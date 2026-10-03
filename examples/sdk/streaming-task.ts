// Streaming task events example

import { DGOSClient } from '@dgos/sdk';

async function main() {
  const client = DGOSClient.withApiKey(
    process.env.DGOS_BASE_URL || 'http://localhost:5000',
    process.env.DGOS_API_KEY || ''
  );

  try {
    // Create a task
    console.log('Creating task...');
    const task = await client.tasks.create({
      prompt: 'Explain quantum computing in simple terms',
      model: 'gpt-4',
    });

    console.log('Task created:', task.taskId);
    console.log('Streaming events...\n');

    // Stream task events in real-time
    for await (const event of client.tasks.stream(task.taskId)) {
      console.log(`[${event.type}]`, new Date().toISOString());

      switch (event.type) {
        case 'task.started':
          console.log('  Task started processing');
          break;

        case 'task.progress':
          console.log('  Progress:', event.data.progress || 'unknown');
          break;

        case 'task.chunk':
          // Streaming text chunk
          process.stdout.write(event.data.text || '');
          break;

        case 'task.completed':
          console.log('\n  Task completed successfully');
          break;

        case 'task.failed':
          console.error('  Task failed:', event.data.error);
          break;

        default:
          console.log('  Event data:', JSON.stringify(event.data, null, 2));
      }
    }

    console.log('\nStream ended');
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
