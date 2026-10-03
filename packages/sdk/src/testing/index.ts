// DGOS App Testing Utilities
// Provides mocking and testing helpers for DGOS apps

import type {
  DGOSAppContext,
  SystemAPI,
  StorageAPI,
  TasksAPI,
  UIAPI,
  PermissionsAPI,
  SystemInfo,
  SystemContext,
  FileInfo,
  ModelInfo,
  TaskReceipt,
  TaskSnapshot,
  TaskEventBatch,
  ArtifactContent,
  PermissionResult,
  PermissionStatus,
  PermissionInfo,
  PermissionRequest,
  TemporaryPermissionResult,
  PermissionHistoryEntry,
  MemoryInfo,
  CPUInfo,
  SystemCapabilities,
  BatteryStatus,
} from '../app-runtime.js';

/**
 * Create a test app context with default or custom values
 */
export function createTestContext(overrides?: Partial<DGOSAppContext>): DGOSAppContext {
  return {
    appId: 'test.app',
    version: '1.0.0',
    build: 1,
    environment: 'test',
    installPath: '/test/install',
    dataPath: '/test/data',
    instanceId: 'test-instance-123',
    locale: 'en-US',
    appearance: 'light',
    ...overrides,
  };
}

/**
 * Mock permission state
 */
export class MockPermissions {
  private permissions = new Map<string, PermissionStatus>();

  grant(capability: string): void {
    this.permissions.set(capability, 'granted');
  }

  deny(capability: string): void {
    this.permissions.set(capability, 'denied');
  }

  reset(capability?: string): void {
    if (capability) {
      this.permissions.delete(capability);
    } else {
      this.permissions.clear();
    }
  }

  getStatus(capability: string): PermissionStatus {
    return this.permissions.get(capability) || 'prompt';
  }

  createAPI(): PermissionsAPI {
    return {
      request: async (capability: string, reason: string) => {
        const status = this.getStatus(capability);
        if (status === 'prompt') {
          this.grant(capability); // Auto-grant in tests
        }
        return {
          capability,
          granted: this.getStatus(capability) === 'granted',
          reason,
        };
      },

      requestBatch: async (requests: PermissionRequest[]) => {
        return Promise.all(
          requests.map(req => this.createAPI().request(req.capability, req.reason))
        );
      },

      requestTemporary: async (capability: string, reason: string, duration: number) => {
        const status = this.getStatus(capability);
        if (status === 'prompt') {
          this.grant(capability);
        }
        return {
          capability,
          granted: this.getStatus(capability) === 'granted',
          reason,
          expiresAt: new Date(Date.now() + duration).toISOString(),
          duration,
        };
      },

      has: async (capability: string) => {
        return this.getStatus(capability) === 'granted';
      },

      status: async (capability: string) => {
        return this.getStatus(capability);
      },

      list: async () => {
        const items: PermissionInfo[] = [];
        for (const [capability, status] of this.permissions) {
          items.push({
            capability,
            status,
            grantedAt: status === 'granted' ? new Date().toISOString() : undefined,
          });
        }
        return items;
      },

      revoke: async (capability: string) => {
        this.permissions.delete(capability);
      },

      getHistory: async () => {
        const history: PermissionHistoryEntry[] = [];
        for (const [capability, status] of this.permissions) {
          history.push({
            capability,
            action: status === 'granted' ? 'granted' : 'denied',
            timestamp: new Date().toISOString(),
          });
        }
        return history;
      },
    };
  }
}

/**
 * Mock storage with in-memory data
 */
export class MockStorage {
  private kvStore = new Map<string, any>();
  private fileStore = new Map<string, Uint8Array | string>();
  private dbData: any[] = [];

  setKV(key: string, value: any): void {
    this.kvStore.set(key, value);
  }

  getKV(key: string): any {
    return this.kvStore.get(key);
  }

  setFile(path: string, content: Uint8Array | string): void {
    this.fileStore.set(path, content);
  }

  getFile(path: string): Uint8Array | string | undefined {
    return this.fileStore.get(path);
  }

