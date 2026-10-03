#!/usr/bin/env node
/**
 * DGOS Application Compliance Checker
 *
 * Comprehensive compliance checking tool for DGOS applications
 * Validates manifest, code quality, performance, security, and accessibility
 */

import * as fs from 'fs';
import * as path from 'path';
import { validator } from '@dgos/app-validator';

interface ComplianceResult {
  score: number;
  maxScore: number;
  passed: boolean;
  categories: CategoryResult[];
  recommendations: string[];
}

interface CategoryResult {
  name: string;
  score: number;
  maxScore: number;
  passed: boolean;
  checks: CheckResult[];
}

interface CheckResult {
  name: string;
  passed: boolean;
  severity: 'critical' | 'error' | 'warning' | 'info';
  message: string;
  recommendation?: string;
}

export class ComplianceChecker {
  private basePath: string;
  private manifestPath: string;
  private manifest: any;

  constructor(basePath: string) {
    this.basePath = basePath;
    this.manifestPath = path.join(basePath, 'dgos.json');
  }

  /**
   * Run full compliance check
   */
  async check(): Promise<ComplianceResult> {
    const categories: CategoryResult[] = [];

    // Load manifest
    try {
      const content = await fs.promises.readFile(this.manifestPath, 'utf-8');
      this.manifest = JSON.parse(content);
    } catch (error) {
      return {
        score: 0,
        maxScore: 100,
        passed: false,
        categories: [],
        recommendations: ['Fix manifest file errors before running compliance checks']
      };
    }

    // Run checks
    categories.push(await this.checkManifest());
    categories.push(await this.checkProjectStructure());
    categories.push(await this.checkCodeQuality());
    categories.push(await this.checkPerformance());
    categories.push(await this.checkSecurity());
    categories.push(await this.checkAccessibility());
    categories.push(await this.checkDocumentation());

    // Calculate overall score
    const totalScore = categories.reduce((sum, cat) => sum + cat.score, 0);
    const maxScore = categories.reduce((sum, cat) => sum + cat.maxScore, 0);
    const passed = totalScore >= maxScore * 0.8; // 80% threshold

    // Generate recommendations
    const recommendations = this.generateRecommendations(categories);

    return {
      score: totalScore,
      maxScore,
      passed,
      categories,
      recommendations
    };
  }

  /**
   * Check manifest completeness and validity
   */
  private async checkManifest(): Promise<CategoryResult> {
    const checks: CheckResult[] = [];

    // Validate against schema
    const validationResult = validator.validate(this.manifest, {
      strict: true,
      checkFiles: true,
      basePath: this.basePath
    });

    if (!validationResult.valid) {
      checks.push({
        name: 'Manifest Validation',
        passed: false,
        severity: 'critical',
        message: `Manifest has ${validationResult.errors.length} errors`,
        recommendation: 'Run dgos app validate to see detailed errors'
      });
    } else {
      checks.push({
        name: 'Manifest Validation',
        passed: true,
        severity: 'info',
        message: 'Manifest is valid'
      });
    }

    // Check for optional but recommended fields
    const recommendedFields = ['displayName', 'metadata', 'performance', 'accessibility'];
    for (const field of recommendedFields) {
      if (!this.manifest[field]) {
        checks.push({
          name: `Recommended Field: ${field}`,
          passed: false,
          severity: 'warning',
          message: `Missing recommended field: ${field}`,
          recommendation: `Add ${field} to manifest for better app quality`
        });
      }
    }

    // Check metadata completeness
    if (this.manifest.metadata) {
      const requiredMetadata = ['author', 'homepage', 'license'];
      for (const field of requiredMetadata) {
        if (!this.manifest.metadata[field]) {
          checks.push({
            name: `Metadata: ${field}`,
            passed: false,
            severity: 'warning',
            message: `Missing metadata field: ${field}`
          });
        }
      }
    }

    return this.calculateCategoryScore('Manifest Completeness', checks, 20);
  }

