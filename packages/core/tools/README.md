---
description: "Tool registry and execution: sandboxed workspace tools plus a registration API for plugins."
kind: "package"
---

# @lfaa/tools

English | [中文](README.zh.md)

## Summary

Tool registry and execution: sandboxed workspace tools plus a registration API for plugins.

This package lives in `packages/core/tools`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/fs`
- `@lfaa/guard`
- `@lfaa/shell`
- `@lfaa/sandbox`

## Dev Note

None.