  setDBData(data: any[]): void {
    this.dbData = data;
  }

  createAPI(): StorageAPI {
    return {
      kv: {
        get: async (key: string) => {
          return this.kvStore.get(key) ?? null;
        },
        set: async (key: string, value: any) => {
          this.kvStore.set(key, value);
        },
        delete: async (key: string) => {
          this.kvStore.delete(key);
        },
        list: async (prefix?: string) => {
          const keys = Array.from(this.kvStore.keys());
          return prefix ? keys.filter(k => k.startsWith(prefix)) : keys;
        },
        clear: async () => {
          this.kvStore.clear();
        },
      },

      files: {
        read: async (path: string) => {
          const content = this.fileStore.get(path);
          if (!content) {
            throw new Error(`File not found: ${path}`);
          }
          return typeof content === 'string'
            ? new TextEncoder().encode(content)
            : content;
        },
        readText: async (path: string) => {
          const content = this.fileStore.get(path);
          if (!content) {
            throw new Error(`File not found: ${path}`);
          }
          return typeof content === 'string'
            ? content
            : new TextDecoder().decode(content);
        },
        write: async (path: string, data: Uint8Array | string) => {
          this.fileStore.set(path, data);
        },
        delete: async (path: string) => {
          this.fileStore.delete(path);
        },
        exists: async (path: string) => {
          return this.fileStore.has(path);
        },
        list: async (directory?: string) => {
          const files: FileInfo[] = [];
          for (const path of this.fileStore.keys()) {
            if (!directory || path.startsWith(directory)) {
              files.push({
                path,
                size: 0,
                created: new Date(),
                modified: new Date(),
                isDirectory: false,
              });
            }
          }
          return files;
        },
        mkdir: async (directory: string) => {
          // No-op in mock
        },
      },

      db: {
        query: async (sql: string, params?: any[]) => {
          return this.dbData;
        },
        execute: async (sql: string, params?: any[]) => {
          return { changes: 1, lastInsertRowid: 1 };
        },
        transaction: async (fn: any) => {
          return fn({
            query: async () => this.dbData,
            execute: async () => ({ changes: 1, lastInsertRowid: 1 }),
          });
        },
      },
    };
  }
}

/**
 * Mock UI interactions
 */
export class MockUI {
  public notifications: Array<any> = [];
  public dialogs: Array<any> = [];
  public toasts: Array<any> = [];

  reset(): void {
    this.notifications = [];
    this.dialogs = [];
    this.toasts = [];
  }

  createAPI(): UIAPI {
    return {
      notify: async (options) => {
        this.notifications.push(options);
      },

      alert: async (message: string, title?: string) => {
        this.dialogs.push({ type: 'alert', message, title });
      },

      confirm: async (message: string, title?: string) => {
        this.dialogs.push({ type: 'confirm', message, title });
        return true; // Auto-confirm in tests
      },

      prompt: async (message: string, defaultValue?: string, title?: string) => {
        this.dialogs.push({ type: 'prompt', message, defaultValue, title });
        return defaultValue || 'test-input';
      },

      window: {
        setTitle: (title: string) => {},
        resize: (width: number, height: number) => {},
        minimize: () => {},
        maximize: () => {},
        close: () => {},
      },

      toast: (message: string, options?: any) => {
        this.toasts.push({ message, ...options });
      },
    };
  }
}

/**
 * Mock system API
 */
export class MockSystem {
  private context: SystemContext = {
    contextVersion: 1,
    appearance: 'light',
    locale: 'en-US',
    grid: { columns: 12, rows: 8 },
    networkSummary: 'online',
  };

  setContext(context: Partial<SystemContext>): void {
    this.context = { ...this.context, ...context };
  }

