---
description: "LFAA Agent 任务循环引擎，聚合 LLM 大脑、工具手脚、记忆与规则四大能力执行 Think -> Act -> Check 闭环。"
kind: "package"
---

# @lfaa/agent

[English](README.md) | 中文

## 摘要

LFAA Agent 任务循环引擎，聚合 LLM 大脑、工具手脚、记忆与规则四大能力执行 Think -> Act -> Check 闭环。

本包位于 `packages/core/agent`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/agent-profile`
- `@lfaa/context`
- `@lfaa/guard`
- `@lfaa/llm`
- `@lfaa/metrics`
- `@lfaa/memory`
- `@lfaa/rules`
- `@lfaa/tools`

## 开发说明

每次运行依据会话保存的工具策略声明和执行工具。旧会话沿用原有行为。会话锁串行处理运行启动和预设变更。

主运行可用 ask_user 保存澄清问题并结束当轮，同轮其他工具调用等待用户答复。父消息保留真实委派记录，仍在运行的子任务在保存父消息前记录停止状态。

会话提供媒体工具时，聊天模型可以调用生成能力，当前选模继续负责对话。运行会把宿主校验过的参考图片交给生成工具，并在最终回复中保留产物预览。

需要预览时由主 Agent 展示当前浏览器标签。委派验收按用户指定的目标、交互、预期结果和结束条件执行。

每轮运行收口时，除了「记住…」这类显式偏好正则，还会调用一次当前模型把本轮结论、决策与踩坑提炼成结构化长期记忆（最多 3 条）；提炼结果按相似度去重、冲突时替代旧条目，失败或超时静默跳过，不阻塞答复。模型也可主动使用 ecall_memory 检索既有记忆、save_memory 写入带类型的记忆、orget_memory 删除已失效条目。
