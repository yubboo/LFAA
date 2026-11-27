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
- `@lfaa/browser`
- `@lfaa/chat`
- `@lfaa/review`
- `@lfaa/jobs`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/plugins`
- `@lfaa/rules`
- `@lfaa/sections`
- `@lfaa/shell`
- `@lfaa/skills`
- `@lfaa/subagent`
- `@lfaa/tools`
- `@lfaa/workspace`
- `@lfaa/worktree`
- `@lfaa/tool-todo`
- `@lfaa/goal`
- `@lfaa/web`
- `@lfaa/timeout-policy`
- `@lfaa/spill-local`
- `@lfaa/plan-mode`
- `@lfaa/fs-observation-policy`
- `@lfaa/tool-schedule`
- `@lfaa/message-feedback`
- `@lfaa/attachment-local`
- `@lfaa/session-title`
- `@lfaa/commands`
- `@lfaa/tool-media`
- `@lfaa/system-prompt`
- `@lfaa/sandbox`
- `@lfaa/compaction`

## Dev Note

The Web bundle defines the built-in session presets. Standard includes delegation, Creative focuses on content and artifacts, and Minimal enables lightweight read-only work. PTC remains unavailable until its runtime is integrated.

Standard and Creative include media generation tools. Existing sessions with the original built-in combinations receive the same media capability at runtime.

Every builtin plugin now mounts as a Cordis Loader entry with a stable id, so the settings plugin list reads real Fiber phases and can enable or disable each one. Function-shaped configuration is injected after assembly through service setters (`shell.setResolveInvocation`, `workspace.setProjectDirResolvers`, `tools.setCommandHooks` / `setSandbox`, `jobs.setResolveInvocation`, `agent.setResolveSessionModules`) instead of living in Loader config. Packages that export several plugins ship a default composition bundle, so one entry covers the whole package: `web`, `goal`, `compaction`, `agent-profile`. `@lfaa/sandbox` defaults to the policy plugin alone; the local sandbox stays on the root context.
