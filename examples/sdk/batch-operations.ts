// Batch operations example

import { DGOSClient } from '@dgos/sdk';

async function main() {
  const client = DGOSClient.withApiKey(
    process.env.DGOS_BASE_URL || 'http://localhost:5000',
    process.env.DGOS_API_KEY || ''
  );

  try {
    // Define multiple prompts
    const prompts = [
      'Write a haiku about mountains',
      'Explain photosynthesis in one sentence',
      'What is the capital of France?',
      'Calculate 123 * 456',
      'Name three programming languages',
    ];

    console.log(`Creating ${prompts.length} tasks...`);

    // Create all tasks in parallel
    const tasks = await Promise.all(
      prompts.map((prompt, index) =>
        client.tasks.create({ prompt }).then((task) => ({
          index,
          prompt,
          taskId: task.taskId,
        }))
      )
    );

    console.log(`Created ${tasks.length} tasks\n`);

    // Wait for all tasks to complete with concurrency control
    const concurrency = 3;
    const results = [];

    for (let i = 0; i < tasks.length; i += concurrency) {
      const batch = tasks.slice(i, i + concurrency);
      console.log(`Processing batch ${Math.floor(i / concurrency) + 1}...`);

      const batchResults = await Promise.all(
        batch.map(async (task) => {
          try {
            const completed = await client.tasks.waitFor(task.taskId, 60000);
            console.log(`  ✓ Task ${task.index + 1} completed`);
            return {
              ...task,
              status: completed.status,
              result: completed.result?.text,
              error: completed.error,
            };
          } catch (error: any) {
            console.error(`  ✗ Task ${task.index + 1} failed:`, error.message);
            return {
              ...task,
              status: 'failed',
              error: error.message,
            };
          }
        })
      );

      results.push(...batchResults);
    }

    // Display results
    console.log('\n=== Results ===\n');
    for (const result of results) {
      console.log(`Task ${result.index + 1}: ${result.prompt}`);
      console.log(`Status: ${result.status}`);
      if (result.result) {
        console.log(`Result: ${result.result.substring(0, 100)}...`);
      }
      if (result.error) {
        console.log(`Error: ${result.error}`);
      }
      console.log('');
    }

    // Summary
    const completed = results.filter((r) => r.status === 'completed').length;
    const failed = results.filter((r) => r.status === 'failed').length;

    console.log('=== Summary ===');
    console.log(`Total: ${results.length}`);
    console.log(`Completed: ${completed}`);
    console.log(`Failed: ${failed}`);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
