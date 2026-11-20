---
description: "Compact-now tool: asks the compaction service to force a smaller-budget compaction before the next model call."
kind: "package"
---

# @lfaa/command-compact

Exposes “compact the context now” as the `compact_context` tool.

## Behaviour

- The tool only **requests** compaction; `@lfaa/compaction-basic` consumes the request before the next model call and compacts with a hard budget (4k chars, tool results capped at 600, two recent rounds kept).
- The request is one-shot: consumed once, never queued.
- The tool result explains the timing so the model does not assume the context is already empty.
- Requests are process-global (single local user); a request made during one run applies to the next compaction, whichever run performs it.

## Usage

Mount `@lfaa/compaction-basic` first, then this plugin. The package default-exports the Cordis plugin with `inject: ["compaction", "tools"]`.