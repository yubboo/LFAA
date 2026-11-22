---
description: "Code review domain: built-in Git change operations, coding settings, and the review workbench with its Host service."
kind: "package"
---

# @lfaa/review

English | [中文](README.zh.md)

## Summary

Code review domain: built-in Git change operations, coding settings, and the review workbench with its Host service.

This package lives in `packages/chat/review`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/chat`
- `@lfaa/settings`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## Dev Note

None.
