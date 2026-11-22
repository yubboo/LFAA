---
description: "LFAA 网页能力 seam：按优先级注册抓取实现，供工具与 Agent 统一取正文。"
kind: "package"
---

# @lfaa/web

[English](README.md) | 中文

## 摘要

LFAA 网页能力 seam：按优先级注册抓取实现，供工具与 Agent 统一取正文。

本包位于 `packages/web/web`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/tools`

## 开发说明

无。
