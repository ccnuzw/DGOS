/**
 * MCP Server Presets
 * Common MCP server configurations for quick setup
 */

import type { MCPServerPreset } from './types.ts';

export const mcpPresets: Record<string, MCPServerPreset> = {
  filesystem: {
    id: 'filesystem',
    name: {
      en: 'Filesystem',
      zh: '文件系统',
    },
    description: {
      en: 'Access and manage local filesystem',
      zh: '访问和管理本地文件系统',
    },
    category: 'system',
    config: {
      serverId: 'filesystem',
      name: { en: 'Filesystem', zh: '文件系统' },
      description: { en: 'Local filesystem access', zh: '本地文件系统访问' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-filesystem', './'],
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['fs:read', 'fs:write'],
      icon: '📁',
      tags: ['filesystem', 'files', 'local'],
    },
    requiresCredentials: false,
  },

  github: {
    id: 'github',
    name: {
      en: 'GitHub',
      zh: 'GitHub',
    },
    description: {
      en: 'GitHub API integration for repository management',
      zh: 'GitHub API 集成，用于仓库管理',
    },
    category: 'api',
    config: {
      serverId: 'github',
      name: { en: 'GitHub', zh: 'GitHub' },
      description: { en: 'GitHub API integration', zh: 'GitHub API 集成' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-github'],
        env: {},
      },
      authentication: {
        type: 'api-key',
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['network:github.com'],
      icon: '🐙',
      tags: ['github', 'git', 'api', 'repositories'],
    },
    requiresCredentials: true,
    credentialFields: [
      {
        key: 'GITHUB_TOKEN',
        label: { en: 'GitHub Token', zh: 'GitHub 令牌' },
        type: 'password',
        required: true,
        placeholder: 'ghp_xxxxxxxxxxxx',
      },
    ],
  },

  postgres: {
    id: 'postgres',
    name: {
      en: 'PostgreSQL',
      zh: 'PostgreSQL',
    },
    description: {
      en: 'PostgreSQL database access and queries',
      zh: 'PostgreSQL 数据库访问和查询',
    },
    category: 'database',
    config: {
      serverId: 'postgres',
      name: { en: 'PostgreSQL', zh: 'PostgreSQL' },
      description: { en: 'PostgreSQL database access', zh: 'PostgreSQL 数据库访问' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-postgres'],
        env: {},
      },
      authentication: {
        type: 'api-key',
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['database:postgres'],
      icon: '🐘',
      tags: ['postgresql', 'database', 'sql'],
    },
    requiresCredentials: true,
    credentialFields: [
      {
        key: 'POSTGRES_CONNECTION_STRING',
        label: { en: 'Connection String', zh: '连接字符串' },
        type: 'password',
        required: true,
        placeholder: 'postgresql://user:password@localhost:5432/dbname',
      },
    ],
  },

  sqlite: {
    id: 'sqlite',
    name: {
      en: 'SQLite',
      zh: 'SQLite',
    },
    description: {
      en: 'SQLite database access and queries',
      zh: 'SQLite 数据库访问和查询',
    },
    category: 'database',
    config: {
      serverId: 'sqlite',
      name: { en: 'SQLite', zh: 'SQLite' },
      description: { en: 'SQLite database access', zh: 'SQLite 数据库访问' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sqlite', '--db-path'],
        env: {},
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['fs:read', 'fs:write'],
      icon: '💾',
      tags: ['sqlite', 'database', 'sql', 'local'],
    },
    requiresCredentials: false,
  },

  brave_search: {
    id: 'brave_search',
    name: {
      en: 'Brave Search',
      zh: 'Brave 搜索',
    },
    description: {
      en: 'Web search using Brave Search API',
      zh: '使用 Brave Search API 进行网络搜索',
    },
    category: 'api',
    config: {
      serverId: 'brave_search',
      name: { en: 'Brave Search', zh: 'Brave 搜索' },
      description: { en: 'Brave Search API integration', zh: 'Brave Search API 集成' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-brave-search'],
        env: {},
      },
      authentication: {
        type: 'api-key',
      },
      capabilities: {
        tools: true,
      },
      permissions: ['network:api.search.brave.com'],
      icon: '🔍',
      tags: ['search', 'web', 'api'],
    },
    requiresCredentials: true,
    credentialFields: [
      {
        key: 'BRAVE_API_KEY',
        label: { en: 'Brave API Key', zh: 'Brave API 密钥' },
        type: 'password',
        required: true,
      },
    ],
  },

  slack: {
    id: 'slack',
    name: {
      en: 'Slack',
      zh: 'Slack',
    },
    description: {
      en: 'Slack workspace integration',
      zh: 'Slack 工作区集成',
    },
    category: 'api',
    config: {
      serverId: 'slack',
      name: { en: 'Slack', zh: 'Slack' },
      description: { en: 'Slack API integration', zh: 'Slack API 集成' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-slack'],
        env: {},
      },
      authentication: {
        type: 'bearer',
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['network:slack.com'],
      icon: '💬',
      tags: ['slack', 'chat', 'communication', 'api'],
    },
    requiresCredentials: true,
    credentialFields: [
      {
        key: 'SLACK_BOT_TOKEN',
        label: { en: 'Bot Token', zh: '机器人令牌' },
        type: 'password',
        required: true,
        placeholder: 'xoxb-xxxxxxxxxxxx',
      },
      {
        key: 'SLACK_TEAM_ID',
        label: { en: 'Team ID', zh: '团队 ID' },
        type: 'text',
        required: true,
      },
    ],
  },

  google_drive: {
    id: 'google_drive',
    name: {
      en: 'Google Drive',
      zh: 'Google Drive',
    },
    description: {
      en: 'Google Drive file access and management',
      zh: 'Google Drive 文件访问和管理',
    },
    category: 'api',
    config: {
      serverId: 'google_drive',
      name: { en: 'Google Drive', zh: 'Google Drive' },
      description: { en: 'Google Drive integration', zh: 'Google Drive 集成' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-gdrive'],
        env: {},
      },
      authentication: {
        type: 'bearer',
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['network:googleapis.com'],
      icon: '📂',
      tags: ['google', 'drive', 'storage', 'api'],
    },
    requiresCredentials: true,
    credentialFields: [
      {
        key: 'GOOGLE_CLIENT_ID',
        label: { en: 'Client ID', zh: '客户端 ID' },
        type: 'text',
        required: true,
      },
      {
        key: 'GOOGLE_CLIENT_SECRET',
        label: { en: 'Client Secret', zh: '客户端密钥' },
        type: 'password',
        required: true,
      },
    ],
  },

  puppeteer: {
    id: 'puppeteer',
    name: {
      en: 'Puppeteer',
      zh: 'Puppeteer',
    },
    description: {
      en: 'Browser automation and web scraping',
      zh: '浏览器自动化和网页抓取',
    },
    category: 'automation',
    config: {
      serverId: 'puppeteer',
      name: { en: 'Puppeteer', zh: 'Puppeteer' },
      description: { en: 'Browser automation', zh: '浏览器自动化' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-puppeteer'],
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['process:spawn', 'network:*'],
      icon: '🤖',
      tags: ['automation', 'browser', 'scraping'],
    },
    requiresCredentials: false,
  },

  memory: {
    id: 'memory',
    name: {
      en: 'Memory',
      zh: '记忆',
    },
    description: {
      en: 'Persistent memory storage for context',
      zh: '用于上下文的持久记忆存储',
    },
    category: 'utility',
    config: {
      serverId: 'memory',
      name: { en: 'Memory', zh: '记忆' },
      description: { en: 'Persistent memory', zh: '持久记忆' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-memory'],
      },
      capabilities: {
        tools: true,
        resources: true,
      },
      permissions: ['fs:read', 'fs:write'],
      icon: '🧠',
      tags: ['memory', 'storage', 'context'],
    },
    requiresCredentials: false,
  },

  sequential_thinking: {
    id: 'sequential_thinking',
    name: {
      en: 'Sequential Thinking',
      zh: '顺序思考',
    },
    description: {
      en: 'Structured thinking and reasoning tools',
      zh: '结构化思考和推理工具',
    },
    category: 'utility',
    config: {
      serverId: 'sequential_thinking',
      name: { en: 'Sequential Thinking', zh: '顺序思考' },
      description: { en: 'Structured thinking', zh: '结构化思考' },
      version: '1.0.0',
      connection: {
        type: 'stdio',
        command: 'npx',
        args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
      },
      capabilities: {
        tools: true,
      },
      permissions: [],
      icon: '🧩',
      tags: ['thinking', 'reasoning', 'utility'],
    },
    requiresCredentials: false,
  },
};

export function getPresetById(id: string): MCPServerPreset | undefined {
  return mcpPresets[id];
}

export function getPresetsByCategory(category: string): MCPServerPreset[] {
  return Object.values(mcpPresets).filter((preset) => preset.category === category);
}

export function getAllPresets(): MCPServerPreset[] {
  return Object.values(mcpPresets);
}

export function getPresetCategories(): string[] {
  const categories = new Set(Object.values(mcpPresets).map((p) => p.category));
  return Array.from(categories).sort();
}
