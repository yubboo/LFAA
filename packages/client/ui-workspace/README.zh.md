---
description: "LFAA 工作区与本地项目插件包，提供 Host 服务契约与 Client 侧栏/工作区/右侧上下文面板贡献。（浏览器半，已从 @lfaa/workspace 拆出）。"
kind: "package"
---

# @lfaa/client-ui-workspace

[English](README.md) | 中文

## 摘要

LFAA 工作区与本地项目插件包，提供 Host 服务契约与 Client 侧栏/工作区/右侧上下文面板贡献。（浏览器半，已从 @lfaa/workspace 拆出）。

本包位于 `packages/client/ui-workspace`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 半：只导出入口说明符 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，由 `apps/web` 挂载 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`
- `react-dom`

## 开发说明

渲染与客户端状态在 `client/` 下；能力包 `@lfaa/workspace` 只保留 Host 侧。
