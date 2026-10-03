// DGOS App Client
// Implementation of app runtime APIs using bridge

import { getBridgeClient } from './bridge-client.js';
import type {
  DGOSApp,
  DGOSAppContext,
  DGOSAppLifecycle,
  SystemAPI,
  StorageAPI,
  TasksAPI,
  UIAPI,
  PermissionsAPI,
  EventsAPI,
  I18nAPI,
  ThemeAPI,
  RouterAPI,
  ClipboardAPI,
  NetworkAPI,
  SystemInfo,
  SystemContext,
  FileInfo,
  ModelInfo,
  TaskSubmitRequest,
  TaskReceipt,
  TaskSnapshot,
  TaskEventBatch,
  ArtifactContent,
  NotificationOptions,
  ToastOptions,
  PermissionResult,
  PermissionStatus,
  PermissionInfo,
  PermissionRequest,
  TemporaryPermissionResult,
  PermissionHistoryEntry,
  AppEvent,
  NetworkStatus,
  MemoryInfo,
  CPUInfo,
  SystemCapabilities,
  BatteryStatus,
  DesignTokens,
  RouterLocation,
  RouteHandler,
  ClipboardData,
} from './app-runtime.js';

export class DGOSAppClient implements DGOSApp {
  private bridge = getBridgeClient();
  private context: DGOSAppContext | null = null;
  private lifecycle: DGOSAppLifecycle;
  private contextChangeHandlers: Set<(context: SystemContext) => void> = new Set();
  private contextPollingInterval: number | null = null;
  private lastContextVersion = 0;
  private lifecycleState: 'inactive' | 'active' | 'visible' | 'focused' = 'inactive';

  public readonly system: SystemAPI;
  public readonly storage: StorageAPI;
  public readonly tasks: TasksAPI;
  public readonly ui: UIAPI;
  public readonly permissions: PermissionsAPI;
  public readonly events: EventsAPI;
  public readonly i18n: I18nAPI;
  public readonly theme: ThemeAPI;
  public readonly router: RouterAPI;
  public readonly clipboard: ClipboardAPI;
  public readonly network: NetworkAPI;

  constructor(lifecycle: DGOSAppLifecycle) {
    this.lifecycle = lifecycle;

    // Initialize API implementations
    this.system = this.createSystemAPI();
    this.storage = this.createStorageAPI();
    this.tasks = this.createTasksAPI();
    this.ui = this.createUIAPI();
    this.permissions = this.createPermissionsAPI();
    this.events = this.createEventsAPI();
    this.i18n = this.createI18nAPI();
    this.theme = this.createThemeAPI();
    this.router = this.createRouterAPI();
    this.clipboard = this.createClipboardAPI();
    this.network = this.createNetworkAPI();

    // Set up lifecycle event listeners
    this.setupLifecycleListeners();
  }

  async initialize(): Promise<void> {
    await this.bridge.initialize();

    // Get initial context
    try {
      const systemContext = await this.system.getContext();
      this.context = {
        appId: '', // Will be populated from launch
        version: '',
        build: 0,
        environment: 'production',
        installPath: '',
        dataPath: '',
        instanceId: this.bridge.getInstanceId() || '',
        locale: systemContext.locale,
        appearance: systemContext.appearance,
      };
      this.lastContextVersion = systemContext.contextVersion;
    } catch (error) {
      // Context read might not be permitted
      console.warn('Could not read initial context:', error);
    }

    // Call lifecycle hook
    this.lifecycleState = 'active';
    await this.lifecycle.onActivate?.();
  }

  async cleanup(): Promise<void> {
    // Stop context polling
    if (this.contextPollingInterval !== null) {
      clearInterval(this.contextPollingInterval);
      this.contextPollingInterval = null;
    }

    // Call lifecycle hook
    this.lifecycleState = 'inactive';
    await this.lifecycle.onDeactivate?.();

    this.bridge.destroy();
  }

  getContext(): DGOSAppContext {
    if (!this.context) {
      throw new Error('App context not initialized');
    }
    return { ...this.context };
  }

  async onActivate(): Promise<void> {
    await this.lifecycle.onActivate?.();
  }

  async onDeactivate(): Promise<void> {
    await this.lifecycle.onDeactivate?.();
  }

  async onUpdate(fromVersion: string, fromDataVersion: number): Promise<void> {
    await this.lifecycle.onUpdate?.(fromVersion, fromDataVersion);
  }

  async onContextChange(context: DGOSAppContext): Promise<void> {
    await this.lifecycle.onContextChange?.(context);
  }

