---
description: "Model access layer: provider-neutral streaming, tool calling, and credential handling."
kind: "package"
---

# @lfaa/llm

English | [中文](README.zh.md)

## Summary

Model access layer: provider-neutral streaming, tool calling, and credential handling.

This package lives in `packages/core/llm`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./ark-plan` | `./lib/ark-plan.js` | Ark plan model routing subpath |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

No workspace dependencies.

## Dev Note

None.

Context occupancy uses reported input tokens with a window matched to the actual response model. Anthropic-format input includes uncached tokens, cache creation and cache reads.

Media generation selects configured models by capability. Alibaba Cloud Token Plan and Volcengine Ark Agent Plan use their respective media endpoints and video task formats.

Image edits prioritize clearly applying the requested change, then preserve the referenced subject and unmentioned details. Common appearance requests are expanded into explicit visible targets. Requests for Wan 2.7 omit `prompt_extend`, which that model does not support.
