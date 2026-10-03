# DGOS CLI Plugin Examples

Example plugins demonstrating how to extend the DGOS CLI.

## Basic Plugin Structure

### Minimal Plugin

```javascript
// dgos-cli-hello/index.js

export function register(program) {
  program
    .command('hello')
    .argument('[name]', 'Name to greet')
    .option('-l, --loud', 'Shout the greeting')
    .description('Say hello')
    .action((name, options) => {
      const greeting = `Hello, ${name || 'World'}!`;
      console.log(options.loud ? greeting.toUpperCase() : greeting);
    });
}

export const metadata = {
  name: 'dgos-cli-hello',
  version: '1.0.0',
  description: 'Simple hello world plugin',
  author: 'Your Name',
  homepage: 'https://github.com/yourusername/dgos-cli-hello',
};
```

```json
// dgos-cli-hello/package.json
{
  "name": "dgos-cli-hello",
  "version": "1.0.0",
  "description": "Simple hello world plugin for DGOS CLI",
  "main": "index.js",
  "keywords": ["dgos-cli-plugin"],
  "author": "Your Name",
  "license": "MIT"
}
```

## TypeScript Plugin

```typescript
// dgos-cli-typescript/src/index.ts

import { Command } from 'commander';
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';

const execAsync = promisify(exec);

export function register(program: Command): void {
  const ts = program
    .command('typescript')
    .alias('ts')
    .description('TypeScript utilities');

  ts.command('check')
    .description('Type check the project')
    .action(async () => {
      const spinner = ora('Type checking...').start();
      
      try {
        await execAsync('tsc --noEmit');
        spinner.succeed(chalk.green('Type check passed!'));
      } catch (error) {
        spinner.fail(chalk.red('Type check failed'));
        console.error(error);
        process.exit(1);
      }
    });

  ts.command('init')
    .description('Initialize TypeScript configuration')
    .action(async () => {
      const spinner = ora('Creating tsconfig.json...').start();
      
      try {
        await execAsync('tsc --init');
        spinner.succeed(chalk.green('TypeScript initialized!'));
      } catch (error) {
        spinner.fail(chalk.red('Failed to initialize TypeScript'));
        console.error(error);
      }
    });
}

export const metadata = {
  name: 'dgos-cli-typescript',
  version: '1.0.0',
  description: 'TypeScript utilities for DGOS CLI',
};
```

## Linting Plugin

```javascript
// dgos-cli-eslint/index.js

import { ESLint } from 'eslint';
import chalk from 'chalk';
import ora from 'ora';

export function register(program) {
  const lint = program
    .command('eslint')
    .description('ESLint integration');

  lint
    .command('run')
    .option('--fix', 'Auto-fix issues')
    .description('Run ESLint')
    .action(async (options) => {
      const spinner = ora('Running ESLint...').start();

      const eslint = new ESLint({ fix: options.fix });
      const results = await eslint.lintFiles(['src/**/*.{js,ts,jsx,tsx}']);

      if (options.fix) {
        await ESLint.outputFixes(results);
      }

      const formatter = await eslint.loadFormatter('stylish');
      const resultText = formatter.format(results);

      const errorCount = results.reduce((sum, r) => sum + r.errorCount, 0);
      const warningCount = results.reduce((sum, r) => sum + r.warningCount, 0);

      if (errorCount > 0) {
        spinner.fail(chalk.red(`${errorCount} errors, ${warningCount} warnings`));
        console.log(resultText);
        process.exit(1);
      } else if (warningCount > 0) {
        spinner.warn(chalk.yellow(`${warningCount} warnings`));
        console.log(resultText);
      } else {
        spinner.succeed(chalk.green('No issues found!'));
      }
    });

  lint
    .command('init')
    .description('Initialize ESLint configuration')
    .action(async () => {
      console.log(chalk.cyan('Initializing ESLint...'));
      const { execa } = await import('execa');
      await execa('npx', ['eslint', '--init'], { stdio: 'inherit' });
    });
}

export const metadata = {
  name: 'dgos-cli-eslint',
  version: '1.0.0',
  description: 'ESLint integration for DGOS CLI',
  keywords: ['dgos-cli-plugin', 'eslint', 'linting'],
};
```

## Git Hooks Plugin

```javascript
// dgos-cli-hooks/index.js

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';

export function register(program) {
  const hooks = program
    .command('hooks')
    .description('Git hooks management');

  hooks
    .command('install')
    .description('Install git hooks')
    .action(async () => {
      const hooksDir = path.join(process.cwd(), '.git', 'hooks');

      // Pre-commit hook
      const preCommit = `#!/bin/sh
