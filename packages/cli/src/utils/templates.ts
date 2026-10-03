// Template management and project scaffolding

import * as fs from 'fs/promises';
import * as path from 'path';
import chalk from 'chalk';

export interface Template {
  name: string;
  title: string;
  description: string;
  features: string[];
}

export const TEMPLATES: Template[] = [
  {
    name: 'basic',
    title: 'Basic Application',
    description: 'Simple DGOS application with minimal setup',
    features: ['Basic UI', 'DGOS SDK integration', 'Hot reload support'],
  },
  {
    name: 'dashboard',
    title: 'Dashboard Application',
    description: 'Data visualization dashboard with charts and widgets',
    features: ['Charts', 'Widgets', 'Real-time updates', 'Responsive layout'],
  },
  {
    name: 'productivity',
    title: 'Productivity Tool',
    description: 'Task management and productivity application',
    features: ['Task management', 'Notes', 'Calendar', 'Notifications'],
  },
  {
    name: 'ai-assistant',
    title: 'AI Assistant',
    description: 'AI-powered assistant with chat interface',
    features: ['Chat UI', 'AI integration', 'Context awareness', 'Skill execution'],
  },
  {
    name: 'mcp-integration',
    title: 'MCP Integration',
    description: 'Application with MCP server integration',
    features: ['MCP client', 'Tool execution', 'Resource access', 'Context management'],
  },
];

export interface ProjectScaffoldOptions {
  name: string;
  template: string;
  directory: string;
  description?: string;
  author?: string;
  gitInit?: boolean;
  installDeps?: boolean;
}

export async function scaffoldProject(options: ProjectScaffoldOptions): Promise<void> {
  const { name, template, directory, description, author, gitInit, installDeps } = options;

  // Create directory structure
  await fs.mkdir(directory, { recursive: true });
  await fs.mkdir(path.join(directory, 'src'), { recursive: true });
  await fs.mkdir(path.join(directory, 'public'), { recursive: true });
  await fs.mkdir(path.join(directory, 'tests'), { recursive: true });

  // Generate manifest
  const manifest = generateManifest(name, template, description);
  await fs.writeFile(
    path.join(directory, 'dgos.json'),
    JSON.stringify(manifest, null, 2)
  );

  // Generate package.json
  const packageJson = generatePackageJson(name, author);
  await fs.writeFile(
    path.join(directory, 'package.json'),
    JSON.stringify(packageJson, null, 2)
  );

  // Generate template files based on template type
  await generateTemplateFiles(directory, template);

  // Generate additional files
  await generateReadme(directory, name, template);
  await generateGitignore(directory);
  await generateTsConfig(directory);
  await generateVsCodeSettings(directory);

  // Git init
  if (gitInit) {
    const { execaCommand } = await import('execa');
    try {
      await execaCommand('git init', { cwd: directory });
      await execaCommand('git add .', { cwd: directory });
      await execaCommand('git commit -m "Initial commit from DGOS CLI"', { cwd: directory });
    } catch (error) {
      console.log(chalk.yellow('  Warning: Git initialization failed'));
    }
  }

  // Install dependencies
  if (installDeps) {
    const { execaCommand } = await import('execa');
    try {
      console.log(chalk.cyan('\nInstalling dependencies...'));
      await execaCommand('pnpm install', { cwd: directory, stdio: 'inherit' });
    } catch (error) {
      console.log(chalk.yellow('  Warning: Dependency installation failed'));
    }
  }
}

function generateManifest(name: string, template: string, description?: string): any {
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
      'zh-CN': description || `${name}应用`,
      'en-US': description || `${name} application`,
    },
    category: template === 'ai-assistant' ? 'ai' : template === 'productivity' ? 'productivity' : 'utilities',
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
    permissions: template === 'mcp-integration' ? ['mcp:*'] : [],
    capabilityAllowlist: [],
    dependencies: {
      apps: [],
      skills: [],
      mcp: template === 'mcp-integration' ? ['@modelcontextprotocol/server-filesystem'] : [],
    },
    actions: [],
    agent: null,
  };
}

function generatePackageJson(name: string, author?: string): any {
  return {
    name: `@dgos-app/${name}`,
    version: '1.0.0',
    private: true,
    type: 'module',
    description: `DGOS application: ${name}`,
    author: author || '',
    scripts: {
      dev: 'dgos app dev',
      build: 'dgos app build',
      validate: 'dgos app validate',
      test: 'dgos app test',
      lint: 'dgos app lint',
      package: 'dgos app package',
    },
    dependencies: {
      '@dgos/sdk': 'workspace:*',
    },
    devDependencies: {
      typescript: '^5.0.0',
      '@types/node': '^20.0.0',
    },
  };
}

async function generateTemplateFiles(directory: string, template: string): Promise<void> {
  switch (template) {
    case 'basic':
      await generateBasicTemplate(directory);
      break;
    case 'dashboard':
      await generateDashboardTemplate(directory);
      break;
    case 'productivity':
      await generateProductivityTemplate(directory);
      break;
    case 'ai-assistant':
      await generateAiAssistantTemplate(directory);
      break;
    case 'mcp-integration':
      await generateMcpTemplate(directory);
      break;
    default:
      await generateBasicTemplate(directory);
  }
}

