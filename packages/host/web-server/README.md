---
description: "Host service: creates the Cordis context, mounts the bundle, registers HTTP APIs, and serves Vite."
kind: "host"
---

# @lfaa/web-server

English | [中文](README.zh.md)

## Summary

Host service: creates the Cordis context, mounts the bundle, registers HTTP APIs, and serves Vite.

This host service package lives in `packages/host/web-server`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/agent`
- `@lfaa/browser`
- `@lfaa/bundle-web`
- `@lfaa/chat`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/plugins`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/workspace`
- `@lfaa/api-gateway`
- `@lfaa/sandbox-local`

## Dev Note

None.
