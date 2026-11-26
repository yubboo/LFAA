---
description: "LFAA Agent 核心记忆能力包，管理短期会话轨迹持久化、上下文窗口裁剪摘要与长期记忆检索。"
kind: "package"
---

# @lfaa/memory

[English](README.md) | 中文

## 摘要

LFAA Agent 核心记忆能力包，管理短期会话轨迹持久化、上下文窗口裁剪摘要与长期记忆检索。

本包位于 `packages/core/memory`。

## 导出

| 子路径 | 目标 | 用途 |
|---|---|---|
| `.` | `./lib/index.js` | Host 入口（默认导出插件本体） |
| `./src/*` | `./src/*` | 源码逃生口，仅供本仓工具链 |
| `./package.json` | `./package.json` | 清单文件 |

## 依赖

- `@lfaa/session`
- `@lfaa/storage`

## 开发说明

长期记忆保存在资料库根目录的单个可读文件 `long-term-memory.json`。条目带 `kind`（偏好 / 事实 / 决策 / 踩坑 / 约定）与 `scope`（global / project / team / session）两层语义；旧条目读取时自动补成 `kind=fact` 与默认生命周期字段。

写入经进程内写队列串行化，并以临时文件原子替换落盘，父 Agent 与并行子智能体同时写不会互相覆盖。读取按文件 mtime 校验缓存，另一个 LFAA 进程写同一资料库时自动重载。

召回按「中文 bi-gram 的 BM25 + 作用域权重 + 30 天半衰期 + 命中次数 + 置信度」排序，再按条数与字符预算截断。超过上限的条目移动到 `long-term-memory.archive.json`，只归档不删除。自动提炼、条数上限与召回预算存放在 `~/.lfaa/memory-settings.json`。

会话记录会在用户消息中保留图片附件引用；图片字节仍由按会话隔离的附件存储负责。
