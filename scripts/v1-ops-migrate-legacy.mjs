import { readFile } from 'node:fs/promises';
import { createFileRootKeyHandle, DurableSecretService } from '../src/security/durable-secret-service.mjs';

const [ciphertextDirectory, keyDirectory, reviewManifest, confirmation] = process.argv.slice(2);
if (!ciphertextDirectory || !keyDirectory || !reviewManifest || confirmation !== '--offline-reviewed-legacy-state') throw new Error('usage: node scripts/v1-ops-migrate-legacy.mjs CIPHERTEXT_DIR KEY_DIR REVIEWED_DIGESTS_JSON --offline-reviewed-legacy-state');
const reviewedRecordDigests = JSON.parse(await readFile(reviewManifest, 'utf8'));
const service = await new DurableSecretService({ directory: ciphertextDirectory, rootKeyHandle: createFileRootKeyHandle({ keyDirectory }) }).ready();
const result = await service.migrateLegacy({ trustLegacyControlState: true, reviewedRecordDigests });
await service.verifyCiphertext();
console.log(JSON.stringify(result));
