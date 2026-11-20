---
description: "会话标题服务：启发式简洁标题 + 可选模型生成，失败自动回落。"
kind: "package"
---

# @lfaa/session-title

根据首条用户消息生成短标题，可选择再走一次模型润色。

| 入口 | 作用 |
| --- | --- |
| `generateConciseSessionTitle(raw)` | 本地启发式：去客套/指令前缀、去代码块、取主句并限长（中文 16 字 / 英文 24 字符） |
| `normalizeGeneratedTitle(raw)` | 清洗模型输出：单行、去 `标题:` 前缀、去引号、去结尾标点，最长 40 字符 |
| `generateSessionTitle(llm, input)` | 用严格提示词调用模型；空结果或异常回落启发式并返回 `source: "heuristic"` |
| `ctx.sessionTitle` | Host 服务：`concise()` 与 `generate()` |
| `POST /api/session-title` | `{ userMessage, assistantReply?, profileId? }` → `{ title, source }` |

## 范围

只做标题。模型失败不会影响会话；不写存储，也不主动改已有会话——是否写回由调用方决定。