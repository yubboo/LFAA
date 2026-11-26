---
description: "Multi-agent task orchestration: relay subagents in dependency order and accept each delivery before hand-off."
kind: "package"
---

# @lfaa/crew

Task orchestration for LFAA: split a goal into dependent tasks, run them in topological order, and only hand an upstream delivery to the next task after it passes structural acceptance.

## Tools

| Tool | Permission | Purpose |
| --- | --- | --- |
| `run_crew` | read | Take a goal plus task list, run them in order, return per-task status and the final delivery |

At most six tasks; each task declares `description` (how) and `expectedOutput` (what to deliver). Execution reuses the isolated subagent runtime from `@lfaa/subagent`: read-only, no recursive delegation, and every task gets its own workbench tab.

## Behavioural Contract

- Tasks are ordered by `dependsOn` (declaration order within a level); cycles, duplicate ids and missing dependencies are rejected before anything runs.
- Only **accepted** upstream outputs enter the downstream prompt — never upstream conversation or reasoning.
- Before hand-off, `expectedOutput` drives deterministic checks: minimum length, parseable JSON, and every `must include: A, B` item; a failure retries once with the reason, then marks the task `failed` and its dependents `skipped`.
- Accepted deliveries are written to `run`-scoped memory (`ownerId=runId`) and condensed into one `team` memory when the run ends, so run details never leak into long-term recall.

## Install

```bash
pnpm add @lfaa/crew
```

The package default-exports the Cordis plugin and injects `tools` and `memory`; the subagent service is resolved lazily so `run_crew` returns a readable error instead of failing Host startup when it is absent.