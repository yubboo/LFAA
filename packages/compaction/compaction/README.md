---
description: "Compaction domain: the replaceable context-compaction service, tool-result pruning, and the /compact command."
kind: "package"
---

# @lfaa/compaction

English | [中文](README.zh.md)

## Summary

Compaction domain: the replaceable context-compaction service, tool-result pruning, and the /compact command.

This package lives in `packages/compaction/compaction`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/context`
- `@lfaa/llm`
- `@lfaa/tools`

## Dev Note

None.
