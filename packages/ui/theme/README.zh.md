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
| `./contract` | `./lib/types/contract/index.js` | 公开契约，无 Node 或 DOM 依赖 |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./client` | `./client/index.tsx` | 浏览器入口，供 Vite 消费 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## 开发说明

### 主题预览组件

外观页顶部的实时预览由两个可复用组件支撑，`./client` 直接导出，其他需要"选外观"的界面不必自己画一张假的界面图：

- `ThemePreview`：按 `ThemePreviewSample`（背景、前景、强调色、是否玻璃质感）渲染迷你工作台——左一图标栏、左二会话栏、中间对话列与输入条。颜色以 `--pv-*` CSS 变量注入，每个元素都对 `background-color` / `color` 做 260ms 过渡，所以切换取样是**平滑变形**，不是整块淡入淡出。传 `secondarySample` 时左右各半，用于「跟随系统」；`variant="tile"` 出的是网格里的缩略图。
- `ThemeGallery`：主题网格。悬停/聚焦只上报 `onPreview(id)`，点击才上报 `onSelect(id)`；预览状态由调用方持有，因此同一个网格可以驱动大面板、侧栏或什么都不驱动。

外观页的组合顺序是：顶部预览舞台 → 「全部主题」网格 → 细项设置。悬停预览不写真实主题，移开即回到已应用的主题。
