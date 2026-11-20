---
description: "LFAA 资料库与存储：数据根路径、资产/产物保存读取、资料库布局与跨目录迁移。"
kind: "package"
---

# @lfaa/storage

[English](README.md) | 中文

## 摘要

LFAA 资料库与存储：数据根路径、资产/产物保存读取、资料库布局与跨目录迁移。

本包位于 `packages/core/storage`。

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
