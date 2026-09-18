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
9. 任何代码或脚本修改必须读取：
   - `docs/standards/QUALITY_GATES.md`
   - `docs/standards/PROJECT_IDENTITY_AND_ATTRIBUTION.md`
10. 涉及 TypeScript/React/Node 代码时必须读取：
   - `docs/standards/NAMING.md`
   - `docs/standards/MODULE_BOUNDARIES.md`
   - `docs/standards/IMPORT_PATHS.md`
11. 涉及权限、执行、Secret、网络或外部输入时必须读取 `docs/standards/SECURITY.md`
12. 涉及运行时、数据库、UI、网络、Agent 或大文件时必须读取 `docs/standards/PERFORMANCE.md`
13. 涉及 Skills、Experts、Plugins、Extensions 或 MCP 时必须读取 `docs/standards/PROJECT_RESOURCES.md`
14. 涉及版本包、稳定工作区或 GitHub 时必须读取 `docs/standards/WORKSPACE_SYNC.md`
15. 如任务涉及其他专项规则，再读取 `docs/standards/`

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

严禁依据 archive 中的旧架构开发新功能。

## 三、AI 四大规则

1. 文档先行
2. 边界优先
3. 验证闭环
4. 全程可追溯

## 四、模块聚焦规则

当前主模块：

```text
config-system
```

达到 `deliverable` 或明确 `blocked` 前，不切换无关业务模块。

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
- 禁止 UI 直接访问 SQLite、Rust Broker、模型 Provider 或 Secret。
- 禁止 Plugin/MCP/DSH 绕过 Tool Runtime。
- 禁止使用 archive 文档恢复旧设计。
- 禁止为了通过测试删除安全检查。
- 禁止无关重构。
- 禁止把项目 Skills、Experts、Plugins、Extensions 或 MCP 安装到用户级目录。
- 禁止删除、篡改或模糊第三方原版权与许可证信息。
- 禁止用空命令、占位输出或跳过检查伪造 build/typecheck/test 成功。
- Node.js 依赖和 workspace 命令只允许使用 pnpm；禁止使用 npm、npx、yarn、bun 代替 pnpm。

## Git 源码更新

Git Clone 后不重新克隆。更新现有仓库统一使用：

```text
LFAA-Update.bat
```
