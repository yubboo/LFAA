---
description: "LFAA group-chat UI (browser half): the Group workbench view, speaker-plan composer cards and the group API client."
kind: "package"
---

# @lfaa/client-ui-agent-group

English | [中文](README.zh.md)

## Summary

Group-chat browser UI, split out of `@lfaa/agent-group` so the capability package stays React-free: the workbench `group` view, its speaker-plan composer and the `/api/group` client.

Location: `packages/client/ui-agent-group`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared view id and types only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@deepseek-ai/cordis`
- `@lfaa/ui-layout`
- `react`
- `@tabler/icons-react`

## Dev note

All rendering and client-side state live under `client/`; the capability package owns orchestration and persistence.