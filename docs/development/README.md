# Development documentation

[中文目录](README.zh.md) · [Documentation home](../README.md)

Use this index to find stable development guidance and topic-specific implementation records. Current project facts and rules have one authority: [development rules](../../开发规范.md), [system architecture](../系统总体架构.md), [development plan](../开发计划.md), and [task contracts](../PROMPTS.md). Dated reports record what was implemented and verified at that time; they are historical evidence, not a replacement for those current sources.

## Long-lived guides and current targets

| Topic | Entry | Purpose |
|---|---|---|
| Developer handbook | [English](handbook.md) · [简体中文](handbook.zh.md) | Feature map, ownership, development records and acceptance workflow |
| Contributor workflow | [English](guide.md) · [简体中文](guide.zh.md) | Repository workflow and change boundaries |
| Package ownership and assembly | [English](package-responsibilities.md) · [简体中文](package-responsibilities.zh.md) | Package Owners, application assembly and migration rules |
| Performance and maintainability | [English](performance.md) · [简体中文](performance.zh.md) | Performance, security and maintainability practices |
| File resources | [English](file-resources.md) · [简体中文](file-resources.zh.md) | File/resource behavior and storage requirements |
| Authentication transition | [English](auth-transition-plugins.md) · [简体中文](auth-transition-plugins.zh.md) | Login transition contract and extension guidance |
| Application panels and templates | [English](application-panels-templates.md) · [简体中文](application-panels-templates.zh.md) | Confirmed product direction; does not claim unfinished template runtime is implemented |
| Xiaoyu agent workspace | [English](xiaoyu-agent.md) · [简体中文](xiaoyu-agent.zh.md) | Shared agent workspace development contract |

## Implementation and acceptance records

Each report below is tied to its task and date. Check the current architecture and the linked contract before using implementation details as current behavior.

### Agent and AI Work

- [Agent execution audit (2026-10-21)](agent-execution-audit-20261021.md)
- [Agent task audit and validation (2026-10-14)](agent-execution-validation-20261014.md)
- [Agent file CRUD contract (2026-10-09)](agent-file-crud-20261009.md)
- [Minecraft, Skill and storage repair (2026-10-13)](agent-minecraft-storage-repair-20261013.md)
- [Agent reply handoff (2026-10-09)](agent-reply-handoff-20261009.md)
- [Agent response delivery (2026-10-09)](agent-response-delivery-20261009.md)
- [Agent stream loop repair (2026-10-09)](agent-stream-loop-repair-20261009.md)
- [Run pause and resume (2026-10-10)](ai-run-pause-resume-20261010.md)
- [Run reconnect and loop bounds (2026-10-10)](ai-run-reconnect-loop-bounds-20261010.md)
- [Clarification UI (2026-10-10)](ai-work-clarification-inline-20261010.md)
- [File change review (2026-10-10)](ai-work-file-change-review-20261010.md)
- [Reply process disclosure (2026-10-10)](ai-work-process-disclosure-20261010.md)
- [Reply layout (2026-10-10)](ai-work-reply-layout-20261010.md)
- [SSE request close (2026-10-10)](ai-work-sse-request-close-20261010.md)
- [Streaming caret flicker (2026-10-09)](ai-work-stream-caret-flicker-20261009.md)
- [Streaming render stability (2026-10-10)](ai-work-stream-render-stability-20261010.md)
- [Tool efficiency (2026-10-10)](ai-work-tool-efficiency-20261010.md)
- [General Agent capabilities (2026-10-09)](general-agent-capabilities-20261009.md)
- [General Agent changed-file record (2026-10-09)](general-agent-capabilities-files-20261009.md)
- [Local app intent discovery (2026-10-09)](local-app-intent-discovery-20261009.md)
- [Local computer activity (2026-10-09)](local-computer-activity-20261009.md)
- [Local executable path launch (2026-10-09)](local-executable-path-launch-20261009.md)
- [Local Web computer use (2026-10-09)](local-web-computer-use-20261009.md)
- [Xiaoyu workspace delivery (2026-10-15)](xiaoyu-agent-20261015.md)

### AI video

- [Storyboard canvas MVP (2026-10-10)](ai-video-canvas-mvp-20261010.md)
- [Image generation (2026-10-11)](ai-video-image-generation-20261011.md)
- [Local project files (2026-10-10)](ai-video-local-project-files-20261010.md)

### Application, client and workspace

- [Application panel separation delivery (2026-10-16)](application-panels-20261016.md)
- [Xiaoyu home migration (2026-10-15)](chat-home-20261015.md)
- [Plugin lifecycle and responsive session menu (2026-10-16)](plugin-lifecycle-session-responsive-20261016.md)
- [Workspace review (English, 2026-10-08)](workspace-audit-20261008.md)
- [Workspace review (简体中文，2026-10-08)](workspace-audit-20261008.zh.md)
- [Workspace review changed-file record (2026-10-08)](workspace-audit-files-20261008.md)

### Harness, packages and integrations

- [DSH and LFAA extension audit (2026-10-17)](dsh-lfaa-extension-audit-20261017.md)
- [Ekko capability register](ekko-capability-fusion.md)
- [Ekko coding collaboration core (2026-10-16)](ekko-fusion-core-20261016.md)
- [Harness runtime integration (2026-10-09)](harness-runtime-integration-20261009.md)
- [Harness runtime changed-file record (2026-10-09)](harness-runtime-integration-files-20261009.md)
- [Package ownership and lazy capabilities (2026-10-14)](package-owner-lazy-capabilities-20261014.md)

### Files, storage and writing

- [File manager source comparison (2026-10-13)](file-manager-reference-20261013.md)
- [File resources delivery (2026-10-14)](file-resources-20261014.md)
- [Writing local files (2026-10-10)](writing-local-files-20261010.md)

### Games, runtime and wallpaper

- [Game library and runtime environments (2026-10-14)](game-library-runtime-20261014.md)
- [Manual server and runtime repair (2026-10-14)](runtime-manual-repair-20261014.md)
- [Wallpaper live switch (2026-10-09)](wallpaper-live-switch-20261009.md)
- [Wallpaper request log noise (2026-10-09)](wallpaper-request-log-noise-20261009.md)
