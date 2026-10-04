import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const read = path => readFileSync(new URL(path, import.meta.url), 'utf8');

test('final integration matrix covers required FR branches and keeps Web/Native evidence separate', () => {
  const matrix = read('../../docs/05-测试与发布/端到端验收/报告/WP-W4-01-V1最终验证矩阵.md');
  for (const requirement of ['Provider', 'SSE', 'Artifact', '重复提交', '无副作用', '安装', '更新', '卸载', '健康失败回滚', 'skill.read', 'MCP', '动作发现', '确认', '拒绝', 'cancel', 'Native', '秘密扫描']) assert.ok(matrix.includes(requirement), `matrix missing ${requirement}`);
  assert.ok(matrix.includes('Web 和 Native 单独分组'));
  assert.ok(existsSync(new URL('../../scripts/w4-final-integration.mjs', import.meta.url)));
});

test('W3 Native evidence gates final readiness without relying on stale status', () => {
  const evidence = JSON.parse(readFileSync(new URL('../../.herdr/evidence/WP-W3-02-native-bridge-fix-2026-10-04.json', import.meta.url), 'utf8'));
  const ready = evidence.status === 'completed'
    && evidence.acceptance?.handshake === 'passed'
    && evidence.acceptance?.taskArtifactReload === 'passed';
  if (evidence.status === 'completed') assert.equal(ready, true);
  else assert.equal(ready, false);
});
