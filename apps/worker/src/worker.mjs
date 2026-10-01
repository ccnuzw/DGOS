import { apiVersion } from '@dgos/sdk';

export function createWorkerInfo() {
  return { service: 'dgos-worker', apiVersion, status: 'idle' };
}

if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  console.log(JSON.stringify(createWorkerInfo()));
}
