---
description: "LFAA 工作区自定义分区管理包，提供 Host 分区持久化服务、HTTP RPC 与侧栏分区交互 UI 插件。"
kind: "package"
---

# @lfaa/sections

[English](README.md) | 中文

## 摘要

LFAA 工作区自定义分区管理包，提供 Host 分区持久化服务、HTTP RPC 与侧栏分区交互 UI 插件。

本包位于 `packages/workspace/sections`。

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
