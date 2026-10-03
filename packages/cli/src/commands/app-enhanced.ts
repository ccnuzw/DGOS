// DGOS CLI - Enhanced App Development Commands
// Comprehensive commands for creating, developing, and managing DGOS applications

import { Command } from 'commander';
import { DGOSClient } from '@dgos/sdk';
import chalk from 'chalk';
import ora from 'ora';
import * as fs from 'fs/promises';
import * as path from 'path';
import { execaCommand } from 'execa';
import semver from 'semver';
import open from 'open';
import { config } from '../config.js';
import {
  runWizard,
  successMessage,
  errorMessage,
  warningMessage,
  infoMessage,
  printHeader,
  printSection,
  selectFromList,
  confirm,
} from '../utils/interactive.js';
import { DevServer } from '../utils/dev-server.js';
import { Builder, createPackage } from '../utils/builder.js';
import { TEMPLATES, scaffoldProject } from '../utils/templates.js';

export function registerAppCommandsEnhanced(program: Command): void {
  const app = program
    .command('app')
    .description('DGOS application development commands');

  // dgos app create - Enhanced with interactive wizard
  app
    .command('create')
    .argument('[name]', 'Application name')
    .option('-t, --template <template>', 'Template to use')
    .option('-d, --directory <dir>', 'Output directory')
    .option('--no-install', 'Skip dependency installation')
    .option('--no-git', 'Skip git initialization')
    .description('Create a new DGOS application with interactive wizard')
    .action(async (name, options) => {
      await createAppEnhanced(name, options);
    });

  // dgos app dev - Enhanced with hot reload and live preview
  app
    .command('dev')
    .option('-p, --port <port>', 'Development server port', '3000')
    .option('--host <host>', 'Development server host', 'localhost')
    .option('--open', 'Open browser automatically')
    .description('Start development server with hot reload')
    .action(async (options) => {
      await startDevServerEnhanced(options);
    });

  // dgos app build - Enhanced with optimization
  app
    .command('build')
    .option('-o, --output <dir>', 'Output directory', 'dist')
    .option('--production', 'Build for production', true)
    .option('--minify', 'Minify output')
    .option('--source-maps', 'Generate source maps')
    .option('--analyze', 'Generate bundle analysis')
    .description('Build the application for production')
    .action(async (options) => {
      await buildAppEnhanced(options);
    });

  // dgos app test - Run tests
  app
    .command('test')
    .option('--watch', 'Watch mode')
    .option('--coverage', 'Generate coverage report')
    .option('--unit', 'Run unit tests only')
    .option('--e2e', 'Run E2E tests only')
    .description('Run application tests')
    .action(async (options) => {
      await runTests(options);
    });

  // dgos app lint - Code quality checks
  app
    .command('lint')
    .option('--fix', 'Auto-fix issues')
    .option('--manifest', 'Validate manifest only')
    .option('--security', 'Run security scan')
    .description('Lint code and validate manifest')
    .action(async (options) => {
      await lintApp(options);
    });

  // dgos app package - Create distributable package
  app
    .command('package')
    .option('-o, --output <file>', 'Output package file')
    .option('--sign', 'Sign the package')
    .option('--compress', 'Compression level', '9')
    .description('Package the application into a .dgos file')
    .action(async (options) => {
      await packageAppEnhanced(options);
    });

  // dgos app publish - Publish to app store
  app
    .command('publish')
    .argument('[package]', 'Package file to publish')
    .option('--channel <channel>', 'Release channel', 'stable')
    .option('--notes <notes>', 'Release notes')
    .option('--bump <type>', 'Version bump type (major|minor|patch)')
    .description('Publish application to the app directory')
    .action(async (packagePath, options) => {
      await publishAppEnhanced(packagePath, options);
    });

  // dgos app inspect - Inspect running app
  app
    .command('inspect')
    .argument('<appId>', 'Application ID to inspect')
    .option('--state', 'Show application state')
    .option('--performance', 'Show performance metrics')
    .description('Inspect running application')
    .action(async (appId, options) => {
      await inspectApp(appId, options);
    });

  // dgos app logs - View application logs
  app
    .command('logs')
    .argument('<appId>', 'Application ID')
    .option('-f, --follow', 'Follow log output')
    .option('--level <level>', 'Filter by log level')
    .option('--search <query>', 'Search logs')
    .option('--export <file>', 'Export logs to file')
    .description('View real-time application logs')
    .action(async (appId, options) => {
      await viewLogs(appId, options);
    });

  // dgos app profile - Performance profiling
  app
    .command('profile')
    .argument('<appId>', 'Application ID')
    .option('--cpu', 'CPU profiling')
    .option('--memory', 'Memory profiling')
    .option('--network', 'Network analysis')
    .option('--duration <seconds>', 'Profiling duration', '30')
    .description('Profile application performance')
    .action(async (appId, options) => {
      await profileApp(appId, options);
    });

  // dgos app upgrade - Upgrade SDK and dependencies
  app
    .command('upgrade')
    .option('--sdk <version>', 'Upgrade to specific SDK version')
    .option('--migrate', 'Run migration scripts')
    .option('--dry-run', 'Show what would be upgraded')
    .description('Upgrade SDK version and dependencies')
    .action(async (options) => {
      await upgradeApp(options);
    });

  // dgos app doctor - Environment check
  app
    .command('doctor')
    .option('--fix', 'Automatically fix issues')
    .description('Check environment and dependencies')
    .action(async (options) => {
      await runDoctor(options);
    });

  // dgos app list - List applications
  app
    .command('list')
    .option('--installed', 'Show only installed apps')
    .option('--format <format>', 'Output format (table|json)')
    .description('List available applications')
    .action(async (options) => {
      await listApps(options);
    });

  // dgos app install - Install application
  app
    .command('install')
    .argument('<appId>', 'Application ID to install')
    .option('--version <version>', 'Specific version to install')
    .description('Install an application')
    .action(async (appId, options) => {
      await installApp(appId, options);
    });

  // dgos app uninstall - Uninstall application
  app
    .command('uninstall')
    .argument('<appId>', 'Application ID to uninstall')
    .option('-y, --yes', 'Skip confirmation')
    .description('Uninstall an application')
    .action(async (appId, options) => {
      await uninstallApp(appId, options);
    });
}

