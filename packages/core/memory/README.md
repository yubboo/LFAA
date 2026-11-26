---
description: "Short-term session trajectories, long-term recall, and library assets."
kind: "package"
---

# @lfaa/memory

English | [中文](README.zh.md)

## Summary

Short-term session trajectories, long-term recall, and library assets.

This package lives in `packages/core/memory`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/session`
- `@lfaa/storage`

## Dev Note

Long-term memory is a single readable `long-term-memory.json` in the data root. Entries carry `kind` (preference / fact / decision / pitfall / convention) and `scope` (global / project / team / session); legacy entries are upgraded on read with `kind=fact` and default lifecycle fields.

Writes are serialized through an in-process queue and committed with an atomic temp-file rename, so a parent agent and parallel subagents can write at the same time without losing entries. Reads reload when the file mtime changes, which also covers another LFAA process writing the same vault.

Recall ranks by BM25 over CJK bi-grams, scope weight, 30-day recency decay, hit count and confidence, then truncates by an entry limit and a character budget. Entries above the configured cap are moved to `long-term-memory.archive.json` instead of being deleted. Behaviour switches (auto extraction, cap, recall budget) live in `~/.lfaa/memory-settings.json`.

Session records keep image attachment references with their user messages; attachment bytes remain in the session-scoped attachment store.
