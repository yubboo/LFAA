---
description: "Resolves PowerShell and CMD invocations for Windows command execution."
kind: "package"
---

# @lfaa/pwsh-local

English | [中文](README.zh.md)

## Summary

Resolves PowerShell and CMD invocations for Windows command execution.

This package lives in `packages/shell/pwsh-local`.

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
