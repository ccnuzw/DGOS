// Adapter Registry - manages registered adapters and their lifecycle

import type {
  ProviderAdapter,
  AdapterFilters,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  AdapterStatus,
} from '../types.js';

export class AdapterRegistry {
  private adapters: Map<string, ProviderAdapter> = new Map();

  /**
   * Register a new adapter
   */
  async register(adapter: ProviderAdapter): Promise<void> {
    // Validate adapter before registration
    const validation = await this.validate(adapter);
    if (!validation.valid) {
      throw new Error(
        `Adapter validation failed: ${validation.errors.map(e => e.message).join(', ')}`
      );
    }

    // Check for conflicts
    if (this.adapters.has(adapter.adapterId)) {
      throw new Error(`Adapter ${adapter.adapterId} is already registered`);
    }

    this.adapters.set(adapter.adapterId, adapter);
  }

  /**
   * Get an adapter by ID
   */
  async get(adapterId: string): Promise<ProviderAdapter | undefined> {
    return this.adapters.get(adapterId);
  }

  /**
   * List all adapters with optional filtering
   */
  async list(filters?: AdapterFilters): Promise<ProviderAdapter[]> {
    let adapters = Array.from(this.adapters.values());

    if (filters?.protocol) {
      adapters = adapters.filter(a => a.protocol === filters.protocol);
    }

    if (filters?.capability) {
      adapters = adapters.filter(a =>
        a.capabilities.some(c => c.capability === filters.capability)
      );
    }

    if (filters?.status) {
      adapters = adapters.filter(a =>
        (a.metadata?.status as AdapterStatus) === filters.status
      );
    }

    return adapters;
  }

  /**
   * Unregister an adapter
   */
  async unregister(adapterId: string): Promise<void> {
    if (!this.adapters.has(adapterId)) {
      throw new Error(`Adapter ${adapterId} not found`);
    }
    this.adapters.delete(adapterId);
  }

  /**
   * Validate an adapter definition
   */
  async validate(adapter: ProviderAdapter): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Required fields
    if (!adapter.adapterId || typeof adapter.adapterId !== 'string') {
      errors.push({
        path: 'adapterId',
        message: 'adapterId is required and must be a string',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!adapter.name?.en) {
      errors.push({
        path: 'name.en',
        message: 'English name is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!adapter.version) {
      errors.push({
        path: 'version',
        message: 'version is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!adapter.protocol) {
      errors.push({
        path: 'protocol',
        message: 'protocol is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!adapter.capabilities || adapter.capabilities.length === 0) {
      errors.push({
        path: 'capabilities',
        message: 'At least one capability is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!adapter.authentication || adapter.authentication.length === 0) {
      errors.push({
        path: 'authentication',
        message: 'At least one authentication method is required',
        code: 'REQUIRED_FIELD',
      });
    }

    if (!adapter.executor) {
      errors.push({
        path: 'executor',
        message: 'executor is required',
        code: 'REQUIRED_FIELD',
      });
    } else {
      // Validate executor has required methods
      if (typeof adapter.executor.execute !== 'function') {
        errors.push({
          path: 'executor.execute',
          message: 'executor.execute method is required',
          code: 'REQUIRED_METHOD',
        });
      }
      if (typeof adapter.executor.test !== 'function') {
        errors.push({
          path: 'executor.test',
          message: 'executor.test method is required',
          code: 'REQUIRED_METHOD',
        });
      }
    }

    // Validate capabilities
    if (adapter.capabilities) {
      adapter.capabilities.forEach((cap, idx) => {
        if (!cap.capability) {
          errors.push({
            path: `capabilities[${idx}].capability`,
            message: 'capability name is required',
            code: 'REQUIRED_FIELD',
          });
        }

        if (!cap.operations || Object.keys(cap.operations).length === 0) {
          errors.push({
            path: `capabilities[${idx}].operations`,
            message: 'At least one operation is required',
            code: 'REQUIRED_FIELD',
          });
        }

        if (!cap.workflows || cap.workflows.length === 0) {
          errors.push({
            path: `capabilities[${idx}].workflows`,
            message: 'At least one workflow is required',
            code: 'REQUIRED_FIELD',
          });
        }

        // Validate operations
        if (cap.operations) {
          Object.entries(cap.operations).forEach(([opName, op]) => {
            if (!op.method) {
              errors.push({
                path: `capabilities[${idx}].operations.${opName}.method`,
                message: 'HTTP method is required',
                code: 'REQUIRED_FIELD',
              });
            }
            if (!op.path) {
              errors.push({
                path: `capabilities[${idx}].operations.${opName}.path`,
                message: 'path is required',
                code: 'REQUIRED_FIELD',
              });
            }
            if (!op.responseMapping) {
              errors.push({
                path: `capabilities[${idx}].operations.${opName}.responseMapping`,
                message: 'responseMapping is required',
                code: 'REQUIRED_FIELD',
              });
            }
          });
        }

        // Validate workflows reference valid operations
        if (cap.workflows && cap.operations) {
          cap.workflows.forEach((workflow, wfIdx) => {
            workflow.steps.forEach((step, stepIdx) => {
              if (!cap.operations[step.operation]) {
                errors.push({
                  path: `capabilities[${idx}].workflows[${wfIdx}].steps[${stepIdx}].operation`,
                  message: `Operation '${step.operation}' not found`,
                  code: 'INVALID_REFERENCE',
                });
              }
            });
          });
        }
      });
    }

    // Warnings
    if (!adapter.modelCatalogEndpoint) {
      warnings.push({
        path: 'modelCatalogEndpoint',
        message: 'modelCatalogEndpoint not specified - model discovery will not be available',
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get all capabilities across all adapters
   */
  async listCapabilities(): Promise<string[]> {
    const capabilities = new Set<string>();
    for (const adapter of this.adapters.values()) {
      for (const cap of adapter.capabilities) {
        capabilities.add(cap.capability);
      }
    }
    return Array.from(capabilities);
  }

  /**
   * Find adapters that support a specific capability
   */
  async findByCapability(capability: string): Promise<ProviderAdapter[]> {
    return this.list({ capability });
  }
}

// Global registry instance
export const globalRegistry = new AdapterRegistry();
