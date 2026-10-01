import process from 'node:process';

const platform = process.platform;
if (platform !== 'darwin') {
  console.error(`SKIPPED: macOS desktop E2E requires macOS (current platform: ${platform})`);
  process.exitCode = 2;
} else {
  console.error('SKIPPED: Tauri GUI E2E needs a signed/installed macOS app and a running API/provider fixture.');
  console.error('Run the documented flow in README.md after installing Xcode and cargo-tauri.');
  process.exitCode = 2;
}
