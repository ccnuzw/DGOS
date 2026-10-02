export class ActionWorker {
  constructor({ service, intervalMs = 250 } = {}) { this.service = service; this.intervalMs = intervalMs; this.timer = null; this.active = null; this.stopping = false; }
  async tick() {
    if (this.stopping) return undefined;
    if (this.active) return this.active;
    const work = this.#tickOnce(); this.active = work;
    try { return await work; } finally { if (this.active === work) this.active = null; }
  }
  async #tickOnce() {
    await this.service.reclaim();
    return this.service.processOne();
  }
  start() {
    if (this.timer) return;
    this.stopping = false;
    this.timer = setInterval(() => this.tick().catch(() => {}), this.intervalMs);
    this.timer.unref?.();
  }
  async stop() { this.stopping = true; clearInterval(this.timer); this.timer = null; if (this.active) await Promise.allSettled([this.active]); }
}
