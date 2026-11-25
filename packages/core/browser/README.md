---
description: "Drives the local Edge/Chrome instance through playwright-core and exposes browser tools to the agent."
kind: "package"
---

# @lfaa/browser

English | [中文](README.zh.md)

## Summary

Drives the local Edge/Chrome instance through playwright-core and exposes browser tools to the agent.

This package lives in `packages/core/browser`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/tools`
- `@lfaa/ui-layout`

## Dev Note

None.

Browser previews reuse the active tab. Explicit captures produce session-scoped evidence that can be viewed while it remains in the host cache.

Managed Playwright and Electron downloads share the host policy, destination confirmation, and download history. History records only successfully saved files, and removing a record leaves the file on disk.
