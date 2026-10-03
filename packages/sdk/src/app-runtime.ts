// DGOS App Runtime API
// Provides the core interfaces and runtime environment for DGOS applications

export interface DGOSAppContext {
  /** Unique application identifier */
  appId: string;
  /** Application version (SemVer) */
  version: string;
  /** Build number */
  build: number;
  /** Runtime environment */
  environment: 'development' | 'production' | 'test';
  /** Installation path (package root) */
  installPath: string;
  /** Application data storage path */
  dataPath: string;
  /** Current instance ID */
  instanceId: string;
  /** System locale */
  locale: string;
  /** UI appearance mode */
  appearance: 'light' | 'dark' | 'auto';
}

export interface DGOSAppLifecycle {
  // Installation lifecycle
  /**
   * Called when the application is first installed
   * Use this to set up initial data and configuration
   */
  onInstall?(): void | Promise<void>;

  /**
   * Called before the application is uninstalled
   * Use this to clean up data and notify users
   */
  onUninstall?(): void | Promise<void>;

  /**
   * Called before an update is applied (while old version is still active)
   * @param fromVersion - Current version being upgraded from
   * @param toVersion - Target version being upgraded to
   */
  onUpdateBefore?(fromVersion: string, toVersion: string): void | Promise<void>;

  /**
   * Called after an update is applied (new version is now active)
   * @param fromVersion - Previous version that was upgraded from
   * @param fromDataVersion - Previous data version
   */
  onUpdate?(fromVersion: string, fromDataVersion: number): void | Promise<void>;

  // Activation lifecycle
  /**
   * Called when the application is activated/launched
   * Use this to initialize your application state
   */
  onActivate(): void | Promise<void>;

  /**
   * Called when the application is deactivated/closed
   * Use this to clean up resources and save state
   */
  onDeactivate(): void | Promise<void>;

  // Window lifecycle
  /**
   * Called when the application window becomes visible
   */
  onShow?(): void | Promise<void>;

  /**
   * Called when the application window is hidden
   */
  onHide?(): void | Promise<void>;

  /**
   * Called when the application window receives focus
   */
  onFocus?(): void | Promise<void>;

  /**
   * Called when the application window loses focus
   */
  onBlur?(): void | Promise<void>;

  /**
   * Called when the application window is resized
   * @param width - New window width
   * @param height - New window height
   */
  onResize?(width: number, height: number): void | Promise<void>;

  // System event lifecycle
  /**
   * Called when the system detects low memory conditions
   * @param level - Severity level of memory pressure
   */
  onMemoryWarning?(level: 'low' | 'critical'): void | Promise<void>;

  /**
   * Called when network connectivity changes
   * @param status - Current network status
   */
  onNetworkChange?(status: NetworkStatus): void | Promise<void>;

  /**
   * Called when the system theme/appearance changes
   * @param appearance - New appearance mode
   */
  onThemeChange?(appearance: 'light' | 'dark'): void | Promise<void>;

  /**
   * Called when the system locale changes
   * @param locale - New locale identifier
   */
  onLocaleChange?(locale: string): void | Promise<void>;

  // Context change (existing)
  /**
   * Called when application settings or system context changes
   * @param context - Updated application context
   */
  onContextChange?(context: DGOSAppContext): void | Promise<void>;

  // Error handling
  /**
   * Called when an unhandled error occurs in the application
   * @param error - The error that occurred
   */
  onError?(error: Error): void | Promise<void>;
}

export interface DGOSApp extends DGOSAppLifecycle {
  /**
   * Get the current application context
   */
  getContext(): DGOSAppContext;

  /**
   * Access to system APIs
   */
  system: SystemAPI;

  /**
   * Access to storage APIs
   */
  storage: StorageAPI;

  /**
   * Access to AI tasks APIs
   */
  tasks: TasksAPI;

  /**
   * Access to UI APIs
   */
  ui: UIAPI;

  /**
   * Access to permissions APIs
   */
  permissions: PermissionsAPI;

  /**
   * Access to events APIs
   */
  events: EventsAPI;

