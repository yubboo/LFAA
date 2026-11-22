---
description: "LFAA Web 宿主服务：装配运行时与全部 HTTP 接口，开发态托管 Vite、生产态托管 Web 产物。"
kind: "host"
---

# @lfaa/web-server

[English](README.md) | 中文

## 摘要

LFAA Web 宿主服务：装配运行时与全部 HTTP 接口，开发态托管 Vite、生产态托管 Web 产物。

本包位于 `packages/host/web-server`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/agent`
- `@lfaa/browser`
- `@lfaa/bundle-web`
- `@lfaa/chat`
- `@lfaa/review`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/message-feedback`
- `@lfaa/attachment-local`
- `@lfaa/session-title`
- `@lfaa/commands`
- `@lfaa/tool-media`
- `@lfaa/plugins`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/workspace`
- `@lfaa/worktree`
- `@lfaa/api-gateway`
- `@lfaa/sandbox`

## 开发说明

宿主按当前会话和媒体目录校验生成图片的引用。直连生成与再次生图和 Agent 运行共用会话锁。