  /**
   * Check project structure
   */
  private async checkProjectStructure(): Promise<CategoryResult> {
    const checks: CheckResult[] = [];

    // Check required files
    const requiredFiles = [
      { path: 'README.md', name: 'README' },
      { path: 'LICENSE', name: 'LICENSE', alt: 'LICENSE.md' },
      { path: 'package.json', name: 'package.json' },
      { path: 'CHANGELOG.md', name: 'CHANGELOG' }
    ];

    for (const file of requiredFiles) {
      const exists = fs.existsSync(path.join(this.basePath, file.path)) ||
                    (file.alt && fs.existsSync(path.join(this.basePath, file.alt)));

      checks.push({
        name: `Required File: ${file.name}`,
        passed: exists,
        severity: file.name === 'README' || file.name === 'LICENSE' ? 'error' : 'warning',
        message: exists ? `${file.name} exists` : `Missing ${file.name}`,
        recommendation: exists ? undefined : `Create ${file.path}`
      });
    }

    // Check recommended directories
    const recommendedDirs = ['src', 'tests', 'docs', 'public'];
    for (const dir of recommendedDirs) {
      const exists = fs.existsSync(path.join(this.basePath, dir));
      if (!exists) {
        checks.push({
          name: `Directory: ${dir}`,
          passed: false,
          severity: 'info',
          message: `Missing recommended directory: ${dir}`,
          recommendation: `Create ${dir}/ directory for better organization`
        });
      }
    }

    // Check for test files
    const hasTests = this.hasFilesMatching(/\.(test|spec)\.(ts|tsx|js|jsx)$/);
    checks.push({
      name: 'Test Files',
      passed: hasTests,
      severity: 'error',
      message: hasTests ? 'Test files found' : 'No test files found',
      recommendation: hasTests ? undefined : 'Add test files to ensure code quality'
    });

    return this.calculateCategoryScore('Project Structure', checks, 15);
  }

  /**
   * Check code quality indicators
   */
  private async checkCodeQuality(): Promise<CategoryResult> {
    const checks: CheckResult[] = [];

    // Check for linting configuration
    const lintConfigs = ['.eslintrc', '.eslintrc.js', '.eslintrc.json', 'eslint.config.js'];
    const hasLintConfig = lintConfigs.some(config =>
      fs.existsSync(path.join(this.basePath, config))
    );

    checks.push({
      name: 'Linting Configuration',
      passed: hasLintConfig,
      severity: 'warning',
      message: hasLintConfig ? 'Linting configured' : 'No linting configuration found',
      recommendation: hasLintConfig ? undefined : 'Add ESLint configuration'
    });

    // Check for TypeScript
    const hasTypeScript = fs.existsSync(path.join(this.basePath, 'tsconfig.json'));
    checks.push({
      name: 'TypeScript',
      passed: hasTypeScript,
      severity: 'info',
      message: hasTypeScript ? 'Using TypeScript' : 'Not using TypeScript',
      recommendation: hasTypeScript ? undefined : 'Consider using TypeScript for better type safety'
    });

    // Check for code formatting
    const formatterConfigs = ['.prettierrc', '.prettierrc.js', '.prettierrc.json', 'prettier.config.js'];
    const hasFormatter = formatterConfigs.some(config =>
      fs.existsSync(path.join(this.basePath, config))
    );

    checks.push({
      name: 'Code Formatting',
      passed: hasFormatter,
      severity: 'info',
      message: hasFormatter ? 'Code formatter configured' : 'No code formatter found',
      recommendation: hasFormatter ? undefined : 'Add Prettier for consistent code formatting'
    });

    // Check for git hooks
    const hasGitHooks = fs.existsSync(path.join(this.basePath, '.husky')) ||
                       fs.existsSync(path.join(this.basePath, '.git/hooks/pre-commit'));

    checks.push({
      name: 'Git Hooks',
      passed: hasGitHooks,
      severity: 'info',
      message: hasGitHooks ? 'Git hooks configured' : 'No git hooks found',
      recommendation: hasGitHooks ? undefined : 'Add pre-commit hooks with Husky'
    });

    return this.calculateCategoryScore('Code Quality', checks, 10);
  }

