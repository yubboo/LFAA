---
description: "LFAA 应用共享四栏可折叠布局契约、侧栏导航、工作区 Shell、Cordis workbench 服务与外观设置。"
kind: "package"
---

# @lfaa/ui-layout

[English](README.md) | 中文

## 摘要

LFAA 应用共享四栏可折叠布局契约、侧栏导航、工作区 Shell、Cordis workbench 服务与外观设置。

本包位于 `packages/ui/layout`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./contract` | `./lib/types/contract/index.js` | 公开契约，无 Node 或 DOM 依赖 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/ui-primitives`

## 开发说明

无。
