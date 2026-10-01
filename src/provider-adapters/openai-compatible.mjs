const failure = (errorKey) => Object.assign(new Error(errorKey), { errorKey });
const cleanEndpoint = (value) => {
  try {
    const url = new URL(value);
    const fixture = process.env.NODE_ENV !== 'production' && process.env.DGOS_ALLOW_INSECURE_FIXTURE === '1' && ['127.0.0.1', 'localhost'].includes(url.hostname);
    if (url.protocol !== 'https:' && !(fixture && url.protocol === 'http:')) throw failure('endpoint_invalid');
    return url.toString().replace(/\/$/, '');
  } catch { throw failure('endpoint_invalid'); }
};
const checkResponse = (response) => {
  if ([401, 403].includes(response.status)) throw failure('authentication_failed');
  if (!response.ok) throw failure('upstream_unavailable');
};
export function createOpenAiCompatibleAdapter() {
  return {
    protocolType: 'openai-compatible', protocolVersion: 'v1', descriptorVersion: 'text.v1', taskModes: ['text.chat'], streamingText: true, cancellation: true, modelListing: true, endpointRules: ['https-only'], timeoutMs: 15000, responseSizeLimit: 2 * 1024 * 1024,
    descriptor() { return { descriptorVersion: 'text.v1', inputs: ['text'], outputs: ['text'], taskModes: ['text.chat'], operationProfiles: ['chat.completions'], streaming: { text: true }, cancellation: true, tools: {}, modelCatalog: 'remote', limits: { responseSizeBytes: 2 * 1024 * 1024 } }; },
    async validate({ config, credential, egress, signal }) {
      const response = await egress.request({ url: `${cleanEndpoint(config.baseUrl)}/models`, headers: { authorization: `Bearer ${credential}` }, timeoutMs: this.timeoutMs, maxBytes: this.responseSizeLimit, signal });
      checkResponse(response);
      return this.descriptor();
    },
    async listModels({ config, credential, egress, signal }) {
      const response = await egress.request({ url: `${cleanEndpoint(config.baseUrl)}/models`, headers: { authorization: `Bearer ${credential}` }, timeoutMs: this.timeoutMs, maxBytes: this.responseSizeLimit, signal });
      checkResponse(response);
      const body = await response.json();
      if (!Array.isArray(body?.data)) throw failure('protocol_mismatch');
      return body.data.map((item) => ({ modelId: String(item.id), displayName: String(item.name ?? item.id), capabilitySummary: { text: true, image: false, audio: false, video: false, tools: false }, taskModes: ['text.chat'], streaming: true, tools: false, enabled: false, defaultEligible: false }));
    },
    async *streamText({ config, credential, egress, modelId, input, signal }) {
      try {
        const response = await egress.request({ url: `${cleanEndpoint(config.baseUrl)}/chat/completions`, method: 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' }, body: JSON.stringify({ model: modelId, messages: [{ role: 'user', content: input }], stream: true }), timeoutMs: this.timeoutMs, maxBytes: this.responseSizeLimit, signal });
        checkResponse(response);
        let pending = ''; let bytes = 0; let emitted = false; let done = false;
        const decoder = new TextDecoder();
        const parse = (line) => {
          if (!line.startsWith('data:')) return;
          const value = line.slice(5).trim();
          if (value === '[DONE]') { done = true; return; }
          try { return JSON.parse(value).choices?.[0]?.delta?.content; } catch { throw failure('protocol_mismatch'); }
        };
        for await (const chunk of response.body) {
          bytes += chunk.byteLength;
          if (bytes > this.responseSizeLimit) throw failure('response_too_large');
          pending += decoder.decode(chunk, { stream: true });
          const lines = pending.split(/\r?\n/); pending = lines.pop();
          for (const line of lines) { const delta = parse(line); if (typeof delta === 'string' && delta) { emitted = true; yield delta; } if (done) break; }
          if (done) break;
        }
        if (!emitted || !done) throw failure('protocol_mismatch');
      } catch (error) {
        if (signal?.aborted) throw failure(signal.reason?.name === 'TimeoutError' ? 'timed_out' : 'cancelled');
        if (error.errorKey) throw error;
        throw failure(['AbortError', 'TimeoutError'].includes(error.name) ? 'timed_out' : 'network_unreachable');
      }
    },
  };
}
