# DGOS Application Development Guide

> 完整的DGOS应用开发框架和工具链文档

## 概述

DGOS提供完整的应用开发平台，支持创建、开发、测试、打包和发布应用。本文档涵盖从创建第一个应用到发布到应用商店的完整流程。

## 快速开始

### 创建新应用

```bash
# 创建基础应用
dgos app create my-app

# 使用特定模板
dgos app create my-dashboard --template dashboard

# 指定输出目录
dgos app create my-app --directory ./apps/my-app
```

### 项目结构

```
my-app/
├── dgos.json           # 应用清单（必需）
├── package.json        # Node.js 配置
├── src/
│   ├── index.html      # 主入口点
│   ├── app.js          # 应用逻辑
│   └── styles.css      # 样式文件
├── public/
│   ├── icon.png        # 应用图标
│   └── assets/         # 静态资源
├── tests/
│   └── app.test.js     # 测试文件
└── README.md
```

### 开发工作流

```bash
# 1. 安装依赖
cd my-app
pnpm install

# 2. 启动开发服务器（V1规划中）
dgos app dev

# 3. 验证应用配置
dgos app validate

# 4. 构建生产版本
dgos app build

# 5. 运行测试
pnpm test

# 6. 打包应用
dgos app package

# 7. 测试安装
dgos app test-install ./my-app-1.0.0.dgos

# 8. 发布到应用商店
dgos app publish ./my-app-1.0.0.dgos --channel=stable
```

## 应用清单（dgos.json）

### 必需字段

```json
{
  "format": "dgos-app/v1",
  "appId": "com.example.myapp",
  "version": "1.0.0",
  "build": 1,
  "releaseChannel": "stable",
  "minRuntimeVersion": "0.1.0",
  "dataVersion": 1,
  "name": {
    "zh-CN": "我的应用",
    "en-US": "My App"
  },
  "description": {
    "zh-CN": "应用描述",
    "en-US": "App description"
  },
  "category": "utilities",
  "icon": "public/icon.png",
  "entrypoints": {
    "main": "src/index.html"
  },
  "defaultWindow": {
    "width": 960,
    "height": 720,
    "minWidth": 640,
    "minHeight": 480,
    "resizable": true,
    "maximizable": true
  },
  "backgroundPolicy": "release",
  "trustLevel": "standard",
  "uninstallPolicy": "user-removable",
  "permissions": [],
  "capabilityAllowlist": [],
  "dependencies": {
    "apps": [],
    "skills": [],
    "mcp": []
  },
  "actions": [],
  "agent": null
}
```

### 字段说明

| 字段 | 类型 | 说明 |
|------|------|------|
| `appId` | string | 全局唯一应用标识，格式：`[a-z][a-z0-9.-]{1,63}` |
| `version` | string | 语义化版本号（SemVer） |
| `build` | integer | 构建号，每次构建递增 |
| `releaseChannel` | enum | 发布渠道：`stable`、`beta`、`dev` |
| `dataVersion` | integer | 数据模式版本，变更需提供迁移 |
| `permissions` | array | 请求的权限列表 |
| `capabilityAllowlist` | array | 允许调用的能力列表 |
| `trustLevel` | enum | 信任级别：`standard`、`trusted`、`system` |
| `backgroundPolicy` | enum | 后台策略：`release`、`keep-alive` |

## DGOS SDK API

### 应用定义

```javascript
import { defineApp } from '@dgos/sdk/app';

defineApp({
  async onActivate() {
    // 应用启动时调用
    console.log('App activated');
  },

  async onDeactivate() {
    // 应用关闭时调用
    console.log('App deactivated');
  },

  async onUpdate(fromVersion, fromDataVersion) {
    // 应用更新时调用
    console.log(`Updated from ${fromVersion}`);
  },

  async onContextChange(context) {
    // 系统上下文变化时调用
    console.log('Context changed', context);
  }
});
```

### System API

```javascript
// 获取系统信息
const info = await this.system.getInfo();
// { version: '1.0.0', platform: 'darwin', arch: 'x64' }

// 获取系统上下文（需要权限）
const context = await this.system.getContext();
// { contextVersion, appearance, locale, grid, networkSummary }

// 监听上下文变化
const unsubscribe = this.system.onContextChange((context) => {
  console.log('Context changed:', context);
});

// 取消监听
unsubscribe();
```

### Storage API

