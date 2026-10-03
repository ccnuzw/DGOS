#!/usr/bin/env node

/**
 * DGOS MCP CLI
 * Command-line interface for MCP server development
 */

import { Command } from 'commander';
import { spawn } from 'child_process';
import { mkdir, writeFile, readFile } from 'fs/promises';
import { join } from 'path';

const program = new Command();

program
  .name('dgos-mcp')
  .description('DGOS MCP development tools')
  .version('1.0.0');

// Create new MCP server project
program
  .command('create <name>')
  .description('Create a new MCP server project')
  .option('-t, --template <type>', 'Template type (typescript|javascript)', 'javascript')
  .action(async (name, options) => {
    console.log(`Creating MCP server: ${name}`);

    const projectDir = join(process.cwd(), name);

    try {
      await mkdir(projectDir, { recursive: true });
      await mkdir(join(projectDir, 'src'));

      // Create package.json
      const packageJson = {
        name,
        version: '1.0.0',
        type: 'module',
        main: './src/index.mjs',
        bin: {
          [name]: './src/index.mjs'
        },
        dependencies: {
          '@dgos/mcp-server-sdk': '^1.0.0',
        },
        scripts: {
          start: 'node src/index.mjs',
          dev: 'node --watch src/index.mjs',
        },
      };

      await writeFile(
        join(projectDir, 'package.json'),
        JSON.stringify(packageJson, null, 2)
      );

      // Create server template
      const serverTemplate = `#!/usr/bin/env node

import { MCPServer, createTextResult } from '@dgos/mcp-server-sdk';

const server = new MCPServer({
  name: '${name}',
  version: '1.0.0',
  capabilities: {
    tools: true,
  },
});

// Add your tools here
server.addTool(
  {
    name: 'example_tool',
    description: 'An example tool',
    inputSchema: {
      type: 'object',
      properties: {
        message: {
          type: 'string',
          description: 'Message to process',
        },
      },
      required: ['message'],
    },
  },
  async (args) => {
    return createTextResult(\`Received: \${args.message}\`);
  }
);

console.error('${name} MCP Server starting...');
await server.start();
console.error('${name} MCP Server ready');
`;

      await writeFile(join(projectDir, 'src', 'index.mjs'), serverTemplate);

      // Create README
      const readme = `# ${name}

MCP server for DGOS

## Installation

\`\`\`bash
npm install
\`\`\`

## Usage

\`\`\`bash
npm start
\`\`\`

## Adding to DGOS

1. Open DGOS MCP Management
2. Add Server → Manual Configuration
3. Configure:
   - Server ID: \`${name}\`
   - Command: \`node\`
   - Arguments: \`${join(projectDir, 'src', 'index.mjs')}\`

## Development

\`\`\`bash
npm run dev
\`\`\`

## Tools

### example_tool

An example tool to demonstrate functionality.

**Parameters:**
- \`message\` (string, required): Message to process

**Example:**
\`\`\`json
{
  "message": "Hello, MCP!"
}
\`\`\`
`;

      await writeFile(join(projectDir, 'README.md'), readme);

      console.log(`\n✓ Created ${name} successfully!`);
      console.log(`\nNext steps:`);
      console.log(`  cd ${name}`);
      console.log(`  npm install`);
      console.log(`  npm start`);

    } catch (error) {
      console.error(`Error creating project: ${error.message}`);
      process.exit(1);
    }
  });

// Test MCP server
program
  .command('test <server>')
  .description('Test an MCP server')
  .option('-m, --method <method>', 'Method to call', 'tools/list')
  .option('-p, --params <json>', 'Parameters as JSON', '{}')
  .action(async (serverPath, options) => {
    console.log(`Testing MCP server: ${serverPath}`);

    const child = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    let responseData = '';

    child.stdout.on('data', (data) => {
      responseData += data.toString();
    });

    child.on('error', (error) => {
      console.error(`Failed to start server: ${error.message}`);
      process.exit(1);
    });

    // Send initialize
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: {
          name: 'dgos-mcp-cli',
          version: '1.0.0',
        },
      },
    };

    child.stdin.write(JSON.stringify(initRequest) + '\n');

    // Wait for initialize response
    setTimeout(() => {
      // Send test request
      const params = JSON.parse(options.params);
      const testRequest = {
        jsonrpc: '2.0',
        id: 2,
        method: options.method,
        params,
      };

      child.stdin.write(JSON.stringify(testRequest) + '\n');

      // Wait for response
      setTimeout(() => {
        child.kill();

        console.log('\nResponse:');
        console.log(responseData);

        process.exit(0);
      }, 2000);
    }, 1000);
  });

// Validate MCP server
program
  .command('validate <server>')
  .description('Validate MCP server configuration')
  .action(async (serverPath) => {
    console.log(`Validating MCP server: ${serverPath}`);

    const child = spawn('node', [serverPath], {
      stdio: ['pipe', 'pipe', 'inherit'],
    });

    let passed = true;
    let responseData = '';

    child.stdout.on('data', (data) => {
      responseData += data.toString();
    });

    child.on('error', (error) => {
      console.error(`✗ Failed to start server: ${error.message}`);
      passed = false;
    });

    // Test initialize
    const initRequest = {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'test', version: '1.0.0' },
      },
    };

    child.stdin.write(JSON.stringify(initRequest) + '\n');

    setTimeout(() => {
      child.kill();

      // Parse responses
      const lines = responseData.split('\n').filter(l => l.trim());

      if (lines.length === 0) {
        console.error('✗ No response from server');
        process.exit(1);
      }

      try {
        const response = JSON.parse(lines[0]);

        if (response.error) {
          console.error(`✗ Server returned error: ${response.error.message}`);
          process.exit(1);
        }

        if (!response.result) {
          console.error('✗ Invalid response format');
          process.exit(1);
        }

        const result = response.result;

        console.log('✓ Server responds to initialize');
        console.log(`✓ Protocol version: ${result.protocolVersion}`);
        console.log(`✓ Server: ${result.serverInfo.name} v${result.serverInfo.version}`);

        if (result.capabilities.tools) {
          console.log('✓ Supports tools');
        }
        if (result.capabilities.resources) {
          console.log('✓ Supports resources');
        }
        if (result.capabilities.prompts) {
          console.log('✓ Supports prompts');
        }

        console.log('\n✓ Validation passed');
        process.exit(0);

      } catch (error) {
        console.error(`✗ Failed to parse response: ${error.message}`);
        process.exit(1);
      }
    }, 2000);
  });

// Package MCP server
program
  .command('package')
  .description('Package MCP server for distribution')
  .action(async () => {
    console.log('Packaging MCP server...');

    try {
      const packageJson = JSON.parse(
        await readFile('package.json', 'utf-8')
      );

      console.log(`\nPackage: ${packageJson.name}@${packageJson.version}`);
      console.log('\nTo publish:');
      console.log('  npm publish');

    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  });

// Run MCP server in development mode
program
  .command('dev')
  .description('Run MCP server in development mode with auto-reload')
  .action(() => {
    console.log('Starting MCP server in development mode...');

    const child = spawn('node', ['--watch', 'src/index.mjs'], {
      stdio: 'inherit',
    });

    child.on('error', (error) => {
      console.error(`Failed to start: ${error.message}`);
      process.exit(1);
    });
  });

program.parse();
