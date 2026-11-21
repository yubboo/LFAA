---
description: "Chat workbench: sessions, streaming runs, the composer, the right-hand workbench, and the settings surfaces."
kind: "package"
---

# @lfaa/chat

English | [中文](README.zh.md)

## Summary

Chat workbench: sessions, streaming runs, the composer, the right-hand workbench, and the settings surfaces.

The conversation view keeps streaming text and expandable activity together. The trace view lists recorded session steps and their available details; the workspace overview links to Git changes and reports tracked line changes relative to HEAD.

This package lives in `packages/core/chat`.

## Exports

| Entry | Target | Purpose |
|---|---|---|
| `.` | `./lib/index.js` | Host entry (default-exports the plugin) |
| `./src/*` | `./src/*` | Source escape hatch for this repository's tooling |
| `./client` | `./client/index.tsx` | Browser entry consumed by Vite |
| `./package.json` | `./package.json` | Package manifest |

## Dependencies

- `@lfaa/browser`
- `@lfaa/llm`
- `@lfaa/metrics`
- `@lfaa/settings`
- `@lfaa/memory`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`

## Dev Note

The composer saves the session mode with an empty chat and locks it after the first message. Completed activities stay in the conversation. A tool's View button selects that step in Trace, and file change rows open the file preview. The overview and Git review use tracked line counts relative to HEAD.

Each streaming activity segment keeps its own row as it changes from thinking to tool results. The composer links to the saved changes for the current reply. Turn and workspace Git changes expand beneath their file rows. The composer also supports persisted clarification questions and answers.

The composer sends descriptions for selected media models directly to generation. Generated images can be downloaded, referenced as thumbnails, or regenerated when their original settings are available. Skipping a clarification dismisses it for the current browser session and preserves the draft.
Images attached to direct image-generation requests remain linked to the user's message and are restored in chat history after reload. Quoted session images and image attachments sent to a chat model are recorded on the user's message as well.