```javascript
// Key-Value 存储（应用私有）
await this.storage.kv.set('key', { data: 'value' });
const value = await this.storage.kv.get('key');
await this.storage.kv.delete('key');
const keys = await this.storage.kv.list('prefix-');

// 文件存储
await this.storage.files.write('data.txt', 'Hello DGOS');
const content = await this.storage.files.readText('data.txt');
const exists = await this.storage.files.exists('data.txt');
const files = await this.storage.files.list('/documents');

// 数据库（SQLite）
const rows = await this.storage.db.query(
  'SELECT * FROM tasks WHERE completed = ?',
  [false]
);

const result = await this.storage.db.execute(
  'INSERT INTO tasks (title) VALUES (?)',
  ['New Task']
);
```

### Tasks API

```javascript
// 列出可用模型
const models = await this.tasks.listModels();
// 或筛选特定Provider
const models = await this.tasks.listModels({ 
  providerConfigId: 'provider-123' 
});

// 提交AI任务
const receipt = await this.tasks.submit({
  target: 'assistant',
  intent: 'text.chat',
  input: {
    text: 'Hello, DGOS!'
  },
  options: {
    providerConfigId: 'provider-123',
    modelId: 'gpt-4',
    parameters: {
      temperature: 0.7,
      max_tokens: 1000
    }
  }
});

// 获取任务状态
const task = await this.tasks.get(receipt.taskId);

// 流式获取任务事件
let cursor = 0;
while (true) {
  const batch = await this.tasks.events(receipt.taskId, cursor);
  
  for (const event of batch.items) {
    console.log('Event:', event);
  }
  
  cursor = batch.cursor;
  
  if (!batch.hasMore) break;
}

// 取消任务
await this.tasks.cancel(receipt.taskId);

// 读取Artifact
const artifact = await this.tasks.readArtifact('artifact-id');
console.log(artifact.content);
```

### UI API

```javascript
// 显示通知
await this.ui.notify({
  title: 'Success',
  message: 'Operation completed',
  type: 'success',
  duration: 3000
});

// 显示对话框
await this.ui.alert('Important message');
const confirmed = await this.ui.confirm('Are you sure?');
const input = await this.ui.prompt('Enter your name:', 'Default');

// Toast 消息
this.ui.toast('Quick message', {
  type: 'info',
  duration: 2000,
  position: 'bottom'
});

// 窗口控制
this.ui.window.setTitle('My App Title');
this.ui.window.resize(1024, 768);
this.ui.window.minimize();
this.ui.window.maximize();
this.ui.window.close();
```

### Permissions API

```javascript
// 请求权限
const result = await this.permissions.request(
  'tasks.submit',
  'Need to submit AI tasks'
);

if (result.granted) {
  console.log('Permission granted');
}

// 检查权限
const hasPermission = await this.permissions.has('tasks.submit');

// 获取权限状态
const status = await this.permissions.status('tasks.submit');
// 'granted' | 'denied' | 'prompt'

// 列出所有权限
const permissions = await this.permissions.list();
```

## 权限系统

### 声明权限

在 `dgos.json` 中同时声明 `permissions` 和 `capabilityAllowlist`：

```json
{
  "permissions": [
    "system.context.read",
    "tasks.submit",
    "storage.kv.write"
  ],
  "capabilityAllowlist": [
    "dgos.system.context.read",
    "dgos.aiTask.submit",
    "dgos.storage.kv.set",
    "dgos.storage.kv.get"
  ]
}
```

### 常用权限

| 权限 | 说明 |
|------|------|
| `system.context.read` | 读取系统上下文 |
| `system.context.events` | 订阅上下文变化 |
| `tasks.submit` | 提交AI任务 |
| `tasks.read` | 读取任务状态 |
| `tasks.cancel` | 取消任务 |
| `storage.kv.read` | 读取KV存储 |
| `storage.kv.write` | 写入KV存储 |
| `storage.files.read` | 读取文件 |
| `storage.files.write` | 写入文件 |
| `storage.db.read` | 读取数据库 |
| `storage.db.write` | 写入数据库 |

## 测试应用

### 使用测试工具

```javascript
import { createTestApp, mockPermission } from '@dgos/sdk/testing';

describe('My App', () => {
  it('should initialize correctly', async () => {
    const testEnv = createTestApp({
      context: {
        appId: 'test.myapp',
        version: '1.0.0'
      },
      permissions: mockPermission('tasks.submit', true)
    });

    // 测试应用逻辑
    const hasPermission = await testEnv.api.permissions.has('tasks.submit');
    expect(hasPermission).toBe(true);
  });
});
```

