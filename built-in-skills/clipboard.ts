// Built-in Skill: Clipboard Manager

import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'clipboard',
    version: '1.0.0',
    name: {
      en: 'Clipboard Manager',
      zh: '剪贴板管理',
    },
    description: {
      en: 'Manage clipboard history and operations',
      zh: '管理剪贴板历史和操作',
    },
    author: {
      name: 'DGOS Team',
    },
    icon: '📋',
    triggers: [
      {
        type: 'keyword',
        value: 'clipboard',
        examples: ['clipboard history', 'show clipboard'],
      },
    ],
    parameters: [
      {
        name: 'action',
        type: 'enum',
        required: true,
        description: 'Clipboard action',
        options: ['history', 'get', 'set', 'clear'],
      },
      {
        name: 'content',
        type: 'string',
        required: false,
        description: 'Content to set (for set action)',
      },
    ],
    permissions: [
      {
        capability: 'clipboard:read',
        reason: 'Read clipboard content',
      },
      {
        capability: 'clipboard:write',
        reason: 'Write to clipboard',
      },
    ],
    execution: {
      timeout: 3000,
      retryable: false,
      async: false,
    },
    category: 'productivity',
    tags: ['clipboard', 'copy', 'paste'],
  },

  async handler(context, api) {
    const { action, content } = context.parameters;

    api.log.info('Clipboard operation', { action });

    // Get clipboard history from storage
    const history: string[] = (await api.storage.get('clipboard:history')) || [];

    switch (action) {
      case 'history':
        return {
          success: true,
          output: {
            history: history.slice(-10), // Last 10 items
            count: history.length,
          },
        };

      case 'get':
        return {
          success: true,
          output: {
            current: history[history.length - 1] || null,
          },
        };

      case 'set':
        if (!content) {
          return {
            success: false,
            error: {
              code: 'MISSING_CONTENT',
              message: 'Content is required for set action',
            },
          };
        }
        history.push(content);
        await api.storage.set('clipboard:history', history);
        return {
          success: true,
          output: {
            message: 'Content added to clipboard',
          },
        };

      case 'clear':
        await api.storage.set('clipboard:history', []);
        return {
          success: true,
          output: {
            message: 'Clipboard history cleared',
          },
        };

      default:
        return {
          success: false,
          error: {
            code: 'INVALID_ACTION',
            message: `Unknown action: ${action}`,
          },
        };
    }
  },
});
