import { resolveTextProfile } from '../provider-config/text-profile.mjs';
import { normalizeTextExecution } from '../provider-config/text-parameters.mjs';
import { createHash } from 'node:crypto';

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
const MAX_EVENT_BYTES = 64 * 1024;
const tokenCount = (value) => Number.isSafeInteger(value) && value >= 0;
const trustedUsage = (usage, evidence, fields) => {
  if (!usage || typeof usage !== 'object' || fields.some((field) => !tokenCount(usage[field]))) return undefined;
  const [inputTokens, outputTokens, totalTokens] = fields.map((field) => usage[field]);
  if (inputTokens + outputTokens !== totalTokens) return undefined;
  return { trusted: true, inputTokens, outputTokens, totalTokens, sourceDigest: createHash('sha256').update(evidence).digest('hex') };
};
export function createOpenAiCompatibleAdapter({ profileDirectory } = {}) {
  return {
    protocolType: 'openai-compatible', protocolVersion: 'v1', descriptorVersion: 'text.v1', taskModes: ['text.chat'], streamingText: true, cancellation: true, modelListing: true, endpointRules: ['https-only'], timeoutMs: 15000, responseSizeLimit: 2 * 1024 * 1024,
    descriptor() { return { descriptorVersion: 'text.v1', inputs: ['text'], outputs: ['text'], taskModes: ['text.chat'], operationProfiles: ['chat.completions', 'responses'], parameters: ['temperature', 'maxOutputTokens'], streaming: { text: true }, cancellation: true, tools: {}, modelCatalog: 'remote', limits: { responseSizeBytes: 2 * 1024 * 1024 } }; },
    async validate({ config, credential, egress, signal }) {
      const response = await egress.request({ url: `${cleanEndpoint(config.baseUrl)}/models`, headers: { authorization: `Bearer ${credential}` }, timeoutMs: this.timeoutMs, maxResponseBytes: this.responseSizeLimit, signal });
      checkResponse(response);
      return this.descriptor();
    },
    async listModels({ config, credential, egress, signal }) {
      const response = await egress.request({ url: `${cleanEndpoint(config.baseUrl)}/models`, headers: { authorization: `Bearer ${credential}` }, timeoutMs: this.timeoutMs, maxResponseBytes: this.responseSizeLimit, signal });
      checkResponse(response);
      const body = await response.json();
      if (!Array.isArray(body?.data)) throw failure('protocol_mismatch');
      return body.data.map((item) => ({ modelId: String(item.id), displayName: String(item.name ?? item.id), capabilitySummary: { text: true, image: false, audio: false, video: false, tools: false }, taskModes: ['text.chat'], streaming: true, tools: false, enabled: false, defaultEligible: false }));
    },
    async *streamText({ config, credential, egress, modelId, input, signal, executionSnapshot }) {
      try {
        let operationProfile = executionSnapshot?.resolvedProfile?.operationProfile ?? 'chat.completions';
        if (!executionSnapshot && (config.capabilityProtocolId || config.capabilityProtocolVersion)) {
          if (!config.capabilityProtocolId || !config.capabilityProtocolVersion || !profileDirectory?.getActive) throw failure('protocol_unavailable');
          const declaration = await profileDirectory.getActive(config.ownerId, config.capabilityProtocolId, config.capabilityProtocolVersion);
          if (!declaration) throw failure('protocol_unavailable');
          operationProfile = resolveTextProfile(declaration, modelId).operationProfile;
          if (!this.descriptor().operationProfiles.includes(operationProfile)) throw failure('capability_mismatch');
        }
        if (!this.descriptor().operationProfiles.includes(operationProfile)) throw failure('capability_mismatch');
        if (executionSnapshot && (executionSnapshot.resolvedProfile.modelId !== modelId || executionSnapshot.resolvedProfile.protocolType !== config.protocolType || executionSnapshot.resolvedProfile.adapterVersion !== this.protocolVersion || executionSnapshot.resolvedProfile.descriptorVersion !== this.descriptorVersion)) throw failure('version_conflict');
        const parameters = executionSnapshot ? executionSnapshot.normalizedParameters : normalizeTextExecution({ adapter: this, input }).normalizedParameters;
        const mapped = { ...(parameters.temperature !== undefined ? { temperature: parameters.temperature } : {}), ...(parameters.maxOutputTokens !== undefined ? { [operationProfile === 'responses' ? 'max_output_tokens' : 'max_tokens']: parameters.maxOutputTokens } : {}) };
        const responses = operationProfile === 'responses';
        const response = await egress.request({ url: `${cleanEndpoint(config.baseUrl)}${responses ? '/responses' : '/chat/completions'}`, method: 'POST', headers: { authorization: `Bearer ${credential}`, 'content-type': 'application/json' }, body: JSON.stringify(responses ? { model: modelId, input, stream: true, ...mapped } : { model: modelId, messages: [{ role: 'user', content: input }], stream: true, stream_options: { include_usage: true }, ...mapped }), timeoutMs: this.timeoutMs, maxResponseBytes: this.responseSizeLimit, streamResponse: true, signal });
        checkResponse(response);
        let pending = ''; let eventData = []; let eventBytes = 0; let bytes = 0; let emitted = false; let done = false; let usage; let usageSeen = false;
        const decoder = new TextDecoder('utf-8', { fatal: true });
        const parse = (value) => {
          if (value === '[DONE]') {
            if (responses ? !done : done) throw failure('protocol_mismatch');
            done = true;
            return;
          }
          if (done) throw failure('protocol_mismatch');
          let event;
          try { event = JSON.parse(value); } catch { throw failure('protocol_mismatch'); }
          if (!event || typeof event !== 'object') throw failure('protocol_mismatch');
          if (responses) {
            if (event.type === 'response.failed' || event.type === 'error') throw failure('upstream_unavailable');
            if (event.type === 'response.completed') {
              if (event.response?.status && event.response.status !== 'completed') throw failure('protocol_mismatch');
              done = true;
              usage = trustedUsage(event.response?.usage, value, ['input_tokens', 'output_tokens', 'total_tokens']);
              return;
            }
            return event.type === 'response.output_text.delta' && typeof event.delta === 'string' ? event.delta : undefined;
          }
          if (usageSeen) throw failure('protocol_mismatch');
          if (event.error) throw failure('upstream_unavailable');
          if (!Array.isArray(event.choices)) throw failure('protocol_mismatch');
          if (event.choices.length === 0 && event.usage !== undefined) {
            usageSeen = true;
            usage = trustedUsage(event.usage, value, ['prompt_tokens', 'completion_tokens', 'total_tokens']);
          }
          return event.choices[0]?.delta?.content;
        };
        const line = (text) => {
          if (!text) {
            if (!eventData.length) return;
            const value = eventData.join('\n');
            eventData = []; eventBytes = 0;
            return parse(value);
          }
          if (text.startsWith(':')) return;
          const separator = text.indexOf(':');
          const field = separator < 0 ? text : text.slice(0, separator);
          if (field !== 'data') return;
          const value = separator < 0 ? '' : text.slice(separator + 1).replace(/^ /, '');
          eventData.push(value);
          eventBytes += Buffer.byteLength(value) + 1;
          if (eventBytes > MAX_EVENT_BYTES) throw failure('protocol_mismatch');
        };
        for await (const chunk of response.body) {
          bytes += chunk.byteLength;
          if (bytes > this.responseSizeLimit) throw failure('response_too_large');
          pending += decoder.decode(chunk, { stream: true });
          const lines = pending.split(/\r\n|\n|\r(?!$)/);
          pending = lines.pop();
          if (Buffer.byteLength(pending) + eventBytes > MAX_EVENT_BYTES) throw failure('protocol_mismatch');
          for (const text of lines) {
            const delta = line(text);
            if (typeof delta === 'string' && delta) { emitted = true; yield delta; }
          }
        }
        pending += decoder.decode();
        if (pending || eventData.length || !emitted || !done) throw failure('protocol_mismatch');
        if (usage) yield { usage };
      } catch (error) {
        if (signal?.aborted) throw failure(signal.reason?.name === 'TimeoutError' ? 'timed_out' : 'cancelled');
        if (error.errorKey) throw error;
        throw failure(['AbortError', 'TimeoutError'].includes(error.name) ? 'timed_out' : 'network_unreachable');
      }
    },
  };
}
