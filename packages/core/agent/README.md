---
description: "Runs the Think → Act → Check loop: assembles the model request, executes tools, and records each step."
kind: "package"
---

# @lfaa/agent

English | [中文](README.zh.md)

## Summary

Runs the Think → Act → Check loop: assembles the model request, executes tools, and records each step.

This package lives in `packages/core/agent`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/context`
- `@lfaa/guard`
- `@lfaa/llm`
- `@lfaa/metrics`
- `@lfaa/memory`
- `@lfaa/rules`
- `@lfaa/tools`

## Dev Note

Each run uses the session's saved tool policy for discovery and execution. Legacy sessions keep their previous behavior. The session lock serializes run startup with preset changes.

A top-level run can use ask_user to persist a clarification and end before executing other tool calls in the same round. Parent messages retain actual delegated-run activity, including cancellation before the parent result is saved.
