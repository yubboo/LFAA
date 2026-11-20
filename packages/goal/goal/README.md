---
description: "Session goal service: persisted goals, progress and blocked reasons under ~/.lfaa/goals.json."
kind: "package"
---

# @lfaa/goal

Session goal service for LFAA. Goals, progress and blockers are persisted to `~/.lfaa/goals.json` so the agent can keep a long objective across runs.

## API

| Export | Purpose |
| --- | --- |
| `GoalService` | `ctx.goal`: create / update / list / get / remove goals |
| `normalizeGoalStatus` | Reject unknown status strings without losing the previous state |
| `normalizeProgress` | Clamp `done`/`total` to sane non-negative values |
| `summarizeGoal` | One-line summary used by tools and logs |

Writes are serialised inside the process, so concurrent tool calls cannot drop entries. Each goal keeps the last 50 progress notes.

## Install

```bash
pnpm add @lfaa/goal
```

The package default-exports the Cordis plugin, so the Loader can mount it by package name. Pair it with `@lfaa/tool-goal` to expose the goal tools to the model.