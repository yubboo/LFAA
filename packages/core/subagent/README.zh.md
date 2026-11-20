---
description: "LFAA 进程内子智能体与多 Agent 并发协作引擎：隔离上下文循环、只读/读写授权边界、并发限流及消息通信。"
kind: "package"
---

# @lfaa/subagent

[English](README.md) | 中文

## 摘要

LFAA 进程内子智能体与多 Agent 并发协作引擎：隔离上下文循环、只读/读写授权边界、并发限流及消息通信。

本包位于 `packages/core/subagent`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/agent`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/rules`
- `@lfaa/tools`

## 开发说明

子运行继承父运行的会话工具策略、模型配置及项目根目录。可写子任务遵循父运行的审批与沙箱策略。子任务记录关联父运行，父运行取消时停止仍在执行或等待审批的子任务。

派发和续接会向父工具上下文报告开始、工具状态变化和结算，父运行将真实事件保存到助手活动记录。
