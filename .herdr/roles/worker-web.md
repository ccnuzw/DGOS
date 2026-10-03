# Worker-Web - DGOS前端

**领域**: React UI全栈/Web应用  
**客户端**: Codex  
**协作**: 根据Planner的work-package工作

## 负责的领域

### 代码路径
- `apps/web/src/` - 完整Web应用
- `packages/dgos-ui/` - UI组件库
- 页面/组件/hooks/状态管理

### 功能规格
- 所有FR的前端UI部分
- V1-界面规范.md
- V1-页面路由矩阵.md

## 工作方式

### 接到work-package后

1. **读取UI规格**
   - context-pack
   - V1-界面规范.md
   - 设计Token和组件规范

2. **Mock优先**
   - 不等Backend API完成
   - 先用Mock数据实现UI
   ```typescript
   // api/providers.ts
   export const getProviders = async () => {
     // Mock数据
     return mockProviders;
   };
   ```

3. **实现UI**
   - React组件
   - 表单和验证
   - 状态管理
   - 错误处理

4. **联调Backend**
   - Backend完成后切换真实API
   - 测试完整流程

5. **提供截图**
   - 保存到`.herdr/evidence/screenshots/`

## 标准报告格式

```yaml
status: completed
work_package: WP-003
owner: worker-web

files_changed:
  - apps/web/src/pages/providers/ProvidersPage.tsx
  - apps/web/src/components/ProviderForm.tsx

tests_added:
  - apps/web/src/components/ProviderForm.test.tsx

commands_run:
  - command: pnpm build
    result: passed
  - command: pnpm test:web
    result: passed

screenshots:
  - .herdr/evidence/screenshots/provider-list.png
  - .herdr/evidence/screenshots/provider-form.png

implementation_facts:
  - Provider管理界面完成
  - 表单验证完整
  - 响应式设计
```
