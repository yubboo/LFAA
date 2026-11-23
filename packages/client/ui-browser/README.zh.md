---
description: "LFAA 内置浏览器服务与可视化控制面板：遵循 DSH browser-use 独占注册契约，基于 playwright-core 复用本机 Edge/Chrome 驱动。（浏览器半，已从 @lfaa/browser 拆出）。"
kind: "package"
---

# @lfaa/client-ui-browser

[English](README.md) | 中文

## 摘要

LFAA 内置浏览器服务与可视化控制面板：遵循 DSH browser-use 独占注册契约，基于 playwright-core 复用本机 Edge/Chrome 驱动。（浏览器半，已从 @lfaa/browser 拆出）。

本包位于 `packages/client/ui-browser`。

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

渲染与客户端状态在 `client/` 下；能力包 `@lfaa/browser` 只保留 Host 侧。
