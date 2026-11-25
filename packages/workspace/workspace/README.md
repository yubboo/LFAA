---
description: "Local project CRUD, directory inspection, project menus, and the right-hand workspace panes."
kind: "package"
---

# @lfaa/workspace

English | [中文](README.zh.md)

## Summary

Local project CRUD, directory inspection, project menus, and the right-hand workspace panes.

This package lives in `packages/workspace/workspace`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## Dev Note

`listProjects()` reconciles the project index with `<Documents>/lfaa` on every read: folders created or deleted there are discovered or pruned automatically (`src/project-store.ts`), while projects bound to other locations keep the manual flow. Projects the user removed are remembered in `~/.lfaa/projects-dismissed.json`, so they are not re-added until the folder is really gone and recreated.
