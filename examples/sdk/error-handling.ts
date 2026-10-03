// Error handling example

import {
  DGOSClient,
  AuthenticationError,
  ValidationError,
  RateLimitError,
  NotFoundError,
  ConflictError,
  PermissionError,
  ServerError,
  NetworkError,
  TimeoutError,
} from '@dgos/sdk';

async function main() {
  const client = DGOSClient.withApiKey(
    process.env.DGOS_BASE_URL || 'http://localhost:5000',
    process.env.DGOS_API_KEY || ''
  );

  // Example 1: Handle authentication errors
  try {
    const invalidClient = DGOSClient.withApiKey('http://localhost:5000', 'invalid-key');
    await invalidClient.tasks.list();
  } catch (error) {
    if (error instanceof AuthenticationError) {
      console.error('Authentication failed:', error.message);
      console.error('Please check your API key');
    }
  }

  // Example 2: Handle validation errors
  try {
    await client.tasks.create({
      prompt: '', // Invalid: empty prompt
    });
  } catch (error) {
    if (error instanceof ValidationError) {
      console.error('Validation error:', error.message);
      console.error('Details:', error.details);
    }
  }

  // Example 3: Handle rate limiting
  try {
    // Simulate many requests
    const promises = Array(100)
      .fill(0)
      .map(() => client.tasks.list());
    await Promise.all(promises);
  } catch (error) {
    if (error instanceof RateLimitError) {
      console.error('Rate limited:', error.message);
      if (error.retryAfter) {
        console.log(`Retry after ${error.retryAfter} seconds`);
        // Wait and retry
        await new Promise((resolve) => setTimeout(resolve, error.retryAfter! * 1000));
        // Retry the request
      }
    }
  }

  // Example 4: Handle not found errors
  try {
    await client.tasks.get('non-existent-task-id');
  } catch (error) {
    if (error instanceof NotFoundError) {
      console.error('Task not found:', error.message);
    }
  }

  // Example 5: Handle conflict errors
  try {
    const provider = await client.providers.createConfig({
      displayName: 'Test Provider',
      protocolType: 'openai-compatible',
    });

    // Try to delete with wrong version (will cause conflict)
    await client.providers.deleteConfig(provider.providerId);
  } catch (error) {
    if (error instanceof ConflictError) {
      console.error('Conflict error:', error.message);
      console.log('Resource may have been modified by another request');
    }
  }

  // Example 6: Handle permission errors
  try {
    // Assuming limited scope API key
    await client.identity.createApiKey({
      label: 'Test',
      scopes: ['*'],
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      console.error('Permission denied:', error.message);
      console.log('Your API key does not have sufficient permissions');
    }
  }

  // Example 7: Handle server errors with retry
  try {
    await retryWithBackoff(
      () => client.tasks.create({ prompt: 'Test' }),
      3, // max retries
      1000 // initial delay
    );
  } catch (error) {
    if (error instanceof ServerError) {
      console.error('Server error:', error.message);
      console.log('Retryable:', error.retryable);
    }
  }

  // Example 8: Handle network errors
  try {
    const offlineClient = new DGOSClient({
      baseUrl: 'http://invalid-host:9999',
      timeout: 5000,
    });
    await offlineClient.tasks.list();
  } catch (error) {
    if (error instanceof NetworkError) {
      console.error('Network error:', error.message);
      console.log('Check your internet connection and server URL');
    }
  }

  // Example 9: Handle timeout errors
  try {
    const slowClient = new DGOSClient({
      baseUrl: process.env.DGOS_BASE_URL || 'http://localhost:5000',
      apiKey: process.env.DGOS_API_KEY,
      timeout: 100, // Very short timeout
    });
    await slowClient.tasks.list();
  } catch (error) {
    if (error instanceof TimeoutError) {
      console.error('Request timed out:', error.message);
      console.log('Consider increasing the timeout value');
    }
  }

  // Example 10: Generic error handling
  try {
    await client.tasks.create({ prompt: 'Test' });
  } catch (error: any) {
    console.error('Error occurred:');
    console.error('Message:', error.message);
    console.error('Code:', error.code);
    console.error('Status:', error.statusCode);
    console.error('Details:', error.details);

    // Log for debugging
    if (process.env.DEBUG) {
      console.error('Stack trace:', error.stack);
    }
  }
}

// Helper function: Retry with exponential backoff
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxRetries: number,
  initialDelay: number
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;

      // Don't retry on non-retryable errors
      if (
        error instanceof AuthenticationError ||
        error instanceof ValidationError ||
        error instanceof NotFoundError ||
        error instanceof PermissionError
      ) {
        throw error;
      }

      // Don't retry if it's a server error marked as non-retryable
      if (error instanceof ServerError && !error.retryable) {
        throw error;
      }

      if (attempt < maxRetries) {
        const delay = initialDelay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

main().catch(console.error);