async function generateBasicTemplate(directory: string): Promise<void> {
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>DGOS App</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div id="app">
    <header>
      <h1>Welcome to DGOS</h1>
      <p>Your application is running!</p>
    </header>
    <main>
      <section class="card">
        <h2>Getting Started</h2>
        <p>Edit <code>src/app.js</code> to start building your application.</p>
        <button id="notify-btn">Show Notification</button>
      </section>
    </main>
  </div>
  <script type="module" src="./app.js"></script>
</body>
</html>`;

  const appJs = `import { defineApp } from '@dgos/sdk/app';

const app = defineApp({
  async onActivate() {
    console.log('[App] Activated');
    this.setupUI();
  },

  async onDeactivate() {
    console.log('[App] Deactivated');
  },

  async onContextChange(context) {
    console.log('[App] Context changed:', context);
  },

  setupUI() {
    const btn = document.getElementById('notify-btn');
    if (btn) {
      btn.addEventListener('click', async () => {
        await this.ui.notify({
          title: 'Hello DGOS',
          message: 'Your application is working!',
          type: 'info',
        });
      });
    }
  },
});

export default app;`;

  const stylesCSS = `* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #333;
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
}

#app {
  max-width: 800px;
  width: 100%;
  padding: 2rem;
}

header {
  text-align: center;
  color: white;
  margin-bottom: 2rem;
}

header h1 {
  font-size: 3rem;
  margin-bottom: 0.5rem;
}

header p {
  font-size: 1.2rem;
  opacity: 0.9;
}

.card {
  background: white;
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2);
}

.card h2 {
  margin-bottom: 1rem;
  color: #667eea;
}

.card p {
  margin-bottom: 1.5rem;
  line-height: 1.6;
}

code {
  background: #f4f4f4;
  padding: 0.2rem 0.4rem;
  border-radius: 4px;
  font-family: 'Monaco', 'Courier New', monospace;
}

button {
  background: #667eea;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.3s;
}

button:hover {
  background: #5568d3;
}`;

  await fs.writeFile(path.join(directory, 'src', 'index.html'), indexHtml);
  await fs.writeFile(path.join(directory, 'src', 'app.js'), appJs);
  await fs.writeFile(path.join(directory, 'src', 'styles.css'), stylesCSS);
}

async function generateDashboardTemplate(directory: string): Promise<void> {
  // Similar structure but with dashboard-specific content
  await generateBasicTemplate(directory);
  // Add dashboard-specific files here
}

async function generateProductivityTemplate(directory: string): Promise<void> {
  await generateBasicTemplate(directory);
  // Add productivity-specific files here
}

async function generateAiAssistantTemplate(directory: string): Promise<void> {
  await generateBasicTemplate(directory);
  // Add AI assistant-specific files here
}

async function generateMcpTemplate(directory: string): Promise<void> {
  await generateBasicTemplate(directory);
  // Add MCP-specific files here
}

async function generateReadme(directory: string, name: string, template: string): Promise<void> {
  const readme = `# ${name}

DGOS application created with \`dgos app create\` using the **${template}** template.

## Development

\`\`\`bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Validate manifest
pnpm validate

# Run tests
pnpm test
\`\`\`

## Project Structure

\`\`\`
${name}/
├── dgos.json          # Application manifest
├── package.json       # Node.js package configuration
├── src/               # Source code
│   ├── index.html    # Main HTML file
│   ├── app.js        # Application logic
│   └── styles.css    # Styles
├── public/           # Static assets
├── tests/            # Test files
└── README.md         # This file
\`\`\`

## Learn More

- [DGOS Documentation](https://dgos.dev/docs)
- [DGOS SDK Reference](https://dgos.dev/docs/sdk)
- [DGOS CLI Guide](https://dgos.dev/docs/cli)

## License

MIT
`;

  await fs.writeFile(path.join(directory, 'README.md'), readme);
}

async function generateGitignore(directory: string): Promise<void> {
  const gitignore = `# Dependencies
node_modules/
pnpm-lock.yaml

# Build output
dist/
build/
*.dgos

# Environment
.env
.env.local

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Testing
coverage/
.nyc_output/
`;

  await fs.writeFile(path.join(directory, '.gitignore'), gitignore);
}

async function generateTsConfig(directory: string): Promise<void> {
  const tsconfig = {
    compilerOptions: {
      target: 'ES2020',
      module: 'ESNext',
      lib: ['ES2020', 'DOM'],
      moduleResolution: 'node',
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      types: ['node'],
    },
    include: ['src/**/*'],
    exclude: ['node_modules', 'dist'],
  };

  await fs.writeFile(path.join(directory, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2));
}

async function generateVsCodeSettings(directory: string): Promise<void> {
  const vscodeDir = path.join(directory, '.vscode');
  await fs.mkdir(vscodeDir, { recursive: true });

  const settings = {
    'editor.formatOnSave': true,
    'editor.codeActionsOnSave': {
      'source.fixAll': true,
    },
    'typescript.tsdk': 'node_modules/typescript/lib',
  };

  const extensions = {
    recommendations: ['dbaeumer.vscode-eslint', 'esbenp.prettier-vscode'],
  };

  await fs.writeFile(path.join(vscodeDir, 'settings.json'), JSON.stringify(settings, null, 2));
  await fs.writeFile(path.join(vscodeDir, 'extensions.json'), JSON.stringify(extensions, null, 2));
}
