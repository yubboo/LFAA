---
description: "LFAA Agent 核心大脑能力包，提供多提供商大模型接入、流式推理、Tool Calling 与安全凭据管理。"
kind: "package"
---

# @lfaa/llm

[English](README.md) | 中文

## 摘要

LFAA Agent 核心大脑能力包，提供多提供商大模型接入、流式推理、Tool Calling 与安全凭据管理。

本包位于 `packages/core/llm`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./ark-plan` | `./lib/ark-plan.js` | 方舟套餐模型路由子路径 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

无 workspace 依赖。

## 开发说明

无。

上下文占用使用供应商上报的输入 token 与匹配实际响应模型的窗口。Anthropic 格式的输入包含普通输入、缓存写入和缓存读取。
