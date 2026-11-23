---
description: "agents browser UI moved out of @lfaa/agent-profile."
kind: "package"
---

# @lfaa/client-ui-agent-profile

English | [中文](README.zh.md)

## Summary

agents browser UI moved out of @lfaa/agent-profile.

Location: `packages/client/ui-agent-profile`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/agent-profile` keeps the host side only.
