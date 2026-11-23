---
description: "LFAA 代码审查功能包：内置 Git 变更操作、编码设置与代码审查工作台，含审查报告 Host 服务。（浏览器半，已从 @lfaa/review 拆出）。"
kind: "package"
---

# @lfaa/client-ui-review

[English](README.md) | 中文

## 摘要

LFAA 代码审查功能包：内置 Git 变更操作、编码设置与代码审查工作台，含审查报告 Host 服务。（浏览器半，已从 @lfaa/review 拆出）。

本包位于 `packages/client/ui-review`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 半：只导出入口说明符 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，由 `apps/web` 挂载 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/chat`
- `@lfaa/ui-primitives`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`

## 开发说明

渲染与客户端状态在 `client/` 下；能力包 `@lfaa/review` 只保留 Host 侧。
