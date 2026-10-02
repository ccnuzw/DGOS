import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';

const source = process.argv[2];
const target = process.argv[3];
if (!source || !target) throw new Error('usage: node deployment/build-seccomp-profile.mjs DOCKER_DEFAULT.json OUTPUT.json');
const bytes = await readFile(source);
const sha256 = createHash('sha256').update(bytes).digest('hex');
if (sha256 !== '6416b47770785a41ac59073cdc77d9fe98517df2799dc83ef207e622de3053f6') throw new Error('docker_default_seccomp_checksum_mismatch');
const profile = JSON.parse(bytes);
if (profile.defaultAction !== 'SCMP_ACT_ERRNO' || !profile.syscalls.some((rule) => rule.names.includes('clone3') && rule.action === 'SCMP_ACT_ERRNO')) throw new Error('docker_default_seccomp_shape_mismatch');

// Retain Docker's default deny rules; add only user namespace creation paths.
profile.syscalls.push({ names: ['clone'], action: 'SCMP_ACT_ALLOW', args: [{ index: 0, value: 0x10000000, valueTwo: 0x10000000, op: 'SCMP_CMP_MASKED_EQ' }], excludes: { arches: ['s390', 's390x'] } });
profile.syscalls.push({ names: ['unshare'], action: 'SCMP_ACT_ALLOW', args: [{ index: 0, value: 0x10000000, valueTwo: 0x10000000, op: 'SCMP_CMP_MASKED_EQ' }] });
profile.syscalls.push({ names: ['mount', 'umount2'], action: 'SCMP_ACT_ALLOW' });
profile.syscalls.push({ names: ['pivot_root'], action: 'SCMP_ACT_ALLOW' });
await writeFile(target, JSON.stringify(profile, null, 2) + '\n', { flag: 'wx' });
console.log(JSON.stringify({ sourceSha256: sha256, rulesAdded: 4, defaultAction: profile.defaultAction }));
