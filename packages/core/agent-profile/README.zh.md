---
description: "LFAA agent 定义与模型绑定：持久化可添加的 agent、路由组与其默认绑定，供会话与派发层读取。"
kind: "package"
---

# @lfaa/agent-profile

[English](README.md) | 中文

## 摘要

LFAA agent 定义与模型绑定：持久化可添加的 agent、路由组与其默认绑定，供会话与派发层读取。

本包位于 `packages/core/agent-profile`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/llm`
- `@lfaa/ui-layout`

## 开发说明

无。
