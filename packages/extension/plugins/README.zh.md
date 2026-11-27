---
description: ""
kind: "package"
---

# @lfaa/plugins

[English](README.md) | 中文

## 摘要



本包位于 `packages/extension/plugins`。

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
- `@lfaa/ui-primitives`

## 开发说明

插件中心设置新会话的默认模式。Host 校验选择并将模块列表快照保存到对应会话。工具还取决于全局插件的实际运行状态。

`GET /api/plugins/inventory` 是只读投影：每次现读 Loader 条目，补上 bundle 静态装配的模块，并从每个包的 `locale/<lang>.json` 取显示元数据（缺失回落 `package.json`）。它不写配置、不启停插件，供设置中心「内置插件」页使用。

Host 不再维护手写插件目录：安装记录的名称与描述同样取自包内 locale 元数据，`pnpm check` 的 `plugin-locale-meta` 会拦住缺少双语 meta 的插件包。
