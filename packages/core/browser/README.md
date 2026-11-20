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
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/tools`
- `@lfaa/ui-layout`

## Dev Note

None.
