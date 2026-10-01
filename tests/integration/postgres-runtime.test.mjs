import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { PostgresAppRepository } from '../../src/apps/postgres-repository.mjs';
import { PostgresPermissionRepository } from '../../src/permissions/postgres-repository.mjs';
import { PostgresActionRepository } from '../../src/actions/repository.mjs';
import { PostgresSystemRepository } from '../../src/system/repository.mjs';

const manifest={appId:'com.example.runtime',version:'1.0.0',build:'1',releaseChannel:'stable',catalogState:'approved',manifest:{appId:'com.example.runtime'},manifestDigest:'sha256:test',packageDigest:'sha256:pkg',trustLevel:'official',uninstallPolicy:'allowed'};
test('PostgreSQL runtime repositories persist restart-readable state', async (t) => {
  let pg;
  try { pg = (await import('../../apps/api/node_modules/pg/lib/index.js')).default; } catch (error) { t.skip(`PostgreSQL driver unavailable: ${error.message}`); return; }
  const pool=new pg.Pool({connectionString:process.env.DGOS_DATABASE_URL??'postgres://dgos:dgos@127.0.0.1:5432/dgos'});
  try { await pool.query('SELECT 1'); } catch(error) { await pool.end(); t.skip(`PostgreSQL unavailable: ${error.message}`); return; }
  const migration=await readFile(new URL('../../migrations/0011-runtime-persistence.sql',import.meta.url),'utf8');
  await pool.query(migration);
  const appRepo=new PostgresAppRepository(pool); const permissionRepo=new PostgresPermissionRepository(pool); const actionRepo=new PostgresActionRepository(pool); const systemRepo=new PostgresSystemRepository(pool);
  const subject=randomUUID(); const requestId=randomUUID(); const planId=randomUUID(); const runId=randomUUID(); const scope=randomUUID();
  try {
    const app=await appRepo.recordApp(manifest); assert.equal(app.appId,manifest.appId);
    const install=await appRepo.saveInstall({subjectId:subject,appId:manifest.appId,version:'1.0.0',build:'1',state:'active',requestId}); assert.equal(install.state,'active');
    const restarted=await new PostgresAppRepository(pool).getInstall(subject,manifest.appId); assert.equal(restarted.version,'1.0.0');
    const decision=await permissionRepo.set({subjectId:subject,appId:manifest.appId,capability:'settings.write',scope:'*'},'deny'); assert.equal(decision.decision,'deny'); assert.equal((await new PostgresPermissionRepository(pool).get({subjectId:subject,appId:manifest.appId,capability:'settings.write',scope:'*'})).decision,'deny');
    await actionRepo.saveDefinition({actionId:'settings.open',actionVersion:1,ownerAppId:manifest.appId});
    const plan=await actionRepo.createPlan({planId,requestId,subjectId:subject,actionId:'settings.open',actionVersion:'1',inputDigest:'digest',riskLevel:'low',confirmationRequired:false,inputSummary:[],expiresAt:new Date(Date.now()+60000).toISOString()}); assert.equal(plan.planId,planId);
    const run=await actionRepo.createRun({runId,planId,requestId:randomUUID(),subjectId:subject,actionId:'settings.open',actionVersion:'1',inputDigest:'digest',timeoutAt:new Date(Date.now()+60000).toISOString()}); assert.equal(run.created,true); assert.equal((await new PostgresActionRepository(pool).getRun(runId)).state,'queued');
    await pool.query("INSERT INTO system_settings(scope_id,settings) VALUES($1,$2) ON CONFLICT DO NOTHING",[scope,JSON.stringify({appearance:{mode:'system'}})]); const s=await new PostgresSystemRepository(pool).load(scope); assert.equal(s.settings.appearance.mode,'system');
  } finally { await pool.query('DELETE FROM action_runs WHERE subject_id=$1',[subject]); await pool.query('DELETE FROM action_plans WHERE subject_id=$1',[subject]); await pool.query('DELETE FROM action_definitions WHERE action_id=$1',['settings.open']); await pool.query('DELETE FROM permission_decisions WHERE subject_id=$1',[subject]); await pool.query('DELETE FROM app_installs WHERE subject_id=$1',[subject]); await pool.query('DELETE FROM app_versions WHERE app_id=$1',[manifest.appId]); await pool.query('DELETE FROM system_setting_events WHERE scope_id=$1',[scope]); await pool.query('DELETE FROM system_settings WHERE scope_id=$1',[scope]); await pool.end(); }
});
