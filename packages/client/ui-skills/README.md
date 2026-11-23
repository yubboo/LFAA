---
description: "skills browser UI moved out of @lfaa/skills."
kind: "package"
---

# @lfaa/client-ui-skills

English | [中文](README.zh.md)

## Summary

skills browser UI moved out of @lfaa/skills.

Location: `packages/client/ui-skills`.

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

Rendering and client-side state live under `client/`; the capability package `@lfaa/skills` keeps the host side only.
