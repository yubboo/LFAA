---
description: "LFAA Agent 核心规则包，分层管理不可覆盖的系统规则、项目级规则（AGENTS.md / .lfaa/rules.md）与用户全局规则。"
kind: "package"
---

# @lfaa/rules

[English](README.md) | 中文

## 摘要

LFAA Agent 核心规则包，分层管理不可覆盖的系统规则、项目级规则（AGENTS.md / .lfaa/rules.md）与用户全局规则。

本包位于 `packages/core/rules`。

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
