---
description: "LFAA 沙箱抽象契约：文件影响模式、沙箱策略与执行前判定接口，不绑定具体后端。"
kind: "sandbox"
---

# @lfaa/sandbox

[English](README.md) | 中文

## 摘要

LFAA 沙箱抽象契约：文件影响模式、沙箱策略与执行前判定接口，不绑定具体后端。

本包位于 `packages/sandbox/sandbox`。

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
