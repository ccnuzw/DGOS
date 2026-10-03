// Auth commands

import { Command } from 'commander';
import { DGOSClient } from '@dgos/sdk';
import { config } from '../config.js';
import { formatOutput } from '../format.js';
import ora from 'ora';
import inquirer from 'inquirer';

export function registerAuthCommands(program: Command) {
  const auth = program.command('auth').description('Manage authentication');

  auth
    .command('login')
    .description('Login to DGOS')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'username',
            message: 'Username:',
            validate: (input) => input.length > 0,
          },
          {
            type: 'password',
            name: 'password',
            message: 'Password:',
            mask: '*',
            validate: (input) => input.length > 0,
          },
        ]);

        await config.load();
        const baseUrl = config.getBaseUrl();
        const client = new DGOSClient({ baseUrl });

        const spinner = ora('Logging in...').start();

        const session = await client.identity.login(answers.username, answers.password);

        await config.saveCredentials({ session: session.sessionId });

        spinner.succeed('Logged in successfully');
        console.log(`Session ID: ${session.sessionId}`);
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  auth
    .command('logout')
    .description('Logout from DGOS')
    .action(async () => {
      try {
        const client = await createClient();
        const spinner = ora('Logging out...').start();

        await client.identity.logout();
        await config.clearCredentials();

        spinner.succeed('Logged out successfully');
      } catch (error: any) {
        // Clear credentials even if logout fails
        await config.clearCredentials();
        console.log('Logged out (credentials cleared)');
      }
    });

  auth
    .command('status')
    .description('Check authentication status')
    .action(async () => {
      try {
        const client = await createClient();
        const session = await client.identity.getCurrentSession();

        console.log('Authenticated');
        console.log(formatOutput(session, 'json'));
      } catch (error: any) {
        console.log('Not authenticated');
        process.exit(1);
      }
    });

  auth
    .command('create-key')
    .description('Create a new API key')
    .action(async () => {
      try {
        const answers = await inquirer.prompt([
          {
            type: 'input',
            name: 'label',
            message: 'Key label (optional):',
          },
          {
            type: 'checkbox',
            name: 'scopes',
            message: 'Select scopes:',
            choices: [
              { name: 'All scopes (*)', value: '*' },
              { name: 'Read tasks (ai_task.read)', value: 'ai_task.read' },
              { name: 'Submit tasks (ai_task.submit)', value: 'ai_task.submit' },
              { name: 'Cancel tasks (ai_task.cancel)', value: 'ai_task.cancel' },
              { name: 'Read providers (provider.config.read)', value: 'provider.config.read' },
              { name: 'Manage providers (provider.config.manage)', value: 'provider.config.manage' },
            ],
          },
        ]);

        const client = await createClient();
        const spinner = ora('Creating API key...').start();

        const result = await client.identity.createApiKey({
          label: answers.label || undefined,
          scopes: answers.scopes,
        });

        spinner.succeed('API key created');
        console.log('\n⚠️  Save this API key - it will not be shown again!\n');
        console.log('API Key:', result.secret);
        console.log('\nKey ID:', result.keyId);
        console.log('Prefix:', result.prefix);
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  auth
    .command('list-keys')
    .description('List API keys')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const client = await createClient();
        const keys = await client.identity.listApiKeys();

        console.log(formatOutput(keys, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  auth
    .command('revoke-key <keyId>')
    .description('Revoke an API key')
    .option('-y, --yes', 'Skip confirmation')
    .action(async (keyId, options) => {
      try {
        if (!options.yes) {
          const { confirm } = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'confirm',
              message: `Are you sure you want to revoke key ${keyId}?`,
              default: false,
            },
          ]);

          if (!confirm) {
            console.log('Cancelled');
            return;
          }
        }

        const client = await createClient();
        const spinner = ora('Revoking API key...').start();

        await client.identity.revokeApiKey(keyId);

        spinner.succeed('API key revoked');
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

  if (!apiKey && !session) {
    throw new Error('Not authenticated. Run "dgos auth login" first.');
  }

  return new DGOSClient({
    baseUrl,
    apiKey,
    session,
  });
}
