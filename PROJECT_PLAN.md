# LFAA 项目主计划

> 本文件只保存当前开发顺序和主模块状态。

## 当前主开发模块

```text
config-system
```

当前状态：

```text
planned
```

当前前置实现任务：

```text
#21 Web 工作台 UI
status: in-progress
```

`project-foundation` 已建立可交付骨架。`#16` 和 `#17` 属于 Config Schema 前置治理/工具链修复，不改变当前主业务模块。

根据用户最新开发顺序，先完成 `#21 Web 工作台 UI`，用于 Vite 本地 UI 与 `.lfaa` 热插拔验证；完成后立即回到 `config-schema`。

## 模块顺序

| 顺序 | 模块 | 状态 | 目标 |
|---|---|---|---|
| 1 | project-foundation | delivered | 项目骨架、规范、边界、文档治理 |
| 2 | config-system | planned | 设置、模型管理、账号、权限配置、配置存储与 UI |
| 3 | session-system | pending-development | Session / Turn / Run |
| 4 | permission-system | pending-development | Ask / Auto / Full |
| 5 | tool-runtime | pending-development | Tool Registry / Tool Pipeline |
| 6 | rust-execution | pending-development | FS / Process / PTY / Sandbox |
| 7 | coding-agent | pending-development | 第一条真正可工作 Agent |
| 8 | eval-system | pending-development | Agent Eval / Regression |
| 9 | context-engine | pending-development | Working Set / Compaction |
| 10 | knowledge-system | pending-development | 本地知识库 |
| 11 | skill-mcp-plugin | pending-development | Skills / MCP / Plugin |
| 12 | model-routing | pending-development | 多模型 Router / Fallback / Usage |
| 13 | subagent-system | pending-development | Parent / Child Agent |
| 14 | productization | pending-development | Update / Signing / Crash Recovery |