dgos app lint --fix
dgos app test
`;

      await fs.writeFile(path.join(hooksDir, 'pre-commit'), preCommit);
      await fs.chmod(path.join(hooksDir, 'pre-commit'), 0o755);

      // Pre-push hook
      const prePush = `#!/bin/sh
dgos app build --production
`;

      await fs.writeFile(path.join(hooksDir, 'pre-push'), prePush);
      await fs.chmod(path.join(hooksDir, 'pre-push'), 0o755);

      console.log(chalk.green('✓ Git hooks installed!'));
      console.log(chalk.gray('  - pre-commit: lint and test'));
      console.log(chalk.gray('  - pre-push: build'));
    });

  hooks
    .command('uninstall')
    .description('Remove git hooks')
    .action(async () => {
      const hooksDir = path.join(process.cwd(), '.git', 'hooks');

      try {
        await fs.unlink(path.join(hooksDir, 'pre-commit'));
        await fs.unlink(path.join(hooksDir, 'pre-push'));
        console.log(chalk.green('✓ Git hooks removed'));
      } catch (error) {
        console.log(chalk.yellow('No hooks to remove'));
      }
    });
}

export const metadata = {
  name: 'dgos-cli-hooks',
  version: '1.0.0',
  description: 'Git hooks management for DGOS CLI',
};
```

## Code Generation Plugin

```javascript
// dgos-cli-generate/index.js

import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import inquirer from 'inquirer';

export function register(program) {
  const generate = program
    .command('generate')
    .alias('g')
    .description('Code generation utilities');

  generate
    .command('component')
    .argument('<name>', 'Component name')
    .option('--type <type>', 'Component type', 'functional')
    .description('Generate a new component')
    .action(async (name, options) => {
      const componentDir = path.join(process.cwd(), 'src', 'components', name);
      await fs.mkdir(componentDir, { recursive: true });

      const componentCode = generateComponent(name, options.type);
      const testCode = generateComponentTest(name);
      const styleCode = generateComponentStyle(name);

      await fs.writeFile(path.join(componentDir, `${name}.jsx`), componentCode);
      await fs.writeFile(path.join(componentDir, `${name}.test.js`), testCode);
      await fs.writeFile(path.join(componentDir, `${name}.css`), styleCode);
      await fs.writeFile(path.join(componentDir, 'index.js'), `export { default } from './${name}';\n`);

      console.log(chalk.green(`✓ Component ${name} created!`));
      console.log(chalk.gray(`  ${componentDir}/`));
    });

  generate
    .command('page')
    .argument('<name>', 'Page name')
    .description('Generate a new page')
    .action(async (name) => {
      const pageCode = generatePage(name);
      const pagePath = path.join(process.cwd(), 'src', 'pages', `${name}.jsx`);

      await fs.mkdir(path.dirname(pagePath), { recursive: true });
      await fs.writeFile(pagePath, pageCode);

      console.log(chalk.green(`✓ Page ${name} created!`));
    });

  generate
    .command('api')
    .argument('<name>', 'API module name')
    .description('Generate an API module')
    .action(async (name) => {
      const apiCode = generateApi(name);
      const apiPath = path.join(process.cwd(), 'src', 'api', `${name}.js`);

      await fs.mkdir(path.dirname(apiPath), { recursive: true });
      await fs.writeFile(apiPath, apiCode);

      console.log(chalk.green(`✓ API module ${name} created!`));
    });
}

function generateComponent(name, type) {
  return `import React from 'react';
import './${name}.css';

export default function ${name}(props) {
  return (
    <div className="${name.toLowerCase()}">
      <h2>${name} Component</h2>
      {/* Add your component content here */}
    </div>
  );
}
`;
}

function generateComponentTest(name) {
  return `import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ${name} from './${name}';

describe('${name}', () => {
  it('renders correctly', () => {
    render(<${name} />);
    expect(screen.getByText('${name} Component')).toBeInTheDocument();
  });
});
`;
}

function generateComponentStyle(name) {
  return `.${name.toLowerCase()} {
  /* Add your styles here */
}
`;
}

function generatePage(name) {
  return `import React from 'react';

export default function ${name}Page() {
  return (
    <div className="page ${name.toLowerCase()}-page">
      <h1>${name} Page</h1>
      {/* Add your page content here */}
    </div>
  );
}
`;
}

function generateApi(name) {
  return `import { DGOSClient } from '@dgos/sdk';

export class ${name}API {
  constructor(client) {
    this.client = client;
  }

  async list(options = {}) {
    const response = await this.client.get('/${name.toLowerCase()}', { params: options });
    return response.data;
  }

