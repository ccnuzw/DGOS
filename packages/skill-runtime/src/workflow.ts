// Skill Workflow - Chain multiple skills together

import type { SkillWorkflow, WorkflowStep, SkillContext, SkillResult } from './types.js';
import { SkillExecutor } from './executor.js';

export class WorkflowExecutor {
  private executor: SkillExecutor;

  constructor(executor: SkillExecutor) {
    this.executor = executor;
  }

  /**
   * Execute a workflow
   */
  async execute(
    workflow: SkillWorkflow,
    initialContext: Omit<SkillContext, 'skillId' | 'parameters'>
  ): Promise<SkillResult[]> {
    const results: SkillResult[] = [];
    let currentStep = workflow.steps[0];
    let stepIndex = 0;
    let previousOutput: any = null;

    while (currentStep && stepIndex < 100) { // Prevent infinite loops
      // Build context for this step
      const context: SkillContext = {
        ...initialContext,
        skillId: currentStep.skillId,
        parameters: {
          ...currentStep.parameters,
          // Pass previous output as input
          previousOutput,
        },
      };

      // Execute skill
      const result = await this.executor.execute(context);
      results.push(result);

      // Determine next step
      if (result.success && currentStep.onSuccess) {
        const nextStep = workflow.steps.find(s => s.skillId === currentStep!.onSuccess);
        if (!nextStep) break;
        currentStep = nextStep;
        previousOutput = result.output;
      } else if (!result.success && currentStep.onFailure) {
        const fallbackStep = workflow.steps.find(s => s.skillId === currentStep!.onFailure);
        if (!fallbackStep) break;
        currentStep = fallbackStep;
        previousOutput = result.error;
      } else {
        // No more steps
        break;
      }

      stepIndex++;
    }

    return results;
  }

  /**
   * Validate a workflow
   */
  validateWorkflow(workflow: SkillWorkflow): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!workflow.workflowId) {
      errors.push('Workflow ID is required');
    }

    if (!workflow.steps || workflow.steps.length === 0) {
      errors.push('At least one step is required');
    }

    // Check for circular references
    const visited = new Set<string>();
    const checkCircular = (stepId: string, path: Set<string>): boolean => {
      if (path.has(stepId)) {
        errors.push(`Circular reference detected: ${Array.from(path).join(' -> ')} -> ${stepId}`);
        return false;
      }

      if (visited.has(stepId)) return true;

      visited.add(stepId);
      const step = workflow.steps.find(s => s.skillId === stepId);
      if (!step) return true;

      const newPath = new Set(path);
      newPath.add(stepId);

      if (step.onSuccess) {
        checkCircular(step.onSuccess, newPath);
      }
      if (step.onFailure) {
        checkCircular(step.onFailure, newPath);
      }

      return true;
    };

    if (workflow.steps.length > 0) {
      checkCircular(workflow.steps[0].skillId, new Set());
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}
