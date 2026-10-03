import { defineSkill } from '@dgos/skill-sdk';
import manifest from '../skill.json';

export default defineSkill({
  manifest,

  async handler(context, api) {
    const { input } = context.parameters;

    api.log.info('Processing input', { input });

    try {
      // Your skill logic here
      const result = input.toUpperCase();

      return {
        success: true,
        output: {
          original: input,
          processed: result,
        },
      };
    } catch (error: any) {
      api.log.error('Processing failed', { error: error.message });

      return {
        success: false,
        error: {
          code: 'PROCESSING_ERROR',
          message: error.message,
        },
      };
    }
  },
});
