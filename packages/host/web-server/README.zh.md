---
description: "LFAA Web 宿主服务：装配 bundle、挂载各能力 HTTP 接口并托管 Vite 开发服务器。"
kind: "host"
---

# @lfaa/web-server

[English](README.md) | 中文

## 摘要

LFAA Web 宿主服务：装配 bundle、挂载各能力 HTTP 接口并托管 Vite 开发服务器。

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
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/plugins`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/workspace`
- `@lfaa/api-gateway`
- `@lfaa/sandbox-local`

## 开发说明

无。
