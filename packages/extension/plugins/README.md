---
description: "Plugin lifecycle: install, enable, disable, uninstall via Cordis Loader, with a profile-scoped record."
kind: "package"
---

# @lfaa/plugins

English | [中文](README.zh.md)

## Summary

Plugin lifecycle: install, enable, disable, uninstall via Cordis Loader, with a profile-scoped record.

This package lives in `packages/extension/plugins`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/skills`
- `@lfaa/tools`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## Dev Note

None.
