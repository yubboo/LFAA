---
description: "消息反馈服务：把对助手回复的赞/踩与备注持久化，并通过 /api/feedback 供聊天界面回读。"
kind: "package"
---

# @lfaa/message-feedback

记录用户对助手回复的反馈，刷新页面后仍可回读与统计。

| 入口 | 作用 |
| --- | --- |
| `ctx.feedback` | Host 服务：`list(sessionId?)`、`get(sessionId, messageId)`、`upsert(input)`、`remove(sessionId, messageId)` |
| `POST /api/feedback` | 写入 `{ sessionId, messageId, rating: "up" \| "down", comment? }`；同一会话同一消息只保留最新一条 |
| `GET /api/feedback?sessionId=` | 按会话列出，按更新时间倒序 |
| `DELETE /api/feedback?sessionId=&messageId=` | 撤销一条反馈 |

## 存储

记录保存在 `~/.lfaa/feedback.json`（`{ version: 1, feedback: [...] }`），写入串行化并使用临时文件 + rename。入参校验会拒绝未知 rating、缺失 id 与超过 2000 字的备注。

## 范围

只做记录：不训练、不聚合、不上传，也没有后台任务。