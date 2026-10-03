// Built-in Skill: Calculator

import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'calculator',
    version: '1.0.0',
    name: {
      en: 'Calculator',
      zh: '计算器',
    },
    description: {
      en: 'Perform mathematical calculations',
      zh: '执行数学计算',
    },
    author: {
      name: 'DGOS Team',
    },
    icon: '🔢',
    triggers: [
      {
        type: 'keyword',
        value: 'calculate',
        examples: ['calculate 2+2', 'calc 10*5'],
      },
      {
        type: 'pattern',
        value: '(?:calculate|calc)\\s+(.+)',
        examples: ['calculate 15 / 3', 'calc sqrt(16)'],
      },
    ],
    parameters: [
      {
        name: 'expression',
        type: 'string',
        required: true,
        description: 'Mathematical expression to evaluate',
      },
    ],
    permissions: [],
    execution: {
      timeout: 3000,
      retryable: true,
      async: false,
    },
    category: 'productivity',
    tags: ['math', 'calculator', 'computation'],
  },

  async handler(context, api) {
    const { expression } = context.parameters;

    api.log.info('Calculating expression', { expression });

    try {
      // Safe math evaluation (in production, use a proper math parser)
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');

      if (sanitized !== expression) {
        return {
          success: false,
          error: {
            code: 'INVALID_EXPRESSION',
            message: 'Expression contains invalid characters',
          },
        };
      }

      // Evaluate (note: eval is used here for simplicity, use a proper math parser in production)
      const result = Function(`"use strict"; return (${sanitized})`)();

      return {
        success: true,
        output: {
          expression,
          result,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'CALCULATION_ERROR',
          message: error.message,
        },
      };
    }
  },
});
