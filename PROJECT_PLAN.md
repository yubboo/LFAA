# LFAA 项目主计划

> 本文件只保存当前开发顺序和主模块状态。

## 当前主开发模块

```text
config-system
```

当前状态：

```text
implementing
```

当前实现任务：

```text
#2.2 Config Schema 基线
version: v0.0.51
status: pending-user-acceptance
```

`project-foundation` 已建立可交付骨架。`#16` 和 `#17` 属于 Config Schema 前置治理/工具链修复，不改变当前主业务模块。

用户已明确要求按照开发规范进入配置系统。#21 Web 工作台历史/实机验收状态保留，不再阻塞业务顺序；当前已完成 `config-schema` 基线并等待用户验收，验收通过后进入 `config-storage`。

## 模块顺序

| 顺序 | 模块 | 状态 | 目标 |
|---|---|---|---|
| 1 | project-foundation | delivered | 项目骨架、规范、边界、文档治理 |
| 2 | config-system | implementing | 设置、模型管理、账号、权限配置、配置存储与 UI |
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


## 文档治理前置任务

```text
#20.5 文档体系单文件时间线重构
version: v0.0.50
status: pending-user-acceptance
```

模块详细 Plan / Progress 已合并至 `docs/MODULES.md`。
