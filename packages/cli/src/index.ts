#!/usr/bin/env node

// DGOS CLI main entry point - Enhanced with exceptional developer experience

import { Command } from 'commander';
import chalk from 'chalk';
import { homedir } from 'os';
import { join } from 'path';
import { registerTaskCommands } from './commands/tasks.js';
import { registerProviderCommands } from './commands/providers.js';
import { registerPackageCommands } from './commands/packages.js';
import { registerAuthCommands } from './commands/auth.js';
import { registerConfigCommands } from './commands/config.js';
import { registerSystemCommands } from './commands/system.js';
import { registerAppCommandsEnhanced } from './commands/app-enhanced.js';
import { PluginManager, registerPluginCommands } from './utils/plugin-system.js';
import { configEnhanced } from './utils/config-enhanced.js';

// ASCII Art Banner
const banner = `
${chalk.cyan('╔═══════════════════════════════════════════════════════════════╗')}
${chalk.cyan('║')}  ${chalk.bold.white('DGOS CLI')} - ${chalk.gray('Distributed Governance Operating System')}     ${chalk.cyan('║')}
${chalk.cyan('║')}  ${chalk.gray('The best app development tool for the modern era')}        ${chalk.cyan('║')}
${chalk.cyan('╚═══════════════════════════════════════════════════════════════╝')}
`;

const program = new Command();

program
  .name('dgos')
  .description('DGOS Command Line Interface - Build, deploy, and manage applications')
  .version('1.0.0');

// Global options
program
  .option('-v, --verbose', 'Enable verbose output')
  .option('--base-url <url>', 'Override base URL')
  .option('--api-key <key>', 'Override API key')
  .option('--format <format>', 'Output format (json|table|yaml)', 'table')
  .option('--no-color', 'Disable colored output')
  .option('--silent', 'Suppress non-error output');

// Initialize plugin system
const pluginDirs = [
  join(homedir(), '.dgos', 'plugins'),
  join(process.cwd(), 'node_modules'),
  join(process.cwd(), '.dgos', 'plugins'),
];

const pluginManager = new PluginManager(pluginDirs);

// Main async initialization
async function main() {
  try {
    // Load configuration
    await configEnhanced.loadAll();

    // Load plugins
    await pluginManager.loadPlugins();

    // Register all command groups
    registerTaskCommands(program);
    registerProviderCommands(program);
    registerPackageCommands(program);
    registerAuthCommands(program);
    registerConfigCommands(program);
    registerSystemCommands(program);
    registerAppCommandsEnhanced(program);
    registerPluginCommands(program, pluginManager);

    // Register plugins
    await pluginManager.registerPlugins(program);

    // Add completion command
    program
      .command('completion')
      .argument('[shell]', 'Shell type (bash|zsh|fish)')
      .description('Generate shell completion script')
      .action((shell) => {
        console.log(chalk.yellow('Shell completion generation not yet implemented'));
        console.log(chalk.gray(`Would generate completion for: ${shell || 'current shell'}`));
      });

    // Add init command for new projects
    program
      .command('init')
      .description('Initialize DGOS configuration in current directory')
      .action(async () => {
        const isProject = await configEnhanced.isInProject();
        if (isProject) {
          console.log(chalk.yellow('DGOS project already initialized'));
          return;
        }

        await configEnhanced.initProjectConfig({
          buildDir: 'dist',
          port: 3000,
          plugins: [],
        });

        console.log(chalk.green('✓ Initialized .dgosrc.json'));
      });

    // Add update command
    program
      .command('update')
      .description('Update DGOS CLI to the latest version')
      .action(async () => {
        console.log(chalk.cyan('Checking for updates...'));
        console.log(chalk.yellow('Self-update not yet implemented'));
        console.log(chalk.gray('Use: npm update -g @dgos/cli'));
      });

    // Parse arguments
    program.parse(process.argv);

    // Show banner and help if no command provided
    if (!process.argv.slice(2).length) {
      console.log(banner);
      console.log();
      program.outputHelp();
      console.log();
      console.log(chalk.cyan('Examples:'));
      console.log(chalk.gray('  dgos app create my-app         ') + 'Create a new application');
      console.log(chalk.gray('  dgos app dev                   ') + 'Start development server');
      console.log(chalk.gray('  dgos app build --production    ') + 'Build for production');
      console.log(chalk.gray('  dgos auth login                ') + 'Login to DGOS');
      console.log(chalk.gray('  dgos tasks create "Your task"  ') + 'Create an AI task');
      console.log();
      console.log(chalk.cyan('Documentation:'));
      console.log(chalk.gray('  https://dgos.dev/docs/cli'));
      console.log();
    }
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason) => {
  console.error(chalk.red('Unhandled rejection:'), reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught exception:'), error.message);
  process.exit(1);
});

// Run main
main();
