---
description: "User-defined sidebar sections with persisted storage and editing UI."
kind: "package"
---

# @lfaa/sections

English | [中文](README.zh.md)

## Summary

User-defined sidebar sections with persisted storage and editing UI.

This package lives in `packages/workspace/sections`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/ui-layout`

## Dev Note

None.
