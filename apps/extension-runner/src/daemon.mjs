import { randomUUID } from 'node:crypto';

export class ExtensionRunDaemon {
  constructor({ service, intervalMs = 100, workerId = `extension-${randomUUID()}`, maxConcurrent = 4, onError = () => {} }) { Object.assign(this,{service,intervalMs,workerId,maxConcurrent,onError}); this.stopped=true; this.currentTick=null; }
  async tick() { await this.service.managementRepository?.recoverSecretWrites(this.service.secretService); await this.service.reconcile(); await this.service.processConnectionIntents(this.workerId); await this.service.recoverConnections(this.workerId); await this.service.processSecretRevokes(); const runnable=await this.service.repository.listRunnable(); const items=[]; for(const run of runnable){ if(run.state==='queued'||await this.service.managementRepository?.taskIntent(run.runId)){items.push(run);if(items.length===this.maxConcurrent)break;} } const settled=await Promise.allSettled(items.map((r)=>this.service.process(r.runId,this.workerId))); for(const result of settled) if(result.status==='rejected') this.onError(result.reason); }
  start() { if(!this.stopped) return; this.stopped=false; const loop=async()=>{ if(this.stopped)return; this.currentTick=this.tick(); try { await this.currentTick; } catch(error) { this.onError(error); } finally { this.currentTick=null; if(!this.stopped) this.timer=setTimeout(loop,this.intervalMs); } }; this.timer=setTimeout(loop,0); }
  async stop() { this.stopped=true; clearTimeout(this.timer); if(this.currentTick) await this.currentTick.catch((error)=>this.onError(error)); await this.service.runner?.close?.(); }
}
