// Built-in Skill: Screenshot

import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'screenshot',
    version: '1.0.0',
    name: {
      en: 'Screenshot',
      zh: '截图',
    },
    description: {
      en: 'Capture screenshots of the screen or window',
      zh: '捕获屏幕或窗口的截图',
    },
    author: {
      name: 'DGOS Team',
    },
    icon: '📸',
    triggers: [
      {
        type: 'keyword',
        value: 'screenshot',
        examples: ['take screenshot', 'capture screen'],
      },
      {
        type: 'keyword',
        value: 'capture',
        examples: ['capture window', 'capture region'],
      },
    ],
    parameters: [
      {
        name: 'type',
        type: 'enum',
        required: false,
        description: 'Screenshot type',
        default: 'fullscreen',
        options: ['fullscreen', 'window', 'region'],
      },
      {
        name: 'delay',
        type: 'number',
        required: false,
        description: 'Delay in seconds before capture',
        default: 0,
        validation: {
          min: 0,
          max: 10,
        },
      },
    ],
    permissions: [
      {
        capability: 'screen:capture',
        reason: 'Capture screenshot',
      },
      {
        capability: 'file:write',
        reason: 'Save screenshot file',
      },
    ],
    execution: {
      timeout: 15000,
      retryable: false,
      async: true,
    },
    category: 'productivity',
    tags: ['screenshot', 'capture', 'image'],
  },

  async handler(context, api) {
    const { type = 'fullscreen', delay = 0 } = context.parameters;

    api.log.info('Taking screenshot', { type, delay });

    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay * 1000));
    }

    // In real implementation, this would capture actual screenshot
    const filename = `screenshot-${Date.now()}.png`;
    const path = `/screenshots/${filename}`;

    await api.ui.showNotification(`Screenshot saved to ${path}`, 'success');

    return {
      success: true,
      output: {
        type,
        path,
        filename,
        timestamp: new Date().toISOString(),
      },
    };
  },
});
