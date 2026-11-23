---
description: "LFAA agent 定义与模型绑定：持久化可添加的 agent、路由组与其默认绑定，供会话与派发层读取。（浏览器半，已从 @lfaa/agent-profile 拆出）。"
kind: "package"
---

# @lfaa/client-ui-agent-profile

[English](README.md) | 中文

## 摘要

LFAA agent 定义与模型绑定：持久化可添加的 agent、路由组与其默认绑定，供会话与派发层读取。（浏览器半，已从 @lfaa/agent-profile 拆出）。

本包位于 `packages/client/ui-agent-profile`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 半：只导出入口说明符 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，由 `apps/web` 挂载 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`

## 开发说明

渲染与客户端状态在 `client/` 下；能力包 `@lfaa/agent-profile` 只保留 Host 侧。
