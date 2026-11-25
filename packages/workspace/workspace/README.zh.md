---
description: "LFAA 工作区与本地项目插件包，提供 Host 服务契约与 Client 侧栏/工作区/右侧上下文面板贡献。"
kind: "package"
---

# @lfaa/workspace

[English](README.md) | 中文

## 摘要

LFAA 工作区与本地项目插件包，提供 Host 服务契约与 Client 侧栏/工作区/右侧上下文面板贡献。

本包位于 `packages/workspace/workspace`。

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

`listProjects()` 每次读取前会把项目索引与 `<文档>/lfaa` 对齐：该目录下新建或删除的文件夹会被自动发现或移出（`src/project-store.ts`），绑定在其它位置的项目仍走手动绑定流程。用户主动移出的项目记在 `~/.lfaa/projects-dismissed.json`，只有文件夹真的被删掉并重建后才会重新纳入。
