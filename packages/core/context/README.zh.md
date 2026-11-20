---
description: "LFAA 上下文预算与压缩：按字符预算压缩早期工具结果、保留最近轮次，并识别上下文超限错误（参考 DSH context 包的独立职责）。"
kind: "package"
---

# @lfaa/context

[English](README.md) | 中文

## 摘要

LFAA 上下文预算与压缩：按字符预算压缩早期工具结果、保留最近轮次，并识别上下文超限错误（参考 DSH context 包的独立职责）。

本包位于 `packages/core/context`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/llm`

## 开发说明

无。
