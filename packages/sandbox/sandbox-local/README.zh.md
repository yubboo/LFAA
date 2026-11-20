---
description: "LFAA 本地沙箱后端：在工具层按模式判定写入与命令，不具备进程级强制。"
kind: "sandbox"
---

# @lfaa/sandbox-local

[English](README.md) | 中文

## 摘要

LFAA 本地沙箱后端：在工具层按模式判定写入与命令，不具备进程级强制。

本包位于 `packages/sandbox/sandbox-local`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/sandbox`

## 开发说明

无。
