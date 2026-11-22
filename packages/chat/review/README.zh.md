---
description: "LFAA 代码审查功能包：内置 Git 变更操作、编码设置与代码审查工作台，含审查报告 Host 服务。"
kind: "package"
---

# @lfaa/review

[English](README.md) | 中文

## 摘要

LFAA 代码审查功能包：内置 Git 变更操作、编码设置与代码审查工作台，含审查报告 Host 服务。

本包位于 `packages/chat/review`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/chat`
- `@lfaa/settings`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## 开发说明

无。
