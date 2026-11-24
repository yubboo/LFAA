---
description: "Session domain types, on-disk session files, titles, and historical summaries."
kind: "package"
---

# @lfaa/session

English | [中文](README.zh.md)

## Summary

Session domain types, on-disk session files, titles, and historical summaries.

This package lives in `packages/core/session`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/session-title`

## Dev Note

Session records retain their validated preset and module list through reload and fork. Preset changes are rejected once the session contains messages. Older sessions can leave both fields unspecified.

Assistant records can retain a structured clarification and child-run steps with their identity and state.
User message records can retain session-scoped image attachment references so chat history can restore previews after reload.

Browser activity can carry a result summary, visual verdict, and an optional reference to a session screenshot.
