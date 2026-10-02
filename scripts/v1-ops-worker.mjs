import { startWorkerProcess } from '../apps/worker/src/worker.mjs';
import { createRequire } from 'node:module';
import { createProductionSecretAuditAccess, createProductionSecretService, validateProductionConfig } from '../src/security/runtime-config.mjs';

validateProductionConfig();
const requireWorkerDependency = createRequire(new URL('../apps/worker/package.json', import.meta.url));
const { Pool } = requireWorkerDependency('pg');
const database = new Pool({ connectionString: process.env.DGOS_DATABASE_URL, max: 2, connectionTimeoutMillis: 3000 });
database.on('error', () => {});
await database.query('SELECT 1');
const secretService = await createProductionSecretService({ auditAccess: createProductionSecretAuditAccess(database) });
await startWorkerProcess({ secretService });
