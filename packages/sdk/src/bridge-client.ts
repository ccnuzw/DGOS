// DGOS Bridge Client
// Handles communication between app iframe and host through postMessage

export interface BridgeMessage {
  type: string;
  payload?: any;
}

export interface BridgeInvokeRequest {
  type: 'dgos.app.invoke';
  requestId: string;
  capability: string;
  input: any;
}

export interface BridgeInvokeResponse {
  type: 'dgos.host.result';
  requestId: string;
  instanceId: string;
  result?: any;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

export interface BridgeHello {
  type: 'dgos.host.hello';
  instanceId: string;
  bridgeVersion: number;
}

export interface BridgeReady {
  type: 'dgos.app.ready';
  instanceId: string;
}

export class BridgeClient {
  private instanceId: string | null = null;
  private bridgeVersion: number | null = null;
  private parentOrigin: string | null = null;
  private pendingRequests = new Map<string, {
    resolve: (value: any) => void;
    reject: (error: any) => void;
    capability: string;
  }>();
  private ready = false;
  private messageHandler: ((event: MessageEvent) => void) | null = null;

  constructor() {
    this.messageHandler = this.handleMessage.bind(this);
  }

  /**
   * Initialize the bridge connection
   * Must be called during app initialization
   */
  async initialize(): Promise<void> {
    if (this.ready) {
      return;
    }

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        window.removeEventListener('message', this.messageHandler!);
        reject(new Error('Bridge initialization timeout'));
      }, 5000);

      window.addEventListener('message', this.messageHandler!);

      // Listen for hello from parent
      const initHandler = (event: MessageEvent) => {
        if (event.source !== window.parent) {
          return;
        }

        const message = event.data as BridgeMessage;
        if (message.type === 'dgos.host.hello') {
          const hello = message as unknown as BridgeHello;

          // Lock to first hello from parent
          if (this.instanceId === null) {
            this.instanceId = hello.instanceId;
            this.bridgeVersion = hello.bridgeVersion;
            this.parentOrigin = event.origin;

            // Send ready response
            const ready: BridgeReady = {
              type: 'dgos.app.ready',
              instanceId: this.instanceId,
            };

            window.parent.postMessage(ready, '*');
            this.ready = true;

            clearTimeout(timeout);
            resolve();
          }
        }
      };

      window.addEventListener('message', initHandler);
    });
  }

  /**
   * Invoke a capability through the bridge
   */
  async invoke<T = any>(capability: string, input: any): Promise<T> {
    if (!this.ready) {
      throw new Error('Bridge not initialized. Call initialize() first.');
    }

    const requestId = crypto.randomUUID();

    return new Promise<T>((resolve, reject) => {
      this.pendingRequests.set(requestId, { resolve, reject, capability });

      const request: BridgeInvokeRequest = {
        type: 'dgos.app.invoke',
        requestId,
        capability,
        input,
      };

      // Send to parent with targetOrigin="*" (opaque-origin requirement)
      window.parent.postMessage(request, '*');

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error(`Bridge invoke timeout for capability: ${capability}`));
        }
      }, 30000);
    });
  }

  private handleMessage(event: MessageEvent): void {
    // Only accept messages from parent
    if (event.source !== window.parent) {
      return;
    }

    // Verify origin matches locked parent (null for opaque origin)
    if (this.parentOrigin !== null && event.origin !== this.parentOrigin) {
      return;
    }

    const message = event.data as BridgeMessage;

    if (message.type === 'dgos.host.result') {
      const response = message as unknown as BridgeInvokeResponse;

      // Verify instance ID
      if (response.instanceId !== this.instanceId) {
        console.error('Instance ID mismatch in bridge response');
        return;
      }

      const pending = this.pendingRequests.get(response.requestId);
      if (pending) {
        this.pendingRequests.delete(response.requestId);

        if (response.error) {
          pending.reject(new Error(response.error.message));
        } else {
          pending.resolve(response.result);
        }
      }
    }
  }

  /**
   * Cleanup and destroy bridge connection
   */
  destroy(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    this.pendingRequests.clear();
    this.ready = false;
    this.instanceId = null;
    this.bridgeVersion = null;
    this.parentOrigin = null;
  }

  /**
   * Get the instance ID
   */
  getInstanceId(): string | null {
    return this.instanceId;
  }

  /**
   * Check if bridge is ready
   */
  isReady(): boolean {
    return this.ready;
  }
}

// Singleton instance
let bridgeInstance: BridgeClient | null = null;

/**
 * Get the global bridge client instance
 */
export function getBridgeClient(): BridgeClient {
  if (!bridgeInstance) {
    bridgeInstance = new BridgeClient();
  }
  return bridgeInstance;
}
