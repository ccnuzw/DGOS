// Skill Registry - Manages skill registration, discovery, and matching

import type {
  Skill,
  SkillManifest,
  SkillFilters,
  SkillMatch,
  SkillState
} from './types.js';

export class SkillRegistry {
  private skills: Map<string, Skill> = new Map();
  private triggerIndex: Map<string, Set<string>> = new Map();

  /**
   * Register a new skill
   */
  async register(skillId: string, manifest: SkillManifest): Promise<void> {
    // Validate manifest
    this.validateManifest(manifest);

    // Check permissions
    this.validatePermissions(manifest.permissions);

    // Create skill record
    const skill: Skill = {
      skillId,
      manifest,
      state: 'disabled', // Start disabled for safety
      stateVersion: 1,
      installedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      stats: {
        invocationCount: 0,
        successCount: 0,
        failureCount: 0,
        averageDuration: 0,
      },
    };

    // Store skill
    this.skills.set(skillId, skill);

    // Index triggers
    this.indexTriggers(skillId, manifest.triggers);
  }

  /**
   * Unregister a skill
   */
  async unregister(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    // Remove trigger indexes
    this.unindexTriggers(skillId, skill.manifest.triggers);

    // Remove skill
    this.skills.delete(skillId);
  }

  /**
   * List skills with optional filters
   */
  async list(filters?: SkillFilters): Promise<Skill[]> {
    let results = Array.from(this.skills.values());

    if (filters) {
      if (filters.category) {
        results = results.filter(s => s.manifest.category === filters.category);
      }

      if (filters.tags && filters.tags.length > 0) {
        results = results.filter(s =>
          filters.tags!.some(tag => s.manifest.tags.includes(tag))
        );
      }

      if (filters.state) {
        results = results.filter(s => s.state === filters.state);
      }

      if (filters.search) {
        const search = filters.search.toLowerCase();
        results = results.filter(s =>
          s.manifest.name.en.toLowerCase().includes(search) ||
          s.manifest.name.zh.toLowerCase().includes(search) ||
          s.manifest.description.en.toLowerCase().includes(search) ||
          s.manifest.description.zh.toLowerCase().includes(search) ||
          s.skillId.toLowerCase().includes(search)
        );
      }
    }

    return results;
  }

  /**
   * Get a specific skill
   */
  async get(skillId: string): Promise<Skill> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }
    return skill;
  }

  /**
   * Enable a skill
   */
  async enable(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    skill.state = 'enabled';
    skill.stateVersion += 1;
    skill.updatedAt = new Date().toISOString();
  }

  /**
   * Disable a skill
   */
  async disable(skillId: string): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill) {
      throw new Error(`Skill not found: ${skillId}`);
    }

    skill.state = 'disabled';
    skill.stateVersion += 1;
    skill.updatedAt = new Date().toISOString();
  }

  /**
   * Match user query to skills
   */
  async match(query: string): Promise<SkillMatch[]> {
    const matches: SkillMatch[] = [];
    const lowerQuery = query.toLowerCase();

    for (const skill of this.skills.values()) {
      if (skill.state !== 'enabled') continue;

      for (const trigger of skill.manifest.triggers) {
        const match = this.matchTrigger(trigger, lowerQuery);
        if (match) {
          matches.push({
            skillId: skill.skillId,
            trigger,
            score: match.score,
            parameters: match.parameters,
          });
        }
      }
    }

    // Sort by score descending
    matches.sort((a, b) => b.score - a.score);

    return matches;
  }

  /**
   * Update skill statistics
   */
  async updateStats(skillId: string, success: boolean, duration: number): Promise<void> {
    const skill = this.skills.get(skillId);
    if (!skill || !skill.stats) return;

    skill.stats.invocationCount += 1;
    if (success) {
      skill.stats.successCount += 1;
    } else {
      skill.stats.failureCount += 1;
    }

    // Update average duration
    const total = skill.stats.averageDuration * (skill.stats.invocationCount - 1) + duration;
    skill.stats.averageDuration = total / skill.stats.invocationCount;
    skill.stats.lastInvocation = new Date().toISOString();
  }

  private validateManifest(manifest: SkillManifest): void {
    if (!manifest.skillId || !/^[a-z0-9_][a-z0-9_.-]*$/.test(manifest.skillId)) {
      throw new Error('Invalid skillId format');
    }

    if (!manifest.version || !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      throw new Error('Invalid version format');
    }

    if (!manifest.name?.en || !manifest.name?.zh) {
      throw new Error('Name required in both en and zh');
    }

    if (!manifest.triggers || manifest.triggers.length === 0) {
      throw new Error('At least one trigger required');
    }
  }

  private validatePermissions(permissions: any[]): void {
    // Validate permission format and check against capability system
    for (const perm of permissions) {
      if (!perm.capability || !perm.reason) {
        throw new Error('Permission must have capability and reason');
      }
    }
  }

  private indexTriggers(skillId: string, triggers: any[]): void {
    for (const trigger of triggers) {
      const key = `${trigger.type}:${trigger.value}`;
      if (!this.triggerIndex.has(key)) {
        this.triggerIndex.set(key, new Set());
      }
      this.triggerIndex.get(key)!.add(skillId);
    }
  }

  private unindexTriggers(skillId: string, triggers: any[]): void {
    for (const trigger of triggers) {
      const key = `${trigger.type}:${trigger.value}`;
      const set = this.triggerIndex.get(key);
      if (set) {
        set.delete(skillId);
        if (set.size === 0) {
          this.triggerIndex.delete(key);
        }
      }
    }
  }

  private matchTrigger(trigger: any, query: string): { score: number; parameters?: Record<string, any> } | null {
    switch (trigger.type) {
      case 'keyword':
        if (query.includes(trigger.value.toLowerCase())) {
          return { score: 0.9 };
        }
        return null;

      case 'pattern':
        const regex = new RegExp(trigger.value, 'i');
        const match = query.match(regex);
        if (match) {
          const parameters: Record<string, any> = {};
          // Extract capture groups as parameters
          for (let i = 1; i < match.length; i++) {
            parameters[`param${i}`] = match[i];
          }
          return { score: 0.95, parameters };
        }
        return null;

      case 'intent':
        // Simple intent matching (could be enhanced with NLU)
        if (query.includes(trigger.value.toLowerCase())) {
          return { score: 0.8 };
        }
        return null;

      default:
        return null;
    }
  }
}
