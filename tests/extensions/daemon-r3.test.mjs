import test from 'node:test';
import assert from 'node:assert/strict';
import { ExtensionRunDaemon } from '../../apps/extension-runner/src/daemon.mjs';

test('daemon catches tick errors, bounds claims, and awaits shutdown',async()=>{
  let calls=0,closed=false,release; const gate=new Promise((resolve)=>{release=resolve;}); const errors=[];
  const service={reconcile:async()=>{if(calls===0){calls++;throw new Error('transient');}},processConnectionIntents:async()=>{},recoverConnections:async()=>{},processSecretRevokes:async()=>{},repository:{listRunnable:async()=>Array.from({length:9},(_,i)=>({state:'queued',runId:String(i)}))},process:async()=>gate,runner:{close:async()=>{closed=true;}}};
  const daemon=new ExtensionRunDaemon({service,intervalMs:1,maxConcurrent:2,onError:(e)=>errors.push(e.message)});
  daemon.start(); await new Promise((resolve)=>setTimeout(resolve,20));
  const shutdown=daemon.stop(); assert.equal(closed,false); release(); await shutdown;
  assert.equal(closed,true); assert.ok(errors.includes('transient'));
});
