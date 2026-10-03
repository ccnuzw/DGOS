// Enhanced configuration management with .dgosrc.json support

import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import * as fs from 'fs/promises';

export interface GlobalConfig {
  baseUrl?: string;
  apiKey?: string;
  session?: string;
  defaultProvider?: string;
  defaultModel?: string;
  outputFormat?: 'json' | 'table' | 'yaml';
  autoUpdate?: boolean;
  telemetry?: boolean;
}

export interface ProjectConfig {
  baseUrl?: string;
  defaultProvider?: string;
  defaultModel?: string;
  buildDir?: string;
  port?: number;
  plugins?: string[];
}

const CONFIG_DIR = join(homedir(), '.dgos');
const GLOBAL_CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');
const PROJECT_CONFIG_FILE = '.dgosrc.json';

export class ConfigManagerEnhanced {
  private globalConfig: GlobalConfig = {};
  private projectConfig: ProjectConfig = {};

  async loadAll(): Promise<void> {
    await this.loadGlobalConfig();
    await this.loadProjectConfig();
  }

  async loadGlobalConfig(): Promise<void> {
    try {
      const data = await readFile(GLOBAL_CONFIG_FILE, 'utf-8');
      this.globalConfig = JSON.parse(data);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      this.globalConfig = {};
    }
  }

  async loadProjectConfig(): Promise<void> {
    try {
      const data = await readFile(PROJECT_CONFIG_FILE, 'utf-8');
      this.projectConfig = JSON.parse(data);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      this.projectConfig = {};
    }
  }

  async saveGlobalConfig(): Promise<void> {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(GLOBAL_CONFIG_FILE, JSON.stringify(this.globalConfig, null, 2));
  }

  async saveProjectConfig(): Promise<void> {
    await writeFile(PROJECT_CONFIG_FILE, JSON.stringify(this.projectConfig, null, 2));
  }

  getGlobal<K extends keyof GlobalConfig>(key: K): GlobalConfig[K] {
    return this.globalConfig[key];
  }

  setGlobal<K extends keyof GlobalConfig>(key: K, value: GlobalConfig[K]): void {
    this.globalConfig[key] = value;
  }

  getProject<K extends keyof ProjectConfig>(key: K): ProjectConfig[K] {
    return this.projectConfig[key];
  }

  setProject<K extends keyof ProjectConfig>(key: K, value: ProjectConfig[K]): void {
    this.projectConfig[key] = value;
  }

  // Get value with fallback: project > global > environment > default
  get<T>(key: string, defaultValue?: T): T | undefined {
    // Try project config first
    if (this.projectConfig[key as keyof ProjectConfig] !== undefined) {
      return this.projectConfig[key as keyof ProjectConfig] as T;
    }

    // Try global config
    if (this.globalConfig[key as keyof GlobalConfig] !== undefined) {
      return this.globalConfig[key as keyof GlobalConfig] as T;
    }

    // Try environment variables
    const envKey = `DGOS_${key.toUpperCase().replace(/[A-Z]/g, '_$&')}`;
    if (process.env[envKey]) {
      return process.env[envKey] as T;
    }

    return defaultValue;
  }

  getAllGlobal(): GlobalConfig {
    return { ...this.globalConfig };
  }

  getAllProject(): ProjectConfig {
    return { ...this.projectConfig };
  }

  async saveCredentials(credentials: { apiKey?: string; session?: string }): Promise<void> {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CREDENTIALS_FILE, JSON.stringify(credentials, null, 2));
  }

  async loadCredentials(): Promise<{ apiKey?: string; session?: string }> {
    try {
      const data = await readFile(CREDENTIALS_FILE, 'utf-8');
      return JSON.parse(data);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      return {};
    }
  }

  async clearCredentials(): Promise<void> {
    try {
      await writeFile(CREDENTIALS_FILE, JSON.stringify({}, null, 2));
    } catch (error: any) {
      // Ignore if file doesn't exist
    }
  }

  getBaseUrl(): string {
    return this.get('baseUrl', 'http://localhost:5000')!;
  }

  async getApiKey(): Promise<string | undefined> {
    // Try explicit config
    const configKey = this.get<string>('apiKey');
    if (configKey) return configKey;

    // Try environment
    if (process.env.DGOS_API_KEY) return process.env.DGOS_API_KEY;

    // Try credentials file
    const credentials = await this.loadCredentials();
    return credentials.apiKey;
  }

  async getSession(): Promise<string | undefined> {
    const configSession = this.get<string>('session');
    if (configSession) return configSession;

    const credentials = await this.loadCredentials();
    return credentials.session;
  }

  // Initialize project config
  async initProjectConfig(options: Partial<ProjectConfig>): Promise<void> {
    const defaults: ProjectConfig = {
      buildDir: 'dist',
      port: 3000,
      plugins: [],
      ...options,
    };

    this.projectConfig = defaults;
    await this.saveProjectConfig();
  }

  // Check if we're in a DGOS project
  async isInProject(): Promise<boolean> {
    try {
      await fs.access('dgos.json');
      return true;
    } catch {
      return false;
    }
  }
}

export const configEnhanced = new ConfigManagerEnhanced();
