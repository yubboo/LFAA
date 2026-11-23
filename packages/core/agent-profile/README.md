---
description: "Agent definitions and model bindings: persisted agents, routing groups, and the default fallback used by sessions."
kind: "package"
---

# @lfaa/agent-profile

English | [中文](README.zh.md)

## Summary

Agent definitions and model bindings: persisted agents, routing groups, and the default fallback used by sessions.

This package lives in `packages/core/agent-profile`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/llm`
- `@lfaa/ui-layout`

## Dev Note

None.