  /**
   * Access to internationalization APIs
   */
  i18n: I18nAPI;

  /**
   * Access to theme APIs
   */
  theme: ThemeAPI;

  /**
   * Access to router APIs
   */
  router: RouterAPI;

  /**
   * Access to clipboard APIs
   */
  clipboard: ClipboardAPI;

  /**
   * Access to network APIs
   */
  network: NetworkAPI;
}

export interface SystemAPI {
  /**
   * Get system information
   */
  getInfo(): Promise<SystemInfo>;

  /**
   * Get current system context (requires permission)
   */
  getContext(): Promise<SystemContext>;

  /**
   * Subscribe to context changes (requires permission)
   * @param handler - Callback function for context updates
   * @returns Unsubscribe function
   */
  onContextChange(handler: (context: SystemContext) => void): () => void;

  /**
   * Get memory usage information
   */
  getMemoryInfo(): Promise<MemoryInfo>;

  /**
   * Get CPU information
   */
  getCPUInfo(): Promise<CPUInfo>;

  /**
   * Get system capabilities
   */
  getCapabilities(): Promise<SystemCapabilities>;

  /**
   * Get battery status (if available)
   */
  getBatteryStatus(): Promise<BatteryStatus | null>;
}

export interface StorageAPI {
  /**
   * Key-Value storage (application private)
   */
  kv: {
    get<T = any>(key: string): Promise<T | null>;
    set(key: string, value: any): Promise<void>;
    delete(key: string): Promise<void>;
    list(prefix?: string): Promise<string[]>;
    clear(): Promise<void>;
  };

  /**
   * File storage operations
   */
  files: {
    read(path: string): Promise<Uint8Array>;
    readText(path: string): Promise<string>;
    write(path: string, data: Uint8Array | string): Promise<void>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    list(directory?: string): Promise<FileInfo[]>;
    mkdir(directory: string): Promise<void>;
  };

  /**
   * Database operations (SQLite for app)
   */
  db: {
    query<T = any>(sql: string, params?: any[]): Promise<T[]>;
    execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number }>;
    transaction<T>(fn: (tx: DatabaseTransaction) => Promise<T>): Promise<T>;
  };
}

export interface TasksAPI {
  /**
   * List available models for task execution
   */
  listModels(options?: { providerConfigId?: string }): Promise<ModelInfo[]>;

  /**
   * Submit an AI task
   */
  submit(request: TaskSubmitRequest): Promise<TaskReceipt>;

  /**
   * Get task status and result
   */
  get(taskId: string): Promise<TaskSnapshot>;

  /**
   * Stream task events
   */
  events(taskId: string, cursor?: number): Promise<TaskEventBatch>;

  /**
   * Cancel a running task
   */
  cancel(taskId: string): Promise<TaskSnapshot>;

  /**
   * Read artifact content
   */
  readArtifact(artifactId: string): Promise<ArtifactContent>;
}

export interface UIAPI {
  /**
   * Show a notification
   */
  notify(options: NotificationOptions): Promise<void>;

  /**
   * Show an alert dialog
   */
  alert(message: string, title?: string): Promise<void>;

  /**
   * Show a confirmation dialog
   */
  confirm(message: string, title?: string): Promise<boolean>;

  /**
   * Show a prompt dialog
   */
  prompt(message: string, defaultValue?: string, title?: string): Promise<string | null>;

  /**
   * Window control
   */
  window: {
    setTitle(title: string): void;
    resize(width: number, height: number): void;
    minimize(): void;
    maximize(): void;
    close(): void;
  };

  /**
   * Show a toast message
   */
  toast(message: string, options?: ToastOptions): void;
}

export interface PermissionsAPI {
  /**
   * Request a permission
   */
  request(capability: string, reason: string): Promise<PermissionResult>;

  /**
   * Request multiple permissions at once
   */
  requestBatch(requests: PermissionRequest[]): Promise<PermissionResult[]>;

  /**
   * Request a temporary permission (expires after duration)
   */
  requestTemporary(
    capability: string,
    reason: string,
    duration: number
  ): Promise<TemporaryPermissionResult>;

