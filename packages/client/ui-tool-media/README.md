---
description: "media generation browser UI moved out of @lfaa/tool-media."
kind: "package"
---

# @lfaa/client-ui-tool-media

English | [中文](README.zh.md)

## Summary

media generation browser UI moved out of @lfaa/tool-media.

Location: `packages/client/ui-tool-media`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@lfaa/ui-primitives`
- `@tabler/icons-react`
- `react`
- `react-dom`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/tool-media` keeps the host side only.
