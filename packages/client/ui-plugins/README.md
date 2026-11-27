---
description: "plugins browser UI moved out of @lfaa/plugins."
kind: "package"
---

# @lfaa/client-ui-plugins

English | [中文](README.zh.md)

## Summary

plugins browser UI moved out of @lfaa/plugins.

Location: `packages/client/ui-plugins`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@lfaa/ui-primitives`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`
- `react-dom`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/plugins` keeps the host side only.

The Settings page under `client/inventory/` renders the host's read-only plugin inventory; install, enable, and disable stay in the plugin center.
