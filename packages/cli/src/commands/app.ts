// DGOS CLI - App Development Commands
// Commands for creating, developing, and managing DGOS applications

import { Command } from 'commander';
import { DGOSClient } from '@dgos/sdk';
import chalk from 'chalk';
import ora from 'ora';
import inquirer from 'inquirer';
import * as fs from 'fs/promises';
import * as path from 'path';
import { config } from '../config.js';

export function registerAppCommands(program: Command): void {
  const app = program
    .command('app')
    .description('DGOS application development commands');

  // dgos app create
  app
    .command('create')
    .argument('<name>', 'Application name')
    .option('-t, --template <template>', 'Template to use', 'basic')
    .option('-d, --directory <dir>', 'Output directory')
    .description('Create a new DGOS application from template')
    .action(async (name, options) => {
      await createApp(name, options);
    });

  // dgos app dev
  app
    .command('dev')
    .option('-p, --port <port>', 'Development server port', '3000')
    .option('--host <host>', 'Development server host', 'localhost')
    .description('Start development server with hot reload')
    .action(async (options) => {
      await startDevServer(options);
    });

  // dgos app build
  app
    .command('build')
    .option('-o, --output <dir>', 'Output directory', 'dist')
    .option('--production', 'Build for production')
    .description('Build the application for production')
    .action(async (options) => {
      await buildApp(options);
    });

  // dgos app validate
  app
    .command('validate')
    .argument('[manifest]', 'Path to manifest file', 'dgos.json')
    .description('Validate application manifest and structure')
    .action(async (manifest) => {
      await validateApp(manifest);
    });

  // dgos app package
  app
    .command('package')
    .option('-o, --output <file>', 'Output package file')
    .option('--sign', 'Sign the package')
    .description('Package the application into a .dgos file')
    .action(async (options) => {
      await packageApp(options);
    });

  // dgos app test-install
  app
    .command('test-install')
    .argument('<package>', 'Package file to install')
    .description('Test install a package locally')
    .action(async (packagePath) => {
      await testInstall(packagePath);
    });

  // dgos app publish
  app
    .command('publish')
    .argument('<package>', 'Package file to publish')
    .option('--channel <channel>', 'Release channel', 'stable')
    .option('--notes <notes>', 'Release notes')
    .description('Publish application to the app directory')
    .action(async (packagePath, options) => {
      await publishApp(packagePath, options);
    });

  // dgos app list
  app
    .command('list')
    .option('--installed', 'Show only installed apps')
    .description('List available applications')
    .action(async (options) => {
      await listApps(options);
    });

  // dgos app install
  app
    .command('install')
    .argument('<appId>', 'Application ID to install')
    .option('--version <version>', 'Specific version to install')
    .description('Install an application')
    .action(async (appId, options) => {
      await installApp(appId, options);
    });

  // dgos app uninstall
  app
    .command('uninstall')
    .argument('<appId>', 'Application ID to uninstall')
    .description('Uninstall an application')
    .action(async (appId) => {
      await uninstallApp(appId);
    });
}

