// Plugin system for extensible CLI functionality

import * as fs from 'fs/promises';
import * as path from 'path';
import { Command } from 'commander';
import chalk from 'chalk';

export interface PluginMetadata {
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  commands?: string[];
}

export interface Plugin {
  metadata: PluginMetadata;
  register: (program: Command) => void | Promise<void>;
}

export class PluginManager {
  private plugins: Map<string, Plugin> = new Map();
  private pluginDirs: string[] = [];

  constructor(pluginDirs: string[]) {
    this.pluginDirs = pluginDirs;
  }

  async loadPlugins(): Promise<void> {
    for (const dir of this.pluginDirs) {
      try {
        await this.loadPluginsFromDirectory(dir);
      } catch (error) {
        // Directory might not exist or be inaccessible
        console.error(chalk.gray(`Could not load plugins from ${dir}`));
      }
    }
  }

  private async loadPluginsFromDirectory(dir: string): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const pluginPath = path.join(dir, entry.name);
          await this.loadPlugin(pluginPath);
        }
      }
    } catch (error) {
      // Ignore errors
    }
  }

  private async loadPlugin(pluginPath: string): Promise<void> {
    try {
      // Load plugin package.json
      const packageJsonPath = path.join(pluginPath, 'package.json');
      const packageJsonContent = await fs.readFile(packageJsonPath, 'utf-8');
      const packageJson = JSON.parse(packageJsonContent);

      // Check if it's a DGOS CLI plugin
      if (!packageJson.keywords?.includes('dgos-cli-plugin')) {
        return;
      }

      // Load plugin module
      const mainFile = packageJson.main || 'index.js';
      const mainPath = path.join(pluginPath, mainFile);
      const pluginModule = await import(mainPath);

      const plugin: Plugin = {
        metadata: {
          name: packageJson.name,
          version: packageJson.version,
          description: packageJson.description,
          author: packageJson.author,
          homepage: packageJson.homepage,
        },
        register: pluginModule.default || pluginModule.register,
      };

      this.plugins.set(plugin.metadata.name, plugin);
      console.log(chalk.gray(`Loaded plugin: ${plugin.metadata.name}@${plugin.metadata.version}`));
    } catch (error) {
      console.error(chalk.gray(`Failed to load plugin from ${pluginPath}`));
    }
  }

  async registerPlugins(program: Command): Promise<void> {
    for (const [name, plugin] of this.plugins) {
      try {
        await plugin.register(program);
      } catch (error) {
        console.error(chalk.yellow(`Failed to register plugin ${name}`));
      }
    }
  }

  getPlugins(): Plugin[] {
    return Array.from(this.plugins.values());
  }

  getPlugin(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }
}

// Plugin command registration
export function registerPluginCommands(program: Command, pluginManager: PluginManager): void {
  const plugin = program
    .command('plugin')
    .description('Manage CLI plugins');

  // dgos plugin list
  plugin
    .command('list')
    .description('List installed plugins')
    .action(() => {
      const plugins = pluginManager.getPlugins();

      if (plugins.length === 0) {
        console.log(chalk.gray('No plugins installed'));
        return;
      }

      console.log();
      console.log(chalk.bold('Installed Plugins:'));
      console.log();

      for (const p of plugins) {
        console.log(chalk.cyan(`  ${p.metadata.name}`) + chalk.gray(` v${p.metadata.version}`));
        console.log(chalk.gray(`    ${p.metadata.description}`));
        if (p.metadata.author) {
          console.log(chalk.gray(`    Author: ${p.metadata.author}`));
        }
        console.log();
      }
    });

  // dgos plugin install
  plugin
    .command('install')
    .argument('<name>', 'Plugin name or path')
    .option('--global', 'Install globally')
    .description('Install a plugin')
    .action(async (name, options) => {
      console.log(chalk.yellow('Plugin installation not yet implemented'));
      console.log(chalk.gray(`Would install: ${name}`));
    });

  // dgos plugin uninstall
  plugin
    .command('uninstall')
    .argument('<name>', 'Plugin name')
    .description('Uninstall a plugin')
    .action(async (name) => {
      console.log(chalk.yellow('Plugin uninstallation not yet implemented'));
      console.log(chalk.gray(`Would uninstall: ${name}`));
    });

  // dgos plugin create
  plugin
    .command('create')
    .argument('<name>', 'Plugin name')
    .description('Create a new plugin from template')
    .action(async (name) => {
      console.log(chalk.yellow('Plugin creation not yet implemented'));
      console.log(chalk.gray(`Would create plugin: ${name}`));
    });
}

// Example plugin template
export const examplePlugin: Plugin = {
  metadata: {
    name: 'dgos-cli-example',
    version: '1.0.0',
    description: 'Example DGOS CLI plugin',
  },
  register: (program: Command) => {
    const example = program
      .command('example')
      .description('Example plugin command');

    example
      .command('hello')
      .argument('[name]', 'Name to greet')
      .description('Say hello')
      .action((name) => {
        console.log(chalk.green(`Hello, ${name || 'World'}!`));
      });
  },
};
