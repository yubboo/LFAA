---
description: "Slash command registration seam: plugins register commands on the host; the chat composer discovers and runs them over /api/commands."
kind: "package"
---

# @lfaa/commands

A host-side registry so plugins can contribute slash commands without changing the chat client.

| Surface | Purpose |
| --- | --- |
| `ctx.commands.register({ name, title, description, kind, source, execute })` | Register a command; returns a disposer |
| `ctx.commands.list()` | Public command views, sorted by name |
| `GET /api/commands` | List registered commands |
| `POST /api/commands/run` | `{ name, args? }` → `{ ok, prompt? , message? }`; unknown command 404 |

## Kinds

- `prompt` — expands `args` into a prompt that the composer places in the input box for review.
- `message` — returns a short receipt that the composer shows as a notice.

## Built-ins

`/summarize` (summarise the session so far) and `/explain` (explain the last answer more simply) are registered by the plugin itself so the register → discover → run path is exercised end to end.

## Scope

Discovery and execution only. The package stores nothing, has no background work, and never injects a prompt into a running conversation on its own.