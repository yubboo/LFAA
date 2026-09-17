# AGENTS.md

> LFAA 仓库的 AI 开发入口。
> 任何 AI、Coding Agent、自动化 Agent 或开发者在修改代码前都必须先读取本文件。

## 一、强制阅读顺序

1. `/DEVELOPMENT.md`
2. `/ARCHITECTURE.md`
3. `/PROJECT_PLAN.md`
4. `/CHANGELOG.md`
5. 当前主模块的 `docs/modules/<module>/README.md`
6. 当前主模块的 `docs/plans/modules/<module>/PLAN.md`
7. 当前主模块的 `docs/progress/modules/<module>/PROGRESS.md`
8. 当前任务的 `docs/prompts/active/NNNN-*.md`
9. 涉及 TypeScript/React/Node 代码时必须读取：
   - `docs/standards/NAMING.md`
   - `docs/standards/MODULE_BOUNDARIES.md`
   - `docs/standards/IMPORT_PATHS.md`
10. 涉及版本包、稳定工作区或 GitHub 时必须读取 `docs/standards/WORKSPACE_SYNC.md`
11. 如任务涉及其他专项规则，再读取 `docs/standards/`

未完成阅读前，禁止修改业务代码。

## 二、唯一当前事实源

### 当前有效

- `/DEVELOPMENT.md`
- `/ARCHITECTURE.md`
- `/PROJECT_PLAN.md`
- `/CHANGELOG.md`
- `docs/architecture/active/`
- `docs/prompts/active/`
- 当前模块 `PLAN.md`
- 当前模块 `PROGRESS.md`

### 仅历史查询

- `docs/architecture/archive/`
- `docs/prompts/archive/`
- `docs/releases/`
- `docs/changelog/` 中旧版本记录

**严禁依据 archive 中的旧架构开发新功能。**

如果历史文档和当前文档冲突，以当前文档为唯一实现依据。

## 三、AI 四大规则

1. **文档先行**
2. **边界优先**
3. **验证闭环**
4. **全程可追溯**

完整定义见 `/DEVELOPMENT.md`。

## 四、模块聚焦规则

一个开发周期只允许一个主开发模块。

例如：

```text
主模块：config-system
```

则优先完成：

```text
settings
model-management
account-management
permission-settings
config-storage
config-ui
tests
docs
```

达到 `deliverable` 或明确 `blocked` 后，才能切换主模块。

禁止想到一个新功能就跨模块开工。

## 五、任何执行能力的唯一链路

```text
Agent / Plugin / MCP / DSH Plugin
↓
Capability / Tool Adapter
↓
Tool Runtime
↓
Policy Engine
↓
Permission Engine
↓
Rust Broker
↓
OS
```

禁止绕过。

## 六、禁止事项

- 禁止混用旧架构和新架构。
- 禁止无 Prompt 开发新业务。
- 禁止无 Plan 开始模块开发。
- 禁止代码完成但不更新 Progress / Changelog。
- 禁止 Child 直接修改 Parent 私有状态。
- 禁止 UI 直接访问 SQLite、Rust Broker、模型 Provider 或 Secret。
- 禁止 Plugin/MCP/DSH 绕过 Tool Runtime。
- 禁止使用 archive 文档恢复旧设计。
- 禁止为了通过测试删除安全检查。
- 禁止无关重构。
