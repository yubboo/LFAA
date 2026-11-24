---
description: "Tool registry and execution: sandboxed workspace tools plus a registration API for plugins."
kind: "package"
---

# @lfaa/tools

English | [中文](README.zh.md)

## Summary

Tool registry and execution: sandboxed workspace tools plus a registration API for plugins.

This package lives in `packages/core/tools`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/fs`
- `@lfaa/guard`
- `@lfaa/shell`

## Dev Note

Tool definitions declare their owning module. The scoped registry applies the session module set to both model schemas and execution, including indirect tool calls and timeout fallback. Tools bound to a project are visible and callable only in that project's sessions. External tools can declare an explicit approval policy.

The execution context has an optional callback for a delegated tool to report child activity to the parent run.

Browser evidence and visual verdicts are optional metadata. Subagent step events can forward the corresponding evidence and result summary.
