#!/usr/bin/env node
import { readFileSync } from 'fs';

const frFiles = [
  { id: 'FR-001', path: 'docs/03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md', name: '桌面与应用工作区' },
  { id: 'FR-002', path: 'docs/03-功能规格/V1/02-开发者体验/01-开发者中心与APP生命周期.md', name: '开发者中心与APP生命周期' },
  { id: 'FR-003', path: 'docs/03-功能规格/V1/03-Agent与协议/01-SkillMCP与Agent接入.md', name: 'SkillMCP与Agent接入' },
  { id: 'FR-005', path: 'docs/03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md', name: '多模态AI任务工作流' },
  { id: 'FR-007', path: 'docs/03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md', name: '模型平台与工作流配置' },
  { id: 'FR-009', path: 'docs/03-功能规格/V1/09-系统助手/01-系统智能助手与快捷指令.md', name: '系统智能助手与快捷指令' },
  { id: 'FR-010', path: 'docs/03-功能规格/V1/10-身份与治理/01-管理员登录与会话.md', name: '管理员登录与会话' },
  { id: 'FR-011', path: 'docs/03-功能规格/V1/10-身份与治理/02-API-Key生命周期.md', name: 'API-Key生命周期' },
  { id: 'FR-012', path: 'docs/03-功能规格/V1/10-身份与治理/03-Provider账号与连接.md', name: 'Provider账号与连接' },
  { id: 'FR-013', path: 'docs/03-功能规格/V1/10-身份与治理/04-上游账号连接测试.md', name: '上游账号连接测试' },
  { id: 'FR-014', path: 'docs/03-功能规格/V1/10-身份与治理/05-审计与管理员系统治理.md', name: '审计与管理员系统治理' },
  { id: 'FR-015', path: 'docs/03-功能规格/V1/10-身份与治理/06-用量与额度管理.md', name: '用量与额度管理' },
];

let totalACs = 0;

for (const fr of frFiles) {
  const content = readFileSync(fr.path, 'utf-8');
  const lines = content.split('\n');

  const acs = [];
  let currentAC = null;
  let inAC = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.match(/^####\s+AC\d+/)) {
      if (currentAC) {
        acs.push(currentAC);
      }
      const match = line.match(/^####\s+(AC\d+)\s+(.+)/);
      currentAC = {
        id: match[1],
        title: match[2],
        given: [],
        when: [],
        then: [],
        and: []
      };
      inAC = true;
    } else if (inAC && line.startsWith('Given ')) {
      currentAC.given.push(line.substring(6));
    } else if (inAC && line.startsWith('When ')) {
      currentAC.when.push(line.substring(5));
    } else if (inAC && line.startsWith('Then ')) {
      currentAC.then.push(line.substring(5));
    } else if (inAC && line.startsWith('并且')) {
      currentAC.and.push(line.substring(2));
    } else if (inAC && line.match(/^###[^#]/)) {
      if (currentAC) {
        acs.push(currentAC);
        currentAC = null;
      }
      inAC = false;
    }
  }

  if (currentAC) {
    acs.push(currentAC);
  }

  console.log(`\n## ${fr.id}: ${fr.name}`);
  console.log(`Total ACs: ${acs.length}\n`);

  for (const ac of acs) {
    console.log(`### ${ac.id}: ${ac.title}`);
    if (ac.given.length > 0) console.log(`Given: ${ac.given.join(' ')}`);
    if (ac.when.length > 0) console.log(`When: ${ac.when.join(' ')}`);
    if (ac.then.length > 0) console.log(`Then: ${ac.then.join(' ')}`);
    if (ac.and.length > 0) console.log(`并且: ${ac.and.join(' ')}`);
    console.log('');
  }

  totalACs += acs.length;
}

console.log(`\n===================`);
console.log(`TOTAL ACs: ${totalACs}`);
console.log(`===================`);
