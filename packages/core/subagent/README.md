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

Child runs inherit the parent's session tool policy, model profile, and project root. Write-capable children follow the parent's approval and sandbox policy. Child records link to the parent run, and cancelling the parent stops its active children, including those waiting for approval.

Invocations and follow-ups report start, tool-state changes and settlement to the parent tool context. The parent saves these events in assistant-message activity.
