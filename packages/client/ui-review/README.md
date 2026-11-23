---
description: "code review browser UI moved out of @lfaa/review."
kind: "package"
---

# @lfaa/client-ui-review

English | [中文](README.zh.md)

## Summary

code review browser UI moved out of @lfaa/review.

Location: `packages/client/ui-review`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@lfaa/chat`
- `@lfaa/ui-primitives`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/review` keeps the host side only.
