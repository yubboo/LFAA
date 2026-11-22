---
description: "Git 工作树隔离：按会话创建独立检出目录、读取状态并在安全校验后清理。"
kind: "package"
---

# @lfaa/worktree

[English](README.md) | 中文

## 摘要

Git 工作树隔离：按会话创建独立检出目录、读取状态并在安全校验后清理。

本包位于 `packages/workspace/worktree`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./contract` | `./lib/types/contract/index.js` | 公开契约，无 Node 或 DOM 依赖 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/workspace`

## 开发说明

无。
