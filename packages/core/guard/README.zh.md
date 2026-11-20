---
description: "LFAA 命令安全与超时策略：拦截引用应用私有文件的命令、记录命令审计、归一化前台命令时限（参考 DSH guard 包的独立职责）。"
kind: "package"
---

# @lfaa/guard

[English](README.md) | 中文

## 摘要

LFAA 命令安全与超时策略：拦截引用应用私有文件的命令、记录命令审计、归一化前台命令时限（参考 DSH guard 包的独立职责）。

本包位于 `packages/core/guard`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/shell`

## 开发说明

无。
