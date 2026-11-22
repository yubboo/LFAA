---
description: "Session handoff: move a task summary and its next steps from one session to another, with a goal created on accept."
kind: "package"
---

# @lfaa/handoff

English | [中文](README.zh.md)

## Summary

Session handoff: move a task summary and its next steps from one session to another, with a goal created on accept.

This package lives in `packages/session/handoff`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/goal`
- `@lfaa/memory`
- `@lfaa/tools`

## Dev Note

Handoffs are persisted in `~/.lfaa/handoffs.json` and only visible inside the same project.