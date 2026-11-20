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
- `@lfaa/bash-local`
- `@lfaa/browser`
- `@lfaa/chat`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/plugins`
- `@lfaa/pwsh-local`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/shell`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/tools`
- `@lfaa/workspace`

## 开发说明

无。
