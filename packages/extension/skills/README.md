---
description: "Skill catalogue: built-in skills, on-demand loading, Git installation, and per-project discovery."
kind: "package"
---

# @lfaa/skills

English | [中文](README.zh.md)

## Summary

Skill catalogue: built-in skills, on-demand loading, Git installation, and per-project discovery.

This package lives in `packages/extension/skills`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./contract` | `./lib/types/contract/index.js` | Public contract with no Node or DOM dependency |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/tools`
- `@lfaa/ui-layout`

## Dev Note

None.
