---
description: "LFAA Agent 任务循环引擎，聚合 LLM 大脑、工具手脚、记忆与规则四大能力执行 Think -> Act -> Check 闭环。"
kind: "package"
---

# @lfaa/agent

[English](README.md) | 中文

## 摘要

LFAA Agent 任务循环引擎，聚合 LLM 大脑、工具手脚、记忆与规则四大能力执行 Think -> Act -> Check 闭环。

本包位于 `packages/core/agent`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/context`
- `@lfaa/guard`
- `@lfaa/llm`
- `@lfaa/metrics`
- `@lfaa/memory`
- `@lfaa/rules`
- `@lfaa/tools`

## 开发说明

无。
