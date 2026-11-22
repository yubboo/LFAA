---
description: "LFAA 媒体生成工具：调用套餐里的生图模型生成图片，保存到工作区并返回文件路径。"
kind: "package"
---

# @lfaa/tool-media

[English](README.md) | 中文

## 摘要

LFAA 媒体生成工具：调用套餐里的生图模型生成图片，保存到工作区并返回文件路径。

本包位于 `packages/media/tool-media`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/llm`
- `@lfaa/tools`
- `@lfaa/ui-primitives`

## 开发说明

无。
