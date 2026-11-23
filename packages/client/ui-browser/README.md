---
description: "built-in browser browser UI moved out of @lfaa/browser."
kind: "package"
---

# @lfaa/client-ui-browser

English | [中文](README.zh.md)

## Summary

built-in browser browser UI moved out of @lfaa/browser.

Location: `packages/client/ui-browser`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/browser` keeps the host side only.
