---
description: "Chat workbench: sessions, streaming runs, the composer, the right-hand workbench, and the settings surfaces."
kind: "package"
---

# @lfaa/chat

English | [中文](README.zh.md)

## Summary

Chat workbench: sessions, streaming runs, the composer, the right-hand workbench, and the settings surfaces.

This package lives in `packages/core/chat`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/browser`
- `@lfaa/llm`
- `@lfaa/metrics`
- `@lfaa/settings`
- `@lfaa/memory`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## Dev Note

None.
