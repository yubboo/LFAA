---
description: "Scheduled tasks for the agent: persisted one-shot and repeating entries with create/list/cancel/due tools."
kind: "package"
---

# @lfaa/tool-schedule

Persists agent-scheduled tasks and exposes them as tools.

| Tool | Permission | Purpose |
| --- | --- | --- |
| `schedule_create` | read | Register a reminder/follow-up. `dueAt` accepts `+30m`, `+2h`, `+1d` or an ISO timestamp; `repeat` accepts `{ kind: "interval", minutes }` or `{ kind: "daily", at: "09:00" }` |
| `schedule_list` | read | List entries sorted by due time |
| `schedule_cancel` | read | Cancel by id |
| `schedule_due` | read | Take entries that are due now; repeating entries advance to the next occurrence, one-shot entries are removed |

## Scope

Storage lives in `~/.lfaa/schedules.json` (serialised writes). There is **no background timer**: due entries surface when `schedule_due` is called (the agent calls it at the start of a turn, or a future UI adds a poll). This is deliberate — a silent background agent run is out of scope for this package.

## Usage

```ts
ctx.plugin(toolSchedulePlugin, { storeFilePath: "D:/data/schedules.json" });
```

The package default-exports the Cordis plugin.