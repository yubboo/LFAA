---
description: "library browser UI moved out of @lfaa/library."
kind: "package"
---

# @lfaa/client-ui-library

English | [中文](README.zh.md)

## Summary

library browser UI moved out of @lfaa/library.

Location: `packages/client/ui-library`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@lfaa/chat`
- `@lfaa/client-ui-tool-media`
- `@lfaa/ui-layout`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/library` keeps the host side only.
