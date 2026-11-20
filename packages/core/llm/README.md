---
description: "Model access layer: provider-neutral streaming, tool calling, and credential handling."
kind: "package"
---

# @lfaa/llm

English | [中文](README.zh.md)

## Summary

Model access layer: provider-neutral streaming, tool calling, and credential handling.

This package lives in `packages/core/llm`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./ark-plan` | `./lib/ark-plan.js` | Ark plan model routing subpath |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

No workspace dependencies.

## Dev Note

None.
