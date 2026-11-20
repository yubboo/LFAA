---
description: "Local attachment storage: keeps uploaded file bytes under ~/.lfaa/attachments/<session>/ and exposes list/read tools."
kind: "package"
---

# @lfaa/attachment-local

Stores files the user attaches in chat so they survive reloads and the agent can read them later.

| Surface | Purpose |
| --- | --- |
| `ctx.attachment` | Service: `list(sessionId)`, `put({ sessionId, name, mime?, contentBase64 })`, `get(sessionId, id)`, `remove(sessionId, id)` |
| `POST /api/attachments` | Upload one file as JSON (`contentBase64`); max 10 MiB |
| `GET /api/attachments?sessionId=` | List metadata, newest first |
| `GET /api/attachments/<id>?sessionId=` | Read one attachment as base64 |
| `DELETE /api/attachments/<id>?sessionId=` | Remove one attachment |
| `list_attachments` / `read_attachment` tools | Agent-side read access; text MIME is inlined (first 20k chars), binary returns metadata |

## Storage layout

`~/.lfaa/attachments/<safe-session>/index.json` holds metadata, and each file is written as `<uuid>-<safe-name>`. Session names and file names are sanitised to prevent path traversal; writes are serialised and use a temp file + rename.

## Scope

Single-machine, plain files, no encryption and no background sync. Attachments are scoped per session; deleting a session does not currently remove its folder automatically.