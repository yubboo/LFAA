---
description: "Layered prompts: system rules, project rules (AGENTS.md / .lfaa/rules.md), and user-global rules."
kind: "package"
---

# @lfaa/rules

English | [中文](README.zh.md)

## Summary

Layered prompts: system rules, project rules (AGENTS.md / .lfaa/rules.md), and user-global rules.

This package lives in `packages/core/rules`.

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
