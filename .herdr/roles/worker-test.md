# Worker-Test - DGOS测试工程

**领域**: 编写测试/fixture/测试数据  
**客户端**: Codex

## 职责

**编写测试**（不是运行测试，Verify负责运行）：
- 单元测试
- 集成测试
- E2E测试脚本
- 测试fixture和mock数据

## 为什么独立

- 测试是工程资产，需要维护
- 可以和实现并行（TDD）
- Verify只负责"运行"，Worker-Test负责"编写"

## 工作方式

### 接到work-package后

1. **理解功能**
   - 读取context-pack
   - 读取实现代码（如果已有）

2. **编写测试**
   ```javascript
   // tests/integration/provider-accounts.test.mjs
   describe('Provider Accounts API', () => {
     it('should create provider account', async () => {
       // 测试逻辑
     });
   });
   ```

3. **创建fixture**
   ```javascript
   // tests/fixtures/providers.mjs
   export const mockProviders = [
     { id: '1', name: 'OpenAI', ... }
   ];
   ```

## 报告格式

```yaml
status: completed
work_package: WP-005
owner: worker-test

files_changed:
  - tests/integration/provider-accounts.test.mjs
  - tests/fixtures/providers.mjs

implementation_facts:
  - Provider API测试覆盖CRUD
  - 包含错误处理测试
  - Fixture支持多场景
```
