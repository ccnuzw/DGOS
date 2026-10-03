import { defineSkill } from '@dgos/skill-sdk';
import manifest from '../skill.json';

export default defineSkill({
  manifest,

  async handler(context, api) {
    const { endpoint, method = 'GET' } = context.parameters;

    api.log.info('Making API request', { endpoint, method });

    try {
      // Validate URL
      const url = new URL(endpoint);

      // Make HTTP request
      let response;
      switch (method.toUpperCase()) {
        case 'GET':
          response = await api.http.get(endpoint);
          break;
        case 'POST':
          response = await api.http.post(endpoint, context.parameters.body || {});
          break;
        default:
          throw new Error(`Unsupported method: ${method}`);
      }

      return {
        success: true,
        output: {
          endpoint,
          method,
          data: response,
        },
      };
    } catch (error: any) {
      api.log.error('API request failed', { error: error.message });

      return {
        success: false,
        error: {
          code: 'API_ERROR',
          message: error.message,
        },
      };
    }
  },
});