  // New lifecycle methods
  async onInstall(): Promise<void> {
    await this.lifecycle.onInstall?.();
  }

  async onUninstall(): Promise<void> {
    await this.lifecycle.onUninstall?.();
  }

  async onUpdateBefore(fromVersion: string, toVersion: string): Promise<void> {
    await this.lifecycle.onUpdateBefore?.(fromVersion, toVersion);
  }

  async onShow(): Promise<void> {
    if (this.lifecycleState === 'active') {
      this.lifecycleState = 'visible';
    }
    await this.lifecycle.onShow?.();
  }

  async onHide(): Promise<void> {
    if (this.lifecycleState === 'visible' || this.lifecycleState === 'focused') {
      this.lifecycleState = 'active';
    }
    await this.lifecycle.onHide?.();
  }

  async onFocus(): Promise<void> {
    if (this.lifecycleState === 'visible') {
      this.lifecycleState = 'focused';
    }
    await this.lifecycle.onFocus?.();
  }

  async onBlur(): Promise<void> {
    if (this.lifecycleState === 'focused') {
      this.lifecycleState = 'visible';
    }
    await this.lifecycle.onBlur?.();
  }

  async onResize(width: number, height: number): Promise<void> {
    await this.lifecycle.onResize?.(width, height);
  }

  async onMemoryWarning(level: 'low' | 'critical'): Promise<void> {
    await this.lifecycle.onMemoryWarning?.(level);
  }

  async onNetworkChange(status: NetworkStatus): Promise<void> {
    await this.lifecycle.onNetworkChange?.(status);
  }

  async onThemeChange(appearance: 'light' | 'dark'): Promise<void> {
    if (this.context) {
      this.context.appearance = appearance;
    }
    await this.lifecycle.onThemeChange?.(appearance);
  }

  async onLocaleChange(locale: string): Promise<void> {
    if (this.context) {
      this.context.locale = locale;
    }
    await this.lifecycle.onLocaleChange?.(locale);
  }

  async onError(error: Error): Promise<void> {
    await this.lifecycle.onError?.(error);
  }

