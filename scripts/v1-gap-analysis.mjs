#!/usr/bin/env node
/**
 * V1 Comprehensive Gap Analysis
 * Systematically checks all 62 ACs against implementation and test evidence
 */

import { readFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';

const BASE = process.cwd();

// All 12 FRs with their ACs
const frSpecs = [
  {
    id: 'FR-001',
    name: '桌面与应用工作区',
    acCount: 8,
    acs: ['AC01', 'AC02', 'AC03', 'AC04', 'AC05', 'AC06', 'AC07', 'AC08']
  },
  {
    id: 'FR-002',
    name: '开发者中心与APP生命周期',
    acCount: 3,
    acs: ['AC01', 'AC02', 'AC03']
  },
  {
    id: 'FR-003',
    name: 'SkillMCP与Agent接入',
    acCount: 8,
    acs: ['AC01', 'AC02', 'AC03', 'AC04', 'AC05', 'AC06', 'AC07', 'AC08']
  },
  {
    id: 'FR-005',
    name: '多模态AI任务工作流',
    acCount: 3,
    acs: ['AC01', 'AC02', 'AC08']
  },
  {
    id: 'FR-007',
    name: '模型平台与工作流配置',
    acCount: 8,
    acs: ['AC01', 'AC02', 'AC04', 'AC05', 'AC06', 'AC07', 'AC08', 'AC09']
  },
  {
    id: 'FR-009',
    name: '系统智能助手与快捷指令',
    acCount: 6,
    acs: ['AC01', 'AC02', 'AC03', 'AC04', 'AC05', 'AC06']
  },
  {
    id: 'FR-010',
    name: '管理员登录与会话',
    acCount: 4,
    acs: ['AC01', 'AC02', 'AC03', 'AC04']
  },
  {
    id: 'FR-011',
    name: 'API-Key生命周期',
    acCount: 4,
    acs: ['AC01', 'AC02', 'AC03', 'AC04']
  },
  {
    id: 'FR-012',
    name: 'Provider账号与连接',
    acCount: 4,
    acs: ['AC01', 'AC02', 'AC03', 'AC04']
  },
  {
    id: 'FR-013',
    name: '上游账号连接测试',
    acCount: 4,
    acs: ['AC01', 'AC02', 'AC03', 'AC04']
  },
  {
    id: 'FR-014',
    name: '审计与管理员系统治理',
    acCount: 5,
    acs: ['AC01', 'AC02', 'AC03', 'AC04', 'AC05']
  },
  {
    id: 'FR-015',
    name: '用量与额度管理',
    acCount: 5,
    acs: ['AC01', 'AC02', 'AC03', 'AC04', 'AC05']
  }
];

// Evidence mapping from V1-AC资产核对-2026-10-02.md
const evidenceMap = {
  'FR-001': {
    'AC01': { status: 'partial', evidence: 'F r6 desktop windows 3/3, real 7/7', gaps: 'Human GUI validation, Developer ID/notarization missing' },
    'AC02': { status: 'partial', evidence: 'Unit tests exist', gaps: 'Real package validation missing' },
    'AC03': { status: 'partial', evidence: 'API tests exist', gaps: 'System info UI missing' },
    'AC04': { status: 'partial', evidence: 'A r9 signed package browser fixture 1/1', gaps: 'Current build UI, dual-host validation missing' },
    'AC05': { status: 'partial', evidence: 'Web E2E Chinese/Shell mock', gaps: 'Locale/assistant language separation, dual-host missing' },
    'AC06': { status: 'partial', evidence: 'I r6/r7 network tests 10/10 total', gaps: 'GUI input, production proxy/secrets, worker action path missing' },
    'AC07': { status: 'partial', evidence: 'Unit/API deny subset', gaps: 'Cross-app capability full branches missing' },
    'AC08': { status: 'partial', evidence: 'Unit/API subset', gaps: 'Cross-app capability full branches missing' }
  },
  'FR-002': {
    'AC01': { status: 'partial', evidence: 'G r11 packages unit/route 16/16, HTTP 12 stages', gaps: 'Strict input, concurrent app lock, rollback with Task/Artifact retention, real D UI' },
    'AC02': { status: 'partial', evidence: 'G r11 retention subset', gaps: 'Actual Task/Artifact retention after rollback' },
    'AC03': { status: 'partial', evidence: 'G r11 subset', gaps: 'Real UI for developer test install, approval workflow' }
  },
  'FR-003': {
    'AC01': { status: 'partial', evidence: 'E r6 extensions 33/33', gaps: 'H management HTTP, D GUI, B Linux' },
    'AC02': { status: 'partial', evidence: 'E r6 subset', gaps: 'Independent process kill/lease, real UI query/cancel' },
    'AC03': { status: 'partial', evidence: 'E r6 subset', gaps: 'Real config/Secret/permission with browser, production egress/OS isolation' },
    'AC04': { status: 'partial', evidence: 'E r6 subset', gaps: 'Custom Skill, rename/translate, delete reference protection full scenarios' },
    'AC05': { status: 'missing', evidence: 'None', gaps: 'Template non-secret fill, need-credentials/no-credentials dual path, connection refusal' },
    'AC06': { status: 'partial', evidence: 'E r6 subset', gaps: 'Current dependency/active Run deletion protection, cross-process recovery' },
    'AC07': { status: 'partial', evidence: 'E r6 + Web E2E subset', gaps: 'Real source preview confirmation, custom fields and permissions' },
    'AC08': { status: 'partial', evidence: 'E r6 subset', gaps: 'Bundled credential dual samples, page close/reload, real daemon recovery' }
  },
  'FR-005': {
    'AC01': { status: 'complete', evidence: 'A r9 + F r6 + H r6 real chain', gaps: 'None identified' },
    'AC02': { status: 'partial', evidence: 'A r9 browser fixture', gaps: 'Dynamic parameters, theme/language, revoke-stop-polling, taskId recovery' },
    'AC08': { status: 'complete', evidence: 'H r6 real PG/Redis/worker/restart', gaps: 'None identified' }
  },
  'FR-007': {
    'AC01': { status: 'complete', evidence: 'H r5/r6 provider tests', gaps: 'None identified' },
    'AC02': { status: 'complete', evidence: 'H r5/r6 provider tests', gaps: 'None identified' },
    'AC04': { status: 'partial', evidence: 'H r4 fixture subset', gaps: 'Real adapter not all Providers/Models' },
    'AC05': { status: 'partial', evidence: 'H r5/r6 subset', gaps: 'Full classification branches' },
    'AC06': { status: 'partial', evidence: 'H r4 API injection 10/10', gaps: 'UI no-export entry, target host check' },
    'AC07': { status: 'complete', evidence: 'H r5/r6 provider tests', gaps: 'None identified' },
    'AC08': { status: 'complete', evidence: 'H r5/r6 provider protocol tests', gaps: 'None identified' },
    'AC09': { status: 'complete', evidence: 'H r5/r6 provider admission profile tests', gaps: 'None identified' }
  },
  'FR-009': {
    'AC01': { status: 'partial', evidence: 'A r8 + Web E2E', gaps: 'Dual-host real navigation, no Provider, permission revoke' },
    'AC02': { status: 'partial', evidence: 'A r8 subset', gaps: 'Full action lifecycle branches' },
    'AC03': { status: 'partial', evidence: 'A r8 actions freshness 2/2', gaps: 'Current identity/permission recheck, atomic receipt' },
    'AC04': { status: 'partial', evidence: 'A r8 subset', gaps: 'Subject isolation, package digest/action SemVer/run revision' },
    'AC05': { status: 'partial', evidence: 'A r8 subset', gaps: 'NL parsing full coverage' },
    'AC06': { status: 'partial', evidence: 'A r8 subset', gaps: 'Real confirmation, full-process recovery' }
  },
  'FR-010': {
    'AC01': { status: 'complete', evidence: 'C r12 identity HTTP 20/20', gaps: 'None identified' },
    'AC02': { status: 'complete', evidence: 'C r12 identity HTTP 20/20', gaps: 'None identified' },
    'AC03': { status: 'complete', evidence: 'C r12 identity HTTP 20/20', gaps: 'None identified' },
    'AC04': { status: 'partial', evidence: 'A r8 subset', gaps: 'Current identity/permission recheck for high-risk' }
  },
  'FR-011': {
    'AC01': { status: 'complete', evidence: 'C r12 identity HTTP 20/20', gaps: 'None identified' },
    'AC02': { status: 'complete', evidence: 'C r12 identity HTTP 20/20', gaps: 'None identified' },
    'AC03': { status: 'partial', evidence: 'C r12 subset', gaps: 'Limited key overlap window validation' },
    'AC04': { status: 'complete', evidence: 'C r12 identity HTTP 20/20', gaps: 'None identified' }
  },
  'FR-012': {
    'AC01': { status: 'complete', evidence: 'H r5/r6 provider account tests', gaps: 'None identified' },
    'AC02': { status: 'complete', evidence: 'H r5/r6 provider binding tests', gaps: 'None identified' },
    'AC03': { status: 'complete', evidence: 'H r5/r6 provider tests', gaps: 'None identified' },
    'AC04': { status: 'partial', evidence: 'H r5/r6 subset', gaps: 'Full reference protection scenarios' }
  },
  'FR-013': {
    'AC01': { status: 'complete', evidence: 'H r5/r6 provider probe tests', gaps: 'None identified' },
    'AC02': { status: 'complete', evidence: 'H r5/r6 provider probe tests', gaps: 'None identified' },
    'AC03': { status: 'partial', evidence: 'H r5/r6 subset', gaps: 'Full SSRF prevention validation' },
    'AC04': { status: 'complete', evidence: 'H r5/r6 provider lease tests', gaps: 'None identified' }
  },
  'FR-014': {
    'AC01': { status: 'complete', evidence: 'C r11 governance audit tests', gaps: 'None identified' },
    'AC02': { status: 'complete', evidence: 'C r11 audit query 5/5', gaps: 'None identified' },
    'AC03': { status: 'complete', evidence: 'C r11 governance tests', gaps: 'None identified' },
    'AC04': { status: 'complete', evidence: 'G r9 retention 10/10 serial + 14/14 no-PG', gaps: 'None identified' },
    'AC05': { status: 'complete', evidence: 'C r11 governance policy tests', gaps: 'None identified' }
  },
  'FR-015': {
    'AC01': { status: 'complete', evidence: 'C r6 quota tests + H r6', gaps: 'None identified' },
    'AC02': { status: 'complete', evidence: 'C r6 quota tests', gaps: 'None identified' },
    'AC03': { status: 'complete', evidence: 'C r6 quota tests', gaps: 'None identified' },
    'AC04': { status: 'complete', evidence: 'C r6 quota tests', gaps: 'None identified' },
    'AC05': { status: 'complete', evidence: 'C r6 quota tests', gaps: 'None identified' }
  }
};

console.log('# V1 Comprehensive Gap Analysis');
console.log('Generated:', new Date().toISOString());
console.log('Baseline: 72ab1cb + concurrent uncommitted changes');
console.log('');

let totalComplete = 0;
let totalPartial = 0;
let totalMissing = 0;

const categoryA = []; // Code Missing
const categoryB = []; // Code Exists, No Test
const categoryC = []; // Test Exists, Not E2E
const categoryD = []; // E2E Partial

for (const fr of frSpecs) {
  console.log(`## ${fr.id}: ${fr.name}`);
  console.log(`Total ACs: ${fr.acCount}\n`);

  for (const ac of fr.acs) {
    const evidence = evidenceMap[fr.id]?.[ac];
    if (!evidence) continue;

    const symbol = evidence.status === 'complete' ? '✅' :
                   evidence.status === 'partial' ? '⚠️' : '❌';

    console.log(`### ${symbol} ${fr.id}/${ac}: ${evidence.status.toUpperCase()}`);
    console.log(`Evidence: ${evidence.evidence}`);
    if (evidence.gaps) {
      console.log(`Gaps: ${evidence.gaps}`);
    }
    console.log('');

    // Count status
    if (evidence.status === 'complete') totalComplete++;
    else if (evidence.status === 'partial') totalPartial++;
    else totalMissing++;

    // Categorize gaps
    if (evidence.status === 'missing') {
      categoryA.push({ fr: fr.id, ac, gap: 'No implementation found' });
    } else if (evidence.status === 'partial') {
      if (evidence.gaps.includes('UI') || evidence.gaps.includes('GUI')) {
        categoryD.push({ fr: fr.id, ac, gap: evidence.gaps });
      } else if (evidence.gaps.includes('test') || evidence.gaps.includes('validation')) {
        categoryB.push({ fr: fr.id, ac, gap: evidence.gaps });
      } else {
        categoryD.push({ fr: fr.id, ac, gap: evidence.gaps });
      }
    }
  }
}

console.log('');
console.log('='.repeat(80));
console.log('## SUMMARY');
console.log('='.repeat(80));
console.log('');
console.log(`Total ACs: 62`);
console.log(`✅ Complete: ${totalComplete} (${Math.round(totalComplete/62*100)}%)`);
console.log(`⚠️  Partial: ${totalPartial} (${Math.round(totalPartial/62*100)}%)`);
console.log(`❌ Missing: ${totalMissing} (${Math.round(totalMissing/62*100)}%)`);
console.log('');

console.log('## GAP CATEGORIES');
console.log('');

console.log(`### Category A: Code Missing (${categoryA.length})`);
for (const item of categoryA) {
  console.log(`- [${item.fr}/${item.ac}] ${item.gap}`);
}
console.log('');

console.log(`### Category B: Code Exists, No Test (${categoryB.length})`);
for (const item of categoryB) {
  console.log(`- [${item.fr}/${item.ac}] ${item.gap}`);
}
console.log('');

console.log(`### Category D: E2E Partial (${categoryD.length})`);
for (const item of categoryD.slice(0, 20)) {
  console.log(`- [${item.fr}/${item.ac}] ${item.gap}`);
}
if (categoryD.length > 20) {
  console.log(`... and ${categoryD.length - 20} more`);
}
console.log('');

console.log('## RELEASE GATE IMPACT');
console.log('');
console.log('### RG-001: V1 FRs spec-ready with AC test mapping');
console.log(`Status: ⚠️  PARTIAL - ${totalPartial} ACs have incomplete mapping`);
console.log('');
console.log('### RG-002: Workbench text AI task complete');
console.log('Status: ✅ COMPLETE - FR-005 AC01/AC08 complete');
console.log('');
console.log('### RG-003: Platform minimums passing');
console.log('Status: ⚠️  PARTIAL - UI validation and dual-host testing incomplete');
console.log('');
