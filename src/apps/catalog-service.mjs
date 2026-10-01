import { validateManifest, manifestDigest } from './manifest-validator.mjs';

export class CatalogService {
  constructor({ repository, audit } = {}) { this.repository = repository; this.audit = audit; }
  async submit({ manifest, packageDigest, catalogState = 'pending_review', actorId, requestId }) {
    const validation = validateManifest(manifest); if (!validation.valid) throw Object.assign(new Error('manifest_invalid'), { statusCode: 422, details: validation.errors });
    const record = await this.repository.recordApp({ appId: manifest.appId, version: manifest.version, build: String(manifest.build), releaseChannel: manifest.releaseChannel, manifest, manifestDigest: manifestDigest(manifest), packageDigest: packageDigest ?? manifestDigest(manifest), catalogState, trustLevel: manifest.trustLevel, uninstallPolicy: manifest.uninstallPolicy, createdAt: new Date().toISOString() });
    if (this.audit) await this.audit.record({ requestId, actorId, action: 'app.manifest.submit', targetType: 'app', targetId: null, summary: { appId: manifest.appId, version: manifest.version, build: manifest.build, manifestDigest: record.manifestDigest } });
    return record;
  }
  async list({ publicOnly = true } = {}) { return { items: await this.repository.listApps({ publicOnly }) }; }
  async approve(input) { return this.repository.setCatalogState(input.appId, input.version, input.build, 'approved', input.actorId, input.requestId); }
  async reject(input) { return this.repository.setCatalogState(input.appId, input.version, input.build, 'rejected', input.actorId, input.requestId); }
  async withdraw(input) { return this.repository.setCatalogState(input.appId, input.version, input.build, 'withdrawn', input.actorId, input.requestId); }
}
