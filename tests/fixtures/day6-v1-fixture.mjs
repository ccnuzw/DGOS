import { createHash } from 'node:crypto';

export const day6Fixture = Object.freeze({
  profile: 'day6-v1-isolated',
  provider: Object.freeze({
    name: 'day6-openai-compatible',
    protocol: 'openai-compatible',
    model: 'fixture-model',
    tokenEnv: 'DAY6_PROVIDER_TOKEN',
    response: 'Day 6 deterministic fixture response',
  }),
  identities: Object.freeze({
    adminRole: 'owner',
    operatorRole: 'operator',
    deniedRole: 'viewer',
  }),
  task: Object.freeze({
    requestId: 'day6-request-0001',
    input: 'Produce a deterministic Day 6 artifact',
    expectedTerminal: 'succeeded',
    expectedArtifactType: 'text/plain',
  }),
  negativeCases: Object.freeze([
    'duplicate_request_id',
    'unknown_provider_config',
    'unknown_task',
    'permission_denied',
    'csrf_failed',
    'cancel_terminal_task',
  ]),
});

export function fixtureFingerprint(fixture = day6Fixture) {
  return createHash('sha256').update(JSON.stringify(fixture)).digest('hex');
}

if (process.argv[1]?.endsWith('day6-v1-fixture.mjs')) {
  console.log(JSON.stringify({ profile: day6Fixture.profile, fingerprint: fixtureFingerprint(), provider: day6Fixture.provider.name, negativeCases: day6Fixture.negativeCases }));
}
