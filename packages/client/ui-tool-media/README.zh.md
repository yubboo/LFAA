---
description: "LFAA 媒体生成工具：调用套餐里的生图模型生成图片，保存到工作区并返回文件路径。（浏览器半，已从 @lfaa/tool-media 拆出）。"
kind: "package"
---

# @lfaa/client-ui-tool-media

[English](README.md) | 中文

## 摘要

LFAA 媒体生成工具：调用套餐里的生图模型生成图片，保存到工作区并返回文件路径。（浏览器半，已从 @lfaa/tool-media 拆出）。

本包位于 `packages/client/ui-tool-media`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 半：只导出入口说明符 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，由 `apps/web` 挂载 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/ui-primitives`
- `@tabler/icons-react`
- `react`
- `react-dom`

## 开发说明

渲染与客户端状态在 `client/` 下；能力包 `@lfaa/tool-media` 只保留 Host 侧。
