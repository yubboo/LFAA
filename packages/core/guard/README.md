---
description: "Command safety: blocks commands touching private application files, records an audit trail, and normalises timeouts."
kind: "package"
---

# @lfaa/guard

English | [中文](README.zh.md)

## Summary

Command safety: blocks commands touching private application files, records an audit trail, and normalises timeouts.

This package lives in `packages/core/guard`.

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
