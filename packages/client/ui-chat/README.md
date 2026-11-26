---
description: "chat workspace browser UI moved out of @lfaa/chat."
kind: "package"
---

# @lfaa/client-ui-chat

English | [中文](README.zh.md)

## Summary

chat workspace browser UI moved out of @lfaa/chat.

Location: `packages/client/ui-chat`.

## Exports

| Subpath | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host half: shared entry id only |
| `./src/*` | `./src/*` | Source escape hatch, repo tooling only |
| `./client` | `./client/index.tsx` | Browser entry, mounted by `apps/web` |
| `./package.json` | `./package.json` | Manifest |

## Dependencies

- `@lfaa/client-ui-browser`
- `@lfaa/client-ui-tool-media`
- `@lfaa/llm`
- `@lfaa/memory`
- `@lfaa/metrics`
- `@lfaa/ui-icons`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`
- `@deepseek-ai/cordis`
- `@tabler/icons-react`
- `react`
- `react-dom`

## Dev note

Rendering and client-side state live under `client/`; the capability package `@lfaa/chat` keeps the host side only.

The workbench opens explicit browser previews and displays live browser activity, scoped verification results, and available screenshots.

The memory settings tab filters by kind and keyword, edits content and kind in place, and reports active / superseded / archived counts; deletion lives in its own danger group at the end of the page.

Composer image attachments open a preview sized to about 70% of the screen (fit with margins, plus 1:1 and zoom controls that stay sharp when scaled up), expose copy / save / remove in their right-click menu, and the last insertion can be undone with Ctrl+Z before the draft text changes.
