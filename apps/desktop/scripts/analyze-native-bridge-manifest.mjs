import fs from 'node:fs';
import path from 'node:path';

const filename = process.argv[2];
if (!filename) {
  console.error('usage: node apps/desktop/scripts/analyze-native-bridge-manifest.mjs <native-manifest.json>');
  process.exit(2);
}

const manifest = JSON.parse(fs.readFileSync(filename, 'utf8'));
const state = manifest.webviewLastState ?? manifest.result ?? {};
const diagnostics = state.frameDiagnostics ?? {};
const hostReady = (diagnostics.hostMessages ?? []).some((message) => message.type === 'dgos.app.ready');
const frameInjected = (diagnostics.injectedPaths ?? []).length > 0;
const result = {
  sourceManifest: path.resolve(filename),
  nativePid: manifest.nativePid ?? manifest.nativeResult?.pid ?? null,
  stage: state.stage ?? null,
  iframePresent: diagnostics.events?.some((event) => event.type === 'present') ?? false,
  iframeLoaded: Number(diagnostics.loads ?? 0) > 0 || diagnostics.events?.some((event) => event.type === 'load') === true,
  iframeResourcePath: diagnostics.events?.find((event) => event.type === 'present')?.src ?? state.frameSrc ?? null,
  frameDriverInjected: frameInjected,
  nativeBridgeHandshake: hostReady,
  frameDriverReady: diagnostics.bridgeReady === true && frameInjected,
  hostHelloSent: diagnostics.hostHello?.sent ?? 0,
  hostHelloErrors: diagnostics.hostHello?.errors ?? [],
  hostMessages: diagnostics.hostMessages ?? [],
  frameEvents: diagnostics.events ?? [],
  conclusion: hostReady && !frameInjected
    ? 'Native Workbench handshake succeeded; the diagnostic frame driver was not injected, causing the test-only frameReady wait to time out.'
    : state.error ?? manifest.error ?? 'No conclusive handshake diagnosis in this manifest.',
};
console.log(JSON.stringify(result, null, 2));
