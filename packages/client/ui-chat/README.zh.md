---
description: "LFAA 核心聊天与 Agent 工作台业务包，提供会话管理、流式思考/行动/检查步骤可视化与模型规则设置界面。（浏览器半，已从 @lfaa/chat 拆出）。"
kind: "package"
---

# @lfaa/client-ui-chat

[English](README.md) | 中文

## 摘要

LFAA 核心聊天与 Agent 工作台业务包，提供会话管理、流式思考/行动/检查步骤可视化与模型规则设置界面。（浏览器半，已从 @lfaa/chat 拆出）。

本包位于 `packages/client/ui-chat`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 半：只导出入口说明符 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，由 `apps/web` 挂载 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/client-ui-browser`
- `@lfaa/client-ui-tool-media`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/metrics`
- `@lfaa/ui-icons`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`
- `react-dom`

## 开发说明

渲染与客户端状态在 `client/` 下；能力包 `@lfaa/chat` 只保留 Host 侧。

工作台展开显式浏览器预览，并显示实时操作、定向验收结果及可用截图。
