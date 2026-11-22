---
description: "Sandbox domain: file-effect modes, per-call policy, and the tool-layer backend with fail-closed pre-execution checks."
kind: "sandbox"
---

# @lfaa/sandbox

English | [中文](README.zh.md)

## Summary

Sandbox domain: file-effect modes, per-call policy, and the tool-layer backend with fail-closed pre-execution checks.

This package lives in `packages/sandbox/sandbox`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/tools`

## Dev Note

None.
