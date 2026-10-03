// Package commands

import { Command } from 'commander';
import { DGOSClient } from '@dgos/sdk';
import { config } from '../config.js';
import { formatOutput } from '../format.js';
import ora from 'ora';
import inquirer from 'inquirer';

export function registerPackageCommands(program: Command) {
  const packages = program.command('packages').description('Manage DGOS packages');

  packages
    .command('list')
    .description('List all available packages')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const client = await createClient();
        const packageList = await client.packages.list();

        console.log(formatOutput(packageList, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  packages
    .command('get <packageId>')
    .description('Get package details')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (packageId, options) => {
      try {
        const client = await createClient();
        const pkg = await client.packages.get(packageId);

        console.log(formatOutput(pkg, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  packages
    .command('install <packageId>')
    .description('Install a package')
    .option('-v, --version <version>', 'Specific version to install')
    .action(async (packageId, options) => {
      try {
        const client = await createClient();
        const spinner = ora(`Installing ${packageId}...`).start();

        const installation = await client.packages.install(packageId, options.version);

        spinner.succeed(`Package ${packageId} installed`);
        console.log(formatOutput(installation, 'json'));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  packages
    .command('uninstall <packageId>')
    .description('Uninstall a package')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (packageId, options) => {
      try {
        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to uninstall ${packageId}?`,
              default: false,
            },
          ]);

          if (!confirm) {
            console.log('Cancelled');
            return;
          }
        }

        const client = await createClient();
        const spinner = ora(`Uninstalling ${packageId}...`).start();

        await client.packages.uninstall(packageId);

        spinner.succeed(`Package ${packageId} uninstalled`);
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  packages
    .command('update <packageId> <version>')
    .description('Update a package to a specific version')
    .action(async (packageId, version) => {
      try {
        const client = await createClient();
        const spinner = ora(`Updating ${packageId} to ${version}...`).start();

        const installation = await client.packages.update(packageId, version);

        spinner.succeed(`Package ${packageId} updated to ${version}`);
        console.log(formatOutput(installation, 'json'));
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
