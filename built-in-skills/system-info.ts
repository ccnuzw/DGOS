// Built-in Skill: System Information

import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'system-info',
    version: '1.0.0',
    name: {
      en: 'System Information',
      zh: '系统信息',
    },
    description: {
      en: 'Query system information like version, platform, and resources',
      zh: '查询系统信息，如版本、平台和资源',
    },
    author: {
      name: 'DGOS Team',
    },
    icon: '⚙️',
    triggers: [
      {
        type: 'keyword',
        value: 'system info',
        examples: ['system info', 'show system information'],
      },
      {
        type: 'keyword',
        value: 'version',
        examples: ['what version', 'dgos version'],
      },
    ],
    parameters: [
      {
        name: 'detail',
        type: 'enum',
        required: false,
        description: 'Level of detail to show',
        default: 'basic',
        options: ['basic', 'detailed', 'full'],
      },
    ],
    permissions: [
      {
        capability: 'system:read',
        reason: 'Read system information',
      },
    ],
    execution: {
      timeout: 5000,
      retryable: false,
      async: false,
    },
    category: 'system',
    tags: ['system', 'info', 'diagnostics'],
  },

  async handler(context, api) {
    const { detail = 'basic' } = context.parameters;

    api.log.info('Getting system information', { detail });

    const version = await api.system.getVersion();
    const platform = await api.system.getPlatform();

    const result: any = {
      version,
      platform,
      timestamp: new Date().toISOString(),
    };

    if (detail === 'detailed' || detail === 'full') {
      result.node = await api.system.getEnvironment('NODE_VERSION');
      result.arch = process.arch;
    }

    if (detail === 'full') {
      result.memory = {
        total: process.memoryUsage().heapTotal,
        used: process.memoryUsage().heapUsed,
      };
      result.uptime = process.uptime();
    }

    return {
      success: true,
      output: result,
    };
  },
});
