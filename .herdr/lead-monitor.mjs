#!/usr/bin/env node
// Lead自动监控脚本 - 让Lead变成主动协调者

import { execSync } from 'child_process';
import fs from 'fs';

const WORKSPACE = 'wJ';
let lastCheck = {};

// 主动检查团队状态
function checkTeam() {
  console.log(`\n⏰ [${new Date().toLocaleTimeString()}] Lead检查团队状态...`);

  try {
    const result = execSync(`herdr agent list --workspace ${WORKSPACE}`, { encoding: 'utf8' });
    const data = JSON.parse(result);
    const agents = data.result.agents.filter(a => a.workspace_id === WORKSPACE);

    // 检查状态变化
    for (const agent of agents) {
      const name = agent.name || 'unnamed';
      const status = agent.agent_status;
      const last = lastCheck[name];

      if (last && last !== status) {
        console.log(`  🔄 ${name}: ${last} → ${status}`);

        // Planner完成
        if (name === 'planner' && status === 'idle' && last === 'working') {
          notifyLead('Planner已完成，请检查并派发任务');
        }

        // Worker完成
        if (name.startsWith('worker-') && status === 'idle' && last === 'working') {
          notifyLead(`${name}已完成，请检查并决定验证`);
        }

        // Verify完成
        if (name === 'verify' && status === 'idle' && last === 'working') {
          notifyLead('Verify已完成，请检查结果并决定整合');
        }
      }

      lastCheck[name] = status;
    }

    // 显示当前working的agents
    const working = agents.filter(a => a.agent_status === 'working');
    if (working.length > 0) {
      console.log(`  ✓ 工作中: ${working.map(a => a.name).join(', ')}`);
    } else {
      console.log(`  ℹ️  所有agents都是idle`);
    }

  } catch (e) {
    console.error('  ❌ 检查失败:', e.message);
  }
}

function notifyLead(message) {
  console.log(`  📢 → Lead: ${message}`);
  try {
    execSync(`herdr agent prompt lead "${message}"`, { stdio: 'pipe' });
  } catch (e) {
    console.log(`  ⚠️  通知Lead失败: ${e.message}`);
  }
}

// 每5分钟检查一次
console.log('🤖 Lead监控启动（每5分钟检查）...\n');
setInterval(checkTeam, 5 * 60 * 1000);
checkTeam(); // 立即执行第一次
