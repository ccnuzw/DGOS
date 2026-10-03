// Provider management example

import { DGOSClient } from '@dgos/sdk';

async function main() {
  const client = DGOSClient.withApiKey(
    process.env.DGOS_BASE_URL || 'http://localhost:5000',
    process.env.DGOS_API_KEY || ''
  );

  try {
    // 1. Create a provider configuration
    console.log('Creating OpenAI provider...');
    const provider = await client.providers.createConfig({
      displayName: 'My OpenAI Provider',
      protocolType: 'openai-compatible',
      credential: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
      defaultForProtocol: true,
    });

    console.log('Provider created:', provider.providerId);

    // 2. Test the connection
    console.log('\nTesting connection...');
    const test = await client.providers.testConnection({
      protocolType: 'openai-compatible',
      displayName: 'Test Connection',
      credential: {
        apiKey: process.env.OPENAI_API_KEY || '',
      },
    });

    // Wait for test to complete
    let testResult = test;
    while (testResult.status === 'pending') {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      testResult = await client.providers.getConnectionTest(test.testId);
    }

    if (testResult.status === 'passed') {
      console.log('✓ Connection test passed');
    } else {
      console.error('✗ Connection test failed:', testResult.result?.message);
    }

    // 3. Refresh model catalog
    console.log('\nRefreshing model catalog...');
    const models = await client.providers.refreshCatalog(provider.providerId);
    console.log(`Found ${models.length} models`);

    // Display first few models
    console.log('\nAvailable models:');
    models.slice(0, 5).forEach((model) => {
      console.log(`- ${model.displayName}`);
      console.log(`  ID: ${model.modelId}`);
      console.log(`  Capabilities: ${model.capabilities.join(', ')}`);
      if (model.contextWindow) {
        console.log(`  Context: ${model.contextWindow} tokens`);
      }
    });

    // 4. Update model policy
    console.log('\nEnabling specific model...');
    if (models.length > 0) {
      await client.providers.updatePolicy(provider.providerId, {
        modelId: models[0].modelId,
        allowed: true,
        capabilities: ['text-generation'],
      });
      console.log(`✓ Enabled model: ${models[0].displayName}`);
    }

    // 5. List all providers
    console.log('\nListing all providers...');
    const allProviders = await client.providers.listConfigs();
    console.log(`Total providers: ${allProviders.length}`);
    allProviders.forEach((p) => {
      console.log(`- ${p.displayName} (${p.protocolType})`);
      console.log(`  State: ${p.state}`);
    });

    // 6. Get provider details
    console.log('\nProvider details:');
    const details = await client.providers.getConfig(provider.providerId);
    console.log(JSON.stringify(details, null, 2));

    // 7. List model policies
    console.log('\nModel policies:');
    const policies = await client.providers.getPolicies(provider.providerId);
    policies.forEach((policy) => {
      console.log(`- ${policy.modelId}: ${policy.allowed ? 'allowed' : 'blocked'}`);
    });

    // Cleanup (optional)
    // await client.providers.deleteConfig(provider.providerId);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

main();
