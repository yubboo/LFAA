---
description: "LFAA Web 装配包：按 Cordis 约定把 Host 基础能力与 Loader 组合成一个可装载的 bundle。"
kind: "bundle"
---

# @lfaa/bundle-web

[English](README.md) | 中文

## 摘要

LFAA Web 装配包：按 Cordis 约定把 Host 基础能力与 Loader 组合成一个可装载的 bundle。

本包位于 `packages/bundle/web`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/agent`
- `@lfaa/browser`
- `@lfaa/chat`
- `@lfaa/review`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/plugins`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/shell`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/tools`
- `@lfaa/workspace`
- `@lfaa/worktree`
- `@lfaa/tool-todo`
- `@lfaa/goal`
- `@lfaa/web`
- `@lfaa/timeout-policy`
- `@lfaa/spill-local`
- `@lfaa/plan-mode`
- `@lfaa/fs-observation-policy`
- `@lfaa/tool-schedule`
- `@lfaa/message-feedback`
- `@lfaa/attachment-local`
- `@lfaa/session-title`
- `@lfaa/commands`
- `@lfaa/tool-media`
- `@lfaa/system-prompt`
- `@lfaa/sandbox`
- `@lfaa/compaction`

## 开发说明

Web 装配包定义内置会话预设。标准模式支持委派，创造模式面向内容与产物，极简模式支持轻量只读工作。PTC 等待运行时接入。

标准和创造模式提供媒体生成工具。沿用旧版内置组合的会话在运行时获得相同的媒体能力。

所有内置插件都以稳定 id 挂载为 Cordis Loader 条目，设置中心的清单因此能读到真实 Fiber 相位，并可逐个启用或停用。函数型配置不再放进 Loader 配置，改由装配完成后经各服务 setter 注入：`shell.setResolveInvocation`、`workspace.setProjectDirResolvers`、`tools.setCommandHooks` / `setSandbox`、`jobs.setResolveInvocation`、`agent.setResolveSessionModules`。导出多个插件的包自带默认组合 bundle，一个条目覆盖整包：`web`、`goal`、`compaction`、`agent-profile`。`@lfaa/sandbox` 默认只挂策略插件，本地沙箱仍由根上下文提供。
