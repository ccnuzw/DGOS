// Built-in Skill: Translator

import { defineSkill } from '@dgos/skill-sdk';

export default defineSkill({
  manifest: {
    skillId: 'translator',
    version: '1.0.0',
    name: {
      en: 'Translator',
      zh: '翻译器',
    },
    description: {
      en: 'Translate text between languages using AI',
      zh: '使用AI在不同语言之间翻译文本',
    },
    author: {
      name: 'DGOS Team',
    },
    icon: '🌐',
    triggers: [
      {
        type: 'keyword',
        value: 'translate',
        examples: ['translate to English', 'translate to Chinese'],
      },
      {
        type: 'pattern',
        value: 'translate (.+) to (\\w+)',
        examples: ['translate hello to Chinese', 'translate 你好 to English'],
      },
    ],
    parameters: [
      {
        name: 'text',
        type: 'string',
        required: true,
        description: 'Text to translate',
      },
      {
        name: 'targetLanguage',
        type: 'enum',
        required: true,
        description: 'Target language',
        options: ['en', 'zh', 'ja', 'ko', 'es', 'fr', 'de'],
      },
      {
        name: 'sourceLanguage',
        type: 'string',
        required: false,
        description: 'Source language (auto-detect if not specified)',
      },
    ],
    permissions: [
      {
        capability: 'ai:tasks',
        reason: 'Use AI for translation',
      },
    ],
    execution: {
      timeout: 30000,
      retryable: true,
      async: true,
    },
    category: 'productivity',
    tags: ['translation', 'language', 'ai'],
    dependencies: {
      providers: ['openai', 'anthropic'],
    },
  },

  async handler(context, api) {
    const { text, targetLanguage, sourceLanguage } = context.parameters;

    api.log.info('Translating text', { targetLanguage, sourceLanguage });

    try {
      // Create AI task for translation
      const prompt = sourceLanguage
        ? `Translate the following text from ${sourceLanguage} to ${targetLanguage}:\n\n${text}`
        : `Translate the following text to ${targetLanguage}:\n\n${text}`;

      const task = await api.tasks.create({
        prompt,
        parameters: {
          temperature: 0.3,
          max_tokens: 1000,
        },
      });

      // Wait for task completion
      let status = await api.tasks.getStatus(task.taskId);
      let attempts = 0;

      while (status.status === 'pending' || status.status === 'running') {
        if (attempts++ > 30) {
          throw new Error('Translation timeout');
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
        status = await api.tasks.getStatus(task.taskId);
      }

      if (status.status !== 'succeeded') {
        throw new Error(status.error || 'Translation failed');
      }

      return {
        success: true,
        output: {
          originalText: text,
          translatedText: status.result,
          targetLanguage,
          sourceLanguage: sourceLanguage || 'auto',
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: {
          code: 'TRANSLATION_ERROR',
          message: error.message,
        },
      };
    }
  },
});
