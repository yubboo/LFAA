---
description: "Library layout, asset and artifact storage, and cross-directory data-root migration."
kind: "package"
---

# @lfaa/storage

English | [中文](README.zh.md)

## Summary

Library layout, asset and artifact storage, and cross-directory data-root migration.

This package lives in `packages/core/storage`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

No workspace dependencies.

## Dev Note

None.
