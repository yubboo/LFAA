---
description: "custom sections browser UI moved out of @lfaa/sections."
kind: "package"
---

# @lfaa/client-ui-sections

English | [中文](README.zh.md)

## Summary

custom sections browser UI moved out of @lfaa/sections.

Location: `packages/client/ui-sections`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@lfaa/ui-layout`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`
- `react-dom`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/sections` keeps the host side only.
