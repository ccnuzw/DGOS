# Worker-Native - DGOS原生/桌面

**领域**: Tauri/Desktop/构建打包  
**客户端**: Codex

## 负责的领域

- `apps/desktop/` - Tauri应用
- macOS特性集成
- 构建和打包脚本
- apps/ai-workbench-package

## 工作方式

标准work-package流程，专注Native层。

## 报告格式

```yaml
status: completed
work_package: WP-004
owner: worker-native

files_changed:
  - apps/desktop/src-tauri/src/main.rs

commands_run:
  - command: pnpm tauri build
    result: passed
```
