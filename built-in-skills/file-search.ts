// Built-in Skill: File Search

import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'file-search',
    version: '1.0.0',
    name: {
      en: 'File Search',
      zh: '文件搜索',
    },
    description: {
      en: 'Search for files in the workspace',
      zh: '在工作区中搜索文件',
    },
    author: {
      name: 'DGOS Team',
    },
    icon: '🔍',
    triggers: [
      {
        type: 'keyword',
        value: 'search files',
        examples: ['search files', 'find file'],
      },
      {
        type: 'pattern',
        value: 'find file (.+)',
        examples: ['find file readme.md', 'find file package.json'],
      },
    ],
    parameters: [
      {
        name: 'query',
        type: 'string',
        required: true,
        description: 'Search query or file pattern',
      },
      {
        name: 'maxResults',
        type: 'number',
        required: false,
        description: 'Maximum number of results',
        default: 10,
        validation: {
          min: 1,
          max: 100,
        },
      },
    ],
    permissions: [
      {
        capability: 'file:read',
        reason: 'Search and read file metadata',
      },
    ],
    execution: {
      timeout: 10000,
      retryable: true,
      async: true,
    },
    category: 'productivity',
    tags: ['files', 'search', 'workspace'],
  },

  async handler(context, api) {
    const { query, maxResults = 10 } = context.parameters;

    api.log.info('Searching files', { query, maxResults });

    // In a real implementation, this would search the file system
    // For now, return mock results
    const mockResults = [
      { path: '/workspace/README.md', size: 1024, modified: new Date().toISOString() },
      { path: '/workspace/package.json', size: 512, modified: new Date().toISOString() },
    ];

    const filtered = mockResults.filter(f =>
      f.path.toLowerCase().includes(query.toLowerCase())
    ).slice(0, maxResults);

    return {
      success: true,
      output: {
        query,
        results: filtered,
        count: filtered.length,
      },
    };
  },
});
