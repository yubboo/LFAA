---
description: "LFAA Web 宿主服务：装配 Cordis 运行时与全部 HTTP 接口，开发态托管 Vite、生产态托管 Web 静态产物。"
kind: "host"
---

# @lfaa/web-server

[English](README.md) | 中文

## 摘要

LFAA Web 宿主服务：装配 Cordis 运行时与全部 HTTP 接口，开发态托管 Vite、生产态托管 Web 静态产物。

本包位于 `packages/host/web-server`。

## 导出

| 导出 | 用途 |
|---|---|
| `startWeb(options)` | 开发入口：启动 Vite 开发服务器，挂载同一套 `/api` 网关与令牌注入 |
| `startHostServer(options)` | 生产入口：装配运行时并静态托管 Web 产物，返回可 `loadURL` 的本机地址 |
| `startStaticServer(options)` | 只起静态托管（注入假网关即可单测，不装配运行时） |
| `createHostRuntime(options)` | 装配沙箱、bundle、处理器与网关，生成一次性接口令牌 |
| `resolveLoaderBaseUrl()` | 推导 Cordis Loader 的解析基准（`@lfaa/bundle-web` 的清单） |
| `detectProjectRoot(startDir)` | 开发态向上探测仓库根；生产态必须显式传入用户工作根 |

## 模块结构

| 文件 | 职责 |
|---|---|
| `src/runtime.ts` | 装配运行时与网关路由表（顺序即派发顺序） |
| `src/handlers.ts` | 常规能力处理器与「工作区根 / 媒体允许列表」解析 |
| `src/handlers-chat.ts` | 聊天、编码会话、媒体直连生成与 Agent 运行处理器 |
| `src/dev-server.ts` | Vite 开发服务器（`vite` 动态导入，生产安装包不含它） |
| `src/static-server.ts` | 生产服务器生命周期与 `/api` 派发 |
| `src/static-files.ts` | MIME、目录穿越防护、Range、SPA 回退与响应工具 |

## 运行边界

- 接口令牌每次启动随机生成，开发态注入 `index.html`，生产态在内存模板中注入；客户端读 `meta[name=lfaa-api-token]` 并附加 `x-lfaa-token`。
- 生产静态托管只接受 `GET` / `HEAD`，`/api` 永远不会回退成 HTML；`assets/` 长缓存、页面 `no-store`。
- 支持单区间 `Range`（206），视频拖动进度依赖它。

## 依赖

- `@lfaa/agent`
- `@lfaa/browser`
- `@lfaa/bundle-web`
- `@lfaa/chat`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/plugins`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/workspace`
- `@lfaa/api-gateway`
- `@lfaa/sandbox-local`

## 开发说明

宿主按当前会话和媒体目录校验生成图片的引用。直连生成与再次生图和 Agent 运行共用会话锁。