### 模拟存储

```javascript
import { mockStorage } from '@dgos/sdk/testing';

const storage = mockStorage({
  'user.name': 'Test User',
  'user.email': 'test@example.com'
});

const api = storage.createAPI();
const name = await api.kv.get('user.name');
console.log(name); // 'Test User'
```

## 应用模板

### Basic App
最小应用模板，包含：
- 基础UI
- 系统信息显示
- 存储演示

### Dashboard App
数据可视化应用模板，包含：
- 图表组件
- 数据刷新
- 响应式布局

### Task App
AI任务应用模板，包含：
- 任务提交界面
- 流式结果展示
- 历史记录

### Chat Assistant
聊天助手模板，包含：
- 对话界面
- 消息历史
- 多轮对话

## 数据迁移

### 迁移声明

```json
{
  "dataVersion": 2,
  "dataMigration": {
    "from": [1],
    "entry": "migrations/v2.json"
  }
}
```

### 迁移脚本（migrations/v2.json）

```json
{
  "version": 2,
  "from": [1],
  "operations": [
    {
      "type": "move",
      "source": "oldField",
      "target": "newField"
    },
    {
      "type": "move",
      "source": "data.items",
      "target": "items"
    }
  ]
}
```

## 打包和发布

### 应用签名

```bash
# 生成开发者密钥
dgos key:generate

# 签名应用
dgos sign my-app.dgos --key=~/.dgos/dev-key.pem
```

### 发布流程

1. **开发完成** - 完成功能开发和测试
2. **验证** - `dgos app validate`
3. **构建** - `dgos app build --production`
4. **打包** - `dgos app package --sign`
5. **测试安装** - `dgos app test-install`
6. **发布** - `dgos app publish --channel=stable`

### 发布渠道

- **dev** - 开发版本，频繁更新
- **beta** - 测试版本，稳定性验证
- **stable** - 稳定版本，推荐使用

## 最佳实践

### 1. 应用结构

- 保持清单文件准确和最新
- 合理组织代码和资源
- 使用模块化设计

### 2. 权限最小化

- 只请求必需的权限
- 提供清晰的权限说明
- 在运行时请求敏感权限

### 3. 错误处理

```javascript
try {
  await this.tasks.submit({ /* ... */ });
} catch (error) {
  console.error('Failed to submit task:', error);
  await this.ui.notify({
    title: 'Error',
    message: error.message,
    type: 'error'
  });
}
```

### 4. 性能优化

- 使用异步操作
- 避免阻塞主线程
- 合理使用缓存

### 5. 用户体验

- 提供加载状态反馈
- 显示有意义的错误消息
- 支持浅色/深色主题
- 国际化支持

## CLI命令参考

```bash
# 创建应用
dgos app create <name> [--template <template>] [--directory <dir>]

# 开发
dgos app dev [--port <port>] [--host <host>]

# 构建
dgos app build [--output <dir>] [--production]

# 验证
dgos app validate [manifest]

# 打包
dgos app package [--output <file>] [--sign]

# 测试安装
dgos app test-install <package>

# 发布
dgos app publish <package> [--channel <channel>] [--notes <notes>]

# 列表
dgos app list [--installed]

# 安装
dgos app install <appId> [--version <version>]

# 卸载
dgos app uninstall <appId>
```

## 故障排除

### 应用无法启动

1. 检查manifest格式是否正确
2. 验证入口文件路径
3. 检查权限声明
4. 查看控制台错误日志

### 权限被拒绝

1. 检查manifest中的permissions声明
2. 确认capabilityAllowlist包含所需能力
3. 运行时请求权限

### 桥接通信失败

1. 确认bridge初始化完成
2. 检查instanceId是否正确
3. 验证消息格式

## 相关资源

- [Manifest Schema](../04-技术架构/当前版本/V1-app-manifest.schema.json)
- [应用运行时契约](../04-技术架构/当前版本/V1-DGOS应用清单与运行时契约.md)
- [Bridge契约](../04-技术架构/当前版本/V1-应用实例与SDK桥接契约.md)
- [SDK README](../../packages/sdk/README.md)
- [CLI README](../../packages/cli/README.md)

## 下一步

- 查看[示例应用](../../examples/)
- 阅读[API参考文档](../skills/api-reference.md)
- 加入[开发者社区](https://developers.dgos.dev)
