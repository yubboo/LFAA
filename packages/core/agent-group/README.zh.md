---
description: "LFAA 群聊编排：把一条消息展开成按序的多个 agent 发言，共享同一份会话历史。"
kind: "package"
---

# @lfaa/agent-group

[English](README.md) | 中文

## 摘要

LFAA 群聊编排：把一条消息展开成按序的多个 agent 发言，共享同一份会话历史。

本包位于 `packages/core/agent-group`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/agent`
- `@lfaa/memory`
- `@lfaa/session`

## 开发说明

无。
