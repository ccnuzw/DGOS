// DGOS App SDK - Browser Entry Point
// Provides defineApp and runtime for browser-based DGOS applications

import { DGOSAppClient } from '../app-client.js';
import type { DGOSAppLifecycle } from '../app-runtime.js';

export * from '../app-runtime.js';
export { DGOSAppClient } from '../app-client.js';
export { BridgeClient, getBridgeClient } from '../bridge-client.js';

let appClient: DGOSAppClient | null = null;

/**
 * Define and initialize a DGOS application
 * This is the main entry point for browser-based DGOS apps
 */
export function defineApp(lifecycle: DGOSAppLifecycle): void {
  if (appClient) {
    console.warn('App already defined. Ignoring duplicate defineApp call.');
    return;
  }

  // Create app client
  appClient = new DGOSAppClient(lifecycle);

  // Store reference globally for host access
  if (typeof window !== 'undefined') {
    (window as any).__DGOS_APP__ = appClient;
  }

  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      initializeApp();
    });
  } else {
    initializeApp();
  }
}

async function initializeApp(): Promise<void> {
  if (!appClient) {
    return;
  }

  try {
    await appClient.initialize();
    console.log('[DGOS] App initialized successfully');
  } catch (error) {
    console.error('[DGOS] Failed to initialize app:', error);
  }
}

/**
 * Get the current app client instance
 * Available after defineApp is called
 */
export function getAppClient(): DGOSAppClient | null {
  return appClient;
}

// Cleanup on page unload
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (appClient) {
      appClient.cleanup().catch(console.error);
    }
  });
}
