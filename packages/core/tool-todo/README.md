---
description: "Todo-list tools for the agent: plan multi-step work, track progress, and persist the list with the session."
kind: "package"
---

# @lfaa/tool-todo

Todo-list tools for the LFAA agent, backed by the session record (`@lfaa/session`).

## Tools

| Tool | Permission | Purpose |
| --- | --- | --- |
| `todo_write` | read | Replace the session's todo list with the complete list the model passes in |
| `todo_read` | read | Read the current list plus per-status counts |

`todo_write` uses whole-list replacement, not merging: anything omitted is removed. Input is validated before it can reach the session — content must be non-empty, duplicate content is rejected, and at most one item may be `in_progress`. When an item omits `id`, the trimmed content becomes its identifier so the same task keeps the same key across turns.

The list is stored in the session record (`todos`), so it survives page reloads and Host restarts; `todo_read` therefore reads the persisted list rather than an in-memory cache.

## Behavioural contract

The tool description itself instructs the model to plan multi-step work: one todo per concrete step before starting, exactly one `in_progress` at a time, and each item marked `completed` as soon as it is done. The agent's progress hint repeats the same rule.

## Install

```bash
pnpm add @lfaa/tool-todo
```

The package default-exports the Cordis plugin, so it can be mounted by the Cordis Loader; it injects `tools` and `memory`.