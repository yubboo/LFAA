---
description: "LFAA 目标服务：把会话目标、进度与受阻原因持久化，供目标工具与界面读取。"
kind: "package"
---

# @lfaa/goal

[English](README.md) | 中文

## 摘要

LFAA 目标服务：把会话目标、进度与受阻原因持久化，供目标工具与界面读取。

本包位于 `packages/goal/goal`。

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
