# WP-W3-03：FR-002 完整入口

**Owner**：worker-web + worker-platform  
**Priority**：P1  
**Status**：立即启动  
**Estimated**：3 天

## 目标

完成应用目录浏览器、开发者中心 UI 和安装/更新/卸载/健康状态入口，与现有生命周期 API 对齐。

## Allowed paths

- `apps/web/src/`
- `apps/web/e2e/`
- `apps/api/src/`（仅缺失的应用目录/生命周期投影）
- `src/apps/`
- `tests/apps/`、`tests/integration/`

不得重写已冻结 manifest schema、信任/审核语义或删除数据策略。

## 验收标准

- [ ] 普通用户可浏览受信目录并查看版本、来源、权限和安装状态。
- [ ] 开发者可查看校验问题、测试安装/健康状态和发布记录。
- [ ] 安装、更新、卸载、不可卸载拒绝和健康失败回滚均有 UI 状态。
- [ ] 更新失败保留旧版本和用户数据；重复操作幂等。
- [ ] Web E2E 覆盖目录→安装→启动/健康→更新/卸载主路径。
