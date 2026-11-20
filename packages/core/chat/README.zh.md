---
description: "LFAA 核心聊天与 Agent 工作台业务包，提供会话管理、流式思考/行动/检查步骤可视化与模型规则设置界面。"
kind: "package"
---

# @lfaa/chat

[English](README.md) | 中文

## 摘要

LFAA 核心聊天与 Agent 工作台业务包，提供会话管理、流式思考/行动/检查步骤可视化与模型规则设置界面。

本包位于 `packages/core/chat`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/browser`
- `@lfaa/llm`
- `@lfaa/metrics`
- `@lfaa/settings`
- `@lfaa/memory`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## 开发说明

无。
