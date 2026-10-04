// Skill SDK - Developer API for building DGOS Skills

import type { SkillManifest, SkillContext, SkillResult } from '@dgos/skill-runtime';

// Skill API available to skill handlers
export interface SkillAPI {
  // System capabilities
  system: SystemAPI;

  // Storage
  storage: StorageAPI;

  // AI tasks
  tasks: TasksAPI;

  // UI interactions
  ui: UIAPI;

  // HTTP requests
  http: HttpAPI;

  // Tool invocations
  tools: ToolsAPI;

  // Logging
  log: LogAPI;

  // Skill communication
  skills: SkillsAPI;
}

export interface SystemAPI {
  getVersion(): Promise<string>;
  getPlatform(): Promise<string>;
  getEnvironment(key: string): Promise<string | undefined>;
}

export interface StorageAPI {
  get(key: string): Promise<any>;
  set(key: string, value: any): Promise<void>;
  delete(key: string): Promise<void>;
  list(prefix?: string): Promise<string[]>;
  clear(): Promise<void>;
}

type MockStorageAPI = StorageAPI & { data: Map<string, any> };

export interface TasksAPI {
  create(request: {
    prompt: string;
    model?: string;
    parameters?: Record<string, any>;
  }): Promise<{ taskId: string }>;

  getStatus(taskId: string): Promise<{
    status: string;
    result?: any;
    error?: string;
  }>;

  cancel(taskId: string): Promise<void>;
}

export interface UIAPI {
  showNotification(message: string, type?: 'info' | 'success' | 'warning' | 'error'): Promise<void>;
  showDialog(options: {
    title: string;
    message: string;
    buttons: string[];
  }): Promise<string>;
  prompt(message: string, defaultValue?: string): Promise<string | null>;
}

export interface HttpAPI {
  get(url: string, options?: RequestInit): Promise<any>;
  post(url: string, body: any, options?: RequestInit): Promise<any>;
  put(url: string, body: any, options?: RequestInit): Promise<any>;
  delete(url: string, options?: RequestInit): Promise<any>;
  fetch(url: string, options?: RequestInit): Promise<Response>;
}

export interface ToolsAPI {
  invoke(toolId: string, parameters: Record<string, any>): Promise<any>;
  list(): Promise<Array<{ toolId: string; name: string; description: string }>>;
}

export interface LogAPI {
  debug(message: string, context?: Record<string, any>): void;
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, context?: Record<string, any>): void;
}

export interface SkillsAPI {
  invoke(skillId: string, parameters: Record<string, any>): Promise<any>;
  exists(skillId: string): Promise<boolean>;
  list(): Promise<Array<{ skillId: string; name: string }>>;
}

// Skill handler type
export type SkillHandler = (
  context: SkillContext,
  api: SkillAPI
) => Promise<SkillResult>;

// Skill definition
export interface SkillDefinition {
  manifest: SkillManifest;
  handler: SkillHandler;
}

/**
 * Define a skill
 */
export function defineSkill(definition: SkillDefinition): SkillDefinition {
  // Validate manifest
  validateManifest(definition.manifest);

  return definition;
}

function validateManifest(manifest: SkillManifest): void {
  if (!manifest.skillId || !/^[a-z0-9_][a-z0-9_.-]*$/.test(manifest.skillId)) {
    throw new Error('Invalid skillId format');
  }

  if (!manifest.version || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
    throw new Error('Invalid version format (use semantic versioning)');
  }

  if (!manifest.name?.en || !manifest.name?.zh) {
    throw new Error('Name required in both English and Chinese');
  }

  if (!manifest.description?.en || !manifest.description?.zh) {
    throw new Error('Description required in both English and Chinese');
  }

  if (!manifest.triggers || manifest.triggers.length === 0) {
    throw new Error('At least one trigger is required');
  }

  if (!manifest.category) {
    throw new Error('Category is required');
  }
}

/**
 * Create a mock API for testing
 */
export function createMockAPI(): SkillAPI {
  return {
    system: {
      async getVersion() { return '1.0.0'; },
      async getPlatform() { return 'test'; },
      async getEnvironment(key: string) {
        const environment = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env;
        return environment?.[key];
      },
    },
    storage: {
      data: new Map<string, any>(),
      async get(key: string) { return this.data.get(key); },
      async set(key: string, value: any) { this.data.set(key, value); },
      async delete(key: string) { this.data.delete(key); },
      async list(prefix?: string) {
        return Array.from(this.data.keys()).filter(k => !prefix || k.startsWith(prefix));
      },
      async clear() { this.data.clear(); },
    } as MockStorageAPI,
    tasks: {
      async create() { return { taskId: 'mock-task-id' }; },
      async getStatus() { return { status: 'succeeded', result: 'mock result' }; },
      async cancel() {},
    },
    ui: {
      async showNotification(message: string) { console.log('[UI]', message); },
      async showDialog() { return 'OK'; },
      async prompt() { return 'mock input'; },
    },
    http: {
      async get(url: string) { return { url }; },
      async post(url: string, body: any) { return { url, body }; },
      async put(url: string, body: any) { return { url, body }; },
      async delete(url: string) { return { url }; },
      async fetch(url: string) { return new Response('{}'); },
    },
    tools: {
      async invoke() { return {}; },
      async list() { return []; },
    },
    log: {
      debug(msg: string, ctx?: any) { console.log('[DEBUG]', msg, ctx); },
      info(msg: string, ctx?: any) { console.log('[INFO]', msg, ctx); },
      warn(msg: string, ctx?: any) { console.warn('[WARN]', msg, ctx); },
      error(msg: string, ctx?: any) { console.error('[ERROR]', msg, ctx); },
    },
    skills: {
      async invoke() { return {}; },
      async exists() { return false; },
      async list() { return []; },
    },
  };
}
