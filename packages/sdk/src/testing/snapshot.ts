// DGOS Snapshot Testing Utilities
// Tools for snapshot testing and visual regression

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

export class SnapshotManager {
  private snapshots = new Map<string, any>();
  private snapshotDir: string;
  private updateSnapshots: boolean;

  constructor(snapshotDir: string, updateSnapshots: boolean = false) {
    this.snapshotDir = snapshotDir;
    this.updateSnapshots = updateSnapshots;
  }

  /**
   * Initialize snapshot manager by loading existing snapshots
   */
  async initialize(): Promise<void> {
    try {
      const snapshotFile = join(this.snapshotDir, 'snapshots.json');
      const content = await readFile(snapshotFile, 'utf-8');
      const data = JSON.parse(content);
      this.snapshots = new Map(Object.entries(data));
    } catch (err) {
      // Snapshot file doesn't exist yet, that's fine
      this.snapshots = new Map();
    }
  }

  /**
   * Save all snapshots to disk
   */
  async save(): Promise<void> {
    await mkdir(this.snapshotDir, { recursive: true });
    const snapshotFile = join(this.snapshotDir, 'snapshots.json');
    const data = Object.fromEntries(this.snapshots);
    await writeFile(snapshotFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Match a value against a snapshot
   */
  match(snapshotId: string, value: any): { pass: boolean; message?: string } {
    const serialized = this.serialize(value);

    if (!this.snapshots.has(snapshotId)) {
      // No snapshot exists, create one
      this.snapshots.set(snapshotId, serialized);
      return { pass: true };
    }

    const expected = this.snapshots.get(snapshotId);

    if (this.updateSnapshots) {
      this.snapshots.set(snapshotId, serialized);
      return { pass: true };
    }

    const pass = this.deepEqual(serialized, expected);

    if (!pass) {
      return {
        pass: false,
        message: `Snapshot ${snapshotId} does not match.\nExpected:\n${JSON.stringify(expected, null, 2)}\n\nReceived:\n${JSON.stringify(serialized, null, 2)}`,
      };
    }

    return { pass: true };
  }

  /**
   * Serialize value for snapshot comparison
   */
  private serialize(value: any): any {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value === 'function') {
      return '[Function]';
    }

    if (value instanceof Date) {
      return { __type: 'Date', value: value.toISOString() };
    }

    if (value instanceof RegExp) {
      return { __type: 'RegExp', value: value.toString() };
    }

    if (value instanceof Map) {
      return { __type: 'Map', value: Array.from(value.entries()) };
    }

    if (value instanceof Set) {
      return { __type: 'Set', value: Array.from(value) };
    }

    if (Array.isArray(value)) {
      return value.map(v => this.serialize(v));
    }

    if (typeof value === 'object') {
      const serialized: any = {};
      for (const key of Object.keys(value)) {
        serialized[key] = this.serialize(value[key]);
      }
      return serialized;
    }

    return value;
  }

  /**
   * Deep equality check
   */
  private deepEqual(a: any, b: any): boolean {
    if (a === b) return true;
    if (a === null || b === null) return false;
    if (typeof a !== typeof b) return false;

    if (Array.isArray(a) && Array.isArray(b)) {
      if (a.length !== b.length) return false;
      return a.every((val, i) => this.deepEqual(val, b[i]));
    }

    if (typeof a === 'object' && typeof b === 'object') {
      const keysA = Object.keys(a);
      const keysB = Object.keys(b);

      if (keysA.length !== keysB.length) return false;

      return keysA.every(key => this.deepEqual(a[key], b[key]));
    }

    return false;
  }

  /**
   * Get all snapshot IDs
   */
  getSnapshotIds(): string[] {
    return Array.from(this.snapshots.keys());
  }

  /**
   * Clear all snapshots
   */
  clear(): void {
    this.snapshots.clear();
  }
}

/**
 * Create a snapshot manager
 */
export function createSnapshotManager(
  snapshotDir: string,
  updateSnapshots: boolean = false
): SnapshotManager {
  return new SnapshotManager(snapshotDir, updateSnapshots);
}
