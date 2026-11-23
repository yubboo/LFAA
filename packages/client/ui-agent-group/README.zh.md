---
description: "LFAA 群聊界面（浏览器半）：工作台 Group 视图、发言编排卡片与群聊接口客户端。"
kind: "package"
---

# @lfaa/client-ui-agent-group

[English](README.md) | 中文

## 摘要

群聊的浏览器界面，从 `@lfaa/agent-group` 拆出，让能力包保持无 React：工作台 `group` 视图、发言编排输入区与 `/api/group` 客户端。

本包位于 `packages/client/ui-agent-group`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 半：只导出共享视图 id 与类型 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，由 `apps/web` 挂载 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@deepseek-ai/cordis`
- `@lfaa/ui-layout`
- `react`
- `@tabler/icons-react`

## 开发说明

渲染与客户端状态全部在 `client/` 下；编排与持久化仍归能力包。