---
description: "LFAA 液态玻璃主题系统与外观设置插件包，提供无 DOM 主题预设契约及 Cordis Client 外观视图贡献。"
kind: "package"
---

# @lfaa/ui-theme

[English](README.md) | 中文

## 摘要

LFAA 液态玻璃主题系统与外观设置插件包，提供无 DOM 主题预设契约及 Cordis Client 外观视图贡献。

本包位于 `packages/ui/theme`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/ui-layout`

## 开发说明

无。
