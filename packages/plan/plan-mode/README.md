---
description: "Plan mode: blocks write and exec tools per session so the agent plans first and executes after leaving."
kind: "package"
---

# @lfaa/plan-mode

A per-session plan mode built on the `@lfaa/tools` middleware seam.

## Behaviour

- `plan_mode_enter` (read) puts the session into planning: write and exec tools are answered with a refusal that tells the model how to leave plan mode.
- `plan_mode_exit` (read) restores write/exec, echoes the submitted plan, and — when the plan has at least two steps — turns it into the session's todo list (`todos` on the session record) so the work can be tracked and shown in the task dock.
- `plan_mode_status` (read) reports the current state and the objective recorded on entry.
- Read tools keep working, so the agent can still inspect the workspace while planning.
- State is per session and cleared when the plugin unmounts.

## Usage

```ts
ctx.plugin(planModePlugin);
```

The package default-exports the Cordis plugin (with `inject: ["tools", "memory"]`).