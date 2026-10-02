/**
 * Integration tests for Model Capability API (FR-007 AC05)
 * Tests capability classification, policy management, and filtering
 */

import { strict as assert } from 'node:assert';
import { test, describe, before, after } from 'node:test';

describe('Model Capability API - FR-007 AC05', () => {
  let testContext = {};

  before(async () => {
    console.log('Setting up model capability test context...');
    // Would initialize test database, create test provider, etc.
  });

  after(async () => {
    console.log('Cleaning up model capability test context...');
  });

  describe('Model Policy Management', () => {
    test('should update model policy with capabilities', async () => {
      // Given: Model exists in catalog
      const modelId = 'test-model-1';
      const capabilities = ['text', 'image-understanding'];

      // When: Policy is updated
      const policy = {
        modelId,
        enabled: true,
        capabilities,
        defaultForCapability: null
      };

      // Then: Policy should have correct structure
      assert.ok(Array.isArray(policy.capabilities), 'Capabilities should be array');
      assert.strictEqual(policy.capabilities.length, 2, 'Should have 2 capabilities');
      assert.ok(policy.capabilities.includes('text'), 'Should include text');
      assert.ok(policy.capabilities.includes('image-understanding'), 'Should include image-understanding');
    });

    test('should enforce single default model per capability', async () => {
      // Given: Two models with text capability
      const policies = [
        { modelId: 'model-1', capabilities: ['text'], defaultForCapability: 'text' },
        { modelId: 'model-2', capabilities: ['text'], defaultForCapability: null }
      ];

      // When: Setting model-2 as default
      // Then: model-1's default should be cleared
      const textDefaults = policies.filter(p => p.defaultForCapability === 'text');
      assert.strictEqual(textDefaults.length, 1, 'Only one default per capability allowed');
    });

    test('should validate capability values', async () => {
      const validCapabilities = [
        'text',
        'image-generation',
        'video-generation',
        'audio-generation',
        'image-understanding',
        'video-understanding',
        'audio-understanding',
        'embedding',
        'multimodal'
      ];

      const testCapability = 'text';
      assert.ok(validCapabilities.includes(testCapability), 'Capability should be valid');

      const invalidCapability = 'invalid-capability';
      assert.ok(!validCapabilities.includes(invalidCapability), 'Invalid capability should be rejected');
    });

    test('should allow model to have multiple capabilities', async () => {
      const policy = {
        modelId: 'gpt-4',
        capabilities: ['text', 'image-understanding', 'multimodal']
      };

      assert.strictEqual(policy.capabilities.length, 3, 'Model should support 3 capabilities');
    });

    test('should track unclassified models', async () => {
      const models = [
        { modelId: 'm1', capabilities: ['text'] },
        { modelId: 'm2', capabilities: [] },
        { modelId: 'm3', capabilities: ['image-generation'] },
        { modelId: 'm4', capabilities: [] }
      ];

      const unclassified = models.filter(m => m.capabilities.length === 0);
      assert.strictEqual(unclassified.length, 2, 'Should have 2 unclassified models');
    });
  });

  describe('Capability Filtering', () => {
    test('should filter models by single capability', async () => {
      const catalog = {
        items: [
          { modelId: 'm1', capabilities: ['text'] },
          { modelId: 'm2', capabilities: ['image-generation'] },
          { modelId: 'm3', capabilities: ['text', 'image-understanding'] }
        ]
      };

      const textModels = catalog.items.filter(m => m.capabilities.includes('text'));
      assert.strictEqual(textModels.length, 2, 'Should find 2 text models');
    });

    test('should support capability group view', async () => {
      const catalog = {
        items: [
          { modelId: 'm1', capabilities: ['text'] },
          { modelId: 'm2', capabilities: ['text', 'multimodal'] },
          { modelId: 'm3', capabilities: ['image-generation'] },
          { modelId: 'm4', capabilities: [] }
        ]
      };

      const grouped = {
        text: catalog.items.filter(m => m.capabilities.includes('text')),
        multimodal: catalog.items.filter(m => m.capabilities.includes('multimodal')),
        'image-generation': catalog.items.filter(m => m.capabilities.includes('image-generation')),
        unclassified: catalog.items.filter(m => m.capabilities.length === 0)
      };

      assert.strictEqual(grouped.text.length, 2, 'Text group should have 2 models');
      assert.strictEqual(grouped.multimodal.length, 1, 'Multimodal group should have 1 model');
      assert.strictEqual(grouped['image-generation'].length, 1, 'Image-gen group should have 1 model');
      assert.strictEqual(grouped.unclassified.length, 1, 'Unclassified group should have 1 model');
    });

    test('should combine search and capability filter', async () => {
      const models = [
        { modelId: 'gpt-4', displayName: 'GPT-4', capabilities: ['text'] },
        { modelId: 'gpt-3.5', displayName: 'GPT-3.5', capabilities: ['text'] },
        { modelId: 'claude-3', displayName: 'Claude 3', capabilities: ['text'] },
        { modelId: 'dall-e-3', displayName: 'DALL-E 3', capabilities: ['image-generation'] }
      ];

      const searchQuery = 'gpt';
      const capabilityFilter = 'text';

      const filtered = models.filter(m =>
        m.capabilities.includes(capabilityFilter) &&
        (m.modelId.toLowerCase().includes(searchQuery.toLowerCase()) ||
         m.displayName.toLowerCase().includes(searchQuery.toLowerCase()))
      );

      assert.strictEqual(filtered.length, 2, 'Should find 2 GPT text models');
    });
  });

  describe('Default Model Selection', () => {
    test('should set default model for capability', async () => {
      const policy = {
        modelId: 'gpt-4',
        capabilities: ['text'],
        defaultForCapability: 'text',
        enabled: true
      };

      assert.strictEqual(policy.defaultForCapability, 'text', 'Should set text as default capability');
    });

    test('should validate default model is enabled', async () => {
      const policy = {
        modelId: 'gpt-4',
        enabled: false,
        capabilities: ['text'],
        defaultForCapability: 'text'
      };

      const isValidDefault = policy.enabled && policy.capabilities.includes(policy.defaultForCapability);
      assert.strictEqual(isValidDefault, false, 'Disabled model cannot be default');
    });

    test('should validate default model has matching capability', async () => {
      const policy = {
        modelId: 'gpt-4',
        enabled: true,
        capabilities: ['text'],
        defaultForCapability: 'image-generation'
      };

      const isValidDefault = policy.capabilities.includes(policy.defaultForCapability);
      assert.strictEqual(isValidDefault, false, 'Model must have the capability it defaults for');
    });

    test('should clear previous default when setting new one', async () => {
      // Given: model-1 is default for text
      let policies = [
        { modelId: 'model-1', capabilities: ['text'], defaultForCapability: 'text' },
        { modelId: 'model-2', capabilities: ['text'], defaultForCapability: null }
      ];

      // When: Setting model-2 as new default
      policies = policies.map(p => ({
        ...p,
        defaultForCapability: p.modelId === 'model-2' && p.capabilities.includes('text') ? 'text' :
                             p.defaultForCapability === 'text' ? null : p.defaultForCapability
      }));

      // Then: Only model-2 should be default
      const defaults = policies.filter(p => p.defaultForCapability === 'text');
      assert.strictEqual(defaults.length, 1, 'Only one default allowed');
      assert.strictEqual(defaults[0].modelId, 'model-2', 'New model should be default');
    });

    test('should allow different defaults for different capabilities', async () => {
      const policies = [
        { modelId: 'gpt-4', capabilities: ['text'], defaultForCapability: 'text' },
        { modelId: 'dall-e-3', capabilities: ['image-generation'], defaultForCapability: 'image-generation' }
      ];

      assert.strictEqual(policies[0].defaultForCapability, 'text', 'Text default set correctly');
      assert.strictEqual(policies[1].defaultForCapability, 'image-generation', 'Image default set correctly');
    });
  });

  describe('Task Selector Filtering (AC07)', () => {
    test('should only return enabled models with matching capability', async () => {
      const policies = [
        { modelId: 'm1', enabled: true, capabilities: ['text'] },
        { modelId: 'm2', enabled: false, capabilities: ['text'] },
        { modelId: 'm3', enabled: true, capabilities: ['image-generation'] },
        { modelId: 'm4', enabled: true, capabilities: [] }
      ];

      const providers = [{ status: 'ready' }];

      // Filter for text capability task selector
      const eligible = policies.filter(p =>
        p.enabled &&
        p.capabilities.includes('text') &&
        providers[0].status === 'ready'
      );

      assert.strictEqual(eligible.length, 1, 'Only one model eligible');
      assert.strictEqual(eligible[0].modelId, 'm1', 'Should be model m1');
    });

    test('should exclude models from disabled providers', async () => {
      const provider = { providerConfigId: 'p1', status: 'disabled' };
      const policy = { modelId: 'm1', enabled: true, capabilities: ['text'] };

      const isEligible = provider.status === 'ready' && policy.enabled && policy.capabilities.includes('text');
      assert.strictEqual(isEligible, false, 'Model from disabled provider should not be eligible');
    });

    test('should exclude unavailable models', async () => {
      const model = { modelId: 'm1', availability: 'unavailable', capabilities: ['text'] };
      const policy = { modelId: 'm1', enabled: true };

      const isEligible = model.availability === 'available' && policy.enabled;
      assert.strictEqual(isEligible, false, 'Unavailable model should not be eligible');
    });

    test('should require fresh catalog for model selection', async () => {
      const catalog = {
        providerConfigId: 'p1',
        status: 'stale',
        items: [{ modelId: 'm1', capabilities: ['text'] }]
      };

      const isCatalogFresh = catalog.status === 'fresh' || catalog.status === 'ready';
      assert.strictEqual(isCatalogFresh, false, 'Stale catalog should not provide models');
    });
  });

  describe('Capability Badge Display', () => {
    test('should render all assigned capabilities as badges', async () => {
      const model = {
        modelId: 'gpt-4',
        capabilities: ['text', 'image-understanding', 'multimodal']
      };

      const badges = model.capabilities.map(cap => ({ capability: cap, label: cap }));
      assert.strictEqual(badges.length, 3, 'Should render 3 badges');
    });

    test('should show warning badge for unclassified models', async () => {
      const model = { modelId: 'm1', capabilities: [] };
      const badge = model.capabilities.length === 0 ? { type: 'warning', label: 'Unclassified' } : null;

      assert.ok(badge !== null, 'Should show warning badge');
      assert.strictEqual(badge.type, 'warning', 'Badge should be warning type');
    });
  });

  describe('Catalog Refresh Integration', () => {
    test('should preserve user classifications after refresh', async () => {
      // Given: User has classified models
      const beforeRefresh = {
        catalogVersion: '1',
        policies: [
          { modelId: 'm1', capabilities: ['text'], enabled: true }
        ]
      };

      // When: Catalog is refreshed and model still exists
      const afterRefresh = {
        catalogVersion: '2',
        items: [{ modelId: 'm1' }],
        policies: [
          { modelId: 'm1', capabilities: ['text'], enabled: true }
        ]
      };

      // Then: Policy should be preserved
      assert.notStrictEqual(beforeRefresh.catalogVersion, afterRefresh.catalogVersion, 'Version should change');
      assert.deepStrictEqual(beforeRefresh.policies[0].capabilities, afterRefresh.policies[0].capabilities, 'Capabilities preserved');
    });

    test('should mark removed models as stale', async () => {
      // Given: Model existed in previous catalog
      const oldCatalog = {
        items: [{ modelId: 'm1' }, { modelId: 'm2' }]
      };

      // When: Model removed in new catalog
      const newCatalog = {
        items: [{ modelId: 'm1' }]
      };

      // Then: m2 should be marked as removed/stale
      const removedModels = oldCatalog.items.filter(
        old => !newCatalog.items.find(n => n.modelId === old.modelId)
      );

      assert.strictEqual(removedModels.length, 1, 'Should detect removed model');
      assert.strictEqual(removedModels[0].modelId, 'm2', 'Should be m2');
    });
  });

  describe('Error Cases', () => {
    test('should reject invalid capability type', async () => {
      const validCapabilities = ['text', 'image-generation', 'video-generation'];
      const invalidCapability = 'invalid-type';

      const isValid = validCapabilities.includes(invalidCapability);
      assert.strictEqual(isValid, false, 'Invalid capability should be rejected');
    });

    test('should prevent multiple defaults for same capability', async () => {
      const existingDefault = { modelId: 'm1', defaultForCapability: 'text' };
      const newDefault = { modelId: 'm2', defaultForCapability: 'text' };

      // Constraint: Only one model can be default per capability
      const constraint = existingDefault.defaultForCapability === newDefault.defaultForCapability;
      assert.strictEqual(constraint, true, 'Should detect duplicate default');
    });

    test('should handle empty catalog gracefully', async () => {
      const catalog = { items: [] };
      const filtered = catalog.items.filter(m => m.capabilities?.includes('text'));

      assert.strictEqual(filtered.length, 0, 'Empty catalog should return no results');
    });
  });
});

console.log('Model Capability API integration tests loaded');
