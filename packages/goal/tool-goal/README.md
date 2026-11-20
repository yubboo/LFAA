---
description: "Goal tools for the agent: create a goal, record progress, and mark blockers."
kind: "package"
---

# @lfaa/tool-goal

Goal tools for the LFAA agent, backed by `@lfaa/goal`.

| Tool | Permission | Purpose |
| --- | --- | --- |
| `goal_create` | read | Register a goal with a verifiable objective |
| `goal_update` | read | Record progress, mark `complete`, or mark `blocked` with a reason |
| `goal_list` | read | List goals of the current session (completed hidden by default) |

Outputs are compact one-line summaries plus at most five recent notes, so multi-step work does not flood the context.

## Install

```bash
pnpm add @lfaa/tool-goal
```

Mount `@lfaa/goal` first; this plugin injects both `goal` and `tools`. The package default-exports the Cordis plugin.