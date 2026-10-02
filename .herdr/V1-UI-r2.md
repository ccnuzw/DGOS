# V1-UI r2 受控整合回报

- status: delivered
- work_package: V1-UI
- revision: r2
- delivery_id: DGOS-V1-IMPLEMENT-20261002
- workspace: `/Users/apple/Progame/DGOS`
- baseline: `72ab1cb98b064a6e27b9f60a9f8f00881a827a99`
- commit: 未提交、未推送

## files_changed

- `apps/web`: r1 的 React/TS/Vite 源码、页面测试、Web dist 运行脚本及配置；旧 `src/main.js` 按 r1 删除。
- `packages/design-tokens`, `packages/dgos-ui`, `packages/app-shell`, `packages/host-adapter/web`: r1 UI 公共包。
- `pnpm-lock.yaml`, `pnpm-workspace.yaml`: UI 依赖与二级 host-adapter workspace glob。root `package.json` 与 worktree 字节相同，未编辑。
- `.herdr/V1-UI-r2.md`: 本回报。
- `apps/web/dist`: 本次构建生成供 Compose/F 使用；生成物未作为源码补丁转入。

## tests_added

- 本修订未新增测试；r1 页面测试随源码转入。按 r2 范围未运行浏览器/API/DB 联调。

## commands_run

| 命令 | 结果 |
| --- | --- |
| `git diff --quiet HEAD -- apps/web package.json pnpm-lock.yaml pnpm-workspace.yaml packages/design-tokens packages/dgos-ui packages/app-shell packages/host-adapter/web` | exit 0；转入前目标路径无他人修改 |
| `node … | apply_patch` | exit 0；转入 26 个文件，删除旧 `apps/web/src/main.js` |
| Node SHA-256 逐文件比对 | exit 0；主目录与 r1 worktree 26/26 一致 |
| `pnpm install --frozen-lockfile` | exit 0；13 个 workspace，lockfile up to date |
| `pnpm --filter @dgos/web build` | exit 0；TypeScript 与 Vite 构建通过，`apps/web/dist/index.html` 存在 |
| `git diff --check -- apps/web packages/design-tokens packages/dgos-ui packages/app-shell packages/host-adapter/web pnpm-lock.yaml pnpm-workspace.yaml` | exit 0 |
| `shasum -a 256 apps/web/dist/index.html pnpm-lock.yaml` | exit 0；dist index `a06e23b89e61f01be02f6981dec794a5ef0ea16e0afaee581e64c9d2f3271c68`，lock `ec3a7dc911dfb9a9bf022e5ada52e4193ef85d6bc6e1fc5409f6936f3f49b672` |

## implementation_facts

- 仅转入 r1 已交接 UI/root 依赖文件。主目录 F 的 `apps/desktop` 和 `packages/host-adapter/macos` 已存在改动，未触碰。
- `pnpm-workspace.yaml` 新增 `packages/host-adapter/*`，可发现 Web 与 macOS adapter；frozen install 已验证。
- Node dist 静态与 API 代理脚本保留原 Compose 命令路径 `apps/web/scripts/serve.mjs`。

## contract_changes_proposed

- 无本修订新增契约；r1 中 SystemSettingsPatch 与扩展调用方等需 Lead/Planner 收敛的事项仍见 `DELIVERY-V1-UI-r1.md`。

## open_risks

- 本修订只做受控转入、依赖安装及 Web 构建；未在主目录运行真实 API/DB/浏览器端口测试，也未形成双宿主 E2E 证据。
- 新增依赖及 UI 运行时需由 Lead 后续整合门禁与 F 桌面联调复核。

## docs_to_update

- Lead 根据后续真实跨服务/双端证据回写 V1 实现状态和发布验证报告；本修订未编辑业务文档。

## 未完成事项及限制

- 未完成：主目录真实 Web→API→Worker→Provider 与 Tauri 双端链路验收。此项属于后续修订。
- 需要 Lead/Planner 决定：r1 报告所列公共契约收敛点；本修订无新决策请求。
