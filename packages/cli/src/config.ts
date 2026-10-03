// Configuration management for DGOS CLI

import { readFile, writeFile, mkdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';

export interface Config {
  baseUrl?: string;
  apiKey?: string;
  session?: string;
  defaultProvider?: string;
  defaultModel?: string;
  outputFormat?: 'json' | 'table' | 'yaml';
}

const CONFIG_DIR = join(homedir(), '.dgos');
const CONFIG_FILE = join(CONFIG_DIR, 'config.json');
const CREDENTIALS_FILE = join(CONFIG_DIR, 'credentials.json');

export class ConfigManager {
  private config: Config = {};

  async load(): Promise<void> {
    try {
      const data = await readFile(CONFIG_FILE, 'utf-8');
      this.config = JSON.parse(data);
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
      // Config file doesn't exist yet
      this.config = {};
    }
  }

  async save(): Promise<void> {
    await mkdir(CONFIG_DIR, { recursive: true });
    await writeFile(CONFIG_FILE, JSON.stringify(this.config, null, 2));
  }

  get<K extends keyof Config>(key: K): Config[K] {
    return this.config[key];
  }

  set<K extends keyof Config>(key: K, value: Config[K]): void {
    this.config[key] = value;
  }

  getAll(): Config {
    return { ...this.config };
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
    return this.config.baseUrl || process.env.DGOS_BASE_URL || 'http://localhost:5000';
  }

  async getApiKey(): Promise<string | undefined> {
    if (this.config.apiKey) return this.config.apiKey;
    if (process.env.DGOS_API_KEY) return process.env.DGOS_API_KEY;

    const credentials = await this.loadCredentials();
    return credentials.apiKey;
  }

  async getSession(): Promise<string | undefined> {
    if (this.config.session) return this.config.session;

    const credentials = await this.loadCredentials();
    return credentials.session;
  }
}

export const config = new ConfigManager();
