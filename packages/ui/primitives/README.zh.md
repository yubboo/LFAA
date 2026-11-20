---
description: "LFAA 共享交互基础 UI 原语包：统一封装居中弹窗（ModalDialog）、浮层卡片（PopoverCard）与步进滑块弹窗（StepSliderPopover）及统一样式动效。"
kind: "package"
---

# @lfaa/ui-primitives

[English](README.md) | 中文

## 摘要

LFAA 共享交互基础 UI 原语包：统一封装居中弹窗（ModalDialog）、浮层卡片（PopoverCard）与步进滑块弹窗（StepSliderPopover）及统一样式动效。

本包位于 `packages/ui/primitives`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

无 workspace 依赖。

## 开发说明

无。
