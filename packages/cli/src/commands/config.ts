// Config commands

import { Command } from 'commander';
import { config } from '../config.js';
import { formatOutput } from '../format.js';

export function registerConfigCommands(program: Command) {
  const configCmd = program.command('config').description('Manage CLI configuration');

  configCmd
    .command('get [key]')
    .description('Get configuration value(s)')
    .action(async (key) => {
      try {
        await config.load();

        if (key) {
          const value = config.get(key as any);
          console.log(value ?? '');
        } else {
          const allConfig = config.getAll();
          console.log(formatOutput(allConfig, 'json'));
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  configCmd
    .command('set <key> <value>')
    .description('Set configuration value')
    .action(async (key, value) => {
      try {
        await config.load();
        config.set(key as any, value);
        await config.save();

        console.log(`Set ${key} = ${value}`);
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  configCmd
    .command('list')
    .description('List all configuration')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (options) => {
      try {
        await config.load();
        const allConfig = config.getAll();

        console.log(formatOutput(allConfig, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}
