// Provider commands

import { Command } from 'commander';
import { DGOSClient } from '@dgos/sdk';
import { config } from '../config.js';
import { formatOutput } from '../format.js';
import ora from 'ora';
import inquirer from 'inquirer';

export function registerProviderCommands(program: Command) {
  const providers = program.command('providers').description('Manage AI providers');

  providers
    .command('list')
    .description('List all provider configurations')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const client = await createClient();
        const providerList = await client.providers.listConfigs();

        console.log(formatOutput(providerList, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  providers
    .command('get <providerId>')
    .description('Get provider configuration details')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (providerId, options) => {
      try {
        const client = await createClient();
        const provider = await client.providers.getConfig(providerId);

        console.log(formatOutput(provider, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  providers
    .command('configure')
    .description('Configure a new provider interactively')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'displayName',
            message: 'Provider display name:',
            validate: (input) => input.length > 0,
          },
          {
            type: 'list',
            name: 'protocolType',
            message: 'Protocol type:',
            choices: ['openai-compatible', 'anthropic', 'google', 'azure-openai'],
          },
          {
            type: 'input',
            name: 'endpoint',
            message: 'API endpoint (optional):',
          },
          {
            type: 'password',
            name: 'apiKey',
            message: 'API key:',
            mask: '*',
          },
          {
            type: 'confirm',
            name: 'defaultForProtocol',
            message: 'Set as default for this protocol?',
            default: false,
          },
        ]);

        const client = await createClient();
        const spinner = ora('Creating provider configuration...').start();

        const provider = await client.providers.createConfig({
          displayName: answers.displayName,
          protocolType: answers.protocolType,
          credential: { apiKey: answers.apiKey },
          scope: answers.endpoint ? { endpoint: answers.endpoint } : undefined,
          defaultForProtocol: answers.defaultForProtocol,
        });

        spinner.succeed(`Provider configured: ${provider.providerId}`);
        console.log(formatOutput(provider, 'json'));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  providers
    .command('test <providerId>')
    .description('Test provider connection')
    .action(async (providerId) => {
      try {
        const client = await createClient();
        const spinner = ora('Testing connection...').start();

        // Get provider config first
        const provider = await client.providers.getConfig(providerId);

        // Start connection test
        const test = await client.providers.testConnection({
          protocolType: provider.protocolType,
          displayName: provider.displayName,
        });

        // Wait for test to complete
        let testResult = test;
        while (testResult.status === 'pending') {
          await new Promise(resolve => setTimeout(resolve, 1000));
          testResult = await client.providers.getConnectionTest(test.testId);
        }

        if (testResult.status === 'passed') {
          spinner.succeed('Connection test passed');
        } else {
          spinner.fail('Connection test failed');
          if (testResult.result?.message) {
            console.error('Error:', testResult.result.message);
          }
        }

        console.log(formatOutput(testResult, 'json'));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  providers
    .command('models <providerId>')
    .description('List models for a provider')
    .option('-r, --refresh', 'Refresh model catalog')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (providerId, options) => {
      try {
        const client = await createClient();

        if (options.refresh) {
          const spinner = ora('Refreshing model catalog...').start();
          await client.providers.refreshCatalog(providerId);
          spinner.succeed('Model catalog refreshed');
        }

        const models = await client.providers.listModels(providerId);
        console.log(formatOutput(models, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  providers
    .command('delete <providerId>')
    .description('Delete a provider configuration')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (providerId, options) => {
      try {
        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to delete provider ${providerId}?`,
              default: false,
            },
          ]);

          if (!confirm) {
            console.log('Cancelled');
            return;
          }
        }

        const client = await createClient();
        const spinner = ora('Deleting provider...').start();

        await client.providers.deleteConfig(providerId);

        spinner.succeed('Provider deleted');
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
