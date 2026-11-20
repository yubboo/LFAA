---
description: "Workspace filesystem boundary: safe path resolution, private-path filtering, and directory walking."
kind: "package"
---

# @lfaa/fs

English | [中文](README.zh.md)

## Summary

Workspace filesystem boundary: safe path resolution, private-path filtering, and directory walking.

This package lives in `packages/core/fs`.

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
