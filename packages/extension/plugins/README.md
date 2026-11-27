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

- `@lfaa/tools`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## Dev Note

The plugin center selects the default for new chats. The Host validates the selected preset and snapshots its module list into each session. Available tools also depend on the running global plugins.

`GET /api/plugins/inventory` is a read-only projection: it reads Loader entries on every call, adds the modules the bundle mounts statically, and takes display metadata from each package's `locale/<lang>.json` (falling back to `package.json`). It writes no configuration and toggles no plugin; the Settings "Plugins" page renders it.

The Host keeps no hand-written plugin catalog: install records take their name and description from the same locale metadata, and the `plugin-locale-meta` check rejects plugin packages missing bilingual meta.
