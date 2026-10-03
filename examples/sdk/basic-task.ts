// Basic task creation and execution example

import { DGOSClient } from '@dgos/sdk';

async function main() {
  // Create client with API key
  const client = DGOSClient.withApiKey(
    process.env.DGOS_BASE_URL || 'http://localhost:5000',
    process.env.DGOS_API_KEY || ''
  );

  try {
    // Create a task
    console.log('Creating task...');
    const task = await client.tasks.create({
      prompt: 'Write a short poem about artificial intelligence',
      model: 'gpt-4',
    });

    console.log('Task created:', task.taskId);
    console.log('Status:', task.status);

    // Wait for task to complete
    console.log('\nWaiting for task to complete...');
    const completedTask = await client.tasks.waitFor(task.taskId, 60000);

    console.log('\nTask completed!');
    console.log('Status:', completedTask.status);

    if (completedTask.result) {
      console.log('\nResult:');
      console.log(completedTask.result.text);

      if (completedTask.result.usage) {
        console.log('\nUsage:');
        console.log('- Prompt tokens:', completedTask.result.usage.promptTokens);
        console.log('- Completion tokens:', completedTask.result.usage.completionTokens);
        console.log('- Total tokens:', completedTask.result.usage.totalTokens);
      }
    }

    if (completedTask.error) {
      console.error('\nTask failed with error:');
      console.error(completedTask.error);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
