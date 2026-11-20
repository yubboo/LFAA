---
description: "Resolves the local Bash flavour (Git Bash, WSL, or native) for command execution."
kind: "package"
---

# @lfaa/bash-local

English | [中文](README.zh.md)

## Summary

Resolves the local Bash flavour (Git Bash, WSL, or native) for command execution.

This package lives in `packages/shell/bash-local`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/shell`

## Dev Note

None.
