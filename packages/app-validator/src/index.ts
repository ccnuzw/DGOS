/**
 * DGOS Application Manifest Validator
 * Comprehensive validation for application manifests with detailed error reporting
 */

import Ajv, { ValidateFunction, ErrorObject } from 'ajv';
import addFormats from 'ajv-formats';
import * as fs from 'fs';
import * as path from 'path';

// Import schemas
import manifestSchemaV1 from '../../../docs/04-技术架构/当前版本/V1-app-manifest.schema.json';
import manifestSchemaV2 from '../../../docs/04-技术架构/当前版本/V2-app-manifest.schema.json';

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
  severity: 'error' | 'critical';
  suggestion?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
  suggestion?: string;
}

export interface ValidatorOptions {
  strict?: boolean;
  checkFiles?: boolean;
  basePath?: string;
  allowUnknownFields?: boolean;
}

export class AppManifestValidator {
  private ajv: Ajv;
  private validateV1: ValidateFunction;
  private validateV2: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      strict: true,
      validateFormats: true
    });

    addFormats(this.ajv);

    // Compile schemas
    this.validateV1 = this.ajv.compile(manifestSchemaV1);
    this.validateV2 = this.ajv.compile(manifestSchemaV2);
  }

  /**
   * Validate application manifest
   */
  public validate(manifest: any, options: ValidatorOptions = {}): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Check manifest exists
    if (!manifest) {
      return {
        valid: false,
        errors: [{
          code: 'MANIFEST_MISSING',
          message: 'Manifest is null or undefined',
          severity: 'critical'
        }],
        warnings: []
      };
    }

    // Check format field
    if (!manifest.format) {
      errors.push({
        code: 'FORMAT_MISSING',
        message: 'Manifest "format" field is required',
        severity: 'critical',
        suggestion: 'Add "format": "dgos-app/v1" or "dgos-app/v2" to your manifest'
      });
      return { valid: false, errors, warnings };
    }

    // Validate based on format version
    let schemaValid = false;
    let validateFn: ValidateFunction;

    if (manifest.format === 'dgos-app/v1') {
      validateFn = this.validateV1;
    } else if (manifest.format === 'dgos-app/v2') {
      validateFn = this.validateV2;
    } else {
      errors.push({
        code: 'FORMAT_UNKNOWN',
        message: `Unknown manifest format: ${manifest.format}`,
        severity: 'critical',
        suggestion: 'Use "dgos-app/v1" or "dgos-app/v2"'
      });
      return { valid: false, errors, warnings };
    }

    schemaValid = validateFn(manifest);

    // Convert Ajv errors to our format
    if (!schemaValid && validateFn.errors) {
      for (const error of validateFn.errors) {
        errors.push(this.convertAjvError(error));
      }
    }

    // Perform additional validations
    this.validateAppId(manifest, errors, warnings);
    this.validateVersion(manifest, errors, warnings);
    this.validateLocalization(manifest, errors, warnings);
    this.validatePaths(manifest, options, errors, warnings);
    this.validatePermissions(manifest, errors, warnings);
    this.validateDependencies(manifest, errors, warnings);
    this.validateActions(manifest, errors, warnings);

    // Strict mode checks
    if (options.strict) {
      this.performStrictChecks(manifest, warnings);
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings
    };
  }

  /**
   * Validate manifest file from path
   */
  public async validateFile(filePath: string, options: ValidatorOptions = {}): Promise<ValidationResult> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      const manifest = JSON.parse(content);

      const basePath = options.basePath || path.dirname(filePath);
      return this.validate(manifest, { ...options, basePath });
    } catch (error: any) {
      return {
        valid: false,
        errors: [{
          code: 'FILE_READ_ERROR',
          message: `Failed to read manifest file: ${error.message}`,
          severity: 'critical'
        }],
        warnings: []
      };
    }
  }

  /**
   * Convert Ajv error to our error format
   */
  private convertAjvError(error: ErrorObject): ValidationError {
    const path = error.instancePath || error.schemaPath;
    let message = error.message || 'Validation error';
    let suggestion: string | undefined;

    // Enhanced error messages
    if (error.keyword === 'required') {
      const missingProp = (error.params as any).missingProperty;
      message = `Missing required field: ${missingProp}`;
      suggestion = `Add the "${missingProp}" field to your manifest`;
    } else if (error.keyword === 'pattern') {
      message = `Field "${path}" does not match required pattern`;
      suggestion = 'Check the field format in the documentation';
    } else if (error.keyword === 'enum') {
      const allowedValues = (error.params as any).allowedValues;
      message = `Field "${path}" must be one of: ${allowedValues.join(', ')}`;
    } else if (error.keyword === 'type') {
      const expectedType = (error.params as any).type;
      message = `Field "${path}" must be of type ${expectedType}`;
    }

    return {
      code: `SCHEMA_${error.keyword.toUpperCase()}`,
      message,
      path,
      severity: 'error',
      suggestion
    };
  }

  /**
   * Validate appId format and conventions
   */
  private validateAppId(manifest: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!manifest.appId) return;

    const appId = manifest.appId;

    // Check reverse domain notation
    if (!appId.includes('.')) {
      warnings.push({
        code: 'APPID_NO_DOMAIN',
        message: 'appId should use reverse domain notation (e.g., com.example.myapp)',
        path: 'appId',
        suggestion: 'Use reverse domain notation for better uniqueness'
      });
    }

    // Check for common mistakes
    if (appId.startsWith('dev.example') || appId.startsWith('com.example')) {
      warnings.push({
        code: 'APPID_EXAMPLE',
        message: 'appId appears to use example domain',
        path: 'appId',
        suggestion: 'Replace with your actual domain'
      });
    }

    // Check length
    if (appId.length > 64) {
      errors.push({
        code: 'APPID_TOO_LONG',
        message: 'appId must not exceed 64 characters',
        path: 'appId',
        severity: 'error'
      });
    }
  }

  /**
   * Validate version format
   */
  private validateVersion(manifest: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!manifest.version) return;

    const version = manifest.version;

    // Check for development versions
    if (version === '0.0.0' || version.startsWith('0.0.')) {
      warnings.push({
        code: 'VERSION_DEVELOPMENT',
        message: 'Version appears to be a development version',
        path: 'version',
        suggestion: 'Use proper semantic versioning for releases'
      });
    }

    // Check build number consistency
    if (manifest.build !== undefined) {
      if (manifest.build === 0 && manifest.releaseChannel === 'stable') {
        warnings.push({
          code: 'BUILD_ZERO_STABLE',
          message: 'Build number 0 in stable release channel',
          path: 'build',
          suggestion: 'Start build numbers from 1 for stable releases'
        });
      }
    }
  }

  /**
   * Validate localization
   */
  private validateLocalization(manifest: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    const requiredLocales = ['zh-CN', 'en-US'];

    // Check name localization
    if (manifest.name) {
      for (const locale of requiredLocales) {
        if (!manifest.name[locale]) {
          errors.push({
            code: 'MISSING_LOCALE',
            message: `Missing required locale "${locale}" in name`,
            path: 'name',
            severity: 'error'
          });
        }
      }
    }

    // Check description localization
    if (manifest.description) {
      for (const locale of requiredLocales) {
        if (!manifest.description[locale]) {
          errors.push({
            code: 'MISSING_LOCALE',
            message: `Missing required locale "${locale}" in description`,
            path: 'description',
            severity: 'error'
          });
        }
      }
    }

    // Check for empty strings
    if (manifest.name) {
      for (const [locale, value] of Object.entries(manifest.name)) {
        if (typeof value === 'string' && value.trim() === '') {
          errors.push({
            code: 'EMPTY_LOCALE_STRING',
            message: `Empty string for locale "${locale}" in name`,
            path: `name.${locale}`,
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * Validate file paths
   */
  private validatePaths(
    manifest: any,
    options: ValidatorOptions,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const pathsToCheck: Array<{ path: string; field: string }> = [];

    // Collect paths to validate
    if (manifest.icon) {
      pathsToCheck.push({ path: manifest.icon, field: 'icon' });
    }

    if (manifest.entrypoints) {
      for (const [name, entryPath] of Object.entries(manifest.entrypoints)) {
        if (typeof entryPath === 'string') {
          pathsToCheck.push({ path: entryPath, field: `entrypoints.${name}` });
        }
      }
    }

    // Check for path traversal
    for (const { path: filePath, field } of pathsToCheck) {
      if (filePath.includes('..') || filePath.startsWith('/')) {
        errors.push({
          code: 'PATH_TRAVERSAL',
          message: `Invalid path "${filePath}" - paths must be relative and not contain '..'`,
          path: field,
          severity: 'critical',
          suggestion: 'Use relative paths within the package'
        });
      }

      // Check if file exists (if option enabled)
      if (options.checkFiles && options.basePath) {
        const fullPath = path.join(options.basePath, filePath);
        if (!fs.existsSync(fullPath)) {
          errors.push({
            code: 'FILE_NOT_FOUND',
            message: `File not found: ${filePath}`,
            path: field,
            severity: 'error'
          });
        }
      }
    }
  }

  /**
   * Validate permissions and capabilities
   */
  private validatePermissions(manifest: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!manifest.permissions || !manifest.capabilityAllowlist) return;

    const permissions = new Set(manifest.permissions);
    const capabilities = new Set(manifest.capabilityAllowlist);

    // Check for overly broad permissions
    const dangerousPermissions = ['system.admin', 'filesystem.write', 'network.unrestricted'];
    for (const perm of permissions) {
      if (dangerousPermissions.includes(perm)) {
        warnings.push({
          code: 'DANGEROUS_PERMISSION',
          message: `Potentially dangerous permission requested: ${perm}`,
          path: 'permissions',
          suggestion: 'Ensure this permission is necessary and documented'
        });
      }
    }

    // Check for empty permissions in non-dev apps
    if (permissions.size === 0 && manifest.releaseChannel === 'stable') {
      warnings.push({
        code: 'NO_PERMISSIONS',
        message: 'No permissions declared - app may have limited functionality',
        path: 'permissions'
      });
    }
  }

  /**
   * Validate dependencies
   */
  private validateDependencies(manifest: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!manifest.dependencies) return;

    const deps = manifest.dependencies;

    // Check for circular dependencies (basic check)
    if (deps.apps) {
      const appDeps = deps.apps.map((d: any) => d.appId);
      if (appDeps.includes(manifest.appId)) {
        errors.push({
          code: 'CIRCULAR_DEPENDENCY',
          message: 'Application cannot depend on itself',
          path: 'dependencies.apps',
          severity: 'error'
        });
      }
    }

    // Warn about too many dependencies
    const totalDeps = (deps.apps?.length || 0) + (deps.skills?.length || 0) + (deps.mcp?.length || 0);
    if (totalDeps > 20) {
      warnings.push({
        code: 'MANY_DEPENDENCIES',
        message: `Large number of dependencies (${totalDeps})`,
        path: 'dependencies',
        suggestion: 'Consider reducing dependencies for better performance'
      });
    }
  }

  /**
   * Validate action declarations
   */
  private validateActions(manifest: any, errors: ValidationError[], warnings: ValidationWarning[]): void {
    if (!manifest.actions || !Array.isArray(manifest.actions)) return;

    const actionIds = new Set<string>();

    for (let i = 0; i < manifest.actions.length; i++) {
      const action = manifest.actions[i];

      // Check for duplicate action IDs
      if (actionIds.has(action.actionId)) {
        errors.push({
          code: 'DUPLICATE_ACTION_ID',
          message: `Duplicate action ID: ${action.actionId}`,
          path: `actions[${i}].actionId`,
          severity: 'error'
        });
      }
      actionIds.add(action.actionId);

      // Check action ID prefix
      if (manifest.appId && !action.actionId.startsWith(manifest.appId + '.')) {
        warnings.push({
          code: 'ACTION_ID_PREFIX',
          message: `Action ID should be prefixed with appId: ${action.actionId}`,
          path: `actions[${i}].actionId`,
          suggestion: `Use "${manifest.appId}.${action.actionId}"`
        });
      }

      // Check for destructive actions without elevated confirmation
      if (action.risk === 'destructive' && action.confirmation !== 'elevated') {
        errors.push({
          code: 'DESTRUCTIVE_NO_ELEVATED',
          message: `Destructive action must require elevated confirmation: ${action.actionId}`,
          path: `actions[${i}].confirmation`,
          severity: 'error'
        });
      }
    }
  }

  /**
   * Perform strict mode checks
   */
  private performStrictChecks(manifest: any, warnings: ValidationWarning[]): void {
    // Check for metadata
    if (!manifest.metadata) {
      warnings.push({
        code: 'MISSING_METADATA',
        message: 'No metadata section found',
        path: 'metadata',
        suggestion: 'Add metadata with author, homepage, license, etc.'
      });
    }

    // Check for proper categorization
    const recommendedCategories = [
      'productivity', 'utilities', 'creative', 'communication', 'development', 'data'
    ];
    if (manifest.category && !recommendedCategories.includes(manifest.category)) {
      warnings.push({
        code: 'UNCOMMON_CATEGORY',
        message: `Uncommon category: ${manifest.category}`,
        path: 'category',
        suggestion: `Consider using: ${recommendedCategories.join(', ')}`
      });
    }

    // Check for accessibility configuration
    if (!manifest.accessibility) {
      warnings.push({
        code: 'NO_ACCESSIBILITY_CONFIG',
        message: 'No accessibility configuration found',
        path: 'accessibility',
        suggestion: 'Add accessibility configuration for better inclusivity'
      });
    }

    // Check for performance budget
    if (!manifest.performance) {
      warnings.push({
        code: 'NO_PERFORMANCE_BUDGET',
        message: 'No performance budget defined',
        path: 'performance',
        suggestion: 'Define performance budgets to ensure app quality'
      });
    }
  }

  /**
   * Format validation result for display
   */
  public formatResult(result: ValidationResult): string {
    const lines: string[] = [];

    if (result.valid) {
      lines.push('✓ Manifest validation passed');
    } else {
      lines.push('✗ Manifest validation failed');
    }

    if (result.errors.length > 0) {
      lines.push('\nErrors:');
      for (const error of result.errors) {
        lines.push(`  ${error.code}: ${error.message}`);
        if (error.path) lines.push(`    at: ${error.path}`);
        if (error.suggestion) lines.push(`    💡 ${error.suggestion}`);
      }
    }

    if (result.warnings.length > 0) {
      lines.push('\nWarnings:');
      for (const warning of result.warnings) {
        lines.push(`  ${warning.code}: ${warning.message}`);
        if (warning.path) lines.push(`    at: ${warning.path}`);
        if (warning.suggestion) lines.push(`    💡 ${warning.suggestion}`);
      }
    }

    return lines.join('\n');
  }
}

// Export singleton instance
export const validator = new AppManifestValidator();
export default validator;
