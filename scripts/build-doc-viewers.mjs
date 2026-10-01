#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(root, 'docs');
const outRoot = path.join(root, 'preview');
const templatePath = '/Users/apple/Progame/tuziagent/tuzi-docs/90-参考资料/产品文档浏览器.html';
const esc = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');

async function walk(dir) {
  const result = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) result.push(...await walk(file));
    else if (entry.isFile() && entry.name.endsWith('.md')) result.push(file);
  }
  return result;
}

function titleOf(source, fallback) {
  const match = source.match(/^#\s+(.+)$/m);
  return match ? match[1].trim() : fallback;
}

const colors = {
  V1: ['#2f7d4f', '#e1f0e8'], V2: ['#087d75', '#dcefeb'], V3: ['#4056a1', '#e6e9f6'],
  V4: ['#a96810', '#f6ead6'], V5: ['#aa2d4d', '#f4dde4'], V6: ['#4056a1', '#e6e9f6'],
  '00': ['#087d75', '#dcefeb'], EV: ['#a96810', '#f6ead6'], FT: ['#087d75', '#dcefeb']
};

const catalog = [
  ['roadmap', '00', '治理', '版本路线图', '02-产品与版本/版本路线图.md', '版本顺序、范围边界、门禁和推进建议'],
  ['evolution', 'EV', '演进', '功能演进矩阵', '02-产品与版本/功能演进矩阵.md', '跨版本能力主线、依赖和门禁关系'],
  ['feature-timeline', 'FT', '索引', '具体功能演进时间线', '__synthetic__', '按 9 条稳定功能编号查看 V1–V6 跨版本推进'],
  ['blueprint', '01', '总蓝图', '产品蓝图', '02-产品与版本/产品蓝图.md', 'DGOS 定位、应用生态和完整产品范围'],
  ['constraints', '02', '产品约束', '全版本产品与交互约束', '02-产品与版本/全版本产品与交互约束.md', '跨版本产品、界面和交互约束'],
  ['v1-prd', 'V1', '首发范围', 'V1 产品需求', '02-产品与版本/当前版本/V1-产品需求.md', '平台控制面和 DGOS AI 工作台的首发范围'],
  ['v1-overview', 'V1', '首发范围', 'V1 版本总览', '02-产品与版本/当前版本/V1-版本总览.md', 'V1 交付目标、边界、门禁与工作包'],
  ['v1-status', 'V1', '实现状态', 'V1 实现状态', '02-产品与版本/当前版本/V1-实现状态.md', '实现完成度唯一权威来源'],
  ['v1-ids', 'V1', '需求索引', 'V1 稳定需求编号', '03-功能规格/V1/00-V1需求编号.md', 'FR、NFR 和发布门禁的稳定编号'],
  ['v1-trace', 'V1', '需求索引', 'V1 需求追踪矩阵', '03-功能规格/V1/00-V1需求追踪矩阵.md', '功能、接口、数据和 E2E 的追踪关系'],
  ['lookup', 'V1', '需求索引', 'V1 功能查找表', '03-功能规格/V1/功能查找表.md', '按功能、版本、依赖和主文档查找'],
  ['architecture', 'V1', '技术架构', 'V1 总体架构', '04-技术架构/当前版本/V1-总体架构.md', '桌面/Web 共用前端、服务和宿主边界'],
  ['architecture-global', '00', '技术架构', '总体架构', '04-技术架构/总体架构.md', 'DGOS 平台、应用运行时和可替换能力平面'],
  ['services', 'V1', '技术架构', '服务与领域边界', '04-技术架构/服务与领域边界.md', '服务职责、依赖方向和演进边界'],
  ['stack', 'V1', '技术架构', 'V1 技术栈候选与专项讨论', '04-技术架构/当前版本/V1-技术栈候选与专项讨论.md', 'React、Tauri、Node/Fastify、Worker 与可替换运行时'],
  ['contracts', 'V1', '技术契约', 'V1 接口契约', '04-技术架构/当前版本/V1-接口契约.md', '系统 API、Provider、任务、权限和流式事件契约'],
  ['data-model', 'V1', '技术契约', 'V1 数据模型', '04-技术架构/当前版本/V1-数据模型.md', '主体、应用、Provider、任务和审计数据模型'],
  ['extension', 'V1', '技术契约', 'V1 扩展声明与执行契约', '04-技术架构/当前版本/V1-DGOS扩展声明与执行契约.md', 'APP、Skill、MCP 和协议扩展声明'],
  ['app-runtime', 'V1', '技术契约', 'V1 应用清单与运行时契约', '04-技术架构/当前版本/V1-DGOS应用清单与运行时契约.md', '应用 manifest、生命周期、权限和宿主能力'],
  ['ui', 'V1', '界面规范', 'V1 界面规范', '04-技术架构/当前版本/V1-界面规范.md', '系统壳层、模块、窗口、状态和跨端界面规则'],
  ['error', 'V1', '技术契约', '统一错误码', '04-技术架构/统一错误码.md', '平台错误、Provider 错误和可观测性映射'],
  ['desktop', 'V1', '功能规格', '桌面与应用工作区', '03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md', '桌面、窗口、Dock、设置和 APP 权限'],
  ['developer', 'V1', '功能规格', '开发者中心与 APP 生命周期', '03-功能规格/V1/02-开发者体验/01-开发者中心与APP生命周期.md', 'manifest、测试安装、更新、回滚和卸载'],
  ['agent', 'V1', '功能规格', 'Skill MCP 与 Agent 接入', '03-功能规格/V1/03-Agent与协议/01-SkillMCP与Agent接入.md', 'Skill、MCP、Agent、授权、超时和审计'],
  ['ai-workflow', 'V1', '功能规格', '多模态 AI 任务工作流', '03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md', 'V1 文本任务和后续多模态任务的分层契约'],
  ['provider', 'V1', '功能规格', '模型平台与工作流配置', '03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md', 'Provider、Adapter、模型目录和能力分类'],
  ['assistant', 'V1', '功能规格', '系统智能助手与快捷指令', '03-功能规格/V1/09-系统助手/01-系统智能助手与快捷指令.md', 'Action Registry、自然语言入口、确认和审计'],
  ['project', 'V2', '后续版本', '无限画布与项目', '03-功能规格/V2/04-无限画布/01-无限画布与项目.md', '项目、视口、节点、端口、连线和保存恢复'],
  ['v2-plan', 'V2', '后续版本', 'V2 项目与画布基础规划', '02-产品与版本/后续版本/V2-规划.md', 'V2 独立版本范围、正式账号和基础图编辑门禁'],
  ['v3-plan', 'V3', '后续版本', 'V3 画布工作流规划', '02-产品与版本/后续版本/V3-规划.md', '画布执行、运行快照和结果回写的版本规划'],
  ['asset', 'V4', '后续版本', '项目资产与生成历史', '03-功能规格/V4/08-资产与历史/01-项目资产与生成历史.md', '资产、历史、分享、授权和跨项目引用'],
  ['v4-plan', 'V4', '后续版本', 'V4 结构化创作与资产服务规划', '02-产品与版本/后续版本/V4-规划.md', 'V4 独立版本范围、表格、资产授权和供应商节点门禁'],
  ['plugin', 'V5', '后续版本', 'Canvas 插件与模板扩展', '03-功能规格/V5/06-插件扩展/01-Canvas插件与模板扩展.md', '插件隔离、节点注册、模板和回滚'],
  ['v5-plan', 'V5', '后续版本', 'V5 3D 与扩展生态规划', '02-产品与版本/后续版本/V5-规划.md', 'V5 独立版本范围、导演台、插件和模板门禁'],
  ['v6-plan', 'V6', '后续版本', 'V6 协作与生态规模化规划', '02-产品与版本/后续版本/V6-规划.md', '组织协作、生态分发、批量运行和跨端入口的版本规划'],
  ['e2e', 'V1', '测试发布', 'V1 端到端验收规范', '05-测试与发布/端到端验收/V1-端到端验收规范.md', '版本门禁、跨功能闭环和验收证据'],
  ['test', 'V1', '测试发布', '测试策略', '05-测试与发布/测试策略.md', '契约、集成、E2E、性能和安全测试策略'],
  ['security', 'V1', '测试发布', '安全基线', '05-测试与发布/安全基线.md', '秘密、权限、应用隔离和审计基线'],
  ['freeze', 'V1', '决策记录', 'V1 冻结决策', '06-决策记录/V1-冻结决策.md', 'V1 范围、技术路线和跨版本取舍'],
  ['adr', '00', '决策记录', 'ADR 索引', '06-决策记录/ADR/README.md', '架构决策、理由和后续影响']
];

const featureSpecs = [
  ['V1-FR-001', '桌面与应用工作区', '桌面与系统', 'platform', '平台与应用运行时', '建立 DGOS Shell、窗口、Dock、系统设置和 APP 权限上下文。', '03-功能规格/V1/01-桌面与系统/01-桌面与应用工作区.md', '安装包、应用运行时、系统设置和权限服务', ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']],
  ['V1-FR-002', '开发者中心与 APP 生命周期', '开发者体验', 'platform', '平台与应用运行时', '以 manifest、校验和最小审核准入建立受信目录；普通用户可管理官方/管理员批准包，开发者可测试安装未审核包，预装应用按策略卸载。', '03-功能规格/V1/02-开发者体验/01-开发者中心与APP生命周期.md', 'Manifest、审核目录、安装器和发布回滚', ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']],
  ['V1-FR-003', 'Skill MCP 与 Agent 接入', 'Agent 与协议', 'agent', 'Agent、Skill 与 MCP', '将 Skill、MCP 和 Agent 作为可授权、可审计的官方扩展能力接入系统。', '03-功能规格/V1/03-Agent与协议/01-SkillMCP与Agent接入.md', '扩展声明、秘密服务、权限和审计', ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']],
  ['V1-FR-004', '无限画布与项目', '无限画布', 'canvas', '项目、画布与工作流', '分阶段交付项目容器、基础图编辑、工作流节点、资产引用和 3D 导演台。', '03-功能规格/V2/04-无限画布/01-无限画布与项目.md', 'V1 平台、项目 API、任务 API、Artifact 和渲染服务', ['V2', 'V3', 'V4', 'V5', 'V6']],
  ['V1-FR-005', '多模态 AI 任务工作流', 'AI 工作流', 'ai', 'AI 任务与 Provider', 'V1 先完成真实文本任务、模型选择、SSE 增量和结果读取，媒体与画布按后续版本接入。', '03-功能规格/V1/05-AI工作流/01-多模态AI任务工作流.md', 'Provider Adapter、模型能力、任务状态和 Artifact', ['V1', 'V3', 'V4', 'V5', 'V6']],
  ['V1-FR-006', 'Canvas 插件与模板扩展', '插件扩展', 'canvas', '项目、画布与工作流', '在节点注册和隔离运行时稳定后，引入插件、模板、升级和回滚。', '03-功能规格/V5/06-插件扩展/01-Canvas插件与模板扩展.md', 'V2/V3 画布协议、隔离运行时和模板数据清理', ['V5', 'V6']],
  ['V1-FR-007', '模型平台与工作流配置', '模型与配置', 'ai', 'AI 任务与 Provider', '配置 Provider、验证连接、拉取并分类模型，启用模型并让工作台按能力选择。', '03-功能规格/V1/07-模型与配置/01-模型平台与工作流配置.md', 'Provider Registry、Adapter、Model Catalog 和秘密服务', ['V1', 'V3', 'V4', 'V5', 'V6']],
  ['V1-FR-008', '项目资产与生成历史', '资产与历史', 'canvas', '项目、画布与工作流', '在结果 Artifact 和项目权限稳定后，提供资产库、历史、分享和跨项目引用。', '03-功能规格/V4/08-资产与历史/01-项目资产与生成历史.md', 'V3 Artifact、项目权限、授权和对象存储', ['V4', 'V5', 'V6']],
  ['V1-FR-009', '系统智能助手与快捷指令', '系统智能助手', 'agent', 'Agent、Skill 与 MCP', '让内置助手通过动作目录操作大部分有公开契约的系统设置和应用配置；写入、删除、权限/隐私、秘密、网络出口及外部副作用按风险确认并审计。', '03-功能规格/V1/09-系统助手/01-系统智能助手与快捷指令.md', 'Action Registry、Capability Broker、公开写 API、任务和权限服务', ['V1', 'V2', 'V3', 'V4', 'V5', 'V6']]
];

const decisions = [
  ['#2f7d4f', 'V1 交付 DGOS 平台控制面、最小受信应用目录生命周期和唯一业务示范 APP：DGOS AI 工作台；项目/画布及高级创作按 V2–V5 分离。'],
  ['#087d75', 'D029：V1 本地部署使用单一受控主体；UserProfile、Session 和所有权接口为未来正式登录与组织模型留出边界。'],
  ['#4056a1', 'D030：普通用户可安装、更新和卸载官方或管理员批准目录中的包；开发者应用审核通过后上架；预装应用逐项标记可卸载或不可卸载。'],
  ['#a96810', 'D031：助手可操作大部分有公开契约的 DGOS 设置和应用配置；写入、删除、权限/隐私、秘密、网络出口、不可逆及外部副作用动作必须确认。'],
  ['#aa2d4d', 'D032：Provider 验证或更新失败后立即停用并阻止新任务；既有任务按 taskId 收敛，失败原因可见。'],
  ['#69707a', 'D033：Task/已提交 Artifact 由用户显式删除；缓存、失败安装记录和撤销会话保留 30 天，审计保留 180 天。'],
  ['#087d75', '首批 Provider 使用可扩展注册表中的 openai-compatible；模型目录、能力分类和启用状态由平台统一管理。'],
  ['#4056a1', '桌面端与 Web 共用 React 前端和公共契约，差异收敛在 Tauri 与 Web 宿主适配层；V1 首发 macOS，Web 支持 Docker Compose。'],
  ['#a96810', 'V1 文本任务支持 SSE 增量、取消、恢复和终态查询；图片、视频、音频与画布工作流按 V3/V4 后置。'],
  ['#aa2d4d', 'API Key、应用权限、Skill/MCP 授权和系统助手动作确认由 DGOS 控制面统一处理，应用不能绕过。'],
  ['#4056a1', 'Markdown 是唯一事实源；实现完成度只认 V1-实现状态和可复核运行证据，浏览器是生成的阅读产物。']
].map(([accent, text]) => ({ accent, text }));

const tracks = {
  platform: { title: '平台与应用运行时', overview: '平台与应用运行时', accent: '#087d75' },
  agent: { title: 'Agent、Skill 与 MCP', overview: 'Agent、Skill 与 MCP', accent: '#4056a1' },
  canvas: { title: '项目、画布与工作流', overview: '项目、画布与工作流', accent: '#a96810' },
  ai: { title: 'AI 任务与 Provider', overview: 'AI 任务与 Provider', accent: '#2f7d4f' }
};
const timelineVersions = [
  { id: 'v1', label: 'V1', kind: 'current' }, { id: 'gate', label: 'V1 门禁', kind: 'gate' },
  { id: 'v2', label: 'V2', kind: 'planned' }, { id: 'v3', label: 'V3', kind: 'planned' },
  { id: 'v4', label: 'V4', kind: 'planned' }, { id: 'v5', label: 'V5', kind: 'planned' },
  { id: 'v6', label: 'V6', kind: 'planned' }, { id: 'future', label: '后续', kind: 'planned' }
];
const versions = [
  ['V1', '平台基础、应用目录与参考 APP', '系统壳层、应用运行时、受信目录与生命周期、Provider、Skill/MCP、权限、任务和 DGOS AI 工作台', '门禁评审中'],
  ['V2', '项目与画布基础', '项目读写、画布导航、内容节点、端口/连线/分组和保存恢复', '规划骨架'],
  ['V3', '画布工作流', '生成卡片、LLM、结果节点、运行快照、取消/重试和结果回写', '规划骨架'],
  ['V4', '结构化创作与资产服务', '多维表格、资产库、历史、分享、跨项目引用和画布 Agent', '规划骨架'],
  ['V5', '3D 与扩展生态', '3D 导演台、Canvas 插件、模板、协议扩展和导出', '规划骨架'],
  ['V6', '协作与生态规模化', '多人协作、组织/团队、规模化投稿审核与分发、批量队列、移动端和生产级观测；评分、收费和商业分发仍待单独决策', '规划骨架']
].map(([id, title, goal, status]) => ({ id, title, goal, status }));

// 版本卡片保持稳定入口；未来版本的规划文件仍不代表可编码规格。
const versionRoutes = {
  V1: { accent: '#2f7d4f', primaryDoc: 'v1-prd', source: 'V1 产品需求' },
  V2: { accent: '#087d75', primaryDoc: 'v2-plan', source: 'V2 独立规划' },
  V3: { accent: '#4056a1', primaryDoc: 'v3-plan', source: 'V3 独立规划' },
  V4: { accent: '#a96810', primaryDoc: 'v4-plan', source: 'V4 独立规划' },
  V5: { accent: '#aa2d4d', primaryDoc: 'v5-plan', source: 'V5 独立规划' },
  V6: { accent: '#4056a1', primaryDoc: 'v6-plan', source: 'V6 独立规划' }
};

function makeFeature(item) {
  const [id, title, domain, track, trackName, goal, file, dependencies, featureVersions] = item;
  const stages = [];
  if (featureVersions.includes('V1')) {
    stages.push({ version: 'V1', stage: 'V1 首发能力', change: goal, dependencies, completion: '功能规格 Ready；对应 V1 E2E、接口契约和安全测试有映射。', source: `[${title}](../docs/${file})`, sourceFile: '' });
    stages.push({ version: 'gate', stage: 'V1 发布门禁', change: '进入 V1 平台控制面或 DGOS AI 工作台的首发门禁。', dependencies: 'V1 公共权限、秘密、Provider、任务和审计服务', completion: '实现状态仍为规划中；必须补充构建、运行和验收证据。', source: '[V1 实现状态](../docs/02-产品与版本/当前版本/V1-实现状态.md)', sourceFile: '' });
  }
  for (const version of featureVersions.filter((entry) => entry !== 'V1')) {
    const v = versions.find((entry) => entry.id === version);
    stages.push({ version, stage: `${version} ${v?.title || '能力演进'}`, change: `${goal} 在 ${version} 中接入更高层应用和系统能力。`, dependencies: `${dependencies}；${version} 进入门禁后冻结扩展契约。`, completion: `${version} 对应 E2E 和功能规格通过，失败、回滚和权限边界可验证。`, source: '[功能演进矩阵](../docs/02-产品与版本/功能演进矩阵.md)', sourceFile: '' });
  }
  if (!featureVersions.includes('V6')) stages.push({ version: 'future', stage: '后续独立增强', change: '当前路线未把更高阶扩展继续前置，后续按门禁重新规划。', dependencies: '依赖上游版本稳定和新的决策记录。', completion: '补充正式功能编号、接口、验收和实现证据后进入版本路线。', source: '[版本路线图](../docs/02-产品与版本/版本路线图.md)', sourceFile: '' });
  return { id, number: id.slice(-3), title, domain, track, trackName, goal, file: `../docs/${file}`, dependencies, implementation: { key: 'foundation', label: '规划中', backend: '尚未创建 DGOS 产品源码', frontend: '尚未创建 DGOS 产品源码', verification: '暂无运行时证据', gap: '当前仓库只有规格文档和参考材料，未进入产品实现。', updatedAt: '2026-09-28' }, stages };
}

function replaceFunction(source, name, replacement) {
  const start = source.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`template function not found: ${name}`);
  const brace = source.indexOf('{', start);
  let depth = 0; let quote = ''; let lineComment = false; let blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const c = source[i]; const n = source[i + 1];
    if (lineComment) { if (c === '\n') lineComment = false; continue; }
    if (blockComment) { if (c === '*' && n === '/') { blockComment = false; i += 1; } continue; }
    if (quote) { if (c === '\\') { i += 1; continue; } if (c === quote) quote = ''; continue; }
    if (c === '/' && n === '/') { lineComment = true; i += 1; continue; }
    if (c === '/' && n === '*') { blockComment = true; i += 1; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth += 1;
    if (c === '}') { depth -= 1; if (depth === 0) return `${source.slice(0, start)}${replacement}${source.slice(i + 1)}`; }
  }
  throw new Error(`unbalanced template function: ${name}`);
}

function renderOverview() {
  const totalLines = state.docs.reduce((sum, doc) => sum + doc.lines, 0);
  const totalHeadings = state.docs.reduce((sum, doc) => sum + doc.headings.length, 0);
  const active = getActiveDoc(); els.outline.innerHTML = ''; els.outlineCount.textContent = '0';
  els.content.innerHTML = `<section class="stats">${statBlock('文档', state.docs.length, '核心 Markdown')}${statBlock('总行数', formatNumber(totalLines), '事实源内容')}${statBlock('章节', formatNumber(totalHeadings), 'H1-H4')}${statBlock('交付版本', 'V1–V6', '平台到生态')}</section><section class="visual-grid">${diagramPanel('DGOS 产品全景图', '总览只展示系统定位和层次关系；完整 SVG 图谱请切换到“图谱”。', renderProductArchitectureSvg(), 'System Architecture')}${diagramPanel('V1 核心调用闭环', '总览只展示首发主链路；数据域、风险和版本依赖请切换到“图谱”。', renderCoreFlowSvg(), 'V1 Runtime Loop')}</section><section class="panel"><div class="panel-head"><h2>版本推进</h2><span class="tag">V1–V6 · 逐版开放</span></div><div class="panel-body"><p class="muted">V2–V6 均可直接阅读独立版本规划。后续版本仍需通过开发门禁，规划文件不作为直接编码输入。</p><div class="timeline">${DGOS_VERSIONS.map((v) => { const route = DGOS_VERSION_ROUTES[v.id] || {}; return `<button class="version-node" data-version="${escapeHtml(v.id)}" style="--accent:${escapeHtml(route.accent || '#4056a1')}" aria-label="查看 ${escapeHtml(v.id)} 版本详情"><strong>${v.id} · ${escapeHtml(v.title)}</strong><span>${escapeHtml(v.goal)}<br><em>${escapeHtml(v.status)} · 查看版本详情</em></span></button>`; }).join('')}</div></div></section><section class="panel"><div class="panel-head"><h2>关键决策</h2><span class="tag">新版 docs 已收敛</span></div><div class="panel-body"><ul class="decision-list">${DECISIONS.map((item) => `<li style="--accent:${item.accent}">${escapeHtml(item.text)}</li>`).join('')}</ul></div></section><section class="panel"><div class="panel-head"><h2>当前入口</h2><span class="tag">${escapeHtml(active.version)}</span></div><div class="panel-body"><table class="matrix"><tbody><tr><th>文件</th><td><code>${escapeHtml(active.file)}</code></td></tr><tr><th>定位</th><td>${escapeHtml(active.goal)}</td></tr><tr><th>规模</th><td>${active.lines} 行，${active.headings.length} 个章节</td></tr></tbody></table></div></section>`;
  els.content.querySelectorAll('[data-version]').forEach((button) => button.addEventListener('click', () => openVersion(button.dataset.version)));
}

function setView(view) {
  if (view === 'matrix') view = 'evolution';
  const views = ['overview', 'reader', 'map', 'evolution', 'feature-timeline', 'version-detail'];
  if (!views.includes(view)) view = 'overview';
  state.view = view;
  localStorage.setItem('dgos.view', view);
  els.tabs.forEach((tab) => {
    const active = tab.dataset.view === view;
    tab.classList.toggle('active', active);
    tab.setAttribute('aria-pressed', String(active));
  });

  if (view === 'overview') renderOverview();
  if (view === 'map') renderMap();
  if (view === 'version-detail') renderVersionDetail(state.activeVersionId || 'V1');
  if (view === 'reader') {
    const readerDoc = state.docs.some((doc) => doc.id === state.readerDocId) ? state.readerDocId : state.activeDocId;
    state.activeDocId = state.docs.some((doc) => doc.id === readerDoc) ? readerDoc : 'roadmap';
    renderDocList();
    renderReader();
  }
  if (view === 'evolution') {
    state.activeDocId = 'evolution';
    localStorage.setItem('dgos.activeDoc', state.activeDocId);
    renderDocList();
    renderEvolution();
  }
  if (view === 'feature-timeline') {
    state.activeDocId = 'feature-timeline';
    localStorage.setItem('dgos.activeDoc', state.activeDocId);
    renderDocList();
    renderFeatureTimeline();
  }
  els.mainScroll.scrollTop = 0;
  updateProgress();
}

function openDoc(docId) {
  if (docId === 'evolution') {
    setView('evolution');
  } else if (docId === 'feature-timeline') {
    setView('feature-timeline');
  } else if (state.docs.some((doc) => doc.id === docId)) {
    state.activeDocId = docId;
    state.readerDocId = docId;
    localStorage.setItem('dgos.activeDoc', docId);
    localStorage.setItem('dgos.readerDoc', docId);
    renderDocList();
    setView('reader');
  }
  els.searchResults.classList.remove('open');
}

function renderMap() {
  els.outline.innerHTML = ''; els.outlineCount.textContent = '5';
  els.content.innerHTML = `<section class="doc-header"><div class="doc-kicker"><span class="tag">Visual</span><span>DGOS 结构图谱</span></div><h2>系统能力图谱</h2><div class="doc-meta"><span class="tag">产品全景</span><span class="tag">调用闭环</span><span class="tag">版本路线</span><span class="tag">数据域</span><span class="tag">风险热区</span></div></section><section class="map-stack">${diagramPanel('DGOS 产品全景图', '平台底座和应用生态的分层结构。', renderProductArchitectureSvg(), 'Architecture')}${diagramPanel('V1 核心调用闭环', '真实 Provider、流式任务、结果和审计。', renderCoreFlowSvg(), 'Runtime')}${diagramPanel('版本路线图', 'V1–V6 的依赖顺序和门禁关系。', renderVersionRoadmapSvg(), 'V1–V6')}${diagramPanel('数据域关系图', '主体、应用、Provider、任务、Artifact 和审计的关系。', renderDataDomainSvg(), 'Data Model')}${diagramPanel('风险热区图', '权限、秘密、协议、范围和扩展是最早需要收敛的区域。', renderRiskHeatmapSvg(), 'Risk')}</section>`;
}

function renderEvolution() {
  const doc = state.docs.find((item) => item.id === 'evolution'); if (!doc) return;
  const rendered = renderMarkdown(doc.content, doc.file);
  els.content.innerHTML = `<section class="doc-header"><div class="doc-kicker"><span class="tag">EV</span><span>版本演进</span><span>V1 当前 · V2–V6 规划</span></div><h2>${escapeHtml(doc.title)}</h2><div class="doc-meta"><span class="tag">能力主线</span><span class="tag">版本里程碑</span><span class="tag">依赖与门禁</span><span class="tag">状态与来源</span></div></section><article class="article" id="article">${rendered.html}</article>`;
  renderOutline(rendered.outline); updateProgress();
}

function extractEvolutionStages(feature) { return feature?.stages || []; }

function renderFeatureTimeline(filterQuery = '') {
  const feature = state.features.find((item) => item.id === state.activeFeatureId) || state.features[0]; if (!feature) return;
  state.activeFeatureId = feature.id; localStorage.setItem('dgos.activeFeature', feature.id);
  const track = FEATURE_TRACKS[feature.track] || { accent: '#087d75' }; const stages = extractEvolutionStages(feature); const matches = filterFeatures(filterQuery); const list = matches.length ? matches : state.features;
  const options = list.map((item) => `<option value="${escapeHtml(item.id)}" ${item.id === feature.id ? 'selected' : ''}>${escapeHtml(item.id)} · ${escapeHtml(item.title)}</option>`).join(''); const implementation = feature.implementation || {};
  els.content.innerHTML = `<section class="feature-query" id="feature-picker"><h2>查询具体功能</h2><p>按编号、名称、领域或目标筛选，查看当前状态、版本归属、依赖、完成判定和来源文档。当前索引包含 9 条稳定功能，时间线覆盖 V1–V6 与后续规划。</p><div class="feature-controls"><div class="feature-field"><label for="featureFilter">关键词筛选</label><input id="featureFilter" value="${escapeHtml(filterQuery)}" placeholder="例如 V1-FR-007、Provider、权限"></div><div class="feature-field"><label for="featureSelect">具体功能（${matches.length || state.features.length} 个结果）</label><select id="featureSelect">${options}</select></div></div></section><section class="feature-summary" id="feature-summary" style="border-left-color:${track.accent}"><div><div class="feature-summary-meta"><span class="tag">${escapeHtml(feature.id)}</span><span class="tag">${escapeHtml(feature.domain)}</span><span class="tag">主责：${escapeHtml(feature.trackName)}</span><span class="feature-status ${escapeHtml(implementation.key || 'foundation')}">工程：${escapeHtml(implementation.label || '规划中')}</span></div><h2>${escapeHtml(feature.title)}</h2><p>${escapeHtml(feature.goal)}</p></div><div class="feature-summary-links"><a href="${escapeHtml(resolveDocHref(feature.file, ''))}" target="_blank" rel="noopener">打开功能主文档</a><a href="${escapeHtml(resolveDocHref('02-产品与版本/当前版本/V1-实现状态.md', ''))}" target="_blank" rel="noopener">查看实现状态</a></div></section><section class="feature-timeline-panel" id="feature-timeline"><div class="feature-timeline-head"><div class="feature-timeline-title"><h3>${escapeHtml(feature.id)} · 完整版本时间线</h3><p>版本归属和工程完成度分开显示；当前规划不能替代运行证据。</p></div><div class="timeline-legend"><span class="current"><i></i>当前版本</span><span class="gate"><i></i>当前门禁</span><span><i></i>未来规划</span><span class="history"><i></i>历史或未规划</span></div></div><div class="feature-timeline-scroll"><div class="feature-version-timeline">${FEATURE_TIMELINE_VERSIONS.map((version) => renderFeatureMilestone(feature, version, stages)).join('')}</div></div></section>`;
  const input = document.getElementById('featureFilter'); const select = document.getElementById('featureSelect'); input.addEventListener('input', () => updateFeatureOptions(select, input.value, feature.id)); input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { const hit = filterFeatures(input.value)[0]; if (hit) selectFeature(hit.id, input.value); } }); select.addEventListener('change', () => selectFeature(select.value, input.value));
  renderOutline([{ id: 'feature-picker', text: '选择具体功能', level: 2 }, { id: 'feature-summary', text: `${feature.id} ${feature.title}`, level: 2 }, { id: 'feature-timeline', text: '完整版本时间线', level: 2 }]); updateProgress();
}

function renderFeatureMilestone(feature, version, stages) {
  const matches = stages.filter((stage) => stage.version === version.label || (version.id === 'gate' && stage.version === 'gate') || (version.id === 'future' && stage.version === 'future'));
  if (version.id === 'v1' && matches.length) { const implementation = feature.implementation || {}; return `<article class="feature-milestone current"><div class="milestone-axis"><span class="milestone-dot"></span><strong>V1</strong><small>精确功能</small></div><div class="milestone-card"><div class="milestone-state-line"><div class="milestone-mobile-meta"><strong>V1</strong><span>精确功能</span></div><span class="milestone-state current">当前版本</span><span class="implementation-state foundation">工程状态 · ${escapeHtml(implementation.label || '规划中')}</span><span class="completion-state">未标记为已完成</span></div><h4>${escapeHtml(feature.title)}</h4><p>${escapeHtml(feature.goal)}</p><div class="milestone-facts"><div class="milestone-fact"><span>后端</span><strong>${escapeHtml(implementation.backend || '尚未创建')}</strong></div><div class="milestone-fact"><span>前端</span><strong>${escapeHtml(implementation.frontend || '尚未创建')}</strong></div><div class="milestone-fact"><span>自动化验证</span><strong>${escapeHtml(implementation.verification || '暂无证据')}</strong></div></div><div class="milestone-detail"><strong>当前主要差距</strong><span>${escapeHtml(implementation.gap || '尚未进入实现')}</span></div><div class="milestone-detail"><strong>上游依赖</strong><span>${escapeHtml(feature.dependencies)}</span></div><div class="milestone-source"><a href="${escapeHtml(resolveDocHref(feature.file, ''))}" target="_blank" rel="noopener">${escapeHtml(feature.id)} 功能主文档</a></div></div></article>`; }
  if (version.id === 'v1' && !matches.length) return `<article class="feature-milestone empty"><div class="milestone-axis"><span class="milestone-dot"></span><strong>V1</strong><small>不在首发范围</small></div><div class="milestone-card"><div class="milestone-state-line"><div class="milestone-mobile-meta"><strong>V1</strong><span>不在首发范围</span></div><span class="milestone-state empty">后续版本</span></div><h4>本功能不在 V1 交付</h4><p>该能力先保留稳定编号和依赖说明，待上游契约满足后进入对应版本。</p><div class="milestone-detail"><strong>当前归属</strong><span>${escapeHtml(feature.stages[0]?.version || '后续规划')}</span></div><div class="milestone-detail"><strong>上游依赖</strong><span>${escapeHtml(feature.dependencies)}</span></div></div></article>`;
  if (!matches.length) return `<article class="feature-milestone empty"><div class="milestone-axis"><span class="milestone-dot"></span><strong>${escapeHtml(version.label)}</strong><small>无单独规划</small></div><div class="milestone-card"><div class="milestone-state-line"><div class="milestone-mobile-meta"><strong>${escapeHtml(version.label)}</strong><span>无单独规划</span></div><span class="milestone-state empty">当前未分配</span></div><h4>当前未分配阶段</h4><p>该功能在此版本没有明确的阶段变化；空白不代表取消。</p><div class="milestone-detail"><strong>说明</strong><span>后续调整应先更新版本路线图、功能演进矩阵和决策记录。</span></div></div></article>`;
  const match = matches[0]; const gate = version.id === 'gate'; const kind = gate ? 'gate' : 'planned'; const status = gate ? '当前门禁' : '未来规划';
  return `<article class="feature-milestone ${kind}"><div class="milestone-axis"><span class="milestone-dot"></span><strong>${escapeHtml(version.label)}</strong><small>${status}</small></div><div class="milestone-card"><div class="milestone-state-line"><div class="milestone-mobile-meta"><strong>${escapeHtml(version.label)}</strong><span>${status}</span></div><span class="milestone-state ${kind}">${status}</span><span>关联能力规划</span></div><h4>${escapeHtml(match.stage)}</h4><p>${inline(match.change, match.sourceFile)}</p><div class="milestone-detail"><strong>依赖与边界</strong><span>${inline(match.dependencies, match.sourceFile)}</span></div><div class="milestone-detail"><strong>完成判定</strong><span>${inline(match.completion, match.sourceFile)}</span></div><div class="milestone-source">${inline(match.source, match.sourceFile)}</div></div></article>`;
}

function svgFrame(title, subtitle, body, height = 420) { const n = (svgFrame.sequence = (svgFrame.sequence || 0) + 1); const ids = { main: `arrow-main-${n}`, soft: `arrow-soft-${n}`, shadow: `card-shadow-${n}` }; const scopedBody = body.replaceAll('arrow-main', ids.main).replaceAll('arrow-soft', ids.soft).replaceAll('card-shadow', ids.shadow).replace(/(<rect[^>]*>)<text([^>]*)>([^<]*)<\/text><\/rect>/g, '$1</rect><text$2>$3</text>'); return `<svg viewBox="0 0 960 ${height}" role="img" aria-label="${title}" focusable="false"><defs><marker id="${ids.main}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L9,3 L0,6 Z" fill="#69707a"></path></marker><marker id="${ids.soft}" markerWidth="10" markerHeight="10" refX="8" refY="3" orient="auto"><path d="M0,0 L9,3 L0,6 Z" fill="#8b929a"></path></marker><filter id="${ids.shadow}" x="-10%" y="-10%" width="120%" height="120%"><feDropShadow dx="0" dy="4" stdDeviation="5" flood-color="#1d1f22" flood-opacity="0.08"></feDropShadow></filter></defs><rect width="960" height="${height}" rx="8" fill="#fbfaf7"></rect><text x="36" y="38" font-size="18" font-weight="760" fill="#1d1f22">${title}</text><text x="36" y="62" font-size="12" fill="#69707a">${subtitle}</text>${scopedBody}</svg>`; }
function renderMermaidSvg(source) { const raw = String(source || '').replace(/\r\n/g, '\n').trim(); const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean); const escText = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;'); const wrap = (value, limit = 20) => { const text = String(value ?? '').trim(); if (!text) return ['']; const chunks = []; let current = ''; for (const token of text.split(/\s+/)) { const next = current ? `${current} ${token}` : token; if (next.length > limit && current) { chunks.push(current); current = token; } else current = next; } if (current) chunks.push(current); return chunks.length ? chunks : [text]; }; const marker = `mermaid-arrow-${Math.random().toString(36).slice(2, 9)}`; const base = (title, width, height, body) => `<figure class="doc-mermaid"><div class="doc-mermaid-label"><span>SVG 图表</span><span>${escText(title)}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escText(title)}" focusable="false"><defs><marker id="${marker}" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L9,3 L0,6 Z" fill="#69707a"></path></marker></defs><rect width="${width}" height="${height}" rx="8" fill="#fbfaf7"></rect>${body}</svg></figure>`; if (!lines.length) return ''; if (/^(flowchart|graph)\s+LR/i.test(lines[0])) { const nodes = new Map(); const edges = []; const nodeRe = /\b([A-Za-z][\w-]*)\s*\[([^\]]+)\]/g; for (const line of lines.slice(1)) { let match; while ((match = nodeRe.exec(line))) nodes.set(match[1], match[2]); const edge = /^([A-Za-z][\w-]*)\s+((?:-+>|-\.+>|-+\.?>))\s*([A-Za-z][\w-]*)(?:\s*\|([^|]+)\|)?/.exec(line); if (edge) { if (!nodes.has(edge[1])) nodes.set(edge[1], edge[1]); if (!nodes.has(edge[3])) nodes.set(edge[3], edge[3]); edges.push({ from: edge[1], to: edge[3], dashed: edge[2].includes('.') }); } } if (!nodes.size) return `<pre><code data-lang="mermaid">${escText(raw)}</code></pre>`; const rank = new Map([...nodes.keys()].map((id) => [id, 0])); for (let pass = 0; pass < nodes.size; pass += 1) { let changed = false; for (const edge of edges) { const next = (rank.get(edge.from) || 0) + 1; if (next > (rank.get(edge.to) || 0)) { rank.set(edge.to, next); changed = true; } } if (!changed) break; } const groups = new Map(); for (const id of nodes.keys()) { const value = rank.get(id) || 0; if (!groups.has(value)) groups.set(value, []); groups.get(value).push(id); } const maxRank = Math.max(...groups.keys()); const colWidth = 190; const nodeWidth = 164; const xPad = 32; const rowHeight = 92; const maxRows = Math.max(...[...groups.values()].map((group) => group.length)); const width = Math.max(960, xPad * 2 + (maxRank + 1) * colWidth); const height = Math.max(190, 100 + maxRows * rowHeight); const positions = new Map(); for (const [col, group] of groups) group.forEach((id, row) => positions.set(id, { x: xPad + col * colWidth, y: 76 + row * rowHeight })); const edgeSvg = edges.map((edge) => { const a = positions.get(edge.from); const b = positions.get(edge.to); if (!a || !b) return ''; const x1 = a.x + nodeWidth; const y1 = a.y + 32; const x2 = b.x; const y2 = b.y + 32; const bend = x1 + Math.max(18, (x2 - x1) / 2); return `<path d="M${x1} ${y1} C${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}" fill="none" stroke="#69707a" stroke-width="1.5" ${edge.dashed ? 'stroke-dasharray="5 5"' : ''} marker-end="url(#${marker})"></path>`; }).join(''); const nodeSvg = [...nodes.entries()].map(([id, label]) => { const p = positions.get(id); const lines = wrap(label, 22); const text = lines.map((line, i) => `<tspan x="${p.x + nodeWidth / 2}" dy="${i ? 16 : 0}">${escText(line)}</tspan>`).join(''); return `<g><rect x="${p.x}" y="${p.y}" width="${nodeWidth}" height="64" rx="8" fill="#ffffff" stroke="#087d75"></rect><text x="${p.x + nodeWidth / 2}" y="${p.y + 29 - (lines.length - 1) * 8}" text-anchor="middle" font-size="12" font-weight="650" fill="#1d1f22">${text}</text></g>`; }).join(''); return base('Mermaid 流程图', width, height, `<g>${edgeSvg}</g><g>${nodeSvg}</g>`); } if (/^sequenceDiagram/i.test(lines[0])) { const participants = []; const seen = new Set(); const messages = []; for (const line of lines.slice(1)) { const participant = /^participant\s+([A-Za-z][\w-]*)\s+as\s+(.+)$/.exec(line); if (participant && !seen.has(participant[1])) { seen.add(participant[1]); participants.push({ id: participant[1], label: participant[2] }); continue; } const message = /^([A-Za-z][\w-]*)\s+(--?>|--?>>|-.+?>|--.+?\.)\s*([A-Za-z][\w-]*):\s*(.+)$/.exec(line); if (message) { for (const id of [message[1], message[3]]) if (!seen.has(id)) { seen.add(id); participants.push({ id, label: id }); } messages.push({ from: message[1], to: message[3], label: message[4], dashed: message[2].includes('.') }); } } if (!participants.length || !messages.length) return `<pre><code data-lang="mermaid">${escText(raw)}</code></pre>`; const colWidth = Math.max(150, Math.floor(900 / Math.max(1, participants.length))); const width = Math.max(960, 48 + participants.length * colWidth); const top = 86; const height = Math.max(250, top + 56 + messages.length * 44); const pos = new Map(participants.map((item, index) => [item.id, 48 + index * colWidth + colWidth / 2])); const participantSvg = participants.map((item) => { const x = pos.get(item.id); const lines = wrap(item.label, 17); const text = lines.map((line, i) => `<tspan x="${x}" dy="${i ? 14 : 0}">${escText(line)}</tspan>`).join(''); return `<g><rect x="${x - 56}" y="22" width="112" height="38" rx="8" fill="#dcefeb" stroke="#087d75"></rect><text x="${x}" y="${42 - (lines.length - 1) * 7}" text-anchor="middle" font-size="11" font-weight="650" fill="#1d1f22">${text}</text><line x1="${x}" y1="60" x2="${x}" y2="${height - 18}" stroke="#b6bbb8" stroke-dasharray="4 5"></line></g>`; }).join(''); const messageSvg = messages.map((item, index) => { const x1 = pos.get(item.from); const x2 = pos.get(item.to); const y = top + index * 44; const direction = x1 < x2 ? 1 : -1; const start = x1 + direction * 8; const end = x2 - direction * 8; const labelX = (x1 + x2) / 2; return `<g><path d="M${start} ${y} H${end}" fill="none" stroke="#69707a" stroke-width="1.5" ${item.dashed ? 'stroke-dasharray="5 5"' : ''} marker-end="url(#${marker})"></path><rect x="${labelX - 100}" y="${y - 15}" width="200" height="22" rx="4" fill="#fbfaf7"></rect><text x="${labelX}" y="${y}" text-anchor="middle" font-size="10.5" fill="#69707a">${escText(wrap(item.label, 30).join(' '))}</text></g>`; }).join(''); return base('Mermaid 时序图', width, height, `${participantSvg}${messageSvg}`); } return `<pre><code data-lang="mermaid">${escText(raw)}</code></pre>`; }

function renderMermaidSvgV2(source) {
  const raw = String(source || '').replace(/\r\n/g, '\n').trim();
  const lines = raw.split('\n').map((line) => line.trim()).filter(Boolean);
  const escapeText = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
  const wrapText = (value, limit = 20) => {
    const text = String(value ?? '').trim();
    if (!text) return [''];
    const result = [];
    let current = '';
    for (const token of text.split(/\s+/)) {
      const next = current ? `${current} ${token}` : token;
      if (next.length > limit && current) {
        result.push(current);
        current = token;
      } else {
        current = next;
      }
    }
    if (current) result.push(current);
    return result;
  };
  const marker = `mermaid-arrow-${Math.random().toString(36).slice(2, 9)}`;
  const frame = (title, width, height, body) => `<figure class="doc-mermaid"><div class="doc-mermaid-label"><span>SVG 图表</span><span>${escapeText(title)}</span></div><svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${escapeText(title)}" focusable="false"><defs><marker id="${marker}" markerWidth="9" markerHeight="9" refX="8" refY="3" orient="auto"><path d="M0,0 L9,3 L0,6 Z" fill="#69707a"></path></marker></defs><rect width="${width}" height="${height}" rx="8" fill="#fbfaf7"></rect>${body}</svg></figure>`;
  const fallback = () => `<pre><code data-lang="mermaid">${escapeText(raw)}</code></pre>`;
  if (!lines.length) return '';

  if (/^(flowchart|graph)\s+LR/i.test(lines[0])) {
    const nodes = new Map();
    const edges = [];
    const nodeRe = /\b([A-Za-z][\w-]*)\s*\[([^\]]+)\]/g;
    for (const line of lines.slice(1)) {
      let match;
      while ((match = nodeRe.exec(line))) nodes.set(match[1], match[2]);
      const edge = /^([A-Za-z][\w-]*)\s+(-+>|-\.+>|-+\.?>)\s*([A-Za-z][\w-]*)/.exec(line);
      if (edge) {
        if (!nodes.has(edge[1])) nodes.set(edge[1], edge[1]);
        if (!nodes.has(edge[3])) nodes.set(edge[3], edge[3]);
        edges.push({ from: edge[1], to: edge[3], dashed: edge[2].includes('.') });
      }
    }
    if (!nodes.size) return fallback();
    const rank = new Map([...nodes.keys()].map((id) => [id, 0]));
    for (let pass = 0; pass < nodes.size; pass += 1) {
      let changed = false;
      for (const edge of edges) {
        const next = (rank.get(edge.from) || 0) + 1;
        if (next > (rank.get(edge.to) || 0)) {
          rank.set(edge.to, next);
          changed = true;
        }
      }
      if (!changed) break;
    }
    const groups = new Map();
    for (const id of nodes.keys()) {
      const column = rank.get(id) || 0;
      if (!groups.has(column)) groups.set(column, []);
      groups.get(column).push(id);
    }
    const maxRank = Math.max(...groups.keys());
    const colWidth = 190;
    const nodeWidth = 164;
    const xPad = 32;
    const rowHeight = 92;
    const maxRows = Math.max(...[...groups.values()].map((group) => group.length));
    const width = Math.max(960, xPad * 2 + (maxRank + 1) * colWidth);
    const height = Math.max(190, 100 + maxRows * rowHeight);
    const positions = new Map();
    for (const [column, group] of groups) group.forEach((id, row) => positions.set(id, { x: xPad + column * colWidth, y: 76 + row * rowHeight }));
    const edgeSvg = edges.map((edge) => {
      const from = positions.get(edge.from); const to = positions.get(edge.to);
      if (!from || !to) return '';
      const x1 = from.x + nodeWidth; const y1 = from.y + 32; const x2 = to.x; const y2 = to.y + 32;
      const bend = x1 + Math.max(18, (x2 - x1) / 2);
      return `<path d="M${x1} ${y1} C${bend} ${y1}, ${bend} ${y2}, ${x2} ${y2}" fill="none" stroke="#69707a" stroke-width="1.5" ${edge.dashed ? 'stroke-dasharray="5 5"' : ''} marker-end="url(#${marker})"></path>`;
    }).join('');
    const nodeSvg = [...nodes.entries()].map(([id, label]) => {
      const position = positions.get(id); const labels = wrapText(label, 22);
      const text = labels.map((line, index) => `<tspan x="${position.x + nodeWidth / 2}" dy="${index ? 16 : 0}">${escapeText(line)}</tspan>`).join('');
      return `<g><rect x="${position.x}" y="${position.y}" width="${nodeWidth}" height="64" rx="8" fill="#ffffff" stroke="#087d75"></rect><text x="${position.x + nodeWidth / 2}" y="${position.y + 29 - (labels.length - 1) * 8}" text-anchor="middle" font-size="12" font-weight="650" fill="#1d1f22">${text}</text></g>`;
    }).join('');
    return frame('Mermaid 流程图', width, height, `<g>${edgeSvg}</g><g>${nodeSvg}</g>`);
  }

  if (/^sequenceDiagram/i.test(lines[0])) {
    const participants = [];
    const seen = new Set();
    const messages = [];
    for (const line of lines.slice(1)) {
      const participant = /^participant\s+([A-Za-z][\w-]*)\s+as\s+(.+)$/.exec(line);
      if (participant && !seen.has(participant[1])) {
        seen.add(participant[1]);
        participants.push({ id: participant[1], label: participant[2] });
        continue;
      }
      const message = /^([A-Za-z][\w-]*)\s*(->>|-->>|->|-->|-\.->|--\.->)\s*([A-Za-z][\w-]*):\s*(.+)$/.exec(line);
      if (message) {
        for (const id of [message[1], message[3]]) {
          if (!seen.has(id)) {
            seen.add(id);
            participants.push({ id, label: id });
          }
        }
        messages.push({ from: message[1], to: message[3], label: message[4], dashed: message[2].includes('.') });
      }
    }
    if (!participants.length || !messages.length) return fallback();
    const colWidth = Math.max(150, Math.floor(900 / Math.max(1, participants.length)));
    const width = Math.max(960, 48 + participants.length * colWidth);
    const top = 86;
    const height = Math.max(250, top + 56 + messages.length * 44);
    const positions = new Map(participants.map((item, index) => [item.id, 48 + index * colWidth + colWidth / 2]));
    const participantSvg = participants.map((item) => {
      const x = positions.get(item.id); const labels = wrapText(item.label, 17);
      const text = labels.map((line, index) => `<tspan x="${x}" dy="${index ? 14 : 0}">${escapeText(line)}</tspan>`).join('');
      return `<g><rect x="${x - 56}" y="22" width="112" height="38" rx="8" fill="#dcefeb" stroke="#087d75"></rect><text x="${x}" y="${42 - (labels.length - 1) * 7}" text-anchor="middle" font-size="11" font-weight="650" fill="#1d1f22">${text}</text><line x1="${x}" y1="60" x2="${x}" y2="${height - 18}" stroke="#b6bbb8" stroke-dasharray="4 5"></line></g>`;
    }).join('');
    const messageSvg = messages.map((item, index) => {
      const x1 = positions.get(item.from); const x2 = positions.get(item.to); const y = top + index * 44;
      const direction = x1 < x2 ? 1 : -1; const start = x1 + direction * 8; const end = x2 - direction * 8; const labelX = (x1 + x2) / 2;
      return `<g><path d="M${start} ${y} H${end}" fill="none" stroke="#69707a" stroke-width="1.5" ${item.dashed ? 'stroke-dasharray="5 5"' : ''} marker-end="url(#${marker})"></path><rect x="${labelX - 100}" y="${y - 15}" width="200" height="22" rx="4" fill="#fbfaf7"></rect><text x="${labelX}" y="${y}" text-anchor="middle" font-size="10.5" fill="#69707a">${escapeText(wrapText(item.label, 30).join(' '))}</text></g>`;
    }).join('');
    return frame('Mermaid 时序图', width, height, `${participantSvg}${messageSvg}`);
  }
  return fallback();
}

