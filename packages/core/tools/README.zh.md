---
description: "LFAA Agent 核心手脚能力包，提供可插拔工具注册表、工作区路径沙箱与内置文件/检索/命令工具。"
kind: "package"
---

# @lfaa/tools

[English](README.md) | 中文

## 摘要

LFAA Agent 核心手脚能力包，提供可插拔工具注册表、工作区路径沙箱与内置文件/检索/命令工具。

本包位于 `packages/core/tools`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/fs`
- `@lfaa/guard`
- `@lfaa/shell`
- `@lfaa/sandbox`

## 开发说明

工具定义声明所属模块。会话工具视图用同一模块集合约束模型声明与实际执行，包括间接调用和命令超时回退。

执行上下文提供可选的子运行活动回调，供委派工具向父运行报告实际进度。
