---
description: "Session title service: heuristic concise titles plus optional model-generated titles with automatic fallback."
kind: "package"
---

# @lfaa/session-title

Generates short session titles from the first user message, with an optional model pass.

| Surface | Purpose |
| --- | --- |
| `generateConciseSessionTitle(raw)` | Local heuristic: strips greetings/instruction prefixes, removes code fences, keeps the primary clause and limits length (16 CJK chars / 24 latin chars) |
| `normalizeGeneratedTitle(raw)` | Cleans model output: single line, no `标题:` prefix, no quotes, no trailing punctuation, max 40 chars |
| `generateSessionTitle(llm, input)` | Calls the model with a strict prompt; empty or failed results fall back to the heuristic and report `source: "heuristic"` |
| `ctx.sessionTitle` | Host service exposing `concise()` and `generate()` |
| `POST /api/session-title` | `{ userMessage, assistantReply?, profileId? }` → `{ title, source }` |

## Scope

Titles only. The service never fails a chat because title generation failed, writes nothing to storage, and does not change existing sessions unless the caller updates them.