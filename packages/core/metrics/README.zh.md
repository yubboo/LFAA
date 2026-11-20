---
description: "LFAA 运行指标与成本：token 密度估算、按单价换算人民币成本、会话统计聚合（参考 DSH token-meter / session-stats 的包设计，独立实现）。"
kind: "package"
---

# @lfaa/metrics

[English](README.md) | 中文

## 摘要

LFAA 运行指标与成本：token 密度估算、按单价换算人民币成本、会话统计聚合（参考 DSH token-meter / session-stats 的包设计，独立实现）。

本包位于 `packages/core/metrics`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/llm`
- `@lfaa/memory`

## 开发说明

无。

上下文占用以最近一次模型请求上报的输入量为准。缓存比例仅使用同时上报输入与缓存输入的请求。
