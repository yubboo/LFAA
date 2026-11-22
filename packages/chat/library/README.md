---
description: "Library domain: image, asset and memory browsing, the right-hand inspector, and storage location settings."
kind: "package"
---

# @lfaa/library

English | [中文](README.zh.md)

## Summary

Library domain: image, asset and memory browsing, the right-hand inspector, and storage location settings.

This package lives in `packages/chat/library`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/chat`
- `@lfaa/ui-layout`
- `@lfaa/tool-media`

## Dev Note

None.
