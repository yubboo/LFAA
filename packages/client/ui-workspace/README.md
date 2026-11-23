---
description: "local projects browser UI moved out of @lfaa/workspace."
kind: "package"
---

# @lfaa/client-ui-workspace

English | [中文](README.zh.md)

## Summary

local projects browser UI moved out of @lfaa/workspace.

Location: `packages/client/ui-workspace`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`
- `react-dom`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/workspace` keeps the host side only.