  /**
   * Check performance budgets
   */
  private async checkPerformance(): Promise<CategoryResult> {
    const checks: CheckResult[] = [];

    // Check if performance budget is declared
    if (!this.manifest.performance) {
      checks.push({
        name: 'Performance Budget',
        passed: false,
        severity: 'warning',
        message: 'No performance budget declared',
        recommendation: 'Add performance section to manifest'
      });
      return this.calculateCategoryScore('Performance', checks, 15);
    }

    const perf = this.manifest.performance;

    // Check bundle size
    if (perf.maxBundleSize) {
      const recommended = 500000; // 500 KB
      const passed = perf.maxBundleSize <= recommended;
      checks.push({
        name: 'Bundle Size Budget',
        passed,
        severity: passed ? 'info' : 'warning',
        message: `Max bundle size: ${(perf.maxBundleSize / 1000).toFixed(0)} KB`,
        recommendation: passed ? undefined : `Consider reducing to ${(recommended / 1000).toFixed(0)} KB or less`
      });
    }

    // Check memory budget
    if (perf.maxMemory) {
      const recommended = 200; // 200 MB
      const passed = perf.maxMemory <= recommended;
      checks.push({
        name: 'Memory Budget',
        passed,
        severity: passed ? 'info' : 'warning',
        message: `Max memory: ${perf.maxMemory} MB`,
        recommendation: passed ? undefined : `Consider reducing to ${recommended} MB or less`
      });
    }

    // Check startup time
    if (perf.maxStartupTime) {
      const recommended = 2000; // 2 seconds
      const passed = perf.maxStartupTime <= recommended;
      checks.push({
        name: 'Startup Time Budget',
        passed,
        severity: passed ? 'info' : 'warning',
        message: `Max startup time: ${perf.maxStartupTime} ms`,
        recommendation: passed ? undefined : `Consider reducing to ${recommended} ms or less`
      });
    }

    // Check if dist folder exists and measure actual size
    const distPath = path.join(this.basePath, 'dist');
    if (fs.existsSync(distPath)) {
      const size = await this.getDirectorySize(distPath);
      const sizeKB = Math.round(size / 1024);
      const budget = perf.maxBundleSize || 500000;
      const passed = size <= budget;

      checks.push({
        name: 'Actual Bundle Size',
        passed,
        severity: passed ? 'info' : 'error',
        message: `Built size: ${sizeKB} KB`,
        recommendation: passed ? undefined : 'Optimize bundle size'
      });
    }

    return this.calculateCategoryScore('Performance', checks, 15);
  }

  /**
   * Check security best practices
   */
  private async checkSecurity(): Promise<CategoryResult> {
    const checks: CheckResult[] = [];

    // Check for package-lock or pnpm-lock
    const hasLockFile = fs.existsSync(path.join(this.basePath, 'package-lock.json')) ||
                       fs.existsSync(path.join(this.basePath, 'pnpm-lock.yaml')) ||
                       fs.existsSync(path.join(this.basePath, 'yarn.lock'));

    checks.push({
      name: 'Lock File',
      passed: hasLockFile,
      severity: 'error',
      message: hasLockFile ? 'Lock file present' : 'No lock file found',
      recommendation: hasLockFile ? undefined : 'Commit package lock file for reproducible builds'
    });

    // Check for .env files in git
    const gitignorePath = path.join(this.basePath, '.gitignore');
    if (fs.existsSync(gitignorePath)) {
      const gitignore = await fs.promises.readFile(gitignorePath, 'utf-8');
      const ignoresEnv = gitignore.includes('.env');

      checks.push({
        name: 'Environment File Security',
        passed: ignoresEnv,
        severity: 'error',
        message: ignoresEnv ? '.env files excluded from git' : '.env may not be excluded',
        recommendation: ignoresEnv ? undefined : 'Add .env to .gitignore'
      });
    }

    // Check for CSP
    if (this.manifest.contentSecurityPolicy) {
      checks.push({
        name: 'Content Security Policy',
        passed: true,
        severity: 'info',
        message: 'CSP configured'
      });
    } else {
      checks.push({
        name: 'Content Security Policy',
        passed: false,
        severity: 'warning',
        message: 'No CSP configured',
        recommendation: 'Add contentSecurityPolicy to manifest'
      });
    }

    // Check for dangerous permissions
    const dangerousPerms = ['system.admin', 'filesystem.write', 'network.unrestricted'];
    const hasDangerous = this.manifest.permissions?.some((p: string) =>
      dangerousPerms.includes(p)
    );

    if (hasDangerous) {
      checks.push({
        name: 'Permission Safety',
        passed: false,
        severity: 'warning',
        message: 'Using potentially dangerous permissions',
        recommendation: 'Document why dangerous permissions are needed'
      });
    }

    // Check HTTPS in network allowlist
    if (this.manifest.networkAllowlist) {
      const hasHttp = this.manifest.networkAllowlist.some((url: string) =>
        url.startsWith('http:')
      );

      checks.push({
        name: 'Network Security',
        passed: !hasHttp,
        severity: hasHttp ? 'warning' : 'info',
        message: hasHttp ? 'HTTP URLs in allowlist' : 'All HTTPS URLs',
        recommendation: hasHttp ? 'Use HTTPS for all network requests' : undefined
      });
    }

    return this.calculateCategoryScore('Security', checks, 20);
  }

