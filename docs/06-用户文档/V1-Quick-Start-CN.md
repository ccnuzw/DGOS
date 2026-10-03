# DGOS V1 快速启动指南

**15分钟内启动并运行**

**版本**: V1.0.0  
**最后更新**: 2026-10-02  
**目标时间**: 15分钟

---

## 目录

1. [前置要求](#前置要求)
2. [安装路径](#安装路径)
3. [路径A：Docker Compose（推荐）](#路径a-docker-compose推荐)
4. [路径B：本地开发](#路径b本地开发)
5. [路径C：macOS桌面应用（即将推出）](#路径c-macos桌面应用即将推出)
6. [首次设置](#首次设置)
7. [常用任务](#常用任务)
8. [故障排除](#故障排除)
9. [下一步](#下一步)

---

## 前置要求

### 系统要求

- **操作系统**: macOS 12+, Linux (Ubuntu 20.04+, Debian 11+), Windows 10+ (WSL2)
- **内存**: 最低4GB，推荐8GB
- **磁盘空间**: 2GB可用空间
- **网络**: 初始设置需要互联网连接

### 必需软件

| 软件 | 版本 | 用途 |
|------|------|------|
| Docker | 20.10+ | 容器运行时 |
| Docker Compose | 2.0+ | 多容器编排 |
| Node.js | 22.0+ | JavaScript运行时 |
| pnpm | 9.0+ | 包管理器 |
| Git | 2.30+ | 版本控制 |

### 快速版本检查

```bash
# 一次性检查所有前置条件
docker --version          # 应为 20.10+
docker compose version    # 应为 2.0+
node --version           # 应为 v22.0+
pnpm --version          # 应为 9.0+
git --version           # 应为 2.30+
```

### 安装缺失的软件

**Docker 与 Docker Compose**:
- macOS: [Docker Desktop](https://www.docker.com/products/docker-desktop)
- Linux: `curl -fsSL https://get.docker.com | sh`
- Windows: [Docker Desktop for Windows](https://www.docker.com/products/docker-desktop)

**Node.js v22**:
```bash
# 使用 nvm（推荐）
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 22
nvm use 22
```

**pnpm**:
```bash
npm install -g pnpm@9
# 或
corepack enable
corepack prepare pnpm@9.0.0 --activate
```

---

## 安装路径

选择最适合您需求的路径：

| 路径 | 最适合 | 时间 | 复杂度 |
|------|--------|------|--------|
| **A: Docker Compose** | 快速评估、类生产环境 | 5分钟 | ⭐ 简单 |
| **B: 本地开发** | 主动开发、调试 | 10分钟 | ⭐⭐ 中等 |
| **C: macOS桌面应用** | 最终用户、原生体验 | 2分钟 | ⭐ 简单 |

---

## 路径A: Docker Compose（推荐）

**最适合**: 首次使用者、快速评估、类生产环境

### 步骤1：克隆仓库

```bash
git clone https://github.com/your-org/DGOS.git
cd DGOS
```

### 步骤2：配置环境

```bash
# 复制环境模板
cp .env.example .env

# 如需要可以编辑（本地开发可选）
# nano .env
```

**默认配置**（开箱即用）：
```bash
NODE_ENV=development
DATABASE_URL=postgres://dgos:dgos@127.0.0.1:5432/dgos
REDIS_URL=redis://127.0.0.1:6379
HOST=127.0.0.1
PORT=3000
```

### 步骤3：启动基础设施

```bash
# 启动 PostgreSQL 和 Redis
docker compose up -d

# 验证服务健康状态
docker compose ps
```

预期输出：
```
NAME                COMMAND                  SERVICE      STATUS       PORTS
dgos-postgres-1     "docker-entrypoint..."   postgres     Up (healthy) 0.0.0.0:5432->5432/tcp
dgos-redis-1        "docker-entrypoint..."   redis        Up (healthy) 0.0.0.0:6379->6379/tcp
```

### 步骤4：安装依赖

```bash
pnpm install --frozen-lockfile
```

⏱️ **这需要2-3分钟**

### 步骤5：运行数据库迁移

```bash
pnpm migrate:plan
```

这会自动创建数据库架构。

### 步骤6：启动DGOS

```bash
# 启动API服务器
pnpm --filter @dgos/api dev
```

在**新终端**中：
```bash
# 启动Web界面
pnpm --filter @dgos/web dev
```

### 步骤7：访问DGOS

打开浏览器并导航到：

```
http://127.0.0.1:5173
```

🎉 **DGOS正在运行！**

API健康端点位于：
```
http://127.0.0.1:3000/health
```

---

## 路径B: 本地开发

**最适合**: 希望完全控制和调试能力的开发者

### 步骤1：克隆和设置

```bash
git clone https://github.com/your-org/DGOS.git
cd DGOS
cp .env.example .env
```

### 步骤2：启动基础设施

```bash
# 启动 PostgreSQL 和 Redis
docker compose up -d

# 等待服务健康（30秒）
docker compose ps
```

### 步骤3：安装依赖

```bash
pnpm install --frozen-lockfile
```

### 步骤4：初始化数据库

```bash
# 运行迁移
pnpm migrate:plan

# 验证迁移已应用
pnpm migrate:check
```

### 步骤5：运行测试（可选但推荐）

```bash
# 运行所有测试
pnpm test

# 运行特定测试套件
pnpm test:security
pnpm test:integration
```

### 步骤6：启动开发服务器

```bash
# 终端1：启动API和Worker
pnpm dev

# 终端2：启动Web UI
pnpm --filter @dgos/web dev
```

### 步骤7：访问DGOS

- **Web界面**: http://127.0.0.1:5173
- **API服务器**: http://127.0.0.1:3000
- **API健康**: http://127.0.0.1:3000/health

---

## 路径C: macOS桌面应用（即将推出）

**最适合**: 希望原生macOS体验的最终用户

### 步骤1：下载

```bash
# 下载最新版本
curl -L -o DGOS.dmg https://github.com/your-org/DGOS/releases/latest/download/DGOS.dmg
```

### 步骤2：安装

1. 打开 `DGOS.dmg`
2. 将DGOS拖到应用程序文件夹
3. 弹出磁盘映像

### 步骤3：启动

1. 从应用程序打开DGOS
2. 提示时允许系统权限
3. 等待初始化（首次启动需要30-60秒）

### 步骤4：首次运行

桌面应用会自动：
- 设置本地数据库
- 启动后台服务
- 打开工作台

**状态**: macOS桌面构建正在开发中。目前请使用路径A或B。

---

## 首次设置

安装后，您需要配置DGOS以供首次使用。

### 1. 引导管理员账户

首次启动时，DGOS会提示您创建管理员账户。

**通过Web界面**:
```
http://127.0.0.1:5173/setup
```

**通过API**:
```bash
curl -X POST http://127.0.0.1:3000/admin/bootstrap \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "YourSecurePassword123!",
    "email": "admin@example.com"
  }'
```

**密码要求**:
- 最少12个字符
- 大小写字母、数字混合
- 推荐至少一个特殊字符

### 2. 配置您的第一个Provider

Provider是为DGOS任务提供动力的AI/LLM服务。

**导航到**: 设置 → Providers → 添加Provider

**示例：OpenAI**
```json
{
  "name": "OpenAI GPT-4",
  "protocol": "openai-compatible",
  "baseUrl": "https://api.openai.com/v1",
  "apiKey": "sk-...",
  "defaultModel": "gpt-4",
  "status": "active"
}
```

**示例：本地Provider**
```json
{
  "name": "Local Ollama",
  "protocol": "openai-compatible",
  "baseUrl": "http://localhost:11434/v1",
  "apiKey": "not-required",
  "defaultModel": "llama2",
  "status": "active"
}
```

**测试Provider**:

使用内置fixture进行测试：

```bash
# 在随机端口启动测试provider
pnpm provider:fixture

# 记下输出中的baseUrl，然后在UI中配置
# 示例输出: {"baseUrl":"http://127.0.0.1:54321","token":"dgos-fixture-token"}
```

### 3. 安装第一个包（AI工作台）

包通过新功能扩展DGOS。

**通过Web界面**:
1. 导航到 **目录** → **包**
2. 找到 **AI工作台**
3. 点击 **安装**
4. 等待安装（30秒）
5. 点击 **启动** 打开

**通过API**:
```bash
curl -X POST http://127.0.0.1:3000/packages/install \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "packageId": "ai-workbench",
    "version": "1.0.0"
  }'
```

### 4. 创建您的第一个任务

任务是AI驱动的工作流。

**从工作台**:
1. 打开AI工作台
2. 点击 **新建任务**
3. 输入提示："总结DGOS的关键特性"
4. 选择Provider："OpenAI GPT-4"
5. 点击 **运行**

**通过API**:
```bash
curl -X POST http://127.0.0.1:3000/tasks \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "ai-completion",
    "prompt": "总结DGOS的关键特性",
    "provider": "openai-gpt4",
    "parameters": {
      "temperature": 0.7,
      "maxTokens": 500
    }
  }'
```

### 5. 查看结果

**在工作台中**:
- 结果显示在输出面板中
- 在侧边栏查看执行日志
- 导出结果为JSON或文本

**通过API**:
```bash
# 获取任务状态
curl http://127.0.0.1:3000/tasks/{taskId} \
  -H "Authorization: Bearer YOUR_API_KEY"

# 获取任务结果
curl http://127.0.0.1:3000/tasks/{taskId}/result \
  -H "Authorization: Bearer YOUR_API_KEY"
```

---

## 常用任务

### 添加新Provider

```bash
# 导航到 设置 → Providers
# 或使用API:
curl -X POST http://127.0.0.1:3000/providers \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Anthropic Claude",
    "protocol": "openai-compatible",
    "baseUrl": "https://api.anthropic.com/v1",
    "apiKey": "sk-ant-...",
    "defaultModel": "claude-3-opus-20240229"
  }'
```

### 安装包

```bash
# 通过Web: 目录 → 浏览 → 安装
# 通过CLI（即将推出）:
dgos package install <包名>
```

### 创建API密钥

**通过Web界面**:
1. 导航到 **设置** → **API密钥**
2. 点击 **创建API密钥**
3. 输入名称并选择范围
4. 安全地复制并保存密钥

**通过API**:
```bash
curl -X POST http://127.0.0.1:3000/api-keys \
  -H "Authorization: Bearer YOUR_SESSION_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Integration Key",
    "scope": ["tasks:read", "tasks:write"],
    "expiresIn": "90d"
  }'
```

### 配置设置

**系统设置**:
- 导航到 **设置** → **系统**
- 配置语言、主题、默认值

**用户偏好**:
- 导航到 **设置** → **偏好**
- 设置编辑器主题、语言、通知

### 查看日志

**应用程序日志**:
```bash
# API日志
docker compose logs -f api

# Worker日志
docker compose logs -f worker

# 所有服务
docker compose logs -f
```

**审计日志**（仅管理员）:
- 导航到 **设置** → **审计**
- 按用户、操作、日期范围筛选
- 导出以符合合规要求

### 备份和恢复

**数据库备份**:
```bash
# 备份
docker compose exec postgres pg_dump -U dgos dgos > backup.sql

# 恢复
docker compose exec -T postgres psql -U dgos dgos < backup.sql
```

**完整系统备份**:
```bash
# 停止服务
docker compose down

# 备份卷
docker run --rm -v dgos_postgres-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/dgos-backup.tar.gz /data

# 重启
docker compose up -d
```

---

## 故障排除

### 服务无法启动

**问题**: `docker compose up -d` 失败

**解决方案**:
```bash
# 检查Docker是否运行
docker ps

# 检查端口是否可用
lsof -i :5432  # PostgreSQL
lsof -i :6379  # Redis
lsof -i :3000  # API

# 删除旧容器
docker compose down -v
docker compose up -d
```

### 数据库连接错误

**问题**: "连接被拒绝"或"数据库不可用"

**症状**:
```
error: connection to server at "127.0.0.1", port 5432 failed
```

**解决方案**:
```bash
# 1. 验证PostgreSQL是否运行
docker compose ps postgres

# 2. 检查数据库健康状态
docker compose exec postgres pg_isready -U dgos -d dgos

# 3. 验证环境变量
cat .env | grep DATABASE_URL

# 4. 重启PostgreSQL
docker compose restart postgres

# 5. 检查日志
docker compose logs postgres
```

### 迁移失败

**问题**: `pnpm migrate:plan` 失败

**解决方案**:
```bash
# 1. 检查迁移状态
pnpm migrate:check

# 2. 查看将要应用的SQL
pnpm migrate:sql

# 3. 重置数据库（警告：销毁数据）
docker compose down -v
docker compose up -d
sleep 10
pnpm migrate:plan
```

### 端口已被占用

**问题**: "EADDRINUSE: 地址已被使用"

**解决方案**:
```bash
# 查找使用端口3000的进程
lsof -ti:3000

# 终止进程（macOS/Linux）
kill -9 $(lsof -ti:3000)

# 或在.env中更改端口
echo "PORT=3001" >> .env
```

### pnpm安装失败

**问题**: 依赖无法安装

**解决方案**:
```bash
# 1. 清除pnpm缓存
pnpm store prune

# 2. 删除node_modules
rm -rf node_modules
rm pnpm-lock.yaml

# 3. 重新安装
pnpm install

# 4. 检查Node版本
node --version  # 必须是v22+
```

### API返回502/504

**问题**: API网关错误

**解决方案**:
```bash
# 1. 检查API健康状态
curl http://127.0.0.1:3000/health

# 2. 检查API日志
docker compose logs api

# 3. 验证数据库连接
docker compose exec postgres psql -U dgos -c "SELECT 1"

# 4. 重启API
docker compose restart api
```

### Provider测试Fixture无法启动

**问题**: `pnpm provider:fixture` 失败

**解决方案**:
```bash
# 1. 检查端口是否可用
lsof -ti:8080

# 2. 使用固定端口
DGOS_FIXTURE_PORT=9000 pnpm provider:fixture

# 3. 检查日志错误
pnpm provider:fixture 2>&1 | tee fixture.log
```

### Web UI显示白屏

**问题**: http://127.0.0.1:5173 显示空白页

**解决方案**:
```bash
# 1. 检查Vite开发服务器
pnpm --filter @dgos/web dev

# 2. 检查浏览器控制台错误
# 打开 DevTools → Console

# 3. 清除浏览器缓存
# 硬刷新: Ctrl+Shift+R (Windows/Linux) 或 Cmd+Shift+R (macOS)

# 4. 重新构建web资源
pnpm --filter @dgos/web build
```

### 权限被拒绝错误

**问题**: "EACCES"或权限错误

**解决方案**:
```bash
# 修复node_modules权限
sudo chown -R $(whoami) node_modules

# 修复Docker socket（Linux）
sudo usermod -aG docker $USER
# 然后注销并重新登录
```

### 内存不足

**问题**: Node进程因堆错误崩溃

**解决方案**:
```bash
# 增加Node内存限制
export NODE_OPTIONS="--max-old-space-size=4096"

# 或编辑package.json scripts
"dev": "NODE_OPTIONS='--max-old-space-size=4096' node --watch src/server.mjs"
```

### 仍然遇到问题？

1. **检查系统状态**: http://127.0.0.1:5173/system-info
2. **查看日志**: `docker compose logs -f`
3. **搜索Issues**: https://github.com/your-org/DGOS/issues
4. **询问社区**: https://discord.gg/dgos
5. **报告Bug**: https://github.com/your-org/DGOS/issues/new

**在错误报告中包含**:
- DGOS版本（`git rev-parse HEAD`）
- 操作系统
- Node版本（`node --version`）
- Docker版本（`docker --version`）
- 错误消息
- 重现步骤

---

## 下一步

### 探索功能

- **📦 浏览包目录**: 发现扩展和集成
- **🤖 配置Providers**: 为不同任务添加更多AI providers
- **⚙️ 自定义设置**: 设置主题、语言和偏好
- **📊 查看分析**: 监控使用和性能
- **🔐 设置安全**: 配置认证和权限

### 了解更多

- **[用户指南](V1-User-Guide.md)**: 完整功能文档
- **[开发者指南](V1-Developer-Guide.md)**: 构建扩展和集成
- **[API参考](../04-技术架构/当前版本/V1-openapi.yaml)**: 完整API规范
- **[架构](../04-技术架构/README.md)**: 系统设计和模式

### 加入社区

- **GitHub**: https://github.com/your-org/DGOS
- **Discord**: https://discord.gg/dgos
- **Twitter**: https://twitter.com/dgos
- **论坛**: https://community.dgos.dev

### 贡献

DGOS是开源的！我们欢迎贡献：

- **报告Bug**: https://github.com/your-org/DGOS/issues
- **请求功能**: https://github.com/your-org/DGOS/discussions
- **提交PR**: https://github.com/your-org/DGOS/pulls
- **编写文档**: 帮助改进本指南
- **构建扩展**: 为社区创建包

### 生产部署

准备将DGOS部署到生产环境？

- **[生产指南](../05-测试与发布/发布/README.md)**: 部署最佳实践
- **[安全加固](../04-技术架构/当前版本/V1-总体架构.md)**: 安全配置
- **[监控](../04-技术架构/当前版本/V1-总体架构.md)**: 可观测性和告警
- **[备份策略](../05-测试与发布/发布/恢复手册.md)**: 灾难恢复规划

---

## 附录：快速参考

### 基本命令

```bash
# 启动服务
docker compose up -d

# 停止服务
docker compose down

# 查看日志
docker compose logs -f

# 安装依赖
pnpm install

# 运行迁移
pnpm migrate:plan

# 启动开发
pnpm dev

# 运行测试
pnpm test

# 检查健康状态
curl http://127.0.0.1:3000/health
```

### 默认端口

| 服务 | 端口 | URL |
|------|------|-----|
| Web UI (开发) | 5173 | http://127.0.0.1:5173 |
| API服务器 | 3000 | http://127.0.0.1:3000 |
| PostgreSQL | 5432 | postgresql://127.0.0.1:5432 |
| Redis | 6379 | redis://127.0.0.1:6379 |
| MinIO (可选) | 9000/9001 | http://127.0.0.1:9000 |

### 环境变量

| 变量 | 默认值 | 描述 |
|------|--------|------|
| `NODE_ENV` | development | 环境模式 |
| `HOST` | 127.0.0.1 | API绑定地址 |
| `PORT` | 3000 | API端口 |
| `DATABASE_URL` | postgres://... | PostgreSQL连接 |
| `REDIS_URL` | redis://... | Redis连接 |
| `SECRET_BACKEND` | development-memory | 密钥存储 |

### 文件位置

```
DGOS/
├── .env                    # 环境配置
├── docker-compose.yml      # 基础设施定义
├── apps/api/              # API服务器源码
├── apps/web/              # Web UI源码
├── apps/worker/           # 后台worker
├── migrations/            # 数据库迁移
├── docs/                  # 文档
└── data/                  # 本地数据（gitignored）
```

---

**有问题？** 查看[用户指南](V1-User-Guide.md)或在[Discord](https://discord.gg/dgos)中提问

**发现问题？** 请[报告它](https://github.com/your-org/DGOS/issues)

---

*最后更新: 2026-10-02 | DGOS V1.0.0*
