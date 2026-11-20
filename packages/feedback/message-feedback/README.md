---
description: "Message feedback service: persist thumbs up/down and notes for assistant replies, exposed to the chat UI over /api/feedback."
kind: "package"
---

# @lfaa/message-feedback

Persists user feedback on assistant replies so ratings survive reloads and can be inspected later.

| Surface | Purpose |
| --- | --- |
| `ctx.feedback` | Host service: `list(sessionId?)`, `get(sessionId, messageId)`, `upsert(input)`, `remove(sessionId, messageId)` |
| `POST /api/feedback` | Upsert `{ sessionId, messageId, rating: "up" \| "down", comment? }`; one record per session+message |
| `GET /api/feedback?sessionId=` | List records, newest first |
| `DELETE /api/feedback?sessionId=&messageId=` | Remove one record |

## Storage

Records live in `~/.lfaa/feedback.json` as `{ version: 1, feedback: [...] }`. Writes are serialised and use a temp file + rename. Input validation rejects unknown ratings, missing ids and notes longer than 2000 characters.

## Scope

The package only records feedback. It does not train, aggregate or upload anything, and it keeps no background job.