  /**
   * Check accessibility compliance
   */
  private async checkAccessibility(): Promise<CategoryResult> {
    const checks: CheckResult[] = [];

    // Check if accessibility config exists
    if (!this.manifest.accessibility) {
      checks.push({
        name: 'Accessibility Configuration',
        passed: false,
        severity: 'error',
        message: 'No accessibility configuration',
        recommendation: 'Add accessibility section to manifest'
      });
      return this.calculateCategoryScore('Accessibility', checks, 15);
    }

    const a11y = this.manifest.accessibility;

    // Check WCAG level
    const wcagLevel = a11y.wcagLevel;
    const passed = wcagLevel === 'AA' || wcagLevel === 'AAA';
    checks.push({
      name: 'WCAG Compliance Level',
      passed,
      severity: 'error',
      message: `WCAG Level: ${wcagLevel || 'Not specified'}`,
      recommendation: passed ? undefined : 'Target WCAG 2.1 Level AA minimum'
    });

    // Check individual features
    const features = {
      'keyboardNavigable': 'Keyboard Navigation',
      'screenReaderSupport': 'Screen Reader Support',
      'highContrastSupport': 'High Contrast Support',
      'textScaling': 'Text Scaling',
      'ariaLabels': 'ARIA Labels'
    };

    for (const [key, name] of Object.entries(features)) {
      const enabled = a11y[key] === true;
      checks.push({
        name,
        passed: enabled,
        severity: 'error',
        message: enabled ? `${name} enabled` : `${name} not enabled`,
        recommendation: enabled ? undefined : `Enable ${name.toLowerCase()}`
      });
    }

    return this.calculateCategoryScore('Accessibility', checks, 15);
  }

  /**
   * Check documentation completeness
   */
  private async checkDocumentation(): Promise<CategoryResult> {
    const checks: CheckResult[] = [];

    // Check README
    const readmePath = path.join(this.basePath, 'README.md');
    if (fs.existsSync(readmePath)) {
      const readme = await fs.promises.readFile(readmePath, 'utf-8');
      const length = readme.length;

      checks.push({
        name: 'README Length',
        passed: length > 500,
        severity: 'warning',
        message: `README: ${length} characters`,
        recommendation: length > 500 ? undefined : 'Expand README with more details'
      });

      // Check for key sections
      const sections = ['Installation', 'Usage', 'Features', 'License'];
      for (const section of sections) {
        const hasSection = readme.toLowerCase().includes(section.toLowerCase());
        checks.push({
          name: `README: ${section}`,
          passed: hasSection,
          severity: 'warning',
          message: hasSection ? `${section} section found` : `${section} section missing`
        });
      }
    }

    // Check CHANGELOG
    const changelogPath = path.join(this.basePath, 'CHANGELOG.md');
    checks.push({
      name: 'CHANGELOG',
      passed: fs.existsSync(changelogPath),
      severity: 'warning',
      message: fs.existsSync(changelogPath) ? 'CHANGELOG exists' : 'No CHANGELOG found',
      recommendation: fs.existsSync(changelogPath) ? undefined : 'Create CHANGELOG.md to track changes'
    });

    // Check for docs directory
    const docsPath = path.join(this.basePath, 'docs');
    const hasDocs = fs.existsSync(docsPath);
    checks.push({
      name: 'Documentation Directory',
      passed: hasDocs,
      severity: 'info',
      message: hasDocs ? 'docs/ directory exists' : 'No docs/ directory',
      recommendation: hasDocs ? undefined : 'Create docs/ for additional documentation'
    });

    return this.calculateCategoryScore('Documentation', checks, 10);
  }

