---
description: "Web assembly bundle: mounts Host capabilities and the Loader in order, then wires cross-service seams."
kind: "bundle"
---

# @lfaa/bundle-web

English | [中文](README.zh.md)

## Summary

Web assembly bundle: mounts Host capabilities and the Loader in order, then wires cross-service seams.

This assembly bundle lives in `packages/bundle/web`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/agent`
- `@lfaa/bash-local`
- `@lfaa/browser`
- `@lfaa/chat`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/plugins`
- `@lfaa/pwsh-local`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/shell`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/tools`
- `@lfaa/workspace`

## Dev Note

None.
