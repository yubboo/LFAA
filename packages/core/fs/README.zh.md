---
description: "LFAA 工作区文件系统边界：安全路径解析、私有路径过滤与忽略目录遍历，供工具与运行时复用。"
kind: "package"
---

# @lfaa/fs

[English](README.md) | 中文

## 摘要

LFAA 工作区文件系统边界：安全路径解析、私有路径过滤与忽略目录遍历，供工具与运行时复用。

本包位于 `packages/core/fs`。

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