  /**
   * Check if permission is granted
   */
  has(capability: string): Promise<boolean>;

  /**
   * Get permission status
   */
  status(capability: string): Promise<PermissionStatus>;

  /**
   * List all permissions for this app
   */
  list(): Promise<PermissionInfo[]>;

  /**
   * Revoke a granted permission
   */
  revoke(capability: string): Promise<void>;

  /**
   * Get permission history/audit trail
   */
  getHistory(): Promise<PermissionHistoryEntry[]>;
}

// Supporting types

export interface SystemInfo {
  version: string;
  platform: string;
  arch: string;
}

export interface SystemContext {
  contextVersion: number;
  appearance: 'light' | 'dark';
  locale: string;
  grid: { columns: number; rows: number };
  networkSummary: 'online' | 'offline' | 'limited';
}

export interface FileInfo {
  path: string;
  size: number;
  created: Date;
  modified: Date;
  isDirectory: boolean;
}

export interface DatabaseTransaction {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<{ changes: number; lastInsertRowid: number }>;
}

export interface ModelInfo {
  providerConfigId: string;
  modelId: string;
  name: string;
  description?: string;
  capabilities: string[];
}

export interface TaskSubmitRequest {
  target: string;
  intent: string;
  input: {
    text: string;
    [key: string]: any;
  };
  options?: {
    providerConfigId?: string;
    modelId?: string;
    parameters?: Record<string, any>;
  };
}

export interface TaskReceipt {
  taskId: string;
  status: string;
  createdAt: string;
}

export interface TaskSnapshot {
  taskId: string;
  status: string;
  result?: any;
  error?: any;
  createdAt: string;
  updatedAt: string;
}

export interface TaskEventBatch {
  items: TaskEvent[];
  cursor: number;
  hasMore: boolean;
}

export interface TaskEvent {
  sequence: number;
  type: string;
  data: any;
  timestamp: string;
}

export interface ArtifactContent {
  artifactId: string;
  content: string;
  mimeType: string;
}

export interface NotificationOptions {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
}

export interface ToastOptions {
  type?: 'info' | 'success' | 'warning' | 'error';
  duration?: number;
  position?: 'top' | 'bottom';
}

export interface PermissionResult {
  capability: string;
  granted: boolean;
  reason?: string;
}

export type PermissionStatus = 'granted' | 'denied' | 'prompt';

export interface PermissionInfo {
  capability: string;
  status: PermissionStatus;
  grantedAt?: string;
}

/**
 * Define a DGOS application
 * This is the main entry point for creating a DGOS app
 */
export function defineApp(app: DGOSAppLifecycle): void {
  // App definition will be processed by the DGOS runtime
  if (typeof window !== 'undefined') {
    (window as any).__DGOS_APP__ = app;
  }
}

// New API interfaces for enhanced functionality

export interface EventsAPI {
  /**
   * Subscribe to system events
   */
  on(eventType: string, handler: (event: AppEvent) => void): () => void;

  /**
   * Emit an event (requires permission)
   */
  emit(eventType: string, data: any): Promise<void>;

  /**
   * Subscribe to events from another app
   */
  subscribe(appId: string, eventType: string, handler: (event: AppEvent) => void): () => void;

  /**
   * Subscribe to memory warnings
   */
  onMemoryWarning(handler: (level: 'low' | 'critical') => void): () => void;

  /**
   * Subscribe to network changes
   */
  onNetworkChange(handler: (status: NetworkStatus) => void): () => void;

  /**
   * Subscribe to theme changes
   */
  onThemeChange(handler: (theme: 'light' | 'dark') => void): () => void;
}

export interface I18nAPI {
  /**
   * Get current locale
   */
  getLocale(): string;

  /**
   * Translate a key
   */
  t(key: string, params?: Record<string, any>): string;

  /**
   * Get localized text from manifest format
   */
  getText(localizedText: Record<string, string>): string;

  /**
   * Format a number according to locale
   */
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string;

  /**
   * Format a date according to locale
   */
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string;

  /**
   * Format currency
   */
  formatCurrency(value: number, currency: string): string;

