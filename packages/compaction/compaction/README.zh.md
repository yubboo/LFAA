---
description: "LFAA 上下文治理包：可替换的上下文压缩服务、单条工具结果精简与 /compact 命令。"
kind: "package"
---

# @lfaa/compaction

[English](README.md) | 中文

## 摘要

LFAA 上下文治理包：可替换的上下文压缩服务、单条工具结果精简与 /compact 命令。

本包位于 `packages/compaction/compaction`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/context`
- `@lfaa/llm`
- `@lfaa/tools`

## 开发说明

无。