  /**
   * Calculate category score
   */
  private calculateCategoryScore(
    name: string,
    checks: CheckResult[],
    maxScore: number
  ): CategoryResult {
    const weights = {
      critical: 1.0,
      error: 0.8,
      warning: 0.5,
      info: 0.3
    };

    let totalWeight = 0;
    let passedWeight = 0;

    for (const check of checks) {
      const weight = weights[check.severity];
      totalWeight += weight;
      if (check.passed) {
        passedWeight += weight;
      }
    }

    const score = totalWeight > 0 ? (passedWeight / totalWeight) * maxScore : maxScore;
    const passed = score >= maxScore * 0.7; // 70% threshold per category

    return {
      name,
      score: Math.round(score),
      maxScore,
      passed,
      checks
    };
  }

  /**
   * Generate recommendations based on results
   */
  private generateRecommendations(categories: CategoryResult[]): string[] {
    const recommendations: string[] = [];

    for (const category of categories) {
      const failedChecks = category.checks.filter(c => !c.passed && c.severity !== 'info');

      if (failedChecks.length > 0) {
        recommendations.push(`${category.name}: ${failedChecks.length} issues to address`);

        // Add top 3 critical/error recommendations
        const critical = failedChecks
          .filter(c => c.recommendation && (c.severity === 'critical' || c.severity === 'error'))
          .slice(0, 3);

        for (const check of critical) {
          if (check.recommendation) {
            recommendations.push(`  - ${check.recommendation}`);
          }
        }
      }
    }

    return recommendations;
  }

  /**
   * Helper: Check if directory contains files matching pattern
   */
  private hasFilesMatching(pattern: RegExp): boolean {
    try {
      const files = this.getAllFiles(this.basePath);
      return files.some(file => pattern.test(file));
    } catch {
      return false;
    }
  }

  /**
   * Helper: Get all files recursively
   */
  private getAllFiles(dir: string, files: string[] = []): string[] {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        this.getAllFiles(fullPath, files);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }

    return files;
  }

  /**
   * Helper: Get directory size
   */
  private async getDirectorySize(dir: string): Promise<number> {
    let size = 0;
    const files = this.getAllFiles(dir);

    for (const file of files) {
      try {
        const stats = await fs.promises.stat(file);
        size += stats.size;
      } catch {
        // Skip files that can't be read
      }
    }

    return size;
  }

  /**
   * Format results for display
   */
  static formatResult(result: ComplianceResult): string {
    const lines: string[] = [];

    lines.push('='.repeat(60));
    lines.push('DGOS Application Compliance Report');
    lines.push('='.repeat(60));
    lines.push('');

    // Overall score
    const percentage = Math.round((result.score / result.maxScore) * 100);
    const status = result.passed ? '✓ PASSED' : '✗ FAILED';

    lines.push(`Overall Score: ${result.score}/${result.maxScore} (${percentage}%) ${status}`);
    lines.push('');

    // Category scores
    lines.push('Category Scores:');
    lines.push('-'.repeat(60));

    for (const category of result.categories) {
      const catPercentage = Math.round((category.score / category.maxScore) * 100);
      const catStatus = category.passed ? '✓' : '✗';
      lines.push(`${catStatus} ${category.name}: ${category.score}/${category.maxScore} (${catPercentage}%)`);

      // Show failed checks
      const failed = category.checks.filter(c => !c.passed && c.severity !== 'info');
      if (failed.length > 0) {
        for (const check of failed) {
          lines.push(`    ${check.severity.toUpperCase()}: ${check.message}`);
        }
      }
    }

    lines.push('');

    // Recommendations
    if (result.recommendations.length > 0) {
      lines.push('Recommendations:');
      lines.push('-'.repeat(60));
      for (const rec of result.recommendations) {
        lines.push(rec);
      }
      lines.push('');
    }

    lines.push('='.repeat(60));

    return lines.join('\n');
  }
}

// CLI interface
if (require.main === module) {
  const basePath = process.argv[2] || process.cwd();

  const checker = new ComplianceChecker(basePath);

  checker.check().then(result => {
    console.log(ComplianceChecker.formatResult(result));
    process.exit(result.passed ? 0 : 1);
  }).catch(error => {
    console.error('Compliance check failed:', error.message);
    process.exit(1);
  });
}

export default ComplianceChecker;
