---
description: "API boundary: one registry that dispatches Host HTTP routes in a fixed order."
kind: "api"
---

# @lfaa/api-gateway

English | [中文](README.zh.md)

## Summary

API boundary: one registry that dispatches Host HTTP routes in a fixed order.

This package lives in `packages/api/gateway`.

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