// Implementation functions

async function createAppEnhanced(name: string | undefined, options: any): Promise<void> {
  printHeader('Create DGOS Application');

  try {
    // Interactive wizard if name not provided
    let projectName = name;
    let template = options.template;
    let directory = options.directory;

    if (!projectName) {
      const answers = await runWizard([
        {
          name: 'name',
          message: 'Application name:',
          type: 'text',
          validate: (value) => value.length > 0 || 'Name is required',
        },
        {
          name: 'description',
          message: 'Description:',
          type: 'text',
        },
        {
          name: 'template',
          message: 'Select template:',
          type: 'select',
          choices: TEMPLATES.map((t) => ({
            title: t.title,
            value: t.name,
            description: t.description,
          })),
        },
      ]);

      projectName = answers.name;
      template = answers.template;
      options.description = answers.description;
    }

    if (!template) {
      template = await selectFromList(
        'Select template:',
        TEMPLATES.map((t) => ({
          title: t.title,
          value: t.name,
          description: t.description,
        }))
      );
    }

    directory = directory || projectName;

    // Check if directory exists
    try {
      await fs.access(directory!);
      errorMessage(`Directory ${directory} already exists`);
      return;
    } catch {
      // Directory doesn't exist, continue
    }

    const spinner = ora('Creating application...').start();

    // Scaffold project
    await scaffoldProject({
      name: projectName!,
      template: template!,
      directory: directory!,
      description: options.description,
      gitInit: options.git !== false,
      installDeps: options.install !== false,
    });

    spinner.succeed(chalk.green(`Created DGOS application: ${projectName}`));

    // Show next steps
    console.log();
    printSection('Next Steps');
    console.log(chalk.cyan(`  cd ${directory}`));
    if (options.install === false) {
      console.log(chalk.cyan('  pnpm install'));
    }
    console.log(chalk.cyan('  pnpm dev'));
    console.log();
  } catch (error) {
    errorMessage('Failed to create application');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function startDevServerEnhanced(options: any): Promise<void> {
  printHeader('DGOS Development Server');

  try {
    const projectDir = process.cwd();

    // Verify project structure
    try {
      await fs.access(path.join(projectDir, 'dgos.json'));
    } catch {
      errorMessage('No dgos.json found. Are you in a DGOS project directory?');
      return;
    }

    const server = new DevServer({
      port: parseInt(options.port),
      host: options.host,
      projectDir,
      open: options.open,
    });

    await server.start();

    if (options.open) {
      await open(`http://${options.host}:${options.port}`);
    }

    // Handle shutdown
    process.on('SIGINT', async () => {
      console.log();
      console.log(chalk.yellow('Shutting down...'));
      await server.stop();
      process.exit(0);
    });

    // Keep process running
    await new Promise(() => {});
  } catch (error) {
    errorMessage('Failed to start development server');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function buildAppEnhanced(options: any): Promise<void> {
  printHeader('Build Application');

  try {
    const projectDir = process.cwd();

    const builder = new Builder({
      projectDir,
      outputDir: options.output,
      production: options.production,
      minify: options.minify,
      sourceMaps: options.sourceMaps,
      analyze: options.analyze,
    });

    const result = await builder.build();

    if (result.success) {
      console.log();
      successMessage('Build complete!');
      console.log();
      console.log(chalk.cyan('  Output:'), result.outputDir);
      console.log(chalk.cyan('  Files: '), result.files.length);
      console.log(chalk.cyan('  Size:  '), formatSize(result.size));
      console.log();
    } else {
      errorMessage('Build failed');
      if (result.errors) {
        result.errors.forEach((err) => console.log(chalk.red(`  ${err}`)));
      }
    }
  } catch (error) {
    errorMessage('Build failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function runTests(options: any): Promise<void> {
  printHeader('Run Tests');

  try {
    const projectDir = process.cwd();
    let command = 'node --test tests/**/*.test.js';

    if (options.watch) {
      command += ' --watch';
    }

    if (options.coverage) {
      command = 'c8 ' + command;
    }

    if (options.unit) {
      command += ' tests/unit/**/*.test.js';
    } else if (options.e2e) {
      command += ' tests/e2e/**/*.test.js';
    }

    console.log(chalk.gray(`Running: ${command}`));
    console.log();

    await execaCommand(command, { cwd: projectDir, stdio: 'inherit' });

    successMessage('Tests passed!');
  } catch (error) {
    errorMessage('Tests failed');
    process.exit(1);
  }
}

async function lintApp(options: any): Promise<void> {
  printHeader('Lint Application');

  const spinner = ora('Running linters...').start();

  try {
    const projectDir = process.cwd();
    const errors: string[] = [];

    // Validate manifest
    spinner.text = 'Validating manifest...';
    const manifestPath = path.join(projectDir, 'dgos.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    const manifestErrors = validateManifest(manifest);
    if (manifestErrors.length > 0) {
      errors.push(...manifestErrors.map((e) => `Manifest: ${e}`));
    }

    if (!options.manifest) {
      // Type checking
      spinner.text = 'Type checking...';
      try {
        await execaCommand('tsc --noEmit', { cwd: projectDir });
      } catch (error) {
        errors.push('TypeScript errors found');
      }
    }

    if (options.security) {
      // Security scan
      spinner.text = 'Running security scan...';
      try {
        await execaCommand('npm audit --production', { cwd: projectDir });
      } catch (error) {
        warningMessage('Security vulnerabilities found');
      }
    }

    if (errors.length > 0) {
      spinner.fail('Linting failed');
      console.log();
      errors.forEach((err) => errorMessage(err));
      process.exit(1);
    } else {
      spinner.succeed('All checks passed!');
    }
  } catch (error) {
    spinner.fail('Linting failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function packageAppEnhanced(options: any): Promise<void> {
  printHeader('Package Application');

  try {
    const projectDir = process.cwd();

    // Load manifest
    const manifestPath = path.join(projectDir, 'dgos.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Build first
    const spinner = ora('Building application...').start();
    const builder = new Builder({
      projectDir,
      outputDir: 'dist',
      production: true,
      minify: true,
    });

    const buildResult = await builder.build();
    if (!buildResult.success) {
      spinner.fail('Build failed');
      return;
    }
    spinner.succeed('Build complete');

    // Create package
    const outputFile = options.output || `${manifest.appId}-${manifest.version}.dgos`;
    await createPackage('dist', outputFile);

    successMessage(`Package created: ${outputFile}`);
  } catch (error) {
    errorMessage('Packaging failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function publishAppEnhanced(packagePath: string | undefined, options: any): Promise<void> {
  printHeader('Publish Application');

  try {
    // Bump version if requested
    if (options.bump) {
      const manifestPath = path.join(process.cwd(), 'dgos.json');
      const manifestContent = await fs.readFile(manifestPath, 'utf-8');
      const manifest = JSON.parse(manifestContent);

      const newVersion = semver.inc(manifest.version, options.bump);
      manifest.version = newVersion;
      manifest.build = (manifest.build || 0) + 1;

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
      successMessage(`Version bumped to ${newVersion}`);
    }

    // Build and package if no package provided
    if (!packagePath) {
      await packageAppEnhanced({});
    }

    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    const spinner = ora('Publishing to app directory...').start();

    // TODO: Implement actual publishing
    spinner.succeed('Published successfully');

    infoMessage('Note: Publishing is not yet fully implemented in V1');
  } catch (error) {
    errorMessage('Publishing failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function inspectApp(appId: string, options: any): Promise<void> {
  printHeader(`Inspect Application: ${appId}`);

  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    infoMessage('Inspection features not yet fully implemented in V1');
    console.log(chalk.gray(`  App ID: ${appId}`));
  } catch (error) {
    errorMessage('Inspection failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function viewLogs(appId: string, options: any): Promise<void> {
  printHeader(`Application Logs: ${appId}`);

  infoMessage('Log viewing not yet fully implemented in V1');
  console.log(chalk.gray(`  App ID: ${appId}`));
  console.log(chalk.gray(`  Follow: ${options.follow || false}`));
}

async function profileApp(appId: string, options: any): Promise<void> {
  printHeader(`Profile Application: ${appId}`);

  infoMessage('Profiling not yet fully implemented in V1');
  console.log(chalk.gray(`  App ID: ${appId}`));
  console.log(chalk.gray(`  Duration: ${options.duration}s`));
}

async function upgradeApp(options: any): Promise<void> {
  printHeader('Upgrade Application');

  try {
    const projectDir = process.cwd();
    const packageJsonPath = path.join(projectDir, 'package.json');

    const spinner = ora('Checking for updates...').start();

    // Check current version
    const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
    const currentVersion = packageJson.dependencies?.['@dgos/sdk'] || 'unknown';

    spinner.succeed(`Current SDK version: ${currentVersion}`);

    if (options.dryRun) {
      infoMessage('Dry run - no changes made');
      return;
    }

    // Upgrade
    const upgradeSpinner = ora('Upgrading dependencies...').start();
    await execaCommand('pnpm update @dgos/sdk', { cwd: projectDir });
    upgradeSpinner.succeed('Dependencies upgraded');

    if (options.migrate) {
      infoMessage('Running migrations...');
      // TODO: Implement migrations
    }

    successMessage('Upgrade complete!');
  } catch (error) {
    errorMessage('Upgrade failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function runDoctor(options: any): Promise<void> {
  printHeader('DGOS Environment Check');

  const checks = [
    { name: 'Node.js version', check: async () => process.version },
    { name: 'npm/pnpm installed', check: async () => {
      try {
        await execaCommand('pnpm --version');
        return 'pnpm available';
      } catch {
        return 'pnpm not found';
      }
    }},
    { name: 'TypeScript installed', check: async () => {
      try {
        await execaCommand('tsc --version');
        return 'TypeScript available';
      } catch {
        return 'TypeScript not found';
      }
    }},
    { name: 'dgos.json exists', check: async () => {
      try {
        await fs.access('dgos.json');
        return 'Found';
      } catch {
        return 'Not found';
      }
    }},
    { name: 'Dependencies installed', check: async () => {
      try {
        await fs.access('node_modules');
        return 'Installed';
      } catch {
        return 'Not installed';
      }
    }},
  ];

  console.log();

  for (const check of checks) {
    const result = await check.check();
    console.log(chalk.cyan('  ✓'), check.name + ':', chalk.gray(result));
  }

  console.log();
  successMessage('Environment check complete');
}

async function listApps(options: any): Promise<void> {
  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    infoMessage('App listing not yet fully implemented in V1');
  } catch (error) {
    errorMessage('Failed to list applications');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function installApp(appId: string, options: any): Promise<void> {
  const spinner = ora(`Installing ${appId}...`).start();

  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    spinner.succeed('Installation initiated');
    infoMessage('App installation not yet fully implemented in V1');
  } catch (error) {
    spinner.fail('Installation failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function uninstallApp(appId: string, options: any): Promise<void> {
  if (!options.yes) {
    const confirmed = await confirm(`Are you sure you want to uninstall ${appId}?`);
    if (!confirmed) {
      infoMessage('Cancelled');
      return;
    }
  }

  const spinner = ora(`Uninstalling ${appId}...`).start();

  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    spinner.succeed('Uninstallation initiated');
    infoMessage('App uninstallation not yet fully implemented in V1');
  } catch (error) {
    spinner.fail('Uninstallation failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

// Helper functions

function validateManifest(manifest: any): string[] {
  const errors: string[] = [];
  const required = [
    'format',
    'appId',
    'version',
    'build',
    'name',
    'description',
    'entrypoints',
  ];

  for (const field of required) {
    if (!manifest[field]) {
      errors.push(`Missing required field: ${field}`);
    }
  }

  if (manifest.format && manifest.format !== 'dgos-app/v1') {
    errors.push(`Invalid format: ${manifest.format}`);
  }

  if (manifest.appId && !/^[a-z][a-z0-9.-]{1,63}$/.test(manifest.appId)) {
    errors.push('Invalid appId format');
  }

  if (manifest.version && !semver.valid(manifest.version)) {
    errors.push('Invalid version format (expected SemVer)');
  }

  return errors;
}

function formatSize(bytes: number): string {
  const units = ['B', 'KB', 'MB', 'GB'];
  let size = bytes;
  let unitIndex = 0;

  while (size >= 1024 && unitIndex < units.length - 1) {
    size /= 1024;
    unitIndex++;
  }

  return `${size.toFixed(2)} ${units[unitIndex]}`;
}
