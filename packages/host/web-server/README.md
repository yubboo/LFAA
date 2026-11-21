---
description: "Host service: assembles the Cordis runtime and every HTTP API, serving Vite in development and built web assets in production."
kind: "host"
---

# @lfaa/web-server

English | [中文](README.zh.md)

## Summary

Host service: assembles the Cordis runtime and every HTTP API, serving Vite in development and built web assets in production.

This host service package lives in `packages/host/web-server`.

## Exports

| Export | Purpose |
|---|---|
| `startWeb(options)` | Development entry: starts Vite and mounts the same `/api` gateway plus token injection |
| `startHostServer(options)` | Production entry: assembles the runtime, serves built assets, returns a local URL for `loadURL` |
| `startStaticServer(options)` | Serves assets only (inject a fake gateway to unit-test without a runtime) |
| `createHostRuntime(options)` | Assembles sandbox, bundle, handlers and gateway, and mints the one-shot API token |
| `resolveLoaderBaseUrl()` | Resolves the Cordis Loader base (`@lfaa/bundle-web` manifest) |
| `detectProjectRoot(startDir)` | Walks up to the repository root in development; production callers must pass an explicit working root |

## Module layout

| File | Responsibility |
|---|---|
| `src/runtime.ts` | Runtime assembly and the gateway route table (order is dispatch order) |
| `src/handlers.ts` | Common API handlers plus workspace-root and media allowlist resolvers |
| `src/handlers-chat.ts` | Chat, coding sessions, direct media generation and Agent run handlers |
| `src/dev-server.ts` | Vite dev server (`vite` is imported dynamically; production bundles omit it) |
| `src/static-server.ts` | Production server lifecycle and `/api` dispatch |
| `src/static-files.ts` | MIME, path-traversal guard, Range, SPA fallback and response helpers |

## Runtime boundaries

- The API token is random per start: injected into `index.html` in development and into an in-memory template in production. Clients read `meta[name=lfaa-api-token]` and send `x-lfaa-token`.
- Production hosting accepts only `GET` / `HEAD`; `/api` never falls back to HTML. `assets/` is long-cached, pages are `no-store`.
- Single-range `Range` (206) is supported because video seeking depends on it.

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

The host validates generated-image references against the current conversation and its media directories. Direct generation and regeneration share the session lock with Agent runs.