function renderMarkdown(source, sourceFile = '') {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const html = [];
  const outline = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (/^```/.test(line)) {
      const lang = line.replace(/^```/, '').trim();
      const code = [];
      index += 1;
      while (index < lines.length && !/^```/.test(lines[index])) {
        code.push(lines[index]);
        index += 1;
      }
      index += 1;
      if (lang.toLowerCase() === 'mermaid') html.push(renderMermaidSvgV2(code.join('\n')));
      else html.push(`<pre><code data-lang="${escapeHtml(lang)}">${escapeHtml(code.join('\n'))}</code></pre>`);
      continue;
    }

    const heading = /^(#{1,4})\s+(.+)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      const text = heading[2].trim();
      const id = makeHeadingId(text, outline.length);
      outline.push({ id, text, level });
      html.push(`<h${level} id="${id}">${inline(text, sourceFile)}</h${level}>`);
      index += 1;
      continue;
    }

    if (isTableStart(lines, index)) {
      const block = [];
      while (index < lines.length && /^\s*\|.*\|\s*$/.test(lines[index])) {
        block.push(lines[index]);
        index += 1;
      }
      html.push(renderTable(block, sourceFile));
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*[-*]\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*[-*]\s+/, ''));
        index += 1;
      }
      html.push(`<ul>${items.map((item) => `<li>${inline(item, sourceFile)}</li>`).join('')}</ul>`);
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ''));
        index += 1;
      }
      html.push(`<ol>${items.map((item) => `<li>${inline(item, sourceFile)}</li>`).join('')}</ol>`);
      continue;
    }

    if (/^\s*>\s?/.test(line)) {
      const quote = [];
      while (index < lines.length && /^\s*>\s?/.test(lines[index])) {
        quote.push(lines[index].replace(/^\s*>\s?/, ''));
        index += 1;
      }
      html.push(`<blockquote>${quote.map((item) => inline(item, sourceFile)).join('<br>')}</blockquote>`);
      continue;
    }

    const standaloneImage = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line.trim());
    if (standaloneImage) {
      html.push(renderDocFigure(standaloneImage[1], standaloneImage[2], sourceFile));
      index += 1;
      continue;
    }

    if (line.trim() === '') {
      index += 1;
      continue;
    }

    const paragraph = [line];
    index += 1;
    while (
      index < lines.length &&
      lines[index].trim() !== '' &&
      !/^(#{1,4})\s+/.test(lines[index]) &&
      !/^```/.test(lines[index]) &&
      !/^!\[[^\]]*\]\([^)]+\)\s*$/.test(lines[index].trim()) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !isTableStart(lines, index)
    ) {
      paragraph.push(lines[index]);
      index += 1;
    }
    html.push(`<p>${inline(paragraph.join(' '), sourceFile)}</p>`);
  }

  return { html: html.join('\n'), outline };
}
function renderProductArchitectureSvg() { return svgFrame('DGOS 产品全景', '独立系统底座通过公开契约承载应用、AI 能力和后续生态。', '<rect x="28" y="84" width="904" height="178" rx="8" fill="#ffffff" stroke="#dedbd2"></rect><text x="44" y="110" font-size="13" font-weight="760" fill="#087d75">数据面：应用调用和能力请求</text><rect x="28" y="286" width="904" height="92" rx="8" fill="#ffffff" stroke="#dedbd2"></rect><text x="44" y="312" font-size="13" font-weight="760" fill="#4056a1">控制面：系统设置、权限、Provider、任务与审计</text><g stroke="#69707a" stroke-width="1.6" fill="none" marker-end="url(#arrow-main)"><path d="M156 166 H228"></path><path d="M420 166 H506"></path><path d="M694 166 H772"></path></g><g filter="url(#card-shadow)"><rect x="52" y="124" width="104" height="84" rx="8" fill="#e1f0e8" stroke="#2f7d4f"></rect><text x="104" y="150" text-anchor="middle" font-size="13" font-weight="700">用户 / 助手</text><text x="104" y="170" text-anchor="middle" font-size="11" fill="#69707a">意图 / 快捷指令</text><text x="104" y="188" text-anchor="middle" font-size="11" fill="#69707a">受控动作</text><rect x="228" y="108" width="192" height="116" rx="8" fill="#dcefeb" stroke="#087d75" stroke-width="2"></rect><text x="324" y="133" text-anchor="middle" font-size="15" font-weight="760" fill="#087d75">应用运行时</text><rect x="250" y="150" width="62" height="26" rx="6" fill="#ffffff" stroke="#087d75"></rect><text x="281" y="167" text-anchor="middle" font-size="10.5">Manifest</text><rect x="323" y="150" width="74" height="26" rx="6" fill="#ffffff" stroke="#087d75"></rect><text x="360" y="167" text-anchor="middle" font-size="10.5">权限</text><rect x="250" y="184" width="62" height="26" rx="6" fill="#ffffff" stroke="#087d75"></rect><text x="281" y="201" text-anchor="middle" font-size="10.5">窗口</text><rect x="323" y="184" width="74" height="26" rx="6" fill="#ffffff" stroke="#087d75"></rect><text x="360" y="201" text-anchor="middle" font-size="10.5">生命周期</text><rect x="506" y="108" width="188" height="116" rx="8" fill="#ffffff" stroke="#a96810" stroke-width="2"></rect><text x="600" y="133" text-anchor="middle" font-size="15" font-weight="760" fill="#a96810">DGOS 能力平面</text><rect x="526" y="150" width="68" height="26" rx="6" fill="#f6ead6"><text x="560" y="167" text-anchor="middle" font-size="10.5">Provider</text></rect><rect x="606" y="150" width="68" height="26" rx="6" fill="#f6ead6"><text x="640" y="167" text-anchor="middle" font-size="10.5">Task</text></rect><rect x="526" y="184" width="68" height="26" rx="6" fill="#f6ead6"><text x="560" y="201" text-anchor="middle" font-size="10.5">Skill/MCP</text></rect><rect x="606" y="184" width="68" height="26" rx="6" fill="#f6ead6"><text x="640" y="201" text-anchor="middle" font-size="10.5">Audit</text></rect><rect x="772" y="108" width="122" height="116" rx="8" fill="#e6e9f6" stroke="#4056a1"></rect><text x="833" y="133" text-anchor="middle" font-size="14" font-weight="760">应用生态</text><text x="833" y="158" text-anchor="middle" font-size="11" fill="#69707a">AI 工作台</text><text x="833" y="176" text-anchor="middle" font-size="11" fill="#69707a">画布 / 文件 / 天气</text><text x="833" y="194" text-anchor="middle" font-size="11" fill="#69707a">二维码 / 第三方 APP</text></g><g stroke="#8b929a" stroke-width="1.4" stroke-dasharray="5 5" fill="none" marker-end="url(#arrow-soft)"><path d="M600 332 V224"></path><path d="M412 332 C454 300 494 264 548 224"></path><path d="M724 332 C760 300 780 264 808 224"></path></g><g filter="url(#card-shadow)"><rect x="52" y="326" width="132" height="36" rx="8" fill="#e1f0e8" stroke="#2f7d4f"></rect><text x="118" y="349" text-anchor="middle" font-size="12" font-weight="700">桌面 / Web Shell</text><rect x="204" y="326" width="132" height="36" rx="8" fill="#e6e9f6" stroke="#4056a1"></rect><text x="270" y="349" text-anchor="middle" font-size="12" font-weight="700">应用商店</text><rect x="356" y="326" width="132" height="36" rx="8" fill="#f6ead6" stroke="#a96810"></rect><text x="422" y="349" text-anchor="middle" font-size="12" font-weight="700">系统设置</text><rect x="508" y="326" width="132" height="36" rx="8" fill="#ffffff" stroke="#087d75"></rect><text x="574" y="349" text-anchor="middle" font-size="12" font-weight="700">公共 SDK/API</text><rect x="660" y="326" width="132" height="36" rx="8" fill="#f4dde4" stroke="#aa2d4d"></rect><text x="726" y="349" text-anchor="middle" font-size="12" font-weight="700">秘密与审计</text></g><g class="legend-row"><line x1="44" y1="402" x2="82" y2="402" stroke="#69707a" stroke-width="1.8" marker-end="url(#arrow-main)"></line><text x="92" y="406" font-size="12" fill="#69707a">运行时调用路径</text><line x1="236" y1="402" x2="274" y2="402" stroke="#8b929a" stroke-width="1.6" stroke-dasharray="5 5" marker-end="url(#arrow-soft)"></line><text x="284" y="406" font-size="12" fill="#69707a">控制面影响路径</text><circle cx="514" cy="402" r="5" fill="#087d75"></circle><text x="526" y="406" font-size="12" fill="#69707a">公开契约</text></g>', 440); }
function renderCoreFlowSvg() { return svgFrame('V1 真实文本 AI 调用闭环', '系统动作、Provider 选择、流式任务和审计都经过统一边界。', '<g stroke="#69707a" stroke-width="1.6" fill="none" marker-end="url(#arrow-main)"><path d="M140 142 H190"></path><path d="M294 142 H344"></path><path d="M448 142 H498"></path><path d="M602 142 H652"></path><path d="M756 142 H806"></path></g><g filter="url(#card-shadow)"><rect x="36" y="98" width="104" height="88" rx="8" fill="#e1f0e8" stroke="#2f7d4f"></rect><text x="88" y="126" text-anchor="middle" font-size="13" font-weight="700">用户 / 助手</text><text x="88" y="149" text-anchor="middle" font-size="11" fill="#69707a">输入意图</text><text x="88" y="168" text-anchor="middle" font-size="11" fill="#69707a">确认动作</text><rect x="190" y="98" width="104" height="88" rx="8" fill="#dcefeb" stroke="#087d75"></rect><text x="242" y="126" text-anchor="middle" font-size="13" font-weight="700">Action Registry</text><text x="242" y="149" text-anchor="middle" font-size="11" fill="#69707a">授权 / 审计</text><text x="242" y="168" text-anchor="middle" font-size="11" fill="#69707a">能力路由</text><rect x="344" y="98" width="104" height="88" rx="8" fill="#ffffff" stroke="#087d75"></rect><text x="396" y="126" text-anchor="middle" font-size="13" font-weight="700">AI Task API</text><text x="396" y="149" text-anchor="middle" font-size="11" fill="#69707a">创建 / 取消</text><text x="396" y="168" text-anchor="middle" font-size="11" fill="#69707a">终态查询</text><rect x="498" y="98" width="104" height="88" rx="8" fill="#e6e9f6" stroke="#4056a1"></rect><text x="550" y="126" text-anchor="middle" font-size="13" font-weight="700">Provider</text><text x="550" y="149" text-anchor="middle" font-size="11" fill="#69707a">Adapter / 模型</text><text x="550" y="168" text-anchor="middle" font-size="11" fill="#69707a">能力分类</text><rect x="652" y="98" width="104" height="88" rx="8" fill="#f6ead6" stroke="#a96810"></rect><text x="704" y="126" text-anchor="middle" font-size="13" font-weight="700">上游模型</text><text x="704" y="149" text-anchor="middle" font-size="11" fill="#69707a">OpenAI 兼容</text><text x="704" y="168" text-anchor="middle" font-size="11" fill="#69707a">超时 / 重试</text><rect x="806" y="98" width="118" height="88" rx="8" fill="#f4dde4" stroke="#aa2d4d"></rect><text x="865" y="126" text-anchor="middle" font-size="13" font-weight="700">SSE + Artifact</text><text x="865" y="149" text-anchor="middle" font-size="11" fill="#69707a">增量 / 恢复</text><text x="865" y="168" text-anchor="middle" font-size="11" fill="#69707a">结果 / 审计</text></g><path d="M865 186 C865 232 96 232 88 186" fill="none" stroke="#69707a" stroke-width="1.4" stroke-dasharray="5 5" marker-end="url(#arrow-soft)"></path><text x="480" y="224" text-anchor="middle" font-size="12" fill="#69707a">断线恢复、错误映射和可复核运行证据</text>', 280); }
function renderVersionRoadmapSvg() { return svgFrame('DGOS 版本推进', 'V1 先完成平台、受信应用目录和真实文本任务；V2–V5 分离项目、工作流、资产、3D 与扩展，V6 承接协作和规模化生态运营。', '<rect x="36" y="88" width="888" height="108" rx="8" fill="#ffffff" stroke="#dedbd2"></rect><rect x="36" y="224" width="888" height="108" rx="8" fill="#ffffff" stroke="#dedbd2"></rect><rect x="36" y="360" width="888" height="108" rx="8" fill="#ffffff" stroke="#dedbd2"></rect><line x1="220" y1="88" x2="220" y2="468" stroke="#dedbd2"></line><g font-size="12" font-weight="700"><text x="56" y="116" fill="#087d75">平台与项目</text><text x="56" y="252" fill="#a96810">创作与扩展</text><text x="56" y="388" fill="#4056a1">协作与生态</text></g><g stroke="#69707a" stroke-width="1.5" fill="none" marker-end="url(#arrow-main)"><path d="M388 142 H442"></path><path d="M614 142 H668"></path><path d="M388 278 H442"></path><path d="M614 278 H668"></path><path d="M388 414 H442"></path></g><g filter="url(#card-shadow)"><rect x="250" y="112" width="138" height="60" rx="8" fill="#e1f0e8" stroke="#2f7d4f"></rect><text x="319" y="135" text-anchor="middle" font-size="13" font-weight="760">V1 平台基础</text><text x="319" y="154" text-anchor="middle" font-size="10.5" fill="#69707a">Shell / 目录 / Provider</text><rect x="442" y="112" width="172" height="60" rx="8" fill="#dcefeb" stroke="#087d75"></rect><text x="528" y="135" text-anchor="middle" font-size="13" font-weight="760">V2 项目与画布</text><text x="528" y="154" text-anchor="middle" font-size="10.5" fill="#69707a">基础图编辑 / 保存恢复</text><rect x="668" y="112" width="168" height="60" rx="8" fill="#e6e9f6" stroke="#4056a1"></rect><text x="752" y="135" text-anchor="middle" font-size="13" font-weight="760">V3 画布工作流</text><text x="752" y="154" text-anchor="middle" font-size="10.5" fill="#69707a">任务节点 / 结果回写</text><rect x="250" y="248" width="138" height="60" rx="8" fill="#f6ead6" stroke="#a96810"></rect><text x="319" y="271" text-anchor="middle" font-size="13" font-weight="760">V4 结构化创作</text><text x="319" y="290" text-anchor="middle" font-size="10.5" fill="#69707a">表格 / 资产 / Agent</text><rect x="442" y="248" width="172" height="60" rx="8" fill="#f4dde4" stroke="#aa2d4d"></rect><text x="528" y="271" text-anchor="middle" font-size="13" font-weight="760">V5 3D 与扩展</text><text x="528" y="290" text-anchor="middle" font-size="10.5" fill="#69707a">导演台 / 插件 / 模板</text><rect x="668" y="248" width="168" height="60" rx="8" fill="#ffffff" stroke="#8b929a" stroke-dasharray="5 5"></rect><text x="752" y="271" text-anchor="middle" font-size="13" font-weight="760" fill="#69707a">后续专项</text><text x="752" y="290" text-anchor="middle" font-size="10.5" fill="#69707a">高阶媒体能力</text><rect x="250" y="384" width="138" height="60" rx="8" fill="#e6e9f6" stroke="#4056a1"></rect><text x="319" y="407" text-anchor="middle" font-size="13" font-weight="760">V6 协作生态</text><text x="319" y="426" text-anchor="middle" font-size="10.5" fill="#69707a">协作 / 审核 / 批量</text></g><line x1="58" y1="506" x2="96" y2="506" stroke="#69707a" stroke-width="1.5" marker-end="url(#arrow-main)"></line><text x="106" y="510" font-size="12" fill="#69707a">主版本依赖</text><line x1="220" y1="506" x2="258" y2="506" stroke="#8b929a" stroke-width="1.3" stroke-dasharray="5 5" marker-end="url(#arrow-soft)"></line><text x="268" y="510" font-size="12" fill="#69707a">后续独立规划</text>', 540); }
function renderDataDomainSvg() { return svgFrame('核心数据域', '主体、应用、Provider、任务、Artifact 和审计形成可追踪关系。', '<g stroke="#69707a" stroke-width="1.4" fill="none" marker-end="url(#arrow-main)"><path d="M168 128 H286"></path><path d="M430 128 H548"></path><path d="M692 128 H810"></path><path d="M358 156 V224"></path><path d="M620 156 V224"></path><path d="M430 256 H548"></path><path d="M692 256 H810"></path></g><g filter="url(#card-shadow)"><rect x="36" y="94" width="132" height="64" rx="8" fill="#e1f0e8" stroke="#2f7d4f"></rect><text x="102" y="120" text-anchor="middle" font-size="14" font-weight="700">主体与会话</text><text x="102" y="141" text-anchor="middle" font-size="11" fill="#69707a">User / Session</text><rect x="286" y="94" width="144" height="64" rx="8" fill="#dcefeb" stroke="#087d75"></rect><text x="358" y="120" text-anchor="middle" font-size="14" font-weight="700">应用与权限</text><text x="358" y="141" text-anchor="middle" font-size="11" fill="#69707a">App / Grant / Secret</text><rect x="548" y="94" width="144" height="64" rx="8" fill="#e6e9f6" stroke="#4056a1"></rect><text x="620" y="120" text-anchor="middle" font-size="14" font-weight="700">Provider 与模型</text><text x="620" y="141" text-anchor="middle" font-size="11" fill="#69707a">Adapter / Catalog</text><rect x="810" y="94" width="116" height="64" rx="8" fill="#f6ead6" stroke="#a96810"></rect><text x="868" y="120" text-anchor="middle" font-size="14" font-weight="700">能力目录</text><text x="868" y="141" text-anchor="middle" font-size="11" fill="#69707a">Capability</text><rect x="286" y="224" width="144" height="64" rx="8" fill="#f4dde4" stroke="#aa2d4d"></rect><text x="358" y="250" text-anchor="middle" font-size="14" font-weight="700">任务与事件</text><text x="358" y="271" text-anchor="middle" font-size="11" fill="#69707a">Task / SSE</text><rect x="548" y="224" width="144" height="64" rx="8" fill="#f4dde4" stroke="#aa2d4d"></rect><text x="620" y="250" text-anchor="middle" font-size="14" font-weight="700">Artifact 与历史</text><text x="620" y="271" text-anchor="middle" font-size="11" fill="#69707a">结果 / 引用</text><rect x="810" y="224" width="116" height="64" rx="8" fill="#ffffff" stroke="#4056a1"></rect><text x="868" y="250" text-anchor="middle" font-size="14" font-weight="700">审计</text><text x="868" y="271" text-anchor="middle" font-size="11" fill="#69707a">Audit</text></g><rect x="36" y="326" width="890" height="32" rx="8" fill="#ffffff" stroke="#dedbd2"></rect><text x="54" y="347" font-size="12" fill="#69707a">底座原则：应用通过公开 API/SDK 获取能力；秘密、任务、结果和审计由系统控制面统一管理。</text>', 380); }
function renderRiskHeatmapSvg() { return svgFrame('风险热区', '颜色越深，越需要在前置版本里收敛规则和测试口径。', '<g filter="url(#card-shadow)"><rect x="70" y="92" width="170" height="78" rx="8" fill="#f4dde4" stroke="#aa2d4d"></rect><text x="155" y="122" text-anchor="middle" font-size="15" font-weight="760">权限与秘密</text><text x="155" y="146" text-anchor="middle" font-size="12" fill="#69707a">Key / Grant / 审计</text><rect x="282" y="92" width="170" height="78" rx="8" fill="#f4dde4" stroke="#aa2d4d"></rect><text x="367" y="122" text-anchor="middle" font-size="15" font-weight="760">Provider 兼容</text><text x="367" y="146" text-anchor="middle" font-size="12" fill="#69707a">协议 / 模型 / 错误</text><rect x="494" y="92" width="170" height="78" rx="8" fill="#f6ead6" stroke="#a96810"></rect><text x="579" y="122" text-anchor="middle" font-size="15" font-weight="760">异步任务</text><text x="579" y="146" text-anchor="middle" font-size="12" fill="#69707a">SSE / 取消 / 恢复</text><rect x="706" y="92" width="170" height="78" rx="8" fill="#f6ead6" stroke="#a96810"></rect><text x="791" y="122" text-anchor="middle" font-size="15" font-weight="760">范围膨胀</text><text x="791" y="146" text-anchor="middle" font-size="12" fill="#69707a">版本 / 依赖 / 门禁</text><rect x="176" y="212" width="170" height="78" rx="8" fill="#e6e9f6" stroke="#4056a1"></rect><text x="261" y="242" text-anchor="middle" font-size="15" font-weight="760">桌面 / Web</text><text x="261" y="266" text-anchor="middle" font-size="12" fill="#69707a">宿主能力差异</text><rect x="388" y="212" width="170" height="78" rx="8" fill="#dcefeb" stroke="#087d75"></rect><text x="473" y="242" text-anchor="middle" font-size="15" font-weight="760">文档事实源</text><text x="473" y="266" text-anchor="middle" font-size="12" fill="#69707a">编号 / 状态 / 证据</text><rect x="600" y="212" width="170" height="78" rx="8" fill="#e1f0e8" stroke="#2f7d4f"></rect><text x="685" y="242" text-anchor="middle" font-size="15" font-weight="760">应用扩展</text><text x="685" y="266" text-anchor="middle" font-size="12" fill="#69707a">Manifest / SDK / 回滚</text></g>', 340); }

