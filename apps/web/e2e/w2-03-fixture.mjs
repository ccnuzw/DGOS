import { randomUUID } from 'node:crypto';

export const W2_E2E_ENABLED = process.env.W2_E2E === '1';
export const W2_FIXTURE = Object.freeze({
  protocolType: 'openai-compatible',
  displayName: `w2-e2e-${Date.now()}`,
  modelId: process.env.W2_MODEL_ID || 'fixture-text-model',
  endpoint: process.env.W2_PROVIDER_ENDPOINT || 'https://provider.fixture.test/v1',
  credential: process.env.W2_PROVIDER_CREDENTIAL || 'fixture-e2e-token',
  successText: process.env.W2_SUCCESS_TEXT || 'w2 e2e fixture response',
});

export function requestId() {
  return randomUUID();
}

export function csrfHeaders() {
  return { 'content-type': 'application/json', 'x-dgos-csrf': 'web' };
}

export function providerAccountInput() {
  return {
    requestId: requestId(),
    protocolType: W2_FIXTURE.protocolType,
    displayName: W2_FIXTURE.displayName,
    credential: W2_FIXTURE.credential,
    scope: { endpoint: W2_FIXTURE.endpoint },
  };
}

export function taskInput({ providerConfigId, modelId = W2_FIXTURE.modelId, prompt = 'w2 e2e prompt', request = requestId() } = {}) {
  return {
    requestId: request,
    target: 'text',
    intent: 'text.chat',
    input: { text: prompt },
    options: { providerConfigId, modelId },
  };
}

export function parseSse(text) {
  return text.split(/\n\n+/).flatMap(block => {
    const data = block.split('\n').find(line => line.startsWith('data: '));
    const id = block.split('\n').find(line => line.startsWith('id: '));
    if (!data) return [];
    try { return [{ sequence: id ? Number(id.slice(4)) : undefined, ...JSON.parse(data.slice(6)) }]; } catch { return []; }
  });
}

export function assertNoSecret(value, secret = W2_FIXTURE.credential) {
  const serialized = JSON.stringify(value);
  if (serialized.includes(secret)) throw new Error('Provider credential leaked into Web API response');
}

export const fixtureBoundary = {
  kind: 'upstream-fixture-only',
  realSystemUnderTest: 'DGOS Web/API/Worker/PG/Redis',
  difference: 'Provider HTTP response is deterministic and local; this does not prove an external provider outcome.',
};
