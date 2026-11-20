---
description: "LFAA Agent 核心记忆能力包，管理短期会话轨迹持久化、上下文窗口裁剪摘要与长期记忆检索。"
kind: "package"
---

# @lfaa/memory

[English](README.md) | 中文

## 摘要

LFAA Agent 核心记忆能力包，管理短期会话轨迹持久化、上下文窗口裁剪摘要与长期记忆检索。

本包位于 `packages/core/memory`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/session`
- `@lfaa/storage`

## 开发说明

无。
