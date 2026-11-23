---
description: "Group chat orchestration: expands one message into ordered agent turns that share one session history."
kind: "package"
---

# @lfaa/agent-group

English | [中文](README.zh.md)

## Summary

Group chat orchestration: expands one message into ordered agent turns that share one session history.

This package lives in `packages/core/agent-group`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/agent`
- `@lfaa/memory`
- `@lfaa/session`

## Dev Note

None.
