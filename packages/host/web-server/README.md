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
- `@lfaa/review`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/message-feedback`
- `@lfaa/attachment-local`
- `@lfaa/session-title`
- `@lfaa/commands`
- `@lfaa/tool-media`
- `@lfaa/plugins`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/workspace`
- `@lfaa/worktree`
- `@lfaa/api-gateway`
- `@lfaa/sandbox`

## Dev Note

The host validates generated-image references against the current conversation and its media directories. Direct generation and regeneration share the session lock with Agent runs.

Browser downloads use the authenticated browser routes for approval and the existing workspace folder picker for destination selection. The desktop shell delivers download events over its private parent-child channel.
