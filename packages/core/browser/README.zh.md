---
description: "LFAA 内置浏览器服务与可视化控制面板：遵循 DSH browser-use 独占注册契约，基于 playwright-core 复用本机 Edge/Chrome 驱动。"
kind: "package"
---

# @lfaa/browser

[English](README.md) | 中文

## 摘要

LFAA 内置浏览器服务与可视化控制面板：遵循 DSH browser-use 独占注册契约，基于 playwright-core 复用本机 Edge/Chrome 驱动。

本包位于 `packages/core/browser`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./contract` | `./lib/types/contract/index.js` | 公开契约，无 Node 或 DOM 依赖 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/tools`
- `@lfaa/ui-layout`

## 开发说明

无。

浏览器预览复用活动标签。显式截图生成会话范围的证据，可在宿主截图缓存存续期间查看。

Playwright 与 Electron 的受管下载共用宿主下载策略、保存位置确认及下载历史。历史在文件保存成功后写入，移除记录会保留磁盘文件。
