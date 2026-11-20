---
description: "LFAA 接口边界：集中登记与派发 Host HTTP 路由，替代散落在各处的路由注册。"
kind: "api"
---

# @lfaa/api-gateway

[English](README.md) | 中文

## 摘要

LFAA 接口边界：集中登记与派发 Host HTTP 路由，替代散落在各处的路由注册。

本包位于 `packages/api/gateway`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

无 workspace 依赖。

## 开发说明

无。
