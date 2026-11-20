---
description: "LFAA Agent 核心手脚能力包，提供可插拔工具注册表、工作区路径沙箱与内置文件/检索/命令工具。"
kind: "package"
---

# @lfaa/tools

[English](README.md) | 中文

## 摘要

LFAA Agent 核心手脚能力包，提供可插拔工具注册表、工作区路径沙箱与内置文件/检索/命令工具。

本包位于 `packages/core/tools`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/fs`
- `@lfaa/guard`
- `@lfaa/shell`
- `@lfaa/sandbox`

## 开发说明

无。
