// Start a configured role in an EXISTING empty shell pane. Never closes panes.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const config = JSON.parse(readFileSync(new URL('./team.json', import.meta.url), 'utf8'));
const [name, pane, sessionId] = process.argv.slice(2);
const role = config.roles.find(r => r.name === name);
if (!role || !pane || process.argv.length > 5) throw new Error('Usage: node .herdr/start-agent.mjs <role-name> <existing-shell-pane-id> [codex-session-id]');
if (sessionId && (role.kind !== 'codex' || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(sessionId))) throw new Error('Resume requires a Codex role and an explicit session UUID');
if (name === 'lead') throw new Error('Keep the existing Lead conversation; Lead replacement requires a handoff');
if (process.env.HERDR_ENV !== '1') throw new Error('Must run inside Herdr');
const api = (...args) => JSON.parse(execFileSync('herdr', args, { encoding: 'utf8', timeout: 55000, maxBuffer: 4 * 1024 * 1024 })).result;
const current = api('pane', 'current', '--current').pane;
const target = api('pane', 'get', pane).pane;
if (target.workspace_id !== current.workspace_id || target.pane_id === current.pane_id || target.agent) {
  throw new Error('Target must be an unoccupied sibling pane in this workspace');
}
const args = [...(role.kind === 'codex' ? config.codexArgs : config.opencodeArgs)];
if (role.kind === 'codex') {
  if (sessionId) args.unshift('resume', sessionId);
  args.push('--cd', root);
  execFileSync(process.execPath, [fileURLToPath(new URL('./prepare-codex-catalog.mjs', import.meta.url))], { stdio: 'inherit' });
  args.push('-c', `model_catalog_json=${JSON.stringify(fileURLToPath(new URL('./state/codex-models.json', import.meta.url)))}`);
  args.push('-c', `developer_instructions=${JSON.stringify(`You are DGOS ${role.label}. Read ${root}.herdr/roles/${role.role} and ${root}AGENTS.md. Only act on the Lead-assigned task. No task: standby. Use native file and exec tools. Do not spawn other agents or change your role/client/model. Report actual commands, evidence and limitations.`)}`);
}
console.log(JSON.stringify(api('agent', 'start', name, '--kind', role.kind, '--pane', pane, '--timeout', '45000', '--', ...args)));
api('tab', 'rename', target.tab_id, role.tabLabel ?? role.label);
api('pane', 'rename', pane, role.label);
