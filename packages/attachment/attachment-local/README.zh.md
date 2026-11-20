---
description: "会话附件本机存储：附件字节保存在 ~/.lfaa/attachments/<session>/，并提供列出/读取工具。"
kind: "package"
---

# @lfaa/attachment-local

保存聊天里附加的文件，刷新后仍在，Agent 也能按需读取原文。

| 入口 | 作用 |
| --- | --- |
| `ctx.attachment` | 服务：`list(sessionId)`、`put({ sessionId, name, mime?, contentBase64 })`、`get(sessionId, id)`、`remove(sessionId, id)` |
| `POST /api/attachments` | 以 JSON（`contentBase64`）上传单个文件，上限 10 MiB |
| `GET /api/attachments?sessionId=` | 按会话列出元数据，新的在前 |
| `GET /api/attachments/<id>?sessionId=` | 读取单个附件（base64） |
| `DELETE /api/attachments/<id>?sessionId=` | 删除单个附件 |
| `list_attachments` / `read_attachment` 工具 | Agent 侧读取：文本类直接内联前 2 万字符，二进制返回类型与大小 |

## 存储布局

`~/.lfaa/attachments/<安全会话名>/index.json` 保存元数据，文件写成 `<uuid>-<安全文件名>`。会话名与文件名会净化以防路径穿越；写入串行化并使用临时文件 + rename。

## 范围

仅本机明文文件，不加密、不做后台同步；附件按会话隔离，删除会话目前不会自动清理其目录。