  createAPI(): SystemAPI {
    const handlers = new Set<(context: SystemContext) => void>();

    return {
      getInfo: async () => {
        return {
          version: '1.0.0',
          platform: 'test',
          arch: 'x64',
        };
      },

      getContext: async () => {
        return { ...this.context };
      },

      onContextChange: (handler) => {
        handlers.add(handler);
        return () => handlers.delete(handler);
      },

      getMemoryInfo: async () => {
        return {
          totalJSHeapSize: 10000000,
          usedJSHeapSize: 5000000,
          jsHeapSizeLimit: 20000000,
        };
      },

      getCPUInfo: async () => {
        return {
          cores: 4,
          architecture: 'x64',
          model: 'Test CPU',
        };
      },

      getCapabilities: async () => {
        return {
          clipboard: true,
          geolocation: false,
          notifications: true,
          storage: true,
          indexedDB: true,
          webGL: true,
          webAssembly: true,
        };
      },

      getBatteryStatus: async () => {
        return {
          level: 0.8,
          charging: false,
          chargingTime: null,
          dischargingTime: 3600,
        };
      },
    };
  }

  emitContextChange(): void {
    // Would notify handlers - simplified for testing
  }
}

/**
 * Mock tasks API
 */
export class MockTasks {
  private models: ModelInfo[] = [];
  private tasks = new Map<string, TaskSnapshot>();

  addModel(model: ModelInfo): void {
    this.models.push(model);
  }

  setTaskResult(taskId: string, snapshot: TaskSnapshot): void {
    this.tasks.set(taskId, snapshot);
  }

  createAPI(): TasksAPI {
    return {
      listModels: async (options) => {
        return this.models;
      },

      submit: async (request) => {
        const taskId = `task-${Date.now()}`;
        const snapshot: TaskSnapshot = {
          taskId,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        this.tasks.set(taskId, snapshot);
        return {
          taskId,
          status: 'pending',
          createdAt: snapshot.createdAt,
        };
      },

      get: async (taskId: string) => {
        const task = this.tasks.get(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        return task;
      },

      events: async (taskId: string, cursor?: number) => {
        return {
          items: [],
          cursor: cursor ?? 0,
          hasMore: false,
        };
      },

      cancel: async (taskId: string) => {
        const task = this.tasks.get(taskId);
        if (!task) {
          throw new Error(`Task not found: ${taskId}`);
        }
        task.status = 'cancelled';
        return task;
      },

      readArtifact: async (artifactId: string) => {
        return {
          artifactId,
          content: 'test content',
          mimeType: 'text/plain',
        };
      },
    };
  }
}

/**
 * Create a complete mock app environment for testing
 */
export function createTestApp(options: {
  context?: Partial<DGOSAppContext>;
  permissions?: MockPermissions;
  storage?: MockStorage;
  ui?: MockUI;
  system?: MockSystem;
  tasks?: MockTasks;
} = {}) {
  const context = createTestContext(options.context);
  const permissions = options.permissions || new MockPermissions();
  const storage = options.storage || new MockStorage();
  const ui = options.ui || new MockUI();
  const system = options.system || new MockSystem();
  const tasks = options.tasks || new MockTasks();

  return {
    context,
    permissions,
    storage,
    ui,
    system,
    tasks,
    getContext: () => context,
    api: {
      system: system.createAPI(),
      storage: storage.createAPI(),
      tasks: tasks.createAPI(),
      ui: ui.createAPI(),
      permissions: permissions.createAPI(),
    },
  };
}

/**
 * Helper to mock a permission grant
 */
export function mockPermission(capability: string, granted: boolean): MockPermissions {
  const mock = new MockPermissions();
  if (granted) {
    mock.grant(capability);
  } else {
    mock.deny(capability);
  }
  return mock;
}

/**
 * Helper to mock storage with initial data
 */
export function mockStorage(data: Record<string, any>): MockStorage {
  const mock = new MockStorage();
  for (const [key, value] of Object.entries(data)) {
    mock.setKV(key, value);
  }
  return mock;
}

// Export additional testing utilities (commented out until compiled)
// export * from './assertions.js';
// export * from './performance.js';
// export * from './accessibility.js';
// export * from './snapshot.js';
// export * from './e2e-helpers.js';
