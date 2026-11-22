---
description: "Media generation domain: the image-generation tool plus the browser-side media library, ratio/style pickers and generated-media cards."
kind: "package"
---

# @lfaa/tool-media

English | [中文](README.zh.md)

## Summary

Media generation domain: the image-generation tool plus the browser-side media library, ratio/style pickers and generated-media cards.

This package lives in `packages/media/tool-media`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/llm`
- `@lfaa/tools`
- `@lfaa/ui-primitives`

## Dev Note

None.
