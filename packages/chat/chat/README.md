---
description: "Chat workbench: sessions, streaming runs, the composer, the right-hand workbench, and the settings surfaces."
kind: "package"
---

# @lfaa/chat

English | [中文](README.zh.md)

## Summary

Chat workbench: sessions, streaming runs, the composer, the right-hand workbench, and the settings surfaces.

This package lives in `packages/chat/chat`.

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
- `@lfaa/ui-icons`
- `@lfaa/ui-layout`
- `@lfaa/ui-primitives`
- `@lfaa/tool-media`

## Dev Note

The composer saves the session mode with an empty chat and locks it after the first message. Completed activities stay in the conversation. A tool's View button selects that step in Trace, and file change rows open the file preview. The overview and Git review use tracked line counts relative to HEAD.

Each streaming activity segment keeps its own row as it changes from thinking to tool results. The composer links to the saved changes for the current reply. Turn and workspace Git changes expand beneath their file rows. The composer also supports persisted clarification questions and answers.

Multi-step turns summarize their real actions in order with a dot between them, such as "Ran command · Read 2 files", instead of an "N steps" placeholder. Single steps name their object the same way ("Read · pom.xml"), running steps only report the progressive state, and failed steps fall back to a neutral action name.

The composer sends descriptions for selected media models directly to generation. Generated images can be downloaded, referenced as thumbnails, or regenerated when their original settings are available. Skipping a clarification dismisses it for the current browser session and preserves the draft.

A goal strip above the composer shows the latest active or blocked goal for the session and lets the user edit its objective text; completion status stays Agent-owned and completed goals are hidden.
Images attached to direct image-generation requests remain linked to the user's message and are restored in chat history after reload. Quoted session images and image attachments sent to a chat model are recorded on the user's message as well.