  async get(id) {
    const response = await this.client.get(\`/${name.toLowerCase()}/\${id}\`);
    return response.data;
  }

  async create(data) {
    const response = await this.client.post('/${name.toLowerCase()}', data);
    return response.data;
  }

  async update(id, data) {
    const response = await this.client.put(\`/${name.toLowerCase()}/\${id}\`, data);
    return response.data;
  }

  async delete(id) {
    await this.client.delete(\`/${name.toLowerCase()}/\${id}\`);
  }
}
`;
}

export const metadata = {
  name: 'dgos-cli-generate',
  version: '1.0.0',
  description: 'Code generation utilities for DGOS CLI',
};
```

## Deployment Plugin

```javascript
// dgos-cli-deploy/index.js

import { execa } from 'execa';
import chalk from 'chalk';
import ora from 'ora';

export function register(program) {
  const deploy = program
    .command('deploy')
    .description('Deployment utilities');

  deploy
    .command('staging')
    .description('Deploy to staging environment')
    .action(async () => {
      await deployTo('staging');
    });

  deploy
    .command('production')
    .option('--force', 'Force deployment without checks')
    .description('Deploy to production environment')
    .action(async (options) => {
      if (!options.force) {
        console.log(chalk.yellow('⚠ Production deployment'));
        const { default: inquirer } = await import('inquirer');
        const { confirm } = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'confirm',
            message: 'Are you sure you want to deploy to production?',
            default: false,
          },
        ]);

        if (!confirm) {
          console.log(chalk.gray('Deployment cancelled'));
          return;
        }
      }

      await deployTo('production');
    });
}

async function deployTo(environment) {
  console.log(chalk.cyan(`\nDeploying to ${environment}...\n`));

  // Build
  let spinner = ora('Building application...').start();
  await execa('dgos', ['app', 'build', '--production']);
  spinner.succeed('Build complete');

  // Run tests
  spinner = ora('Running tests...').start();
  await execa('dgos', ['app', 'test']);
  spinner.succeed('Tests passed');

  // Package
  spinner = ora('Creating package...').start();
  await execa('dgos', ['app', 'package']);
  spinner.succeed('Package created');

  // Upload
  spinner = ora(`Uploading to ${environment}...`).start();
  // Simulated upload
  await new Promise(resolve => setTimeout(resolve, 2000));
  spinner.succeed('Upload complete');

  console.log(chalk.green(`\n✓ Deployed to ${environment}!`));
}

export const metadata = {
  name: 'dgos-cli-deploy',
  version: '1.0.0',
  description: 'Deployment utilities for DGOS CLI',
};
```

## Installing Plugins

### From npm

```bash
npm install -g dgos-cli-typescript
dgos plugin list
```

### From Local Directory

```bash
dgos plugin install ./my-plugin
```

### Plugin Directory

Plugins are loaded from:
- `~/.dgos/plugins/`
- `node_modules/` (packages with `dgos-cli-plugin` keyword)
- `.dgos/plugins/` (project-specific)

## Creating Your Own Plugin

### 1. Create Plugin Structure

```bash
mkdir dgos-cli-myplugin
cd dgos-cli-myplugin
npm init -y
```

### 2. Update package.json

```json
{
  "name": "dgos-cli-myplugin",
  "version": "1.0.0",
  "description": "My DGOS CLI plugin",
  "main": "index.js",
  "keywords": ["dgos-cli-plugin"],
  "dependencies": {
    "commander": "^11.0.0",
    "chalk": "^5.3.0"
  }
}
```

### 3. Implement Plugin

```javascript
// index.js
export function register(program) {
  program
    .command('mycommand')
    .description('My custom command')
    .action(() => {
      console.log('Hello from my plugin!');
    });
}

export const metadata = {
  name: 'dgos-cli-myplugin',
  version: '1.0.0',
  description: 'My DGOS CLI plugin',
};
```

### 4. Test Plugin

```bash
dgos plugin install .
dgos mycommand
```

### 5. Publish Plugin

```bash
npm publish
```

## Plugin Best Practices

1. **Use TypeScript** for better type safety
2. **Follow naming convention**: `dgos-cli-*`
3. **Add `dgos-cli-plugin` keyword** to package.json
4. **Provide help text** for all commands
5. **Use spinner** for long-running operations
6. **Handle errors gracefully**
7. **Add tests** for your plugin
8. **Document usage** in README
9. **Use semantic versioning**
10. **Keep dependencies minimal**

## Resources

- [Commander.js Documentation](https://github.com/tj/commander.js)
- [Chalk Documentation](https://github.com/chalk/chalk)
- [Ora Documentation](https://github.com/sindresorhus/ora)
- [Inquirer Documentation](https://github.com/SBoudrias/Inquirer.js)
