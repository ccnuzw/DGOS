// Skill Executor - Manages skill execution with sandboxing and resource limits

import type {
  SkillContext,
  SkillResult,
  SkillError,
  SkillStatus,
  SkillExecution,
  Skill
} from './types.js';
import { SkillRegistry } from './registry.js';

export class SkillExecutor {
  private executions: Map<string, SkillExecution> = new Map();
  private registry: SkillRegistry;

  constructor(registry: SkillRegistry) {
    this.registry = registry;
  }

  /**
   * Execute a skill
   */
  async execute(context: SkillContext): Promise<SkillResult> {
    const startTime = Date.now();

    // Create execution record
    const execution: SkillExecution = {
      requestId: context.requestId,
      skillId: context.skillId,
      status: 'pending',
      context,
      startedAt: new Date().toISOString(),
    };
    this.executions.set(context.requestId, execution);

    try {
      // Get skill
      const skill = await this.registry.get(context.skillId);

      // Validate skill is enabled
      if (skill.state !== 'enabled') {
        throw this.createError('SKILL_DISABLED', `Skill ${context.skillId} is not enabled`);
      }

      // Validate permissions
      await this.validatePermissions(skill, context);

      // Validate parameters
      await this.validateParameters(skill, context.parameters);

      // Update status
      execution.status = 'running';

      // Execute with timeout
      const timeout = skill.manifest.execution.timeout || 30000;
      const result = await this.executeWithTimeout(skill, context, timeout);

      // Update execution
      execution.status = 'succeeded';
      execution.result = result;
      execution.completedAt = new Date().toISOString();

      // Update statistics
      const duration = Date.now() - startTime;
      await this.registry.updateStats(context.skillId, true, duration);

      return result;

    } catch (error: any) {
      // Update execution
      execution.status = 'failed';
      const skillError = this.normalizeError(error);
      execution.result = {
        success: false,
        error: skillError,
      };
      execution.completedAt = new Date().toISOString();

      // Update statistics
      const duration = Date.now() - startTime;
      await this.registry.updateStats(context.skillId, false, duration);

      return execution.result;
    }
  }

  /**
   * Cancel a running execution
   */
  async cancel(requestId: string): Promise<void> {
    const execution = this.executions.get(requestId);
    if (!execution) {
      throw new Error(`Execution not found: ${requestId}`);
    }

    if (execution.status === 'running') {
      execution.status = 'cancelled';
      execution.completedAt = new Date().toISOString();
    }
  }

  /**
   * Get execution status
   */
  async getStatus(requestId: string): Promise<SkillStatus> {
    const execution = this.executions.get(requestId);
    if (!execution) {
      throw new Error(`Execution not found: ${requestId}`);
    }
    return execution.status;
  }

  /**
   * Get execution details
   */
  async getExecution(requestId: string): Promise<SkillExecution> {
    const execution = this.executions.get(requestId);
    if (!execution) {
      throw new Error(`Execution not found: ${requestId}`);
    }
    return execution;
  }

  /**
   * List recent executions for a skill
   */
  async listExecutions(skillId: string, limit = 10): Promise<SkillExecution[]> {
    const executions = Array.from(this.executions.values())
      .filter(e => e.skillId === skillId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, limit);
    return executions;
  }

  private async executeWithTimeout(
    skill: Skill,
    context: SkillContext,
    timeout: number
  ): Promise<SkillResult> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(this.createError('TIMEOUT', `Skill execution exceeded ${timeout}ms`));
      }, timeout);

      // Execute skill (this would call the actual skill handler)
      this.executeSandboxed(skill, context)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  private async executeSandboxed(skill: Skill, context: SkillContext): Promise<SkillResult> {
    // In a real implementation, this would:
    // 1. Create isolated execution environment
    // 2. Inject skill API
    // 3. Apply resource limits (memory, CPU)
    // 4. Execute skill handler
    // 5. Collect logs and metrics

    // For now, return a placeholder result
    return {
      success: true,
      output: {
        message: 'Skill execution not yet implemented',
        skillId: skill.skillId,
        parameters: context.parameters,
      },
      metadata: {
        duration: 0,
      },
    };
  }

  private async validatePermissions(skill: Skill, context: SkillContext): Promise<void> {
    // Validate that skill has necessary permissions
    // This would check against the permission system
    for (const permission of skill.manifest.permissions) {
      // Check if permission is granted
      // For now, we'll assume all permissions are granted
    }
  }

  private async validateParameters(skill: Skill, parameters: Record<string, any>): Promise<void> {
    for (const param of skill.manifest.parameters) {
      const value = parameters[param.name];

      // Check required
      if (param.required && (value === undefined || value === null)) {
        throw this.createError(
          'MISSING_PARAMETER',
          `Required parameter missing: ${param.name}`
        );
      }

      // Type validation
      if (value !== undefined && value !== null) {
        this.validateParameterType(param, value);
      }

      // Validation rules
      if (param.validation && value !== undefined) {
        this.validateParameterRules(param, value);
      }
    }
  }

  private validateParameterType(param: any, value: any): void {
    const actualType = typeof value;

    switch (param.type) {
      case 'string':
        if (actualType !== 'string') {
          throw this.createError('TYPE_ERROR', `Parameter ${param.name} must be string`);
        }
        break;
      case 'number':
        if (actualType !== 'number') {
          throw this.createError('TYPE_ERROR', `Parameter ${param.name} must be number`);
        }
        break;
      case 'boolean':
        if (actualType !== 'boolean') {
          throw this.createError('TYPE_ERROR', `Parameter ${param.name} must be boolean`);
        }
        break;
      case 'enum':
        if (!param.options || !param.options.includes(value)) {
          throw this.createError(
            'INVALID_VALUE',
            `Parameter ${param.name} must be one of: ${param.options?.join(', ')}`
          );
        }
        break;
    }
  }

  private validateParameterRules(param: any, value: any): void {
    const { validation } = param;

    if (validation.min !== undefined && value < validation.min) {
      throw this.createError('VALIDATION_ERROR', `${param.name} must be >= ${validation.min}`);
    }

    if (validation.max !== undefined && value > validation.max) {
      throw this.createError('VALIDATION_ERROR', `${param.name} must be <= ${validation.max}`);
    }

    if (validation.pattern) {
      const regex = new RegExp(validation.pattern);
      if (!regex.test(String(value))) {
        throw this.createError('VALIDATION_ERROR', `${param.name} does not match pattern`);
      }
    }
  }

  private createError(code: string, message: string): SkillError {
    return { code, message };
  }

  private normalizeError(error: any): SkillError {
    if (error.code && error.message) {
      return error as SkillError;
    }
    return {
      code: 'UNKNOWN_ERROR',
      message: error.message || String(error),
    };
  }
}
