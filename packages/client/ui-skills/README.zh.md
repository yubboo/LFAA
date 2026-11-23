---
description: "skills（浏览器半，已从 @lfaa/skills 拆出）。"
kind: "package"
---

# @lfaa/client-ui-skills

[English](README.md) | 中文

## 摘要

skills（浏览器半，已从 @lfaa/skills 拆出）。

本包位于 `packages/client/ui-skills`。

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

渲染与客户端状态在 `client/` 下；能力包 `@lfaa/skills` 只保留 Host 侧。
