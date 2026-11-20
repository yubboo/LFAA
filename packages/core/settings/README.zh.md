---
description: "LFAA 持久化设置：常规偏好与编码（Git/代码审查）配置的读取、归一化与写入，存于 ~/.lfaa。"
kind: "package"
---

# @lfaa/settings

[English](README.md) | 中文

## 摘要

LFAA 持久化设置：常规偏好与编码（Git/代码审查）配置的读取、归一化与写入，存于 ~/.lfaa。

本包位于 `packages/core/settings`。

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