  /**
   * Subscribe to locale changes
   */
  onLocaleChange(handler: (locale: string) => void): () => void;
}

export interface ThemeAPI {
  /**
   * Get current theme tokens
   */
  getTokens(): Promise<DesignTokens>;

  /**
   * Get current appearance mode
   */
  getAppearance(): 'light' | 'dark' | 'auto';

  /**
   * Get a semantic color value
   */
  getSemanticColor(name: string): Promise<string>;

  /**
   * Subscribe to theme changes
   */
  onChange(handler: (tokens: DesignTokens) => void): () => void;
}

export interface RouterAPI {
  /**
   * Navigate to a route within the app
   */
  push(path: string, state?: any): void;

  /**
   * Replace current route
   */
  replace(path: string, state?: any): void;

  /**
   * Go back in history
   */
  back(): void;

  /**
   * Go forward in history
   */
  forward(): void;

  /**
   * Get current location
   */
  getLocation(): RouterLocation;

  /**
   * Subscribe to deep link events
   */
  onDeepLink(handler: (url: string) => void): () => void;

  /**
   * Register a route handler
   */
  registerRoute(pattern: string, handler: RouteHandler): void;
}

export interface ClipboardAPI {
  /**
   * Read clipboard content (requires permission)
   */
  read(): Promise<ClipboardData>;

  /**
   * Read clipboard text (requires permission)
   */
  readText(): Promise<string>;

  /**
   * Write to clipboard
   */
  write(data: ClipboardData): Promise<void>;

  /**
   * Write text to clipboard
   */
  writeText(text: string): Promise<void>;

  /**
   * Check clipboard permission
   */
  hasPermission(): Promise<boolean>;
}

export interface NetworkAPI {
  /**
   * Make an HTTP request (URL must be in allowlist)
   */
  fetch(url: string, options?: RequestInit): Promise<Response>;

  /**
   * Check if a URL is allowed by the allowlist
   */
  isAllowed(url: string): boolean;

  /**
   * Get current network status
   */
  getStatus(): Promise<NetworkStatus>;

  /**
   * Subscribe to network status changes
   */
  onStatusChange(handler: (status: NetworkStatus) => void): () => void;
}

// Supporting types for new APIs

export interface AppEvent {
  type: string;
  data: any;
  timestamp: string;
  source?: string;
}

export interface NetworkStatus {
  online: boolean;
  type?: 'wifi' | 'cellular' | 'ethernet' | 'unknown';
  effectiveType?: '4g' | '3g' | '2g' | 'slow-2g';
  downlink?: number;
  rtt?: number;
}

export interface MemoryInfo {
  totalJSHeapSize: number;
  usedJSHeapSize: number;
  jsHeapSizeLimit: number;
}

export interface CPUInfo {
  cores: number;
  architecture: string;
  model?: string;
}

export interface SystemCapabilities {
  clipboard: boolean;
  geolocation: boolean;
  notifications: boolean;
  storage: boolean;
  indexedDB: boolean;
  webGL: boolean;
  webAssembly: boolean;
}

export interface BatteryStatus {
  level: number;
  charging: boolean;
  chargingTime: number | null;
  dischargingTime: number | null;
}

export interface PermissionRequest {
  capability: string;
  reason: string;
}

export interface TemporaryPermissionResult extends PermissionResult {
  expiresAt: string;
  duration: number;
}

export interface PermissionHistoryEntry {
  capability: string;
  action: 'requested' | 'granted' | 'denied' | 'revoked';
  timestamp: string;
  reason?: string;
}

export interface DesignTokens {
  colors: Record<string, string>;
  typography: Record<string, any>;
  spacing: Record<string, string>;
  borderRadius: Record<string, string>;
  shadows: Record<string, string>;
}

export interface RouterLocation {
  path: string;
  search: string;
  hash: string;
  state?: any;
}

export type RouteHandler = (params: Record<string, string>) => void | Promise<void>;

export interface ClipboardData {
  text?: string;
  html?: string;
  image?: Blob;
  files?: File[];
}
