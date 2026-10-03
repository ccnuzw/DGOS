// Provider Presets - pre-configured popular providers

import type { ProviderPreset } from '../types.js';

export const providerPresets: Record<string, ProviderPreset> = {
  openai: {
    presetId: 'openai',
    name: { en: 'OpenAI', zh: 'OpenAI' },
    logo: '/icons/providers/openai.svg',
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.openai.com/v1',
    documentation: 'https://platform.openai.com/docs',
    authMethod: 'bearer',
    popularModels: ['gpt-4', 'gpt-4-turbo', 'gpt-4o', 'gpt-3.5-turbo'],
    capabilities: ['text.chat', 'text.completion', 'image.generate', 'text.embedding'],
    tags: ['official', 'popular'],
    official: true,
  },

  anthropic: {
    presetId: 'anthropic',
    name: { en: 'Anthropic', zh: 'Anthropic' },
    logo: '/icons/providers/anthropic.svg',
    adapterId: 'anthropic',
    defaultBaseUrl: 'https://api.anthropic.com/v1',
    documentation: 'https://docs.anthropic.com',
    authMethod: 'api-key',
    popularModels: ['claude-3-opus', 'claude-3-sonnet', 'claude-3-haiku'],
    capabilities: ['text.chat'],
    tags: ['official', 'popular'],
    official: true,
  },

  deepseek: {
    presetId: 'deepseek',
    name: { en: 'DeepSeek', zh: '深度求索' },
    logo: '/icons/providers/deepseek.svg',
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.deepseek.com/v1',
    documentation: 'https://platform.deepseek.com/docs',
    authMethod: 'bearer',
    popularModels: ['deepseek-chat', 'deepseek-coder'],
    capabilities: ['text.chat', 'text.completion'],
    tags: ['official', 'china'],
    official: true,
  },

  zhipu: {
    presetId: 'zhipu',
    name: { en: 'Zhipu AI', zh: '智谱AI' },
    logo: '/icons/providers/zhipu.svg',
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    documentation: 'https://open.bigmodel.cn/dev/api',
    authMethod: 'bearer',
    popularModels: ['glm-4', 'glm-4-plus', 'glm-3-turbo'],
    capabilities: ['text.chat', 'image.generate'],
    tags: ['official', 'china'],
    official: true,
  },

  moonshot: {
    presetId: 'moonshot',
    name: { en: 'Moonshot AI', zh: '月之暗面' },
    logo: '/icons/providers/moonshot.svg',
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.moonshot.cn/v1',
    documentation: 'https://platform.moonshot.cn/docs',
    authMethod: 'bearer',
    popularModels: ['moonshot-v1-8k', 'moonshot-v1-32k', 'moonshot-v1-128k'],
    capabilities: ['text.chat'],
    tags: ['official', 'china'],
    official: true,
  },

  groq: {
    presetId: 'groq',
    name: { en: 'Groq', zh: 'Groq' },
    logo: '/icons/providers/groq.svg',
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.groq.com/openai/v1',
    documentation: 'https://console.groq.com/docs',
    authMethod: 'bearer',
    popularModels: ['llama-3.1-70b-versatile', 'mixtral-8x7b-32768'],
    capabilities: ['text.chat', 'text.completion'],
    tags: ['official', 'fast'],
    official: true,
  },

  together: {
    presetId: 'together',
    name: { en: 'Together AI', zh: 'Together AI' },
    logo: '/icons/providers/together.svg',
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.together.xyz/v1',
    documentation: 'https://docs.together.ai',
    authMethod: 'bearer',
    popularModels: ['meta-llama/Llama-3-70b-chat-hf', 'mistralai/Mixtral-8x7B-Instruct-v0.1'],
    capabilities: ['text.chat', 'text.completion', 'image.generate'],
    tags: ['official'],
    official: true,
  },

  'openai-compatible': {
    presetId: 'openai-compatible',
    name: { en: 'OpenAI-Compatible API', zh: 'OpenAI 兼容 API' },
    adapterId: 'openai-compatible',
    defaultBaseUrl: 'https://api.example.com/v1',
    authMethod: 'bearer',
    capabilities: ['text.chat', 'text.completion'],
    tags: ['custom'],
    official: false,
  },
};

/**
 * Get a preset by ID
 */
export function getPreset(presetId: string): ProviderPreset | undefined {
  return providerPresets[presetId];
}

/**
 * List all presets with optional filtering
 */
export function listPresets(filters?: {
  official?: boolean;
  tag?: string;
  capability?: string;
}): ProviderPreset[] {
  let presets = Object.values(providerPresets);

  if (filters?.official !== undefined) {
    presets = presets.filter(p => p.official === filters.official);
  }

  if (filters?.tag) {
    presets = presets.filter(p => p.tags?.includes(filters.tag));
  }

  if (filters?.capability) {
    presets = presets.filter(p => p.capabilities?.includes(filters.capability));
  }

  return presets;
}

/**
 * Search presets by name or tags
 */
export function searchPresets(query: string): ProviderPreset[] {
  const lowerQuery = query.toLowerCase();
  return Object.values(providerPresets).filter(
    p =>
      p.name.en.toLowerCase().includes(lowerQuery) ||
      p.name.zh.includes(query) ||
      p.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
  );
}
