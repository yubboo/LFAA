---
description: "Context compaction service: budget-based compaction exposed as a replaceable Cordis service."
kind: "package"
---

# @lfaa/compaction-basic

Exposes context compaction as `ctx.compaction`, so the runtime can swap the policy without touching the agent loop.

## Behaviour

- Wraps `@lfaa/context`'s `compactConversation`: trims early tool results, drops the oldest rounds when still over budget, and keeps the system prompt, the most recent rounds and the latest user request.
- Defaults can be set per deployment (`budgetChars`, `toolCapChars`, `keepRecentRounds`) and overridden per run by the caller.
- Invalid or too-small budgets fall back to the library default (160k chars) instead of producing a degenerate result.
- `isOverflow(error)` tells the runtime whether a failed call was a context-length overflow, so it can force a compaction and retry.

## Usage

```ts
ctx.plugin(compactionBasicPlugin, { budgetChars: 120_000, toolCapChars: 800 });
```

The agent loop uses this service when it is mounted and falls back to the built-in function otherwise. The package default-exports the Cordis plugin.