---
description: "System prompt segment registry: plugins append ordered segments that the agent merges into the system message."
kind: "package"
---

# @lfaa/system-prompt

Lets plugins contribute to the system prompt without editing the agent.

## Behaviour

- `ctx.prompt.registerSegment({ id, order?, text })` — `text` can be a string or an async provider, so segments can read live settings.
- `compose()` joins non-empty segments in `order` (then registration order), separated by a blank line.
- Re-registering the same `id` replaces it; the returned disposer removes it.
- A segment whose provider throws is skipped instead of breaking the run.
- The agent composes once per run and appends the result after its built-in hints, so the prompt prefix stays cache-friendly.

## Usage

```ts
ctx.plugin(systemPromptPlugin);
ctx.prompt.registerSegment({ id: "team-policy", order: 50, text: () => "提交前必须跑 pnpm check" });
```

The package default-exports the Cordis plugin.