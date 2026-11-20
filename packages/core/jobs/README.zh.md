---
description: "LFAA 会话隔离后台任务管理器：支持后台命令启动、实时日志流解码、状态查询与进程树终止。"
kind: "package"
---

# @lfaa/jobs

[English](README.md) | 中文

## 摘要

LFAA 会话隔离后台任务管理器：支持后台命令启动、实时日志流解码、状态查询与进程树终止。

本包位于 `packages/core/jobs`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/shell`
- `@lfaa/shell-env`
- `@lfaa/tools`

## 开发说明

无。
