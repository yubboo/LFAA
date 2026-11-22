---
description: "会话交接：把任务摘要与下一步从一个会话交到另一个会话，接手时自动创建目标。"
kind: "package"
---

# @lfaa/handoff

[English](README.md) | 中文

## 摘要

会话交接：把任务摘要与下一步从一个会话交到另一个会话，接手时自动创建目标。

本包位于 `packages/session/handoff`。

## 导出

| 入口 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件） |
| `./src/*` | `./src/*` | 本仓库工具链的源码通道 |
| `./package.json` | `./package.json` | 包清单 |

## 依赖

- `@lfaa/goal`
- `@lfaa/memory`
- `@lfaa/tools`

## 开发说明

交接单持久化在 `~/.lfaa/handoffs.json`，只在同一项目内可见。