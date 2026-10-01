import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryAuditRepository, OutboxPublisher } from '../../src/audit/outbox.mjs';

test('audit outbox publisher retries failures and marks success once', async () => {
  const audit = new InMemoryAuditRepository();
  const eventId = await audit.record({ requestId: 'request-1', action: 'provider.test', targetType: 'connection_test' });
  let attempts = 0;
  const publisher = new OutboxPublisher({ auditRepository: audit, workerId: 'publisher-1', publish: async (id) => { attempts += 1; assert.equal(id, eventId); if (attempts === 1) throw new Error('temporary'); } });
  const failed = await publisher.publishOnce();
  assert.equal(failed.publishedAt, null);
  const item = audit.outbox.get(eventId);
  item.nextAttemptAt = 0;
  const published = await publisher.publishOnce();
  assert.ok(published.publishedAt);
  assert.equal(await publisher.publishOnce(), undefined);
});
