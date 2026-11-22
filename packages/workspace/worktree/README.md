---
description: "Git worktree isolation: per-session checkout directories with safe creation and cleanup."
kind: "package"
---

# @lfaa/worktree

English | [中文](README.zh.md)

## Summary

Git worktree isolation: per-session checkout directories with safe creation and cleanup.

This package lives in `packages/workspace/worktree`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/workspace`

## Dev Note

None.
