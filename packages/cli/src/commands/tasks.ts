// Task commands

import { Command } from 'commander';
import { DGOSClient } from '@dgos/sdk';
import { config } from '../config.js';
import { formatOutput, formatTaskStatus } from '../format.js';
import ora from 'ora';

export function registerTaskCommands(program: Command) {
  const tasks = program.command('tasks').description('Manage AI tasks');

  tasks
    .command('create <prompt>')
    .description('Create a new AI task')
    .option('-m, --model <model>', 'Model to use')
    .option('-p, --provider <provider>', 'Provider ID to use')
    .option('-w, --wait', 'Wait for task to complete')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (prompt, options) => {
      try {
        const client = await createClient();
        const spinner = ora('Creating task...').start();

        const task = await client.tasks.create({
          prompt,
          model: options.model,
          providerId: options.provider,
        });

        spinner.succeed(`Task created: ${task.taskId}`);

        if (options.wait) {
          spinner.start('Waiting for task to complete...');
          const completedTask = await client.tasks.waitFor(task.taskId, 300000);
          spinner.stop();

          console.log('\nTask Status:', formatTaskStatus(completedTask.status));

          if (completedTask.status === 'completed' && completedTask.result) {
            console.log('\nResult:');
            console.log(formatOutput(completedTask.result, options.format));
          } else if (completedTask.status === 'failed' && completedTask.error) {
            console.error('\nError:');
            console.error(formatOutput(completedTask.error, options.format));
          }
        } else {
          console.log(formatOutput(task, options.format));
        }
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  tasks
    .command('get <taskId>')
    .description('Get task details')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'json')
    .action(async (taskId, options) => {
      try {
        const client = await createClient();
        const task = await client.tasks.get(taskId);

        console.log('Task Status:', formatTaskStatus(task.status));
        console.log(formatOutput(task, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  tasks
    .command('list')
    .description('List tasks')
    .option('-s, --status <status>', 'Filter by status')
    .option('-p, --page <page>', 'Page number', '1')
    .option('--page-size <size>', 'Page size', '20')
    .option('-f, --format <format>', 'Output format (json, table, yaml)', 'table')
    .action(async (options) => {
      try {
        const client = await createClient();
        const tasks = await client.tasks.list({
          status: options.status,
          page: parseInt(options.page),
          pageSize: parseInt(options.pageSize),
        });

        console.log(formatOutput(tasks, options.format));
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  tasks
    .command('cancel <taskId>')
    .description('Cancel a running task')
    .action(async (taskId) => {
      try {
        const client = await createClient();
        const spinner = ora('Cancelling task...').start();

        await client.tasks.cancel(taskId);

        spinner.succeed('Task cancelled');
      } catch (error: any) {
        console.error('Error:', error.message);
        process.exit(1);
      }
    });

  tasks
    .command('stream <taskId>')
    .description('Stream task events')
    .action(async (taskId) => {
      try {
        const client = await createClient();
        console.log(`Streaming events for task ${taskId}...\n`);

        for await (const event of client.tasks.stream(taskId)) {
          console.log(`[${event.type}]`, JSON.stringify(event.data, null, 2));
        }
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
