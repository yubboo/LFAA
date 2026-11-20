---
description: "Bash、Git Bash 和 WSL 本地调用"
kind: "package"
---

# @lfaa/bash-local

[English](README.md) | 中文

## 摘要

Bash、Git Bash 和 WSL 本地调用

本包位于 `packages/shell/bash-local`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/shell`

## 开发说明

无。
