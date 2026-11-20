---
description: "In-process subagents: isolated context loops, read/write permission boundaries, and parallel dispatch limits."
kind: "package"
---

# @lfaa/subagent

English | [中文](README.zh.md)

## Summary

In-process subagents: isolated context loops, read/write permission boundaries, and parallel dispatch limits.

This package lives in `packages/core/subagent`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/agent`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/rules`
- `@lfaa/tools`

## Dev Note

None.
