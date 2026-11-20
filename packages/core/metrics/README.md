---
description: "Token estimation, per-model cost, and session statistics aggregation shared by Host and Client."
kind: "package"
---

# @lfaa/metrics

English | [中文](README.zh.md)

## Summary

Token estimation, per-model cost, and session statistics aggregation shared by Host and Client.

This package lives in `packages/core/metrics`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/llm`
- `@lfaa/memory`

## Dev Note

None.

Use the latest model request’s reported input to calculate context occupancy. Cache ratios use only requests reporting both input and cached input.
