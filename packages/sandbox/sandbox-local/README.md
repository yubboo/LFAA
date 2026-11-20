---
description: "Tool-layer sandbox backend: enforces write and command policy without OS-level confinement."
kind: "sandbox"
---

# @lfaa/sandbox-local

English | [中文](README.zh.md)

## Summary

Tool-layer sandbox backend: enforces write and command policy without OS-level confinement.

This package lives in `packages/sandbox/sandbox-local`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/sandbox`

## Dev Note

None.