async function createApp(name: string, options: any): Promise<void> {
  const spinner = ora('Creating DGOS application...').start();

  try {
    const template = options.template || 'basic';
    const directory = options.directory || name;

    // Check if directory exists
    try {
      await fs.access(directory);
      spinner.fail(`Directory ${directory} already exists`);
      return;
    } catch {
      // Directory doesn't exist, continue
    }

    // Create directory structure
    await fs.mkdir(directory, { recursive: true });
    await fs.mkdir(path.join(directory, 'src'), { recursive: true });
    await fs.mkdir(path.join(directory, 'public'), { recursive: true });
    await fs.mkdir(path.join(directory, 'tests'), { recursive: true });

    // Generate manifest
    const manifest = generateManifest(name, template);
    await fs.writeFile(
      path.join(directory, 'dgos.json'),
      JSON.stringify(manifest, null, 2)
    );

    // Generate package.json
    const packageJson = generatePackageJson(name);
    await fs.writeFile(
      path.join(directory, 'package.json'),
      JSON.stringify(packageJson, null, 2)
    );

    // Generate template files
    await generateTemplateFiles(directory, template);

    spinner.succeed(chalk.green(`Created DGOS application: ${name}`));
    console.log();
    console.log(chalk.cyan('Next steps:'));
    console.log(`  cd ${directory}`);
    console.log('  pnpm install');
    console.log('  dgos app dev');
  } catch (error) {
    spinner.fail('Failed to create application');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function startDevServer(options: any): Promise<void> {
  console.log(chalk.cyan('Starting DGOS development server...'));
  console.log(chalk.gray(`Port: ${options.port}`));
  console.log(chalk.gray(`Host: ${options.host}`));
  console.log();

  // In a real implementation, this would start a dev server with hot reload
  console.log(chalk.yellow('Dev server not yet fully implemented in V1'));
  console.log(chalk.gray('For now, use standard web dev tools and test with dgos app test-install'));
}

async function buildApp(options: any): Promise<void> {
  const spinner = ora('Building application...').start();

  try {
    // Load manifest
    const manifestPath = path.join(process.cwd(), 'dgos.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    // Create output directory
    await fs.mkdir(options.output, { recursive: true });

    // Copy necessary files
    // In real implementation, would bundle and optimize
    spinner.text = 'Copying files...';
    await fs.cp('src', path.join(options.output, 'src'), { recursive: true });
    await fs.cp('public', path.join(options.output, 'public'), { recursive: true });
    await fs.copyFile('dgos.json', path.join(options.output, 'dgos.json'));

    spinner.succeed(chalk.green('Build complete!'));
    console.log(chalk.gray(`Output: ${options.output}`));
  } catch (error) {
    spinner.fail('Build failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function validateApp(manifestPath: string): Promise<void> {
  const spinner = ora('Validating application...').start();

  try {
    const content = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(content);

    // Validate required fields
    const requiredFields = [
      'format', 'appId', 'version', 'build', 'releaseChannel',
      'minRuntimeVersion', 'dataVersion', 'name', 'description',
      'category', 'icon', 'entrypoints', 'permissions', 'capabilityAllowlist'
    ];

    const errors: string[] = [];

    for (const field of requiredFields) {
      if (!(field in manifest)) {
        errors.push(`Missing required field: ${field}`);
      }
    }

    // Validate format
    if (manifest.format !== 'dgos-app/v1') {
      errors.push(`Invalid format: ${manifest.format} (expected dgos-app/v1)`);
    }

    // Validate appId pattern
    if (manifest.appId && !/^[a-z][a-z0-9.-]{1,63}$/.test(manifest.appId)) {
      errors.push('Invalid appId format');
    }

    // Validate version
    if (manifest.version && !/^\d+\.\d+\.\d+/.test(manifest.version)) {
      errors.push('Invalid version format (expected SemVer)');
    }

    // Check entrypoint files exist
    if (manifest.entrypoints) {
      for (const [name, entryPath] of Object.entries(manifest.entrypoints)) {
        try {
          await fs.access(entryPath as string);
        } catch {
          errors.push(`Entrypoint file not found: ${entryPath}`);
        }
      }
    }

    if (errors.length > 0) {
      spinner.fail('Validation failed');
      console.log();
      for (const error of errors) {
        console.log(chalk.red(`  ✗ ${error}`));
      }
      process.exit(1);
    } else {
      spinner.succeed(chalk.green('Validation passed!'));
      console.log(chalk.gray(`App ID: ${manifest.appId}`));
      console.log(chalk.gray(`Version: ${manifest.version}`));
      console.log(chalk.gray(`Build: ${manifest.build}`));
    }
  } catch (error) {
    spinner.fail('Validation failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

async function packageApp(options: any): Promise<void> {
  const spinner = ora('Packaging application...').start();

  try {
    // Load manifest
    const manifestPath = path.join(process.cwd(), 'dgos.json');
    const manifestContent = await fs.readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(manifestContent);

    const outputFile = options.output || `${manifest.appId}-${manifest.version}.dgos`;

    spinner.text = 'Creating package archive...';

    // In real implementation, would create tar.gz with signature
    console.log();
    console.log(chalk.yellow('Packaging not yet fully implemented in V1'));
    console.log(chalk.gray('Package would be created at: ' + outputFile));

    spinner.succeed('Package creation initiated');
  } catch (error) {
    spinner.fail('Packaging failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function testInstall(packagePath: string): Promise<void> {
  const spinner = ora('Installing package for testing...').start();

  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    // In real implementation, would upload and install
    spinner.text = 'Uploading package...';

    console.log();
    console.log(chalk.yellow('Test installation not yet fully implemented in V1'));
    console.log(chalk.gray('Would install: ' + packagePath));

    spinner.succeed('Test installation initiated');
  } catch (error) {
    spinner.fail('Installation failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function publishApp(packagePath: string, options: any): Promise<void> {
  const spinner = ora('Publishing application...').start();

  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    spinner.text = 'Uploading to app directory...';

    console.log();
    console.log(chalk.yellow('Publishing not yet fully implemented in V1'));
    console.log(chalk.gray(`Would publish: ${packagePath}`));
    console.log(chalk.gray(`Channel: ${options.channel}`));

    spinner.succeed('Publication initiated');
  } catch (error) {
    spinner.fail('Publication failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function listApps(options: any): Promise<void> {
  const spinner = ora('Loading applications...').start();

  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    // Would fetch from API
    spinner.succeed('Applications loaded');

    console.log();
    console.log(chalk.yellow('App listing not yet fully implemented in V1'));
  } catch (error) {
    spinner.fail('Failed to load applications');
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

    // Would call installation API
    console.log();
    console.log(chalk.yellow('App installation not yet fully implemented in V1'));
    console.log(chalk.gray(`Would install: ${appId} ${options.version || 'latest'}`));

    spinner.succeed('Installation initiated');
  } catch (error) {
    spinner.fail('Installation failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

async function uninstallApp(appId: string): Promise<void> {
  const spinner = ora(`Uninstalling ${appId}...`).start();

  try {
    await config.load();
    const client = new DGOSClient({
      baseUrl: config.getBaseUrl(),
      apiKey: await config.getApiKey(),
    });

    // Would call uninstall API
    console.log();
    console.log(chalk.yellow('App uninstallation not yet fully implemented in V1'));
    console.log(chalk.gray(`Would uninstall: ${appId}`));

    spinner.succeed('Uninstallation initiated');
  } catch (error) {
    spinner.fail('Uninstallation failed');
    console.error(chalk.red(error instanceof Error ? error.message : String(error)));
  }
}

// Helper functions

function generateManifest(name: string, template: string): any {
  const appId = name.toLowerCase().replace(/[^a-z0-9.-]/g, '-');

  return {
    format: 'dgos-app/v1',
    appId: `dev.${appId}`,
    version: '1.0.0',
    build: 1,
    releaseChannel: 'dev',
    minRuntimeVersion: '0.1.0',
    dataVersion: 1,
    name: {
      'zh-CN': name,
      'en-US': name,
    },
    description: {
      'zh-CN': `${name}应用`,
      'en-US': `${name} application`,
    },
    category: 'utilities',
    icon: 'public/icon.png',
    entrypoints: {
      main: 'src/index.html',
    },
    defaultWindow: {
      width: 960,
      height: 720,
      minWidth: 640,
      minHeight: 480,
      resizable: true,
      maximizable: true,
    },
    backgroundPolicy: 'release',
    trustLevel: 'standard',
    uninstallPolicy: 'user-removable',
    permissions: [],
    capabilityAllowlist: [],
    dependencies: {
      apps: [],
      skills: [],
      mcp: [],
    },
    actions: [],
    agent: null,
  };
}

function generatePackageJson(name: string): any {
  return {
    name: `@dgos-app/${name}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    scripts: {
      dev: 'dgos app dev',
      build: 'dgos app build',
      validate: 'dgos app validate',
      test: 'node --test tests/**/*.test.js',
    },
    dependencies: {
      '@dgos/sdk': 'workspace:*',
    },
    devDependencies: {
      typescript: '^5.0.0',
    },
  };
}

async function generateTemplateFiles(directory: string, template: string): Promise<void> {
  // Generate basic template files
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DGOS App</title>
</head>
<body>
  <div id="app">
    <h1>Welcome to DGOS</h1>
    <p>Your application is running!</p>
  </div>
  <script type="module" src="./app.js"></script>
</body>
</html>`;

  const appJs = `import { defineApp } from '@dgos/sdk/app';

defineApp({
  async onActivate() {
    console.log('[App] Activated');

    // Show a welcome notification
    await this.ui.notify({
      title: 'Hello DGOS',
      message: 'Your application is running!',
      type: 'info',
    });
  },

  async onDeactivate() {
    console.log('[App] Deactivated');
  },

  async onContextChange(context) {
    console.log('[App] Context changed:', context);
  },
});`;

  const readme = `# DGOS Application

This is a DGOS application created with \`dgos app create\`.

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Start development server
dgos app dev

# Build for production
dgos app build

# Validate manifest
dgos app validate

# Run tests
pnpm test
\`\`\`

## Structure

- \`dgos.json\` - Application manifest
- \`src/\` - Application source code
- \`public/\` - Static assets
- \`tests/\` - Test files
`;

  await fs.writeFile(path.join(directory, 'src', 'index.html'), indexHtml);
  await fs.writeFile(path.join(directory, 'src', 'app.js'), appJs);
  await fs.writeFile(path.join(directory, 'README.md'), readme);
  await fs.writeFile(path.join(directory, '.gitignore'), 'node_modules/\ndist/\n*.log\n');
}