async function buildData() {
  const files = await walk(docsRoot); const sources = new Map();
  for (const file of files) sources.set(path.relative(docsRoot, file).split(path.sep).join('/'), await fs.readFile(file, 'utf8'));
  const docs = catalog.map(([id, version, phase, title, relative, goal], index) => {
    const source = relative === '__synthetic__' ? '# 具体功能演进时间线\n\n按稳定功能编号查看 V1–V6 的版本推进、依赖与门禁。' : (sources.get(relative) || `# ${title}\n\n${goal}\n`);
    const [accent, soft] = colors[version] || ['#4056a1', '#e6e9f6'];
    return { id, version, phase, accent, soft, title: titleOf(source, title), file: relative === '__synthetic__' ? '02-产品与版本/功能演进矩阵.md' : `../docs/${relative}`, goal, content: source, lines: source.split(/\r?\n/).length, words: source.replace(/\s+/g, '').length };
  });
  return { docs, features: featureSpecs.map(makeFeature), decisions, tracks, timelineVersions, versions, versionRoutes, generatedAt: new Date().toISOString() };
}

async function readTemplate() {
  const source = await fs.readFile(templatePath, 'utf8'); const css = source.match(/<style>([\s\S]*?)<\/style>/)?.[1]; const body = source.match(/<body>([\s\S]*?)<\/body>/)?.[1]; const scripts = [...source.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
  if (!css || !body || !scripts.length) throw new Error('invalid document browser template');
  const markup = body.slice(0, body.indexOf('<script')).replaceAll('TUZAI', 'DGOS').replace('PRD Viewer', 'Document Browser').replace('搜索 PRD / API / 数据表 / 风险', '搜索文档 / 功能 / 接口 / 风险');
  const mermaidCss = `
    .doc-mermaid {
      margin: 18px 0;
      border: 1px solid var(--line);
      border-radius: 8px;
      background: var(--surface);
      overflow: hidden;
    }
    .doc-mermaid-label {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      padding: 9px 12px;
      border-bottom: 1px solid var(--line);
      color: var(--muted);
      font-size: 11px;
    }
    .doc-mermaid-label span:first-child {
      color: var(--teal);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      text-transform: uppercase;
    }
    .doc-mermaid svg {
      display: block;
      width: 100%;
      min-width: 720px;
      height: auto;
    }
    .nav-group {
      margin: 0 0 14px;
    }
    .nav-group-summary,
    .nav-group-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 28px;
      padding: 0 4px 6px;
      color: var(--muted);
      font-size: 11px;
      font-weight: 760;
      letter-spacing: .02em;
      cursor: pointer;
      list-style: none;
    }
    .nav-group-summary::-webkit-details-marker {
      display: none;
    }
    .nav-group-summary::after {
      content: '+';
      color: var(--muted);
      font-size: 16px;
      font-weight: 400;
      line-height: 1;
    }
    .nav-group[open] > .nav-group-summary::after {
      content: '−';
    }
    .nav-group-hint {
      display: block;
      margin: -2px 4px 7px;
      color: var(--muted);
      font-size: 10px;
      line-height: 1.4;
    }
    .nav-count {
      min-width: 19px;
      padding: 2px 5px;
      border-radius: 999px;
      background: var(--line-soft, #f1eee7);
      color: var(--muted);
      font-size: 10px;
      font-weight: 700;
      text-align: center;
    }
    .nav-group-items {
      display: grid;
      gap: 6px;
    }
    details.nav-group:not([open]) .nav-group-items {
      display: none;
    }
    .nav-group.primary .nav-group-summary {
      color: var(--ink);
    }
    .nav-group.primary .nav-group-summary::after {
      display: none;
    }
    .nav-group.primary .nav-group-items {
      gap: 8px;
    }
    .nav-group.compact .doc-item {
      min-height: 48px;
      padding: 7px;
    }
    .nav-group.compact .doc-badge {
      width: 34px;
      height: 32px;
      font-size: 11px;
    }
    .nav-group.compact .doc-name strong {
      font-size: 12px;
    }
    .nav-group.compact .doc-name span {
      font-size: 10px;
    }
    .nav-subgroup {
      margin: 8px 0 0 4px;
      border-left: 1px solid var(--line);
      padding-left: 8px;
    }
    .nav-subgroup-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      min-height: 26px;
      color: var(--ink);
      font-size: 11px;
      font-weight: 700;
      cursor: pointer;
      list-style: none;
    }
    .nav-subgroup-summary::-webkit-details-marker {
      display: none;
    }
    .nav-subgroup-summary::before {
      content: '+';
      width: 13px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 400;
    }
    .nav-subgroup[open] > .nav-subgroup-summary::before {
      content: '−';
    }
    .nav-subgroup-summary > span:first-child {
      flex: 1;
    }
    .nav-subgroup .nav-group-items {
      margin-top: 6px;
    }
  `;
  const viewMarkup = markup
    .replace('<button id="tabOverview" class="active" data-view="overview">总览</button>', '<button id="tabOverview" class="active" data-view="overview" title="产品范围、版本入口和决策摘要">总览</button>')
    .replace('<button id="tabReader" data-view="reader">阅读</button>', '<button id="tabReader" data-view="reader" title="阅读一份 Markdown 事实文档">阅读</button>')
    .replace('<button id="tabMap" data-view="map">图谱</button>', '<button id="tabMap" data-view="map" title="查看架构、数据域、依赖和风险图谱">图谱</button>')
    .replace('<button id="tabEvolution" data-view="evolution">功能演进</button>', '<button id="tabEvolution" data-view="evolution" title="按能力主线比较 V1–V6 的版本演进">功能演进</button>')
    .replace('<button id="tabFeatureTimeline" data-view="feature-timeline" title="具体功能时间线">时间线</button>', '<button id="tabFeatureTimeline" data-view="feature-timeline" title="按稳定功能编号查看完整生命周期">时间线</button>');
  return { css: `${css}\n${mermaidCss}\n.button{border:1px solid var(--line-strong);border-radius:6px;background:var(--surface);color:var(--ink);padding:8px 11px;font:inherit;font-size:12px;cursor:pointer}.button:hover{border-color:var(--teal);color:var(--teal)}.button.secondary{background:var(--surface-soft)}.inline-button{padding:4px 7px;text-align:left}.version-detail-actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}.version-detail-actions .muted{flex:1 1 100%;margin:0 0 3px}.muted{color:var(--muted);font-size:12px;line-height:1.6}`, markup: viewMarkup.replace('<div class="side-title">文档</div>', '<div class="side-title">阅读入口</div>'), script: scripts.at(-1)[1] };
}

function adaptScript(source, data) {
  let script = source.replaceAll('TUZAI', 'DGOS').replaceAll('prd.', 'dgos.');
  const navGroups = [
    { id: 'primary', title: '开始阅读', hint: '先看路线、蓝图和跨版本能力主线。', items: ['roadmap', 'evolution', 'feature-timeline', 'blueprint'] },
    {
      id: 'current',
      title: '当前版本 · V1',
      hint: 'V1 首发闭环的三个入口；深入规范默认收起。',
      items: ['v1-prd', 'v1-overview', 'v1-status'],
      children: [
        {
          id: 'v1-detail',
          title: '深入规范',
          items: [],
          children: [
            { id: 'v1-scope', title: '范围与追踪', items: ['v1-ids', 'v1-trace', 'lookup'] },
            { id: 'v1-architecture', title: '架构与契约', items: ['architecture', 'architecture-global', 'services', 'stack', 'contracts', 'data-model', 'extension', 'app-runtime', 'ui', 'error'] },
            { id: 'v1-features', title: '首发功能', items: ['desktop', 'developer', 'agent', 'ai-workflow', 'provider', 'assistant'] }
          ]
        }
      ]
    },
    { id: 'future', title: '后续版本入口', hint: 'V2–V6 各有独立规划；功能规格作为对应版本的登记稿或实施输入。', items: ['v2-plan', 'project', 'v3-plan', 'v4-plan', 'asset', 'v5-plan', 'plugin', 'v6-plan'] },
    { id: 'delivery', title: '测试、发布与决策', hint: '验收、安全、发布和冻结依据。', items: ['e2e', 'test', 'security', 'freeze', 'adr'] },
    { id: 'reference', title: '参考与治理文档', hint: '全局约束和不属于首发版本的治理材料。', items: ['constraints'] }
  ];
  script = `const DGOS_VERSIONS = ${JSON.stringify(data.versions)};
const DGOS_VERSION_ROUTES = ${JSON.stringify(data.versionRoutes)};
const DOC_NAV_GROUPS = ${JSON.stringify(navGroups)};\n${script}`;
  script = script.replace(/const DOCS = \[[\s\S]*?\n    \];/, `const DOCS = ${JSON.stringify(data.docs.map(({ content, lines, words, ...doc }) => doc))};`);
  script = script.replace(/const DECISIONS = \[[\s\S]*?\n    \];/, `const DECISIONS = ${JSON.stringify(data.decisions)};`);
  script = script.replace(/const FEATURE_TRACKS = \{[\s\S]*?\n    \};/, `const FEATURE_TRACKS = ${JSON.stringify(data.tracks)};`);
  script = script.replace(/const FEATURE_TIMELINE_VERSIONS = \[[\s\S]*?\n    \];/, `const FEATURE_TIMELINE_VERSIONS = ${JSON.stringify(data.timelineVersions)};`);
  script = script.replace(/if \(state\.features\.length !== \d+\) throw new Error\(`具体功能数据应为 \d+ 个，当前 \$\{state\.features\.length\} 个`\);/, 'if (!state.features.length) throw new Error("缺少 DGOS 功能数据");');
  script = script.replace('localStorage.getItem("dgos.activeDoc") || "index"', 'localStorage.getItem("dgos.activeDoc") || "roadmap"');
  script = script.replace('const state = {', 'const state = {\n      activeVersionId: localStorage.getItem("dgos.activeVersion") || "V1",\n      readerDocId: localStorage.getItem("dgos.readerDoc") || "roadmap",');
  script = script.replaceAll('V1-V8', 'V1–V6');

  function renderVersionDetail(versionId = state.activeVersionId || 'V1') {
    const version = DGOS_VERSIONS.find((item) => item.id === versionId) || DGOS_VERSIONS[0];
    const route = DGOS_VERSION_ROUTES[version.id] || {};
    const primary = route.primaryDoc ? state.docs.find((doc) => doc.id === route.primaryDoc) : null;
    const roadmap = state.docs.find((doc) => doc.id === 'roadmap');
    const evolution = state.docs.find((doc) => doc.id === 'evolution');
    const index = DGOS_VERSIONS.findIndex((item) => item.id === version.id);
    const previous = DGOS_VERSIONS[index - 1];
    const next = DGOS_VERSIONS[index + 1];
    state.activeVersionId = version.id;
    localStorage.setItem('dgos.activeVersion', version.id);
    els.outline.innerHTML = '';
    els.outlineCount.textContent = '0';
    const planningDoc = ['V2', 'V3', 'V4', 'V5', 'V6'].includes(version.id) && primary ? renderMarkdown(primary.content, primary.file) : null;
    els.content.innerHTML = `<section class="doc-header" style="--accent:${escapeHtml(route.accent || '#4056a1')}">
      <div class="doc-kicker"><span class="tag">${escapeHtml(version.id)}</span><span>版本详情</span><span>${planningDoc ? '独立版本规划' : '由路线与演进事实源生成'}</span></div>
      <h2>${escapeHtml(version.title)}</h2>
      <div class="doc-meta"><span class="tag">${escapeHtml(version.status)}</span><span class="tag">${escapeHtml(route.source || '版本演进矩阵')}</span><span class="tag">${planningDoc ? '规划文件 · 不作为编码输入' : primary ? '有主文档' : '无独立主文档'}</span></div>
    </section>
    <section class="panel"><div class="panel-head"><h2>${escapeHtml(version.id)} 交付定位</h2><span class="tag">版本边界</span></div><div class="panel-body"><p>${escapeHtml(version.goal)}</p><table class="matrix"><tbody>
      <tr><th>版本状态</th><td>${escapeHtml(version.status)}</td></tr>
      <tr><th>上一版本</th><td>${previous ? `<button class="button inline-button" data-version="${escapeHtml(previous.id)}">${escapeHtml(previous.id)} · ${escapeHtml(previous.title)}</button>` : '路线起点'}</td></tr>
      <tr><th>下一版本</th><td>${next ? `<button class="button inline-button" data-version="${escapeHtml(next.id)}">${escapeHtml(next.id)} · ${escapeHtml(next.title)}</button>` : '当前路线终点'}</td></tr>
      <tr><th>事实来源</th><td>${planningDoc ? '独立版本规划；路线图和功能演进矩阵提供总览' : `版本路线图、功能演进矩阵${primary ? '及对应功能主文档' : ''}`}</td></tr>
    </tbody></table></div></section>
    <section class="panel"><div class="panel-head"><h2>阅读入口</h2><span class="tag">导航</span></div><div class="panel-body version-detail-actions">
      ${primary ? `<button class="button" data-open-doc="${escapeHtml(primary.id)}">${planningDoc ? '单独阅读规划' : '打开主文档'}：${escapeHtml(primary.title)}</button>` : `<p class="muted">${escapeHtml(version.id)} 当前没有独立 Markdown 主文档，范围由路线图和功能演进矩阵共同定义。</p>`}
      ${roadmap ? `<button class="button secondary" data-open-doc="roadmap">查看版本路线图</button>` : ''}
      ${evolution ? `<button class="button secondary" data-open-doc="evolution">查看功能演进矩阵</button>` : ''}
      <button class="button secondary" data-view="overview">返回总览</button>
    </div></section>${planningDoc ? `<article class="article" id="article">${planningDoc.html}</article>` : ''}`;
    if (planningDoc) renderOutline(planningDoc.outline);
    els.content.querySelectorAll('[data-open-doc]').forEach((button) => button.addEventListener('click', () => openDoc(button.dataset.openDoc)));
    els.content.querySelectorAll('[data-version]').forEach((button) => button.addEventListener('click', () => openVersion(button.dataset.version)));
    els.content.querySelectorAll('[data-view]').forEach((button) => button.addEventListener('click', () => setView(button.dataset.view)));
    updateProgress();
  }

  function openVersion(versionId) {
    if (!DGOS_VERSIONS.some((item) => item.id === versionId)) return;
    state.activeVersionId = versionId;
    localStorage.setItem('dgos.activeVersion', versionId);
    setView('version-detail');
  }

  function renderDocList() {
    // 首次加载保持版本树收起；用户点入文档后再展开它的祖先路径。
    const revealActive = Boolean(renderDocList.hasRendered || state.activeDocId !== 'roadmap');
    const flattenItems = (group) => [
      ...(group.items || []),
      ...((group.children || []).flatMap((child) => flattenItems(child)))
    ];
    const assigned = new Set(DOC_NAV_GROUPS.flatMap(flattenItems));
    const groups = [
      ...DOC_NAV_GROUPS,
      {
        id: 'other',
        title: '其他文档',
        hint: '未归入主要阅读路径的索引和治理材料。',
        items: state.docs.map((doc) => doc.id).filter((id) => !assigned.has(id))
      }
    ].filter((group) => flattenItems(group).length);

    const docButton = (doc) => `
      <button class="doc-item ${doc.id === state.activeDocId ? "active" : ""}" data-doc="${doc.id}" style="--accent:${doc.accent};--accent-soft:${doc.soft}">
        <span class="doc-badge">${doc.version}</span>
        <span class="doc-name">
          <strong>${escapeHtml(doc.title)}</strong>
          <span>${escapeHtml(doc.phase)} · ${doc.lines} 行</span>
        </span>
      </button>
    `;
    const renderItems = (items) => items
      .map((id) => state.docs.find((doc) => doc.id === id))
      .filter(Boolean)
      .map(docButton)
      .join("");
    const renderChildren = (children) => children.map((child) => {
      const docs = (child.items || []).map((id) => state.docs.find((doc) => doc.id === id)).filter(Boolean);
      const nested = renderChildren(child.children || []);
      const active = Boolean(child.items?.includes(state.activeDocId)) || (child.children || []).some((nestedChild) => flattenItems(nestedChild).includes(state.activeDocId));
      const count = docs.length + (child.children || []).reduce((sum, nestedChild) => sum + flattenItems(nestedChild).length, 0);
      return `<details class="nav-subgroup" data-nav-subgroup="${escapeHtml(child.id)}"${active && revealActive ? ' open' : ''}>
        <summary class="nav-subgroup-summary"><span>${escapeHtml(child.title)}</span><span class="nav-count">${count}</span></summary>
        <div class="nav-group-items">${docs.map(docButton).join("")}${nested}</div>
      </details>`;
    }).join("");

    els.docList.innerHTML = groups.map((group) => {
      const docs = (group.items || []).map((id) => state.docs.find((doc) => doc.id === id)).filter(Boolean);
      // 顶层版本节点只显示直接入口数量；深层规范的数量在其折叠节点内显示。
      const count = docs.length;
      const items = renderItems(group.items || []);
      const children = renderChildren(group.children || []);

      if (group.id === 'primary') {
        return `<section class="nav-group primary">
          <div class="nav-group-summary"><span>${escapeHtml(group.title)}</span><span class="nav-count">${count}</span></div>
          <span class="nav-group-hint">${escapeHtml(group.hint)}</span>
          <div class="nav-group-items">${items}${children}</div>
        </section>`;
      }

      return `<details class="nav-group compact" data-nav-group="${escapeHtml(group.id)}">
        <summary class="nav-group-summary"><span>${escapeHtml(group.title)}</span><span class="nav-count">${count}</span></summary>
        <span class="nav-group-hint">${escapeHtml(group.hint)}</span>
        <div class="nav-group-items">${items}${children}</div>
      </details>`;
    }).join("");

    els.docList.querySelectorAll("button[data-doc]").forEach((button) => {
      button.addEventListener("click", () => openDoc(button.dataset.doc));
    });

    if (revealActive) {
      els.docList.querySelectorAll("details.nav-group").forEach((group) => {
        if (group.querySelector(`button[data-doc="${state.activeDocId}"]`)) group.open = true;
      });
      els.docList.querySelectorAll("details.nav-subgroup").forEach((group) => {
        if (group.querySelector(`button[data-doc="${state.activeDocId}"]`)) group.open = true;
      });
    }
    renderDocList.hasRendered = true;
  }

  const replacements = { svgFrame, renderMermaidSvgV2, renderVersionDetail, openVersion, renderDocList, renderMarkdown, renderOverview, setView, openDoc, renderMap, renderEvolution, extractEvolutionStages, renderFeatureTimeline, renderFeatureMilestone, renderProductArchitectureSvg, renderCoreFlowSvg, renderVersionRoadmapSvg, renderDataDomainSvg, renderRiskHeatmapSvg };
  for (const [name, fn] of Object.entries(replacements)) {
    if (['svgFrame', 'renderMermaidSvgV2', 'renderVersionDetail', 'openVersion'].includes(name) && !script.includes(`function ${name}(`)) script = `${fn.toString()}\n${script}`;
    else script = replaceFunction(script, name, fn.toString());
  }
  return script;
}

function browserHtml(template, data) {
  const docs = JSON.stringify(Object.fromEntries(data.docs.map((doc) => [doc.id, doc.content]))).replaceAll('</script', '<\\/script');
  const features = JSON.stringify(data.features).replaceAll('</script', '<\\/script');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DGOS 产品文档浏览器</title><style>${template.css}</style></head><body>${template.markup}<script>window.DGOS_DOC_BROWSER_DATA=${docs};window.DGOS_FEATURE_BROWSER_DATA=${features};</script><script>${adaptScript(template.script, data)}</script></body></html>`;
}

function handbook(data) {
  const rows = data.versions.map((v) => `<tr><td><b>${v.id}</b></td><td>${esc(v.title)}</td><td>${esc(v.goal)}</td><td>${esc(v.status)}</td></tr>`).join('');
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>DGOS 文档驱动开发分析手册</title><style>body{margin:0;background:#f7f5ef;color:#1d1f22;font:14px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif}.manual{max-width:1060px;margin:auto;padding:44px 28px 90px}.hero h1{font-size:35px}.hero p{color:#69707a;max-width:780px}.cards{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}.metric{padding:14px;border:1px solid #dedbd2;border-radius:8px;background:#fff}.metric b{display:block;font-size:25px}.metric span{color:#69707a;font-size:12px}.manual section{border-top:1px solid #dedbd2;margin-top:34px;padding-top:27px}.manual table{width:100%;border-collapse:collapse;background:#fff}.manual th,.manual td{border:1px solid #dedbd2;padding:9px;text-align:left}.manual th{background:#fbfaf7}.callout{padding:13px 15px;background:#e6e9f6;border-left:3px solid #4056a1}.code{padding:14px;border-radius:8px;background:#24272b;color:#f8f6ef;font:12px/1.7 ui-monospace,monospace;overflow:auto}.manual a{color:#087d75}@media(max-width:720px){.cards{grid-template-columns:1fr 1fr}}</style></head><body><main class="manual"><div class="hero"><div style="color:#087d75;font:11px ui-monospace,monospace">DGOS / SPEC-FIRST</div><h1>文档驱动开发分析手册</h1><p>面向开发人员，把新版 DGOS 文档的产品范围、版本路线、功能追踪、技术契约和开发门禁组织成可阅读的入口。Markdown 仍是唯一事实源。</p><div class="cards"><div class="metric"><b>${data.docs.length}</b><span>份核心文档</span></div><div class="metric"><b>${data.features.length}</b><span>条稳定功能编号</span></div><div class="metric"><b>V1–V6</b><span>版本路线</span></div><div class="metric"><b>0</b><span>当前产品实现证据</span></div></div></div><section><h2>1. DGOS 的产品边界</h2><p>DGOS 是独立运行的桌面与 Web 应用操作系统。平台先提供 Shell、应用运行时、Provider、Skill、MCP、权限、任务和审计，再让画布、文件、天气、二维码等能力以合规应用进入生态。</p><div class="callout"><b>事实口径：</b>当前仓库只有新版规格文档和参考材料，没有 DGOS 产品源码。规划中不能渲染为已完成。</div></section><section><h2>2. 版本推进</h2><table><thead><tr><th>版本</th><th>主题</th><th>目标</th><th>状态</th></tr></thead><tbody>${rows}</tbody></table></section><section><h2>3. 生成和渲染</h2><p>生成器读取 <code>docs/</code> 中被选入浏览器索引的 Markdown，把正文、标题、版本、功能主线和时间线数据内嵌到 HTML，并使用样版的五段视图和三栏阅读骨架。</p><pre class="code">node scripts/check-docs.mjs\nnode scripts/build-doc-viewers.mjs\npython3 -m http.server 4173 --directory preview</pre><p><a href="dgos-document-browser.html">打开 DGOS 产品文档浏览器</a></p></section><section><h2>4. 开发门禁</h2><p>V1 首先冻结 manifest、公共 API/SDK、权限、秘密、Action Registry、Provider Adapter、模型目录、任务和审计边界；再以 DGOS AI 工作台完成真实文本 Provider、SSE、结果读取和失败恢复的纵向验证。</p><p>V2–V6 依次承接项目与画布、画布工作流、结构化创作与资产、3D 与扩展、协作与生态。入口出现或页面生成不等于能力已交付。</p></section></main></body></html>`;
}

const data = await buildData();
const template = await readTemplate();
await fs.mkdir(outRoot, { recursive: true });
await fs.writeFile(path.join(outRoot, 'dgos-document-browser.html'), browserHtml(template, data));
await fs.writeFile(path.join(outRoot, 'dgos-document-handbook.html'), handbook(data));
console.log(`[doc-viewers] generated ${data.docs.length} core docs, ${data.features.length} features -> ${outRoot}`);
