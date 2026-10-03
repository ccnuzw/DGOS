// System commands

import { Command } from 'commander';
import { DGOSClient } from '@dgos/sdk';
import { config } from '../config.js';
import { formatOutput } from '../format.js';

export function registerSystemCommands(program: Command) {
  const system = program.command('system').description('System information and settings');

  system
    .command('info')
    .description('Get system information')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (options) => {
      try {
        const client = await createClient();
        const info = await client.system.info();

        console.log(formatOutput(info, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  system
    .command('health')
    .description('Check system health')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (options) => {
      try {
        const client = await createClient();
        const health = await client.system.health();

        console.log(formatOutput(health, options.format));

        if (health.status !== 'healthy') {
          process.exit(1);
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  system
    .command('settings')
    .description('Get system settings')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (options) => {
      try {
        const client = await createClient();
        const settings = await client.system.getSettings();

        console.log(formatOutput(settings, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });
}

async function createClient(): Promise<DGOSClient> {
  await config.load();
  const baseUrl = config.getBaseUrl();
  const apiKey = await config.getApiKey();
  const session = await config.getSession();

  return new DGOSClient({
    baseUrl,
    apiKey,
    session,
  });
}
