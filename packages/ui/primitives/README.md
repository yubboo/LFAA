---
description: "Shared UI atoms: modal dialog, popover card, step slider, and the common motion vocabulary."
kind: "package"
---

# @lfaa/ui-primitives

English | [中文](README.zh.md)

## Summary

Shared UI atoms: modal dialog, popover card, step slider, and the common motion vocabulary.

This package lives in `packages/ui/primitives`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

No workspace dependencies.

## Dev Note

None.