  private setupLifecycleListeners(): void {
    // Listen for visibility changes
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.hidden) {
          this.onHide().catch(console.error);
        } else {
          this.onShow().catch(console.error);
        }
      });

      // Listen for focus/blur
      window.addEventListener('focus', () => {
        this.onFocus().catch(console.error);
      });

      window.addEventListener('blur', () => {
        this.onBlur().catch(console.error);
      });

      // Listen for resize
      window.addEventListener('resize', () => {
        this.onResize(window.innerWidth, window.innerHeight).catch(console.error);
      });

      // Set up global error handler
      window.addEventListener('error', (event) => {
        this.onError(event.error).catch(console.error);
      });

      window.addEventListener('unhandledrejection', (event) => {
        this.onError(new Error(event.reason)).catch(console.error);
      });
    }
  }

  private createSystemAPI(): SystemAPI {
    return {
      getInfo: async () => {
        return this.bridge.invoke<SystemInfo>('dgos.system.info', {});
      },

      getContext: async () => {
        const result = await this.bridge.invoke<SystemContext>('dgos.system.context.read', {});
        return result;
      },

      onContextChange: (handler) => {
        this.contextChangeHandlers.add(handler);

        // Start polling if not already started
        if (this.contextPollingInterval === null && this.contextChangeHandlers.size > 0) {
          this.startContextPolling();
        }

        // Return unsubscribe function
        return () => {
          this.contextChangeHandlers.delete(handler);

          // Stop polling if no more handlers
          if (this.contextChangeHandlers.size === 0 && this.contextPollingInterval !== null) {
            clearInterval(this.contextPollingInterval);
            this.contextPollingInterval = null;
          }
        };
      },

      getMemoryInfo: async () => {
        return this.bridge.invoke<MemoryInfo>('dgos.system.memory.info', {});
      },

      getCPUInfo: async () => {
        return this.bridge.invoke<CPUInfo>('dgos.system.cpu.info', {});
      },

      getCapabilities: async () => {
        return this.bridge.invoke<SystemCapabilities>('dgos.system.capabilities', {});
      },

      getBatteryStatus: async () => {
        return this.bridge.invoke<BatteryStatus | null>('dgos.system.battery.status', {});
      },
    };
  }

  private async startContextPolling(): Promise<void> {
    const poll = async () => {
      try {
        const batch = await this.bridge.invoke<{ items: SystemContext[]; cursor: number }>(
          'dgos.system.context.events',
          { cursor: this.lastContextVersion }
        );

        if (batch.items.length > 0) {
          const latestContext = batch.items[batch.items.length - 1];
          this.lastContextVersion = batch.cursor;

          // Update local context
          if (this.context) {
            this.context.locale = latestContext.locale;
            this.context.appearance = latestContext.appearance;
          }

          // Notify handlers
          for (const handler of this.contextChangeHandlers) {
            try {
              handler(latestContext);
            } catch (error) {
              console.error('Error in context change handler:', error);
            }
          }

          // Notify lifecycle hook
          if (this.context) {
            await this.lifecycle.onContextChange?.(this.context);
          }
        }
      } catch (error) {
        console.error('Error polling context:', error);
      }
    };

    // Poll every 2 seconds
    this.contextPollingInterval = window.setInterval(poll, 2000) as any;
  }

  private createStorageAPI(): StorageAPI {
    return {
      kv: {
        get: async <T = any>(key: string) => {
          return this.bridge.invoke<T | null>('dgos.storage.kv.get', { key });
        },
        set: async (key: string, value: any) => {
          await this.bridge.invoke('dgos.storage.kv.set', { key, value });
        },
        delete: async (key: string) => {
          await this.bridge.invoke('dgos.storage.kv.delete', { key });
        },
        list: async (prefix?: string) => {
          return this.bridge.invoke<string[]>('dgos.storage.kv.list', { prefix });
        },
        clear: async () => {
          await this.bridge.invoke('dgos.storage.kv.clear', {});
        },
      },

      files: {
        read: async (path: string) => {
          const result = await this.bridge.invoke<{ data: string }>('dgos.storage.file.read', { path });
          // Assume base64 encoded
          return Uint8Array.from(atob(result.data), c => c.charCodeAt(0));
        },
        readText: async (path: string) => {
          return this.bridge.invoke<string>('dgos.storage.file.readText', { path });
        },
        write: async (path: string, data: Uint8Array | string) => {
          const content = typeof data === 'string' ? data : btoa(String.fromCharCode(...data));
          await this.bridge.invoke('dgos.storage.file.write', { path, content });
        },
        delete: async (path: string) => {
          await this.bridge.invoke('dgos.storage.file.delete', { path });
        },
        exists: async (path: string) => {
          return this.bridge.invoke<boolean>('dgos.storage.file.exists', { path });
        },
        list: async (directory?: string) => {
          return this.bridge.invoke<FileInfo[]>('dgos.storage.file.list', { directory });
        },
        mkdir: async (directory: string) => {
          await this.bridge.invoke('dgos.storage.file.mkdir', { directory });
        },
      },

      db: {
        query: async <T = any>(sql: string, params?: any[]) => {
          return this.bridge.invoke<T[]>('dgos.storage.db.query', { sql, params });
        },
        execute: async (sql: string, params?: any[]) => {
          return this.bridge.invoke<{ changes: number; lastInsertRowid: number }>(
            'dgos.storage.db.execute',
            { sql, params }
          );
        },
        transaction: async <T>(fn: (tx: any) => Promise<T>) => {
          // Transaction API needs special handling - simplified for V1
          throw new Error('Transactions not yet implemented in V1');
        },
      },
    };
  }

  private createTasksAPI(): TasksAPI {
    return {
      listModels: async (options?: { providerConfigId?: string }) => {
        const result = await this.bridge.invoke<{ items: ModelInfo[] }>(
          'dgos.model.list',
          options || {}
        );
        return result.items;
      },

      submit: async (request: TaskSubmitRequest) => {
        return this.bridge.invoke<TaskReceipt>('dgos.aiTask.submit', request);
      },

      get: async (taskId: string) => {
        return this.bridge.invoke<TaskSnapshot>('dgos.aiTask.get', { taskId });
      },

      events: async (taskId: string, cursor?: number) => {
        return this.bridge.invoke<TaskEventBatch>('dgos.aiTask.events', {
          taskId,
          cursor: cursor ?? 0
        });
      },

      cancel: async (taskId: string) => {
        return this.bridge.invoke<TaskSnapshot>('dgos.aiTask.cancel', { taskId });
      },

      readArtifact: async (artifactId: string) => {
        return this.bridge.invoke<ArtifactContent>('dgos.artifact.read', { artifactId });
      },
    };
  }

  private createUIAPI(): UIAPI {
    return {
      notify: async (options: NotificationOptions) => {
        await this.bridge.invoke('dgos.ui.notify', options);
      },

      alert: async (message: string, title?: string) => {
        await this.bridge.invoke('dgos.ui.alert', { message, title });
      },

      confirm: async (message: string, title?: string) => {
        return this.bridge.invoke<boolean>('dgos.ui.confirm', { message, title });
      },

      prompt: async (message: string, defaultValue?: string, title?: string) => {
        return this.bridge.invoke<string | null>('dgos.ui.prompt', { message, defaultValue, title });
      },

      window: {
        setTitle: (title: string) => {
          this.bridge.invoke('dgos.ui.window.setTitle', { title }).catch(console.error);
        },
        resize: (width: number, height: number) => {
          this.bridge.invoke('dgos.ui.window.resize', { width, height }).catch(console.error);
        },
        minimize: () => {
          this.bridge.invoke('dgos.ui.window.minimize', {}).catch(console.error);
        },
        maximize: () => {
          this.bridge.invoke('dgos.ui.window.maximize', {}).catch(console.error);
        },
        close: () => {
          this.bridge.invoke('dgos.ui.window.close', {}).catch(console.error);
        },
      },

      toast: (message: string, options?: ToastOptions) => {
        this.bridge.invoke('dgos.ui.toast', { message, ...options }).catch(console.error);
      },
    };
  }

  private createPermissionsAPI(): PermissionsAPI {
    return {
      request: async (capability: string, reason: string) => {
        return this.bridge.invoke<PermissionResult>('dgos.permissions.request', {
          capability,
          reason
        });
      },

      requestBatch: async (requests: PermissionRequest[]) => {
        return this.bridge.invoke<PermissionResult[]>('dgos.permissions.requestBatch', {
          requests
        });
      },

      requestTemporary: async (capability: string, reason: string, duration: number) => {
        return this.bridge.invoke<TemporaryPermissionResult>('dgos.permissions.requestTemporary', {
          capability,
          reason,
          duration
        });
      },

      has: async (capability: string) => {
        const result = await this.bridge.invoke<PermissionResult>('dgos.permissions.has', {
          capability
        });
        return result.granted;
      },

      status: async (capability: string) => {
        return this.bridge.invoke<PermissionStatus>('dgos.permissions.status', { capability });
      },

      list: async () => {
        const result = await this.bridge.invoke<{ items: PermissionInfo[] }>(
          'dgos.permissions.list',
          {}
        );
        return result.items;
      },

      revoke: async (capability: string) => {
        await this.bridge.invoke('dgos.permissions.revoke', { capability });
      },

      getHistory: async () => {
        const result = await this.bridge.invoke<{ items: PermissionHistoryEntry[] }>(
          'dgos.permissions.history',
          {}
        );
        return result.items;
      },
    };
  }

  private createEventsAPI(): EventsAPI {
    const eventHandlers = new Map<string, Set<(event: AppEvent) => void>>();

    return {
      on: (eventType: string, handler: (event: AppEvent) => void) => {
        if (!eventHandlers.has(eventType)) {
          eventHandlers.set(eventType, new Set());
        }
        eventHandlers.get(eventType)!.add(handler);

        return () => {
          eventHandlers.get(eventType)?.delete(handler);
        };
      },

      emit: async (eventType: string, data: any) => {
        await this.bridge.invoke('dgos.events.emit', { eventType, data });
      },

      subscribe: (appId: string, eventType: string, handler: (event: AppEvent) => void) => {
        const key = `${appId}:${eventType}`;
        if (!eventHandlers.has(key)) {
          eventHandlers.set(key, new Set());
        }
        eventHandlers.get(key)!.add(handler);

        return () => {
          eventHandlers.get(key)?.delete(handler);
        };
      },

      onMemoryWarning: (handler: (level: 'low' | 'critical') => void) => {
        return this.events.on('system.memory.warning', (event) => {
          handler(event.data.level);
        });
      },

      onNetworkChange: (handler: (status: NetworkStatus) => void) => {
        return this.events.on('system.network.change', (event) => {
          handler(event.data);
        });
      },

      onThemeChange: (handler: (theme: 'light' | 'dark') => void) => {
        return this.events.on('system.theme.change', (event) => {
          handler(event.data.appearance);
        });
      },
    };
  }

  private createI18nAPI(): I18nAPI {
    return {
      getLocale: () => {
        return this.context?.locale || 'en-US';
      },

      t: (key: string, params?: Record<string, any>) => {
        // TODO: Implement translation lookup
        return key;
      },

      getText: (localizedText: Record<string, string>) => {
        const locale = this.context?.locale || 'en-US';
        return localizedText[locale] || localizedText['en-US'] || Object.values(localizedText)[0] || '';
      },

      formatNumber: (value: number, options?: Intl.NumberFormatOptions) => {
        const locale = this.context?.locale || 'en-US';
        return new Intl.NumberFormat(locale, options).format(value);
      },

      formatDate: (date: Date, options?: Intl.DateTimeFormatOptions) => {
        const locale = this.context?.locale || 'en-US';
        return new Intl.DateTimeFormat(locale, options).format(date);
      },

      formatCurrency: (value: number, currency: string) => {
        const locale = this.context?.locale || 'en-US';
        return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(value);
      },

      onLocaleChange: (handler: (locale: string) => void) => {
        return this.system.onContextChange((context) => {
          handler(context.locale);
        });
      },
    };
  }

  private createThemeAPI(): ThemeAPI {
    return {
      getTokens: async () => {
        return this.bridge.invoke<DesignTokens>('dgos.theme.tokens', {});
      },

      getAppearance: () => {
        return this.context?.appearance || 'light';
      },

      getSemanticColor: async (name: string) => {
        const tokens = await this.theme.getTokens();
        return tokens.colors[name] || '#000000';
      },

      onChange: (handler: (tokens: DesignTokens) => void) => {
        return this.events.onThemeChange(async () => {
          const tokens = await this.theme.getTokens();
          handler(tokens);
        });
      },
    };
  }

  private createRouterAPI(): RouterAPI {
    const routeHandlers = new Map<string, RouteHandler>();

    return {
      push: (path: string, state?: any) => {
        if (typeof window !== 'undefined') {
          window.history.pushState(state, '', path);
          window.dispatchEvent(new PopStateEvent('popstate', { state }));
        }
      },

      replace: (path: string, state?: any) => {
        if (typeof window !== 'undefined') {
          window.history.replaceState(state, '', path);
          window.dispatchEvent(new PopStateEvent('popstate', { state }));
        }
      },

      back: () => {
        if (typeof window !== 'undefined') {
          window.history.back();
        }
      },

      forward: () => {
        if (typeof window !== 'undefined') {
          window.history.forward();
        }
      },

      getLocation: () => {
        if (typeof window === 'undefined') {
          return { path: '/', search: '', hash: '', state: null };
        }
        return {
          path: window.location.pathname,
          search: window.location.search,
          hash: window.location.hash,
          state: window.history.state,
        };
      },

      onDeepLink: (handler: (url: string) => void) => {
        // Deep links would be handled by host and forwarded via bridge
        return this.events.on('deeplink', (event) => {
          handler(event.data.url);
        });
      },

      registerRoute: (pattern: string, handler: RouteHandler) => {
        routeHandlers.set(pattern, handler);
      },
    };
  }

  private createClipboardAPI(): ClipboardAPI {
    return {
      read: async () => {
        return this.bridge.invoke<ClipboardData>('dgos.clipboard.read', {});
      },

      readText: async () => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          return navigator.clipboard.readText();
        }
        const data = await this.clipboard.read();
        return data.text || '';
      },

      write: async (data: ClipboardData) => {
        await this.bridge.invoke('dgos.clipboard.write', { data });
      },

      writeText: async (text: string) => {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          await navigator.clipboard.writeText(text);
        } else {
          await this.clipboard.write({ text });
        }
      },

      hasPermission: async () => {
        return this.permissions.has('clipboard.read');
      },
    };
  }

  private createNetworkAPI(): NetworkAPI {
    return {
      fetch: async (url: string, options?: RequestInit) => {
        // Verify URL is in allowlist
        const allowed = await this.bridge.invoke<boolean>('dgos.network.checkUrl', { url });
        if (!allowed) {
          throw new Error(`URL not in network allowlist: ${url}`);
        }

        // Make the request through the bridge
        return this.bridge.invoke<Response>('dgos.network.fetch', { url, options });
      },

      isAllowed: (url: string) => {
        // Sync check against cached allowlist
        // This would need to be populated during initialization
        return true; // Placeholder
      },

      getStatus: async () => {
        return this.bridge.invoke<NetworkStatus>('dgos.network.status', {});
      },

      onStatusChange: (handler: (status: NetworkStatus) => void) => {
        return this.events.on('system.network.change', (event) => {
          handler(event.data);
        });
      },
    };
  }
}
