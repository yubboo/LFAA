---
description: "LFAA 资料库功能包：图像/资产/记忆分类浏览、右栏检视器与存储位置设置。"
kind: "package"
---

# @lfaa/library

[English](README.md) | 中文

## 摘要

LFAA 资料库功能包：图像/资产/记忆分类浏览、右栏检视器与存储位置设置。

本包位于 `packages/chat/library`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/chat`
- `@lfaa/ui-layout`
- `@lfaa/tool-media`

## 开发说明

无。
