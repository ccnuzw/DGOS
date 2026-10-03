// Skill Runtime - Core execution engine for DGOS V1 Skills

export * from './types.js';
export * from './registry.js';
export * from './executor.js';
export * from './workflow.js';

import { SkillRegistry } from './registry.js';
import { SkillExecutor } from './executor.js';

/**
 * Create a skill runtime instance
 */
export function createSkillRuntime() {
  const registry = new SkillRegistry();
  const executor = new SkillExecutor(registry);

  return {
    registry,
    executor,
  };
}
