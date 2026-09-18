# AGENTS.md

> LFAA 仓库的 AI 开发入口。
> 任何 AI、Coding Agent、自动化 Agent 或开发者在修改代码前都必须先读取本文件。

## 一、强制阅读顺序

用户说“按照开发要求做”时，严格按以下顺序：

1. `/DEVELOPMENT.md`
2. `docs/logs/development/INDEX.md`
3. 根据任务关键词读取 `docs/logs/development/active/` 中的相关当前日志
4. `/ARCHITECTURE.md`
5. `/PROJECT_PLAN.md`
6. `/CHANGELOG.md`
7. 当前模块 `docs/modules/<module>/README.md`
8. 当前模块 `docs/plans/modules/<module>/PLAN.md`
9. 当前模块 `docs/progress/modules/<module>/PROGRESS.md`
10. 当前任务 `docs/prompts/active/NNNN-*.md`
11. 任务相关 `docs/standards/`
12. Code

只有需要追溯历史原因时，才读取：

```text
docs/logs/development/archive/
docs/architecture/archive/
docs/prompts/archive/
docs/changelog/
docs/releases/
```

未完成阅读前，禁止修改业务代码。

## 二、当前与历史分离

当前实现依据：

- `DEVELOPMENT.md`
- `docs/logs/development/active/`
- `ARCHITECTURE.md`
- `docs/architecture/active/`
- `PROJECT_PLAN.md`
- 当前 Module PLAN / PROGRESS
- Active Prompt
- 当前 Standards

历史文件只用于解释“为什么变”，不能覆盖当前 active 结论。

## 三、AI 四大规则

1. 文档先行
2. 边界优先
3. 验证闭环
4. 全程可追溯

## 四、开发日志硬规则

任何需求、设计、架构、目录、行为或安全规则发生变化：

```text
先查主编号
→ 同一问题追加 #NN.x
→ 更新 active
→ 旧版进入 archive
→ 旧版指向新 active
→ 更新 INDEX
```

旧记录不删除。

禁止让旧主编号只存在于外部指针而不进入 Development Log 索引。

详细规则：

```text
docs/standards/DEV_LOGS.md
```

## 五、文档与命名硬规则

- 文档中文为主；
- 标题清晰；
- 当前结论放前面；
- 一项一项列清楚；
- 禁止大段无标题流水账；
- 名称短、准、规范；
- 禁止 `final`、`latest`、`new`、`fix2` 等临时命名。

详细规则：

```text
docs/standards/NAMING.md
```

## 六、当前主模块

```text
config-system
```

达到 `deliverable` 或明确 `blocked` 前，不切换无关业务模块。

## 七、执行能力唯一链路

```text
Agent / Plugin / MCP / DSH Plugin
→ Capability / Tool Adapter
→ Tool Runtime
→ Policy Engine
→ Permission Engine
→ Rust Broker
→ OS
```

禁止绕过。

## 八、包管理器

Node.js workspace 只允许：

```text
pnpm
```

禁止使用 npm、npx、yarn、bun 替代 pnpm。

## 九、Git 源码更新

Git Clone 后不重新克隆。

统一使用：

```text
LFAA-Update.bat
```
