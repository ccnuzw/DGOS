# V1-UI r2 受控整合

D r1已交接停写。Lead显式授权D在主目录转入r1的`apps/web`、`packages/design-tokens`、`packages/dgos-ui`、`packages/app-shell`、`packages/host-adapter/web`和root `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`、本轮前端所需根TS配置。host-adapter/macos与desktop由F独占。

先核对目标无他人修改，以apply_patch转入源码/配置/测试，核SHA。不带AGENTS/DELIVERY/node_modules/dist/test-results/截图。删除旧main.js等仅按r1明确删除差异，不误删F或其他文件。root workspace需保留macos包可发现，若新增合理workspace glob无需额外确认。

主目录可pnpm install --frozen-lockfile及Web build，使共享dist可供桌面和Compose。不要跑真实API/DB/浏览器端口冲突测试，本修订仅转入/安装/构建。报告 `.herdr/V1-UI-r2.md` 命令结果后停写，完整双端链路下一修订。
