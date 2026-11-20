---
description: "Session-scoped background tasks: start commands, stream logs, query state, and terminate process trees."
kind: "package"
---

# @lfaa/jobs

English | [中文](README.zh.md)

## Summary

Session-scoped background tasks: start commands, stream logs, query state, and terminate process trees.

This package lives in `packages/core/jobs`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/shell`
- `@lfaa/shell-env`
- `@lfaa/tools`

## Dev Note

None.
