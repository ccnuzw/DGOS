#!/usr/bin/env node
// .herdr/coordinator.mjs
// DGOS团队自动协调守护进程

import { execSync } from 'child_process';
import fs from 'fs';
import yaml from 'yaml';

const WORKSPACE = 'wJ';
const CHECK_INTERVAL = 5 * 60 * 1000; // 5分钟
const STATUS_FILE = '.herdr/status/current.yaml';

console.log('🤖 DGOS Coordinator启动...');
console.log(`检查间隔: ${CHECK_INTERVAL / 1000}秒`);
console.log('');

// 读取agent状态
function getAgentStatus() {
  const result = execSync(`herdr agent list --workspace ${WORKSPACE}`, { encoding: 'utf8' });
  const data = JSON.parse(result);
  return data.result.agents.filter(a => a.workspace_id === WORKSPACE);
}

// 读取任务状态
function getTaskStatus() {
  if (!fs.existsSync(STATUS_FILE)) return { tasks: [] };
  return yaml.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
}

// 更新任务状态
function updateTaskStatus(updates) {
  const status = getTaskStatus();
  Object.assign(status, updates);
  status.last_updated = new Date().toISOString();
  fs.writeFileSync(STATUS_FILE, yaml.stringify(status));
}

// 派发agent任务
function promptAgent(agentName, message) {
  console.log(`📤 派发任务给 ${agentName}`);
  execSync(`herdr agent prompt ${agentName} "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
}

// 通知Lead
function notifyLead(message) {
  console.log(`📢 通知Lead: ${message}`);
  execSync(`herdr agent prompt lead "${message.replace(/"/g, '\\"')}"`, { stdio: 'inherit' });
}

// 检查状态变化
let lastAgentStates = {};

function checkAndAct() {
  console.log(`\n⏰ [${new Date().toLocaleTimeString()}] 检查团队状态...`);

  const agents = getAgentStatus();
  const status = getTaskStatus();

  let hasChanges = false;

  // 检查每个agent的状态变化
  for (const agent of agents) {
    const name = agent.name || 'unnamed';
    const currentState = agent.agent_status;
    const lastState = lastAgentStates[name];

    // 状态发生变化
    if (lastState && lastState !== currentState) {
      console.log(`  🔄 ${name}: ${lastState} → ${currentState}`);

      // Planner完成 → 派发Workers
      if (name === 'planner' && lastState === 'working' && currentState === 'idle') {
        console.log('  ✅ Planner完成，准备派发Workers...');
        hasChanges = true;

        // 读取delivery-board，找到待派发的work-packages
        setTimeout(() => {
          notifyLead('Planner已完成评估，请检查并派发work-packages给Workers');
        }, 1000);
      }

      // Worker完成 → 派发Verify
      if (name.startsWith('worker-') && lastState === 'working' && currentState === 'idle') {
        console.log(`  ✅ ${name}完成，准备派发Verify...`);
        hasChanges = true;

        setTimeout(() => {
          notifyLead(`${name}已完成工作，请检查并派发Verify验证`);
        }, 1000);
      }

      // Verify完成 → 通知Lead整合
      if (name === 'verify' && lastState === 'working' && currentState === 'idle') {
        console.log('  ✅ Verify完成，通知Lead决策...');
        hasChanges = true;

        setTimeout(() => {
          notifyLead('Verify已完成验证，请检查结果并决策是否整合');
        }, 1000);
      }
    }

    lastAgentStates[name] = currentState;
  }

  // 检查任务超时（>24小时没进展）
  if (status.tasks) {
    for (const task of status.tasks) {
      if (task.status === 'working' && task.started_at) {
        const elapsed = Date.now() - new Date(task.started_at).getTime();
        const hours = elapsed / (1000 * 60 * 60);

        if (hours > 24) {
          console.log(`  ⚠️  ${task.id} 已运行${hours.toFixed(1)}小时，可能阻塞`);
          notifyLead(`任务${task.id}运行超过24小时，请检查是否阻塞`);
        }
      }
    }
  }

  if (!hasChanges) {
    console.log('  ✓ 无状态变化');
  }
}

// 主循环
console.log('开始监控...\n');
setInterval(checkAndAct, CHECK_INTERVAL);

// 立即执行第一次检查
checkAndAct();

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 Coordinator停止');
  process.exit(0);
});
