# LFAA 仓库目录说明书

> 本文件由 `pnpm map:sync`（[scripts/gen-repository-map.mjs](../../scripts/gen-repository-map.mjs)）按真实文件系统生成，**不要手改**。
> 骨架发生变化（新增/删除/移动文件、包或目录）后，必须在同一轮运行 `pnpm map:sync` 并提交，否则 `pnpm check` 会失败。

当前快照：**69 个包、3219 个文件、551 个子目录**（不含 node_modules、构建产物与运行数据）。

## 1. 快速索引

| 想找什么 | 从哪里看 |
| --- | --- |
| Windows 菜单与本地启动 | [lfaa.bat](../../lfaa.bat) → [lfaa.ps1](../../scripts/lfaa.ps1) → [ensure-dependencies.mjs](../../scripts/ensure-dependencies.mjs) |
| Web 服务的 Host 装配 | [runtime.ts](../../packages/host/web-server/src/runtime.ts) → [static-server.ts](../../packages/host/web-server/src/static-server.ts) → [index.ts](../../packages/bundle/web/src/index.ts) |
| Web 前端入口与插件装配 | [index.html](../../apps/web/index.html) → [main.tsx](../../apps/web/src/main.tsx) |
| 四栏 Shell 与工作台服务 | [WorkbenchShell.tsx](../../packages/ui/layout/client/shell/WorkbenchShell.tsx) → [workbench-service.ts](../../packages/ui/layout/client/workbench-service.ts) |
| 聊天工作区与状态机 | [ChatWorkspace.tsx](../../packages/client/ui-chat/client/conversation/ChatWorkspace.tsx) → [chat-store.ts](../../packages/client/ui-chat/client/store/chat-store.ts) → [useChatComposer.ts](../../packages/client/ui-chat/client/composer/useChatComposer.ts) |
| Agent 任务循环与工具 | [agent-loop.ts](../../packages/core/agent/src/run/agent-loop.ts) → [index.ts](../../packages/core/tools/src/index.ts) → [index.ts](../../packages/core/llm/src/index.ts) |
| 插件生命周期与来源安装 | [plugin-manager.ts](../../packages/extension/plugins/src/manager/plugin-manager.ts) → [install-external.ts](../../packages/extension/plugins/src/manager/install-external.ts) → [fork-plugin.ts](../../packages/extension/plugins/src/manager/fork-plugin.ts) |
| 项目、分区与工作树 | [index.ts](../../packages/workspace/workspace/src/index.ts) → [index.ts](../../packages/workspace/sections/src/index.ts) → [index.ts](../../packages/workspace/worktree/src/index.ts) |
| 主题与共享控件 | [index.tsx](../../packages/ui/theme/client/index.tsx) → [index.tsx](../../packages/ui/primitives/client/index.tsx) |
| 仓库门禁与探针 | [check-workspace.mjs](../../scripts/check-workspace.mjs) → [check-logs.mjs](../../scripts/check-logs.mjs) → [probe-boot.mjs](../../scripts/probe-boot.mjs) → [verify-web.mts](../../scripts/verify-web.mts) |

## 2. 项目总览

### 2.1 目录树

目录后标注其下文件数；包目录标注包名。完整文件清单见第 3 节。

```text
lfaa/
├── .agent/  (141 个文件)
│   └── skills/  (141 个文件)
│       ├── antfu/  (6 个文件)
│       │   └── references/  (5 个文件)
│       ├── design-taste-frontend/  (37 个文件)
│       │   ├── library/  (2 个文件)
│       │   ├── references/  (22 个文件)
│       │   └── scripts/  (12 个文件)
│       ├── frontend-design/  (2 个文件)
│       ├── impeccable/  (61 个文件)
│       │   ├── reference/  (50 个文件)
│       │   │   └── degraded/  (5 个文件)
│       │   └── scripts/  (10 个文件)
│       ├── taste-skill/  (34 个文件)
│       │   ├── assets/  (6 个文件)
│       │   │   └── scenes/  (2 个文件)
│       │   ├── evals/  (1 个文件)
│       │   ├── library/  (9 个文件)
│       │   ├── references/  (11 个文件)
│       │   └── scripts/  (5 个文件)
│       └── ui-screenshot/  (1 个文件)
├── .githooks/  (1 个文件)
├── .github/  (1 个文件)
│   └── workflows/  (1 个文件)
├── .workbuddy/  (1 个文件)
│   └── memory/  (1 个文件)
├── Python/  (1 个文件)
├── apps/  (40 个文件)
│   ├── cli/  (3 个文件)
│   │   └── src/  (1 个文件)
│   ├── desktop/  (21 个文件)
│   │   ├── resources/  (1 个文件)
│   │   ├── scripts/  (5 个文件)
│   │   └── src/  (10 个文件)
│   ├── desktop-host/  (5 个文件)
│   │   └── src/  (1 个文件)
│   └── web/  (10 个文件)
│       ├── public/  (2 个文件)
│       └── src/  (3 个文件)
├── docs/  (596 个文件)
│   ├── architecture/  (11 个文件)
│   ├── dev-log/  (5 个文件)
│   ├── features/  (34 个文件)
│   ├── plans/  (32 个文件)
│   ├── standards/  (4 个文件)
│   ├── templates/  (2 个文件)
│   └── updata-log/  (506 个文件)
├── packages/  (2372 个文件)
│   ├── api/  (7 个文件)
│   │   └── gateway/  # @lfaa/api-gateway  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── attachment/  (9 个文件)
│   │   └── attachment-local/  # @lfaa/attachment-local  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── bundle/  (8 个文件)
│   │   └── web/  # @lfaa/bundle-web  (8 个文件)
│   │       ├── src/  (2 个文件)
│   │       └── tests/  (1 个文件)
│   ├── chat/  (35 个文件)
│   │   ├── chat/  # @lfaa/chat  (14 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── library/  # @lfaa/library  (6 个文件)
│   │   │   └── src/  (1 个文件)
│   │   └── review/  # @lfaa/review  (15 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (7 个文件)
│   │       └── tests/  (1 个文件)
│   ├── client/  (687 个文件)
│   │   ├── ui-agent-group/  # @lfaa/client-ui-agent-group  (13 个文件)
│   │   │   ├── client/  (7 个文件)
│   │   │   │   ├── group/  (1 个文件)
│   │   │   │   └── view/  (3 个文件)
│   │   │   └── src/  (1 个文件)
│   │   ├── ui-agent-profile/  # @lfaa/client-ui-agent-profile  (16 个文件)
│   │   │   ├── client/  (10 个文件)
│   │   │   │   ├── agents/  (2 个文件)
│   │   │   │   ├── editor/  (2 个文件)
│   │   │   │   └── view/  (3 个文件)
│   │   │   └── src/  (1 个文件)
│   │   ├── ui-browser/  # @lfaa/client-ui-browser  (34 个文件)
│   │   │   ├── client/  (27 个文件)
│   │   │   │   ├── api/  (3 个文件)
│   │   │   │   ├── downloads/  (2 个文件)
│   │   │   │   ├── panes/  (13 个文件)
│   │   │   │   └── settings/  (7 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── ui-canvas/  # @lfaa/client-ui-canvas  (71 个文件)
│   │   │   ├── client/  (62 个文件)
│   │   │   │   ├── api/  (1 个文件)
│   │   │   │   ├── canvas/  (41 个文件)
│   │   │   │   ├── previs/  (6 个文件)
│   │   │   │   └── projects/  (11 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── ui-chat/  # @lfaa/client-ui-chat  (359 个文件)
│   │   │   ├── client/  (288 个文件)
│   │   │   │   ├── composer/  (49 个文件)
│   │   │   │   ├── conversation/  (76 个文件)
│   │   │   │   ├── models/  (16 个文件)
│   │   │   │   ├── session/  (19 个文件)
│   │   │   │   ├── settings/  (16 个文件)
│   │   │   │   ├── shared/  (6 个文件)
│   │   │   │   ├── store/  (20 个文件)
│   │   │   │   └── workbench/  (77 个文件)
│   │   │   │       └── pane/  (4 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (65 个文件)
│   │   ├── ui-connectors/  # @lfaa/client-ui-connectors  (26 个文件)
│   │   │   ├── client/  (20 个文件)
│   │   │   │   ├── api/  (2 个文件)
│   │   │   │   ├── connectors/  (12 个文件)
│   │   │   │   └── mcp/  (3 个文件)
│   │   │   └── src/  (1 个文件)
│   │   ├── ui-library/  # @lfaa/client-ui-library  (22 个文件)
│   │   │   ├── client/  (13 个文件)
│   │   │   │   ├── settings/  (2 个文件)
│   │   │   │   └── views/  (9 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── ui-plugins/  # @lfaa/client-ui-plugins  (20 个文件)
│   │   │   ├── client/  (14 个文件)
│   │   │   │   ├── api/  (1 个文件)
│   │   │   │   ├── components/  (5 个文件)
│   │   │   │   ├── inventory/  (4 个文件)
│   │   │   │   └── stream/  (1 个文件)
│   │   │   └── src/  (1 个文件)
│   │   ├── ui-review/  # @lfaa/client-ui-review  (16 个文件)
│   │   │   ├── client/  (9 个文件)
│   │   │   │   ├── settings/  (3 个文件)
│   │   │   │   └── views/  (4 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── ui-sections/  # @lfaa/client-ui-sections  (15 个文件)
│   │   │   ├── client/  (8 个文件)
│   │   │   │   ├── components/  (4 个文件)
│   │   │   │   └── store/  (1 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── ui-skills/  # @lfaa/client-ui-skills  (12 个文件)
│   │   │   ├── client/  (6 个文件)
│   │   │   │   ├── skills/  (1 个文件)
│   │   │   │   └── view/  (2 个文件)
│   │   │   └── src/  (1 个文件)
│   │   ├── ui-terminal/  # @lfaa/client-ui-terminal  (11 个文件)
│   │   │   ├── client/  (5 个文件)
│   │   │   └── src/  (1 个文件)
│   │   ├── ui-tool-media/  # @lfaa/client-ui-tool-media  (33 个文件)
│   │   │   ├── client/  (20 个文件)
│   │   │   │   ├── compose/  (6 个文件)
│   │   │   │   ├── library/  (4 个文件)
│   │   │   │   ├── media/  (4 个文件)
│   │   │   │   └── thumbs/  (3 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (7 个文件)
│   │   └── ui-workspace/  # @lfaa/client-ui-workspace  (39 个文件)
│   │       ├── client/  (32 个文件)
│   │       │   ├── project/  (21 个文件)
│   │       │   ├── shared/  (2 个文件)
│   │       │   ├── store/  (2 个文件)
│   │       │   └── worktree/  (4 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── compaction/  (14 个文件)
│   │   └── compaction/  # @lfaa/compaction  (14 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (4 个文件)
│   │       └── tests/  (3 个文件)
│   ├── core/  (369 个文件)
│   │   ├── agent/  # @lfaa/agent  (84 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (51 个文件)
│   │   │   │   ├── context/  (4 个文件)
│   │   │   │   ├── run/  (35 个文件)
│   │   │   │   └── tools/  (5 个文件)
│   │   │   └── tests/  (26 个文件)
│   │   ├── agent-group/  # @lfaa/agent-group  (12 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── agent-profile/  # @lfaa/agent-profile  (20 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (9 个文件)
│   │   │   └── tests/  (4 个文件)
│   │   ├── browser/  # @lfaa/browser  (39 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (28 个文件)
│   │   │   │   ├── downloads/  (5 个文件)
│   │   │   │   ├── session/  (10 个文件)
│   │   │   │   ├── settings/  (6 个文件)
│   │   │   │   ├── snapshot/  (1 个文件)
│   │   │   │   └── tools/  (2 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   ├── context/  # @lfaa/context  (8 个文件)
│   │   │   ├── src/  (2 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── crew/  # @lfaa/crew  (16 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (5 个文件)
│   │   │   └── tests/  (4 个文件)
│   │   ├── fs/  # @lfaa/fs  (9 个文件)
│   │   │   ├── src/  (3 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── guard/  # @lfaa/guard  (11 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   ├── jobs/  # @lfaa/jobs  (12 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── llm/  # @lfaa/llm  (35 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (18 个文件)
│   │   │   │   ├── adapters/  (4 个文件)
│   │   │   │   └── media/  (4 个文件)
│   │   │   └── tests/  (9 个文件)
│   │   ├── memory/  # @lfaa/memory  (18 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (8 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── metrics/  # @lfaa/metrics  (12 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── rules/  # @lfaa/rules  (11 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (3 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── session/  # @lfaa/session  (13 个文件)
│   │   │   ├── src/  (6 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   ├── settings/  # @lfaa/settings  (9 个文件)
│   │   │   ├── src/  (3 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── storage/  # @lfaa/storage  (11 个文件)
│   │   │   ├── src/  (5 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── subagent/  # @lfaa/subagent  (15 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (6 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   ├── system-prompt/  # @lfaa/system-prompt  (9 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── tool-todo/  # @lfaa/tool-todo  (9 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   └── tools/  # @lfaa/tools  (16 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (7 个文件)
│   │       └── tests/  (2 个文件)
│   ├── extension/  (725 个文件)
│   │   ├── connectors/  # @lfaa/connectors  (23 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (13 个文件)
│   │   │   │   └── catalog/  (4 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── mcp/  # @lfaa/mcp  (17 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (6 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   ├── plugins/  # @lfaa/plugins  (32 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (17 个文件)
│   │   │   │   ├── catalog/  (6 个文件)
│   │   │   │   ├── inventory/  (1 个文件)
│   │   │   │   ├── manager/  (8 个文件)
│   │   │   │   └── routes/  (1 个文件)
│   │   │   └── tests/  (6 个文件)
│   │   └── skills/  # @lfaa/skills  (653 个文件)
│   │       ├── contract/  (1 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (643 个文件)
│   │       │   └── builtin-skills/  (639 个文件)
│   │       │       ├── agent-browser/  (1 个文件)
│   │       │       ├── animate/  (2 个文件)
│   │       │       ├── animate-expo/  (2 个文件)
│   │       │       ├── animation-performance/  (1 个文件)
│   │       │       ├── animation-vocabulary/  (1 个文件)
│   │       │       ├── apple-design/  (1 个文件)
│   │       │       ├── ask-sonner/  (2 个文件)
│   │       │       ├── baseline-ui/  (1 个文件)
│   │       │       ├── break-ui/  (2 个文件)
│   │       │       ├── choreograph/  (2 个文件)
│   │       │       ├── code-review/  (5 个文件)
│   │       │       │   └── references/  (4 个文件)
│   │       │       ├── component-canvas/  (1 个文件)
│   │       │       ├── create-canvas/  (1 个文件)
│   │       │       ├── create-design-md/  (1 个文件)
│   │       │       ├── device-frames/  (1 个文件)
│   │       │       ├── dimensional-drawing/  (3 个文件)
│   │       │       │   └── examples/  (2 个文件)
│   │       │       ├── dimensional-drawing-motion/  (8 个文件)
│   │       │       │   ├── adapters/  (5 个文件)
│   │       │       │   │   └── headless/  (4 个文件)
│   │       │       │   └── templates/  (2 个文件)
│   │       │       ├── emil-design-eng/  (1 个文件)
│   │       │       ├── find-animation-opportunities/  (1 个文件)
│   │       │       ├── find-skills/  (1 个文件)
│   │       │       ├── fixing-accessibility/  (1 个文件)
│   │       │       ├── fixing-metadata/  (1 个文件)
│   │       │       ├── gestures/  (1 个文件)
│   │       │       ├── impeccable/  (67 个文件)
│   │       │       │   ├── agents/  (6 个文件)
│   │       │       │   ├── reference/  (50 个文件)
│   │       │       │   │   └── degraded/  (5 个文件)
│   │       │       │   └── scripts/  (10 个文件)
│   │       │       ├── improve-animations/  (3 个文件)
│   │       │       ├── improve-ui/  (3 个文件)
│   │       │       │   ├── agents/  (1 个文件)
│   │       │       │   └── references/  (1 个文件)
│   │       │       ├── ios-design/  (20 个文件)
│   │       │       │   ├── agents/  (1 个文件)
│   │       │       │   ├── reference/  (9 个文件)
│   │       │       │   ├── references/  (3 个文件)
│   │       │       │   └── scripts/  (1 个文件)
│   │       │       ├── learn-taste/  (1 个文件)
│   │       │       ├── lfaa-skill-creator/  (1 个文件)
│   │       │       ├── media-use/  (78 个文件)
│   │       │       │   ├── audio/  (47 个文件)
│   │       │       │   │   ├── assets/  (21 个文件)
│   │       │       │   │   │   └── sfx/  (21 个文件)
│   │       │       │   │   ├── references/  (10 个文件)
│   │       │       │   │   │   └── captions/  (3 个文件)
│   │       │       │   │   └── scripts/  (16 个文件)
│   │       │       │   ├── luts/  (2 个文件)
│   │       │       │   ├── references/  (13 个文件)
│   │       │       │   └── scripts/  (14 个文件)
│   │       │       ├── minecraft-plugin-dev/  (1 个文件)
│   │       │       ├── mobile-native/  (1 个文件)
│   │       │       ├── pick-ui-library/  (1 个文件)
│   │       │       ├── prototype/  (2 个文件)
│   │       │       ├── remove-animations/  (1 个文件)
│   │       │       ├── review-animations/  (2 个文件)
│   │       │       ├── stageshow/  (372 个文件)
│   │       │       │   ├── assets/  (1 个文件)
│   │       │       │   ├── examples/  (155 个文件)
│   │       │       │   │   ├── ai-cards/  (2 个文件)
│   │       │       │   │   ├── ai-chat/  (2 个文件)
│   │       │       │   │   ├── annotations/  (4 个文件)
│   │       │       │   │   ├── backgrounds/  (2 个文件)
│   │       │       │   │   ├── bento/  (2 个文件)
│   │       │       │   │   ├── brand-marks/  (2 个文件)
│   │       │       │   │   ├── buttons/  (2 个文件)
│   │       │       │   │   ├── calendar/  (2 个文件)
│   │       │       │   │   ├── cards/  (2 个文件)
│   │       │       │   │   ├── chart-scrub/  (2 个文件)
│   │       │       │   │   ├── choreography/  (2 个文件)
│   │       │       │   │   ├── chrome/  (2 个文件)
│   │       │       │   │   ├── close-up/  (2 个文件)
│   │       │       │   │   ├── controls/  (2 个文件)
│   │       │       │   │   ├── corner-chip/  (2 个文件)
│   │       │       │   │   ├── cursor-morph/  (4 个文件)
│   │       │       │   │   ├── cursor-resize/  (2 个文件)
│   │       │       │   │   ├── cursors/  (2 个文件)
│   │       │       │   │   ├── dark-bento/  (2 个文件)
│   │       │       │   │   ├── dark-hero/  (2 个文件)
│   │       │       │   │   ├── device-pair/  (2 个文件)
│   │       │       │   │   ├── dynamic-island/  (2 个文件)
│   │       │       │   │   ├── excel/  (2 个文件)
│   │       │       │   │   ├── fade-crop/  (2 个文件)
│   │       │       │   │   ├── figma/  (2 个文件)
│   │       │       │   │   ├── finder/  (2 个文件)
│   │       │       │   │   ├── finder-glass/  (2 个文件)
│   │       │       │   │   ├── form-error/  (2 个文件)
│   │       │       │   │   ├── freeform-drag/  (2 个文件)
│   │       │       │   │   ├── glass/  (2 个文件)
│   │       │       │   │   ├── gmail/  (2 个文件)
│   │       │       │   │   ├── google-calendar/  (2 个文件)
│   │       │       │   │   ├── google-docs/  (2 个文件)
│   │       │       │   │   ├── hero-demo/  (4 个文件)
│   │       │       │   │   ├── hero-grid/  (2 个文件)
│   │       │       │   │   ├── imessage/  (2 个文件)
│   │       │       │   │   ├── kit-extras/  (2 个文件)
│   │       │       │   │   ├── linear/  (2 个文件)
│   │       │       │   │   ├── loading/  (2 个文件)
│   │       │       │   │   ├── looks/  (7 个文件)
│   │       │       │   │   ├── many-of-one/  (2 个文件)
│   │       │       │   │   ├── messages/  (2 个文件)
│   │       │       │   │   ├── monochrome/  (2 个文件)
│   │       │       │   │   ├── notion/  (2 个文件)
│   │       │       │   │   ├── opposite-corners/  (2 个文件)
│   │       │       │   │   ├── overlap/  (2 个文件)
│   │       │       │   │   ├── panel-annotation/  (2 个文件)
│   │       │       │   │   ├── parts/  (2 个文件)
│   │       │       │   │   ├── payout-flow/  (2 个文件)
│   │       │       │   │   ├── phone-touch/  (2 个文件)
│   │       │       │   │   ├── phones/  (1 个文件)
│   │       │       │   │   ├── powerpoint/  (2 个文件)
│   │       │       │   │   ├── presence/  (2 个文件)
│   │       │       │   │   ├── raycast/  (2 个文件)
│   │       │       │   │   ├── reorder/  (2 个文件)
│   │       │       │   │   ├── ruled-bento/  (2 个文件)
│   │       │       │   │   ├── share/  (2 个文件)
│   │       │       │   │   ├── slack/  (2 个文件)
│   │       │       │   │   ├── spotify/  (2 个文件)
│   │       │       │   │   ├── stacked-cards/  (2 个文件)
│   │       │       │   │   ├── staggered-bento/  (2 个文件)
│   │       │       │   │   ├── static-card/  (2 个文件)
│   │       │       │   │   ├── story/  (2 个文件)
│   │       │       │   │   ├── subscriptions/  (2 个文件)
│   │       │       │   │   ├── swipe/  (2 个文件)
│   │       │       │   │   ├── table-edit/  (2 个文件)
│   │       │       │   │   ├── telegram/  (2 个文件)
│   │       │       │   │   ├── tilted-stack/  (2 个文件)
│   │       │       │   │   ├── upload/  (2 个文件)
│   │       │       │   │   ├── wikipedia/  (5 个文件)
│   │       │       │   │   └── window-row/  (2 个文件)
│   │       │       │   ├── kit/  (155 个文件)
│   │       │       │   │   ├── brands/  (50 个文件)
│   │       │       │   │   ├── controls/  (17 个文件)
│   │       │       │   │   ├── motion/  (27 个文件)
│   │       │       │   │   └── parts/  (33 个文件)
│   │       │       │   ├── playground/  (10 个文件)
│   │       │       │   ├── references/  (15 个文件)
│   │       │       │   ├── scripts/  (12 个文件)
│   │       │       │   └── teaching/  (18 个文件)
│   │       │       ├── ui-measure/  (2 个文件)
│   │       │       │   └── references/  (1 个文件)
│   │       │       ├── ui-taste/  (26 个文件)
│   │       │       │   ├── agents/  (1 个文件)
│   │       │       │   ├── reference/  (15 个文件)
│   │       │       │   ├── references/  (3 个文件)
│   │       │       │   └── scripts/  (1 个文件)
│   │       │       ├── unslop/  (16 个文件)
│   │       │       │   ├── agents/  (1 个文件)
│   │       │       │   ├── references/  (11 个文件)
│   │       │       │   │   └── refs/  (5 个文件)
│   │       │       │   └── scripts/  (3 个文件)
│   │       │       └── write-swift/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── feedback/  (9 个文件)
│   │   └── message-feedback/  # @lfaa/message-feedback  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── fs/  (9 个文件)
│   │   └── fs-observation-policy/  # @lfaa/fs-observation-policy  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── goal/  (14 个文件)
│   │   └── goal/  # @lfaa/goal  (14 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (4 个文件)
│   │       │   └── tool/  (1 个文件)
│   │       └── tests/  (3 个文件)
│   ├── guard/  (9 个文件)
│   │   └── timeout-policy/  # @lfaa/timeout-policy  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── host/  (35 个文件)
│   │   ├── terminal/  # @lfaa/terminal  (12 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   └── web-server/  # @lfaa/web-server  (23 个文件)
│   │       ├── src/  (14 个文件)
│   │       │   ├── handlers/  (6 个文件)
│   │       │   └── trash/  (1 个文件)
│   │       └── tests/  (4 个文件)
│   ├── interaction/  (9 个文件)
│   │   └── commands/  # @lfaa/commands  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── media/  (41 个文件)
│   │   ├── canvas/  # @lfaa/canvas  (21 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (6 个文件)
│   │   │   └── tests/  (6 个文件)
│   │   └── tool-media/  # @lfaa/tool-media  (20 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (6 个文件)
│   │       └── tests/  (7 个文件)
│   ├── plan/  (10 个文件)
│   │   └── plan-mode/  # @lfaa/plan-mode  (10 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (2 个文件)
│   ├── sandbox/  (16 个文件)
│   │   └── sandbox/  # @lfaa/sandbox  (16 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (5 个文件)
│   │       │   └── local/  (2 个文件)
│   │       └── tests/  (4 个文件)
│   ├── schedule/  (9 个文件)
│   │   └── tool-schedule/  # @lfaa/tool-schedule  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── session/  (22 个文件)
│   │   ├── handoff/  # @lfaa/handoff  (13 个文件)
│   │   │   ├── locale/  (2 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   │   └── tool/  (1 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   └── session-title/  # @lfaa/session-title  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── shell/  (13 个文件)
│   │   └── shell/  # @lfaa/shell  (13 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (4 个文件)
│   │       │   ├── bash/  (1 个文件)
│   │       │   ├── env/  (1 个文件)
│   │       │   └── pwsh/  (1 个文件)
│   │       └── tests/  (2 个文件)
│   ├── spill/  (9 个文件)
│   │   └── spill-local/  # @lfaa/spill-local  (9 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── ui/  (246 个文件)
│   │   ├── icons/  # @lfaa/ui-icons  (15 个文件)
│   │   │   ├── LICENSES/  (1 个文件)
│   │   │   ├── client/  (4 个文件)
│   │   │   ├── contract/  (2 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── layout/  # @lfaa/ui-layout  (115 个文件)
│   │   │   ├── client/  (86 个文件)
│   │   │   │   ├── navigation/  (31 个文件)
│   │   │   │   ├── panels/  (15 个文件)
│   │   │   │   └── shell/  (32 个文件)
│   │   │   ├── contract/  (3 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (19 个文件)
│   │   ├── primitives/  # @lfaa/ui-primitives  (51 个文件)
│   │   │   ├── client/  (38 个文件)
│   │   │   │   ├── base/  (7 个文件)
│   │   │   │   └── settings/  (6 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (5 个文件)
│   │   └── theme/  # @lfaa/ui-theme  (65 个文件)
│   │       ├── client/  (48 个文件)
│   │       │   ├── assets/  (18 个文件)
│   │       │   │   └── backgrounds/  (18 个文件)
│   │       │   └── components/  (23 个文件)
│   │       ├── contract/  (1 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (9 个文件)
│   ├── web/  (16 个文件)
│   │   └── web/  # @lfaa/web  (16 个文件)
│   │       ├── locale/  (2 个文件)
│   │       ├── src/  (5 个文件)
│   │       │   ├── fetch/  (1 个文件)
│   │       │   └── tool/  (2 个文件)
│   │       └── tests/  (4 个文件)
│   └── workspace/  (50 个文件)
│       ├── sections/  # @lfaa/sections  (12 个文件)
│       │   ├── contract/  (1 个文件)
│       │   ├── locale/  (2 个文件)
│       │   └── src/  (3 个文件)
│       ├── workspace/  # @lfaa/workspace  (22 个文件)
│       │   ├── contract/  (1 个文件)
│       │   ├── locale/  (2 个文件)
│       │   ├── src/  (11 个文件)
│       │   └── tests/  (2 个文件)
│       └── worktree/  # @lfaa/worktree  (16 个文件)
│           ├── contract/  (1 个文件)
│           ├── locale/  (2 个文件)
│           ├── src/  (5 个文件)
│           └── tests/  (2 个文件)
├── patches/  (1 个文件)
├── scripts/  (38 个文件)
└── vendor/  (14 个文件)
    └── loader/  (13 个文件)
        └── src/  (9 个文件)
            └── config/  (6 个文件)
# .editorconfig
# .gitattributes
# .gitignore
# AGENTS.md
# README.md
# lfaa.bat
# package.json
# pnpm-lock.yaml
# pnpm-workspace.yaml
# tsconfig.base.json
# tsconfig.host.json
# tsconfig.json
# tsdown.config.ts
```

### 2.2 包清单

| 分组 | 包名 | 路径 | 职责 |
| --- | --- | --- | --- |
| api | `@lfaa/api-gateway` | `packages/api/gateway` | LFAA 接口边界：集中登记与派发 Host HTTP 路由，替代散落在各处的路由注册。 |
| attachment | `@lfaa/attachment-local` | `packages/attachment/attachment-local` | LFAA 会话附件本机存储：附件字节落到 ~/.lfaa/attachments/<session>/，并提供列出/读取工具。 |
| bundle | `@lfaa/bundle-web` | `packages/bundle/web` | LFAA Web 装配包：按 Cordis 约定把 Host 基础能力与 Loader 组合成一个可装载的 bundle。 |
| chat | `@lfaa/chat` | `packages/chat/chat` | LFAA 核心聊天与 Agent 工作台业务包，提供会话管理、流式思考/行动/检查步骤可视化与模型规则设置界面。 |
| chat | `@lfaa/library` | `packages/chat/library` | LFAA 资料库功能包：图像/资产/记忆分类浏览、右栏检视器与存储位置设置。 |
| chat | `@lfaa/review` | `packages/chat/review` | LFAA 代码审查功能包：内置 Git 变更操作、编码设置与代码审查工作台，含审查报告 Host 服务。 |
| client | `@lfaa/client-ui-agent-group` | `packages/client/ui-agent-group` | LFAA 群聊界面（浏览器半）：工作台 Group 视图、发言编排卡片与群聊接口客户端。 |
| client | `@lfaa/client-ui-agent-profile` | `packages/client/ui-agent-profile` | LFAA agent 定义与模型绑定：持久化可添加的 agent、路由组与其默认绑定，供会话与派发层读取。（浏览器半，已从 @lfaa/agent-profile 拆出）。 |
| client | `@lfaa/client-ui-browser` | `packages/client/ui-browser` | LFAA 内置浏览器服务与可视化控制面板：遵循 DSH browser-use 独占注册契约，基于 playwright-core 复用本机 Edge/Chrome 驱动。（浏览器半，已从 @lfaa/browser 拆出）。 |
| client | `@lfaa/client-ui-canvas` | `packages/client/ui-canvas` |  |
| client | `@lfaa/client-ui-chat` | `packages/client/ui-chat` | LFAA 核心聊天与 Agent 工作台业务包，提供会话管理、流式思考/行动/检查步骤可视化与模型规则设置界面。（浏览器半，已从 @lfaa/chat 拆出）。 |
| client | `@lfaa/client-ui-connectors` | `packages/client/ui-connectors` |  |
| client | `@lfaa/client-ui-library` | `packages/client/ui-library` | LFAA 资料库功能包：图像/资产/记忆分类浏览、右栏检视器与存储位置设置。（浏览器半，已从 @lfaa/library 拆出）。 |
| client | `@lfaa/client-ui-plugins` | `packages/client/ui-plugins` | plugins（浏览器半，已从 @lfaa/plugins 拆出）。 |
| client | `@lfaa/client-ui-review` | `packages/client/ui-review` | LFAA 代码审查功能包：内置 Git 变更操作、编码设置与代码审查工作台，含审查报告 Host 服务。（浏览器半，已从 @lfaa/review 拆出）。 |
| client | `@lfaa/client-ui-sections` | `packages/client/ui-sections` | LFAA 工作区自定义分区管理包，提供 Host 分区持久化服务、HTTP RPC 与侧栏分区交互 UI 插件。（浏览器半，已从 @lfaa/sections 拆出）。 |
| client | `@lfaa/client-ui-skills` | `packages/client/ui-skills` | skills（浏览器半，已从 @lfaa/skills 拆出）。 |
| client | `@lfaa/client-ui-terminal` | `packages/client/ui-terminal` | LFAA 真实终端界面：xterm.js 渲染、WebSocket 输入输出、尺寸自适应与主题适配。 |
| client | `@lfaa/client-ui-tool-media` | `packages/client/ui-tool-media` | LFAA 媒体生成工具：调用套餐里的生图模型生成图片，保存到工作区并返回文件路径。（浏览器半，已从 @lfaa/tool-media 拆出）。 |
| client | `@lfaa/client-ui-workspace` | `packages/client/ui-workspace` | LFAA 工作区与本地项目插件包，提供 Host 服务契约与 Client 侧栏/工作区/右侧上下文面板贡献。（浏览器半，已从 @lfaa/workspace 拆出）。 |
| compaction | `@lfaa/compaction` | `packages/compaction/compaction` | LFAA 上下文治理包：可替换的上下文压缩服务、单条工具结果精简与 /compact 命令。 |
| core | `@lfaa/agent` | `packages/core/agent` | LFAA Agent 任务循环引擎，聚合 LLM 大脑、工具手脚、记忆与规则四大能力执行 Think -> Act -> Check 闭环。 |
| core | `@lfaa/agent-group` | `packages/core/agent-group` | LFAA 群聊编排：把一条消息展开成按序的多个 agent 发言，共享同一份会话历史。 |
| core | `@lfaa/agent-profile` | `packages/core/agent-profile` | LFAA agent 定义与模型绑定：持久化可添加的 agent、路由组与其默认绑定，供会话与派发层读取。 |
| core | `@lfaa/browser` | `packages/core/browser` | LFAA 内置浏览器服务与可视化控制面板：遵循 DSH browser-use 独占注册契约，基于 playwright-core 复用本机 Edge/Chrome 驱动。 |
| core | `@lfaa/context` | `packages/core/context` | LFAA 上下文预算与压缩：按字符预算压缩早期工具结果、保留最近轮次，并识别上下文超限错误（参考 DSH context 包的独立职责）。 |
| core | `@lfaa/crew` | `packages/core/crew` | LFAA 多 Agent 任务编排包：按 Task 契约串行接力子智能体，交接前做结构验收并沉淀运行期记忆。 |
| core | `@lfaa/fs` | `packages/core/fs` | LFAA 工作区文件系统边界：安全路径解析、私有路径过滤与忽略目录遍历，供工具与运行时复用。 |
| core | `@lfaa/guard` | `packages/core/guard` | LFAA 命令安全与超时策略：拦截引用应用私有文件的命令、记录命令审计、归一化前台命令时限（参考 DSH guard 包的独立职责）。 |
| core | `@lfaa/jobs` | `packages/core/jobs` | LFAA 会话隔离后台任务管理器：支持后台命令启动、实时日志流解码、状态查询与进程树终止。 |
| core | `@lfaa/llm` | `packages/core/llm` | LFAA Agent 核心大脑能力包，提供多提供商大模型接入、流式推理、Tool Calling 与安全凭据管理。 |
| core | `@lfaa/memory` | `packages/core/memory` | LFAA Agent 核心记忆能力包，管理短期会话轨迹持久化、上下文窗口裁剪摘要与长期记忆检索。 |
| core | `@lfaa/metrics` | `packages/core/metrics` | LFAA 运行指标与成本：token 密度估算、按单价换算人民币成本、会话统计聚合（参考 DSH token-meter / session-stats 的包设计，独立实现）。 |
| core | `@lfaa/rules` | `packages/core/rules` | LFAA Agent 核心规则包，分层管理不可覆盖的系统规则、项目级规则（AGENTS.md / .lfaa/rules.md）与用户全局规则。 |
| core | `@lfaa/session` | `packages/core/session` | LFAA 会话领域：消息/步骤/指标契约、本地会话文件读写、标题生成与历史摘要。 |
| core | `@lfaa/settings` | `packages/core/settings` | LFAA 持久化设置：常规偏好与编码（Git/代码审查）配置的读取、归一化与写入，存于 ~/.lfaa。 |
| core | `@lfaa/storage` | `packages/core/storage` | LFAA 资料库与存储：数据根路径、资产/产物保存读取、资料库布局与跨目录迁移。 |
| core | `@lfaa/subagent` | `packages/core/subagent` | LFAA 进程内子智能体与多 Agent 并发协作引擎：隔离上下文循环、只读/读写授权边界、并发限流及消息通信。 |
| core | `@lfaa/system-prompt` | `packages/core/system-prompt` | LFAA 系统提示词分段服务：插件注册段落，Agent 在组装系统提示时统一合并。 |
| core | `@lfaa/tool-todo` | `packages/core/tool-todo` | LFAA 待办清单工具包：为智能体提供创建、更新与查询任务清单的工具。 |
| core | `@lfaa/tools` | `packages/core/tools` | LFAA Agent 核心手脚能力包，提供可插拔工具注册表、工作区路径沙箱与内置文件/检索/命令工具。 |
| extension | `@lfaa/connectors` | `packages/extension/connectors` |  |
| extension | `@lfaa/mcp` | `packages/extension/mcp` |  |
| extension | `@lfaa/plugins` | `packages/extension/plugins` |  |
| extension | `@lfaa/skills` | `packages/extension/skills` |  |
| feedback | `@lfaa/message-feedback` | `packages/feedback/message-feedback` | LFAA 消息反馈服务：持久化对助手回复的赞/踩与备注，供聊天界面记录与回读。 |
| fs | `@lfaa/fs-observation-policy` | `packages/fs/fs-observation-policy` | LFAA 写前必读策略：写文件或改文件之前，同一会话必须先读取过该文件。 |
| goal | `@lfaa/goal` | `packages/goal/goal` | LFAA 目标服务：把会话目标、进度与受阻原因持久化，供目标工具与界面读取。 |
| guard | `@lfaa/timeout-policy` | `packages/guard/timeout-policy` | LFAA 工具超时策略：为每次工具执行套统一超时，超时中止信号并返回可读结果。 |
| host | `@lfaa/terminal` | `packages/host/terminal` | LFAA Host 真实终端服务：基于 node-pty 的会话管理、窗口尺寸同步与 WebSocket 双向流。 |
| host | `@lfaa/web-server` | `packages/host/web-server` | LFAA Web 宿主服务：装配运行时与全部 HTTP 接口，开发态托管 Vite、生产态托管 Web 产物。 |
| interaction | `@lfaa/commands` | `packages/interaction/commands` | LFAA 斜杠命令注册 seam：插件注册命令，聊天输入栏通过 /api/commands 发现并执行。 |
| media | `@lfaa/canvas` | `packages/media/canvas` |  |
| media | `@lfaa/tool-media` | `packages/media/tool-media` | LFAA 媒体生成工具：调用套餐里的生图模型生成图片，保存到工作区并返回文件路径。 |
| plan | `@lfaa/plan-mode` | `packages/plan/plan-mode` | LFAA 计划模式：开启后只允许只读工具，写与执行类工具被中间件拦截。 |
| sandbox | `@lfaa/sandbox` | `packages/sandbox/sandbox` | LFAA 沙箱抽象契约：文件影响模式、沙箱策略与执行前判定接口，不绑定具体后端。 |
| schedule | `@lfaa/tool-schedule` | `packages/schedule/tool-schedule` | LFAA 定时任务工具：持久化一次性/重复任务，提供创建、查看、取消与到期领取。 |
| session | `@lfaa/handoff` | `packages/session/handoff` | LFAA 会话交接：把任务摘要、下一步与目标从一个会话交到另一个会话。 |
| session | `@lfaa/session-title` | `packages/session/session-title` | LFAA 会话标题服务：启发式简洁标题 + 可选模型生成（失败自动回落），供聊天与 Host 接口复用。 |
| shell | `@lfaa/shell` | `packages/shell/shell` | Shell 进程执行、取消及输出收集 |
| spill | `@lfaa/spill-local` | `packages/spill/spill-local` | LFAA 长结果落盘：超长工具输出写入本机文件，只保留首尾窗口与路径回给模型。 |
| ui | `@lfaa/ui-icons` | `packages/ui/icons` | LFAA 共享文件类型图标包：彩色文件/文件夹图标与扩展名映射，供文件树、标签栏、面包屑与变更列表复用。 |
| ui | `@lfaa/ui-layout` | `packages/ui/layout` | LFAA 应用共享四栏可折叠布局契约、侧栏导航、工作区 Shell、Cordis workbench 服务与外观设置。 |
| ui | `@lfaa/ui-primitives` | `packages/ui/primitives` | LFAA 共享交互基础 UI 原语包：统一封装居中弹窗（ModalDialog）、浮层卡片（PopoverCard）与步进滑块弹窗（StepSliderPopover）及统一样式动效。 |
| ui | `@lfaa/ui-theme` | `packages/ui/theme` | LFAA 液态玻璃主题系统与外观设置插件包，提供无 DOM 主题预设契约及 Cordis Client 外观视图贡献。 |
| web | `@lfaa/web` | `packages/web/web` | LFAA 网页能力 seam：按优先级注册抓取实现，供工具与 Agent 统一取正文。 |
| workspace | `@lfaa/sections` | `packages/workspace/sections` | LFAA 工作区自定义分区管理包，提供 Host 分区持久化服务、HTTP RPC 与侧栏分区交互 UI 插件。 |
| workspace | `@lfaa/workspace` | `packages/workspace/workspace` | LFAA 工作区与本地项目插件包，提供 Host 服务契约与 Client 侧栏/工作区/右侧上下文面板贡献。 |
| workspace | `@lfaa/worktree` | `packages/workspace/worktree` | Git 工作树隔离：按会话创建独立检出目录、读取状态并在安全校验后清理。 |

## 3. 文件清单

每条为「文件 — 首行职责注释」。没有首行注释的文件只列文件名，语义由路径承担。

### .githooks

- `pre-commit` — !/bin/sh

### .github/workflows

- `ci.yml` — LFAA 持续集成：在 Windows runner 上跑完整门禁。

### apps

- `README.md` — 应用入口

### apps/cli

- `package.json`
- `tsconfig.json`

### apps/cli/src

- `bin.ts` — 解析 LFAA 启动目标并负责在退出信号到来时关闭 Web 服务。

### apps/desktop

- `README.md` — LFAA 桌面端
- `electron-builder.config.mjs` — 桌面安装包配置（electron-builder）：以 apps/desktop 为工程目录，staging 在 .desktop-build/。
- `package.json`
- `tsconfig.json`
- `tsdown.config.mts` — 桌面主进程与 Preload 桥构建：均输出 CJS，规避 Electron 45 Windows ESM 加载器对盘符根 lstat 报 EPERM。

### apps/desktop-host

- `README.md` — LFAA 桌面端宿主
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — 桌面宿主构建：只打包本进程源码；@lfaa/* 保持外部依赖（安装包内由 node_modules 提供）。

### apps/desktop-host/src

- `index.ts` — 桌面端宿主进程：以 Electron 的 Node 模式运行 @lfaa/web-server 生产宿主，并通过 IPC 向 Electron 壳上报地址与退出。

### apps/desktop/resources

- `icon.ico`

### apps/desktop/scripts

- `make-icon.mjs` — 生成桌面端占位图标（256×256，32 位 ICO）：深色圆角底 + 品牌蓝字标。
- `package.mjs` — 桌面安装包构建：全量构建 → 生成 staging（真实文件、无符号链接）→ electron-builder 出 NSIS 安装包。
- `start-diagnostics.mjs` — 桌面端启动失败诊断：识别 Windows 低完整性级别（Low Mandatory Level）与目录 ACL 缺失，避免误走 --no-sandbox。
- `start-diagnostics.test.mjs` — 桌面端启动失败诊断回归测试：覆盖低完整性标记识别、ACL 识别与 --no-sandbox 回退边界。
- `start.mjs` — 启动桌面端：先校验构建产物存在，再在 Windows 下修复低完整性标记/ACL，最后用本机 Electron 打开 apps/desktop。

### apps/desktop/src

- `embedded-browser.ts` — LFAA 桌面端原生内置浏览器管理器：在主窗口右侧挂载 Electron 原生 WebContentsView（GPU 硬件合成、零截图压缩延迟）。
- `host-process.ts` — 桌面宿主子进程：用 Electron 的 Node 模式拉起 apps/desktop-host，经 IPC 获取本机地址并负责优雅退出。
- `log.ts` — 桌面端日志：启动失败、宿主异常与未捕获错误写入 ~/.lfaa/logs/desktop.log，便于用户回传排查。
- `main.ts` — LFAA 桌面端主进程：单实例、拉起桌面宿主子进程、创建主窗口，并在退出时先停宿主再退出。
- `menu.ts` — 安装中文应用菜单：Windows 上菜单缺失会连带 Ctrl+C/V/A 失效，所以编辑角色的快捷键必须显式保留；
- `native-downloads.ts` — Electron 主进程下载适配：暂存来自内置视图的文件，并用桌面宿主私有 IPC 报告下载事件。
- `paths.ts` — 解析桌面端运行路径：开发态指向仓库内产物，安装态指向 resources/app；用户数据仍在 ~/.lfaa。
- `preload.ts` — LFAA 桌面端安全 Preload 桥：仅向渲染进程暴露原生内置浏览器 WebContentsView 的受控 IPC 接口。
- `theme-state.ts` — 桌面端主题持久化与原生标题栏同步：读写 ~/.lfaa/desktop-appearance.json，解决随机端口下 localStorage 丢失与 Windows 标题栏不跟随浅/深色问题。
- `window.ts` — 创建主窗口并施加导航与弹窗安全策略：只允许本机页面内导航，外部链接交给系统浏览器。

### apps/web

- `README.md` — Web 应用
- `index.html` — LFAA Web 文档入口：挂载由 apps/web/src/main.tsx 装配的工作台插件。
- `package.json`
- `tsconfig.json`
- `vite.config.ts` — 配置 Web 开发服务器、React 转换和生产构建。

### apps/web/public

- `favicon.ico`
- `favicon.svg`

### apps/web/src

- `api-auth.ts` — 本机接口令牌注入：Host 把一次性令牌写进页面 meta，这里统一为同源 /api 请求附加请求头。
- `app.css` — Web 页面基线：主题颜色由 Shell 管理，页面铺满浏览器视口。
- `main.tsx` — 创建浏览器 Cordis 上下文，装配共享四栏 Shell、主题外观插件、自定义分区插件与工作区项目插件。

### docs/architecture

- `README.md` — 架构文档索引
- `dependency-rules.json`
- `dsh-package-reuse.md` — DSH 包跨仓库复用评估
- `engineering-foundation.md` — 构建、测试与分包地基（对齐 DSH）
- `overview.md` — 架构基线
- `package-taxonomy.md` — 包分类规范（Package Taxonomy）
- `plugin-model.md` — 插件模型：内置插件 vs 外部插件
- `plugin-runtime.md` — 插件运行时可行性验证
- `repository-map.md` — LFAA 仓库目录说明书
- `shell-runtime.md` — Shell 执行体系
- `structure.md` — 结构法则（Structure）

### docs/standards

- `AI-Agent-Development-Standards.md` — AI Agent 项目工程开发规范
- `dialogs.md` — 弹窗规范（强制）
- `floating-cards.md` — 悬浮卡片规范（强制）
- `settings-ui.md` — 设置中心界面规范（强制）

### docs/templates

- `dev-log.template.md` — DEV-{{ID}}｜{{TASK_TITLE}}
- `updata-log.template.md` — UPDATE-{{ID}}｜{{TASK_TITLE}}

### packages

- `README.zh.md` — 包目录索引

### packages/api/gateway

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/api/gateway/src

- `index.ts` — @lfaa/api-gateway：集中登记并派发 Host HTTP 路由，并提供本机接口的访问令牌校验。

### packages/api/gateway/tests

- `gateway.test.ts` — 验证 @lfaa/api-gateway 的派发顺序、未命中返回 false、异常上抛与本机接口令牌校验。

### packages/attachment/attachment-local

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/attachment/attachment-local/locale

- `en.json`
- `zh.json`

### packages/attachment/attachment-local/src

- `index.ts` — @lfaa/attachment-local：会话附件本机存储。附件字节保存到 ~/.lfaa/attachments/<session>/，元数据存会话索引。

### packages/attachment/attachment-local/tests

- `attachment-local.test.ts` — 验证会话附件：名称/大小校验、落盘与索引、HTTP 分支，以及 list/read 工具端到端。

### packages/bundle/web

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/bundle/web/src

- `index.ts` — @lfaa/bundle-web 装配插件：把 Web Host 的插件改成 Cordis Loader 条目，Loader 与插件管理在这里组合成 bundle。
- `presets.ts` — @lfaa/bundle-web 模式预设：会话插件是从全局插件清单里挑出的子集，模式即该子集的命名组合。

### packages/bundle/web/tests

- `presets.test.ts` — 验证模式预设：会话插件必须是全局清单的子集，未知模式回退标准模式。

### packages/chat/chat

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/chat/chat/locale

- `en.json`
- `zh.json`

### packages/chat/chat/src

- `http-handler.ts` — 为本机 Web 服务提供 /api/chat/* 聊天会话 CRUD 与项目聊天数统计接口。
- `index.ts` — @lfaa/chat Host 侧 Cordis 服务：基于 @lfaa/memory 暴露聊天会话 CRUD、项目维度统计与本机语音转写。
- `session-search.ts` — 本地会话全文搜索：匹配会话标题与消息正文，生成带上下文的片段；不建立额外索引，按需扫描本地记录。
- `speech-service.ts` — 为 Host 侧提供零外网依赖的本机离线 WAV 语音转文字能力（Windows System.Speech SAPI）。

### packages/chat/chat/tests

- `chat-http-worktree.test.ts` — 验证聊天会话接口的工作树绑定：只接受 id、由 Host 解析快照，未知 id 明确拒绝，null 表示解绑。
- `session-search.test.ts` — 验证会话全文搜索：标题/正文命中、大小写不敏感、片段上下文、每会话上限与截断标记。
- `todo-readonly.test.ts` — 验证任务清单只读：HTTP PATCH 带 todos 会被明确拒绝，清单保持 Agent 写入的状态。

### packages/chat/library

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/chat/library/src

- `index.ts` — @lfaa/library 的 Host 侧入口：资料库数据由 @lfaa/memory 的 Host 服务提供，本包只有浏览器端实现。

### packages/chat/review

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/chat/review/locale

- `en.json`
- `zh.json`

### packages/chat/review/src

- `commit-drafts.ts` — Git 提交与 PR 草稿生成：根据仓库快照与用户偏好拼出可编辑的提交消息、PR 标题与正文。
- `git-diff.ts` — Git 差异读取：按文件、暂存区或指定提交返回 diff/stat，并为未跟踪文件补文本预览。
- `git-http-handler.ts` — 为本机 Web 服务提供 /api/chat/coding-settings、/api/git/* 与 /api/code-review/* 内置 Git 与审查接口。
- `git-run.ts` — Git 命令执行与路径/分支名校验：所有 Git 操作共用的最小底座。
- `git-service.ts` — 提供 LFAA 内置 Git 服务：仓储探测、状态与差异读取、分支切换/前缀新建、暂存与提交、PR 草案生成。
- `index.ts` — @lfaa/review Host 侧 Cordis 服务：内置 Git 变更操作、编码设置持久化与代码审查引擎。
- `review-service.ts` — 提供 LFAA 内置代码审查引擎：结合静态/差异规则分析与审查历史持久化（存于 ~/.lfaa/code-reviews.json）。

### packages/chat/review/tests

- `coding-lifecycle.test.ts` — 验证 @lfaa/review 的内置 Git 服务与代码审查引擎完整闭环。

### packages/client/ui-agent-group

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-agent-group/client

- `css-modules.d.ts` — 声明 CSS Modules 类型导出，供 @lfaa/agent-group 浏览器端组件安全导入样式。
- `index.tsx` — @lfaa/agent-group 浏览器端 Cordis 插件：注册群聊视图，卸载时清理贡献。
- `locales.ts` — @lfaa/agent-group 浏览器端中英文文案字典（群聊页）。

### packages/client/ui-agent-group/client/group

- `group-api.ts` — @lfaa/agent-group 浏览器端接口封装：群会话的创建、读取与一轮群聊的启动。

### packages/client/ui-agent-group/client/view

- `Group-Composer.module.css` — @lfaa/agent-group 群聊发送区样式：输入框、@ 成员栏与发送按钮，只消费主题语义变量。
- `Group-View.module.css` — @lfaa/agent-group 群聊页样式：群列表 + 消息流 + 发送区，只消费主题语义变量。
- `Group-View.tsx` — @lfaa/agent-group 群聊页：左侧群列表与建群，右侧消息流与发送框。

### packages/client/ui-agent-group/src

- `index.ts` — @lfaa/client-ui-agent-group 的 Host 半：只放可被两端共享的稳定标识与类型，界面实现见 ./client。

### packages/client/ui-agent-profile

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-agent-profile/client

- `css-modules.d.ts` — 声明 CSS Modules 类型导出，供 @lfaa/agent-profile 浏览器端组件安全导入样式。
- `index.tsx` — @lfaa/agent-profile 浏览器端 Cordis 插件：向 Workbench 注册 Agents 视图，卸载时清理贡献。
- `locales.ts` — @lfaa/agent-profile 浏览器端中英文界面文案字典（Agents 页与会话顶栏共用）。

### packages/client/ui-agent-profile/client/agents

- `agents-api.ts` — @lfaa/agent-profile 浏览器端接口封装：读写 agent 定义、模型绑定与可选模型清单。
- `agents-types.ts` — @lfaa/agent-profile 浏览器端视图模型：只描述界面需要渲染的字段，不依赖 Host 内部类型。

### packages/client/ui-agent-profile/client/editor

- `Agent-Editor.module.css` — @lfaa/agent-profile Agent 编辑卡样式：表单、子卡与操作按钮，只消费主题语义变量。
- `Agent-Editor.tsx` — @lfaa/agent-profile Agent 编辑卡：名称、用途、人设指令、模型绑定与保存/删除。

### packages/client/ui-agent-profile/client/view

- `Agents-Toolbar.tsx` — @lfaa/agent-profile Agents 页工具条：刷新、导出、导入与新建，避免列表页继续膨胀。
- `Agents-View.module.css` — @lfaa/agent-profile Agents 页样式：页头 + agent 列表 + 窄屏适配，只消费主题语义变量。
- `Agents-View.tsx` — @lfaa/agent-profile Agents 页：左侧列出 agent，右侧编辑人设、用途与模型绑定。

### packages/client/ui-agent-profile/src

- `index.ts` — @lfaa/client-ui-agent-profile 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-browser

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-browser/client

- `css-modules.d.ts` — 声明 CSS Modules 模块类型供 TypeScript 检查。
- `index.tsx` — @lfaa/browser/client 浏览器端导出与设置页插件注册。

### packages/client/ui-browser/client/api

- `browser-client.ts` — 封装浏览器面板与设置页共用的 HTTP API 请求辅助函数，支持多标签、动态视口、键鼠穿透与 DevTools 日志。
- `browser-data-client.ts` — 封装浏览器历史、下载记录、密码管理器、联系信息与系统目录选择器的前端 HTTP 客户端。
- `desktop-browser-bridge.ts` — 桌面端原生内置浏览器（Electron WebContentsView）渲染进程桥接探测与类型声明；普通浏览器环境返回 null。

### packages/client/ui-browser/client/downloads

- `DownloadActivity.module.css` — 下载确认沿用 Shell 的颜色与字号，文件名、保存状态和可执行操作按顺序排列。
- `DownloadActivity.tsx` — 右栏与设置共用的下载确认和结果。Host 保留请求状态，视图切换后可继续处理。

### packages/client/ui-browser/client/panes

- `BrowserCanvasViewport.tsx` — 高清低延迟 CDP 画布视口：Canvas + createImageBitmap 双缓冲绘制、非被动滚轮防穿透、单在途背压与完整键鼠直通。
- `BrowserDevToolsDrawer.tsx` — 内置浏览器底部可折叠 DevTools 抽屉：按 Console 与 Network 分页查看页面异常与请求状态。
- `BrowserDeviceBar.module.css` — 内置浏览器响应式设备工具栏样式，全量消费 @lfaa/ui-theme 语义变量。
- `BrowserDeviceBar.tsx` — 内置浏览器响应式设备工具栏：提供常见设备下拉预设、自定义宽高像素输入、横竖屏旋转与缩放比例展示。
- `BrowserTabs.tsx` — 内置浏览器顶部多标签栏：标签切换、关闭与新建；标签数据与激活/关闭操作由父组件传入。
- `BrowserToolbar.tsx` — 内置浏览器工具栏：精简为导航、地址栏、接管开关与「更多（...）」菜单（基于 @lfaa/ui-primitives 的 Base UI DropdownMenu）。
- `BrowserViewport.module.css` — 内置浏览器双引擎视口、设备框、透明防误触护盾、提示胶囊与空白就绪态样式，全量消费 @lfaa/ui-theme 语义变量。
- `BrowserViewport.tsx` — 内置浏览器双引擎视口：保留原生预览，Agent 控制和人工接管时展示宿主协同画面。
- `RightBrowserPane.devtools.module.css` — 内置浏览器 DevTools 抽屉：标签、控制台/网络列表与日志行样式，双主题变量适配。
- `RightBrowserPane.module.css` — 全高全宽内置浏览器容器、多标签栏、工具栏、交互视口与 DevTools 样式，全量使用 @lfaa/ui-theme 语义变量。
- `RightBrowserPane.tsx` — 全高全宽内置浏览器视图：双引擎渲染（可嵌入页默认原生直连，拦截站与 Agent 实操自动切高清 Canvas 协同）。
- `browser-render-mode.ts` — 内置浏览器双引擎模式判定、同源递归防呆、CDP 修饰键掩码与 Base64 帧解码辅助。
- `useBrowserSessionSync.ts` — 内置浏览器宿主同步 Hook：管理 2x 无损 PNG 帧流直通 Canvas、无回环抖动的视口尺寸同步与明暗主题同步。

### packages/client/ui-browser/client/settings

- `Browser-Downloads-Group.tsx` — 设置中心「浏览器」的下载分组：显示生效的下载位置（跟随系统或自定义）、更改目录、恢复默认与下载历史入口。
- `Browser-History-Downloads.tsx` — 浏览器「浏览历史」与「下载历史记录」管理子页：按日期分组、搜索、智能体标识、定位文件与一键清空。
- `Browser-Passwords-Subpage.tsx` — 浏览器「密码管理器」子页：支持密码列表（搜索/添加/查看/删除）与设置页（保存提示、通行密钥、自动登录、CSV 导入导出与清空）。
- `Browser-Settings.module.css` — 浏览器设置页与各管理子页样式：全部消费 @lfaa/ui-theme 语义变量，严禁写死颜色。
- `Browser-Site-Ext-Subpages.tsx` — 浏览器「站点设置」「联系信息」与「扩展程序管理器」三个二级管理子页。
- `Browser-Site-Rules.tsx` — 网站访问与下载权限规则表 + 「浏览器操作权限」独立子页（执行 URL / 下载文件），共享同一份持久化规则。
- `BrowserSettingsView.tsx` — 设置中心「浏览器」主页面：涵盖总控开关、常规与链接打开方式、自动填充与密码、扩展程序、下载、浏览器权限、驱动与开发者完整 CDP 设置。

### packages/client/ui-browser/src

- `index.ts` — @lfaa/client-ui-browser 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-browser/tests

- `browser-render-mode.test.ts` — 验证内置浏览器双引擎模式判定、同源防自嵌套与 CDP 修饰键掩码计算。

### packages/client/ui-canvas

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-canvas/client

- `css-modules.d.ts` — 为无限画布的 CSS Modules 提供浏览器侧类型。
- `index.tsx` — 无限画布客户端通过工作台契约添加可卸载的右侧标签，并向画布透传 workbench 服务以复用项目创建与全屏对话。
- `locales.ts` — 无限画布术语和端口标签，供节点、模板卡片、悬浮控制台、资产库与项目面板消费。

### packages/client/ui-canvas/client/api

- `canvas-api.ts` — 发起受工作台本机令牌保护的画布读写，媒体预览使用已有 URL 鉴权。

### packages/client/ui-canvas/client/canvas

- `Canvas-Bottom-Bar.tsx` — 画布底部居中悬浮控制胶囊：选择/抓手模式、缩放百分比、适应画布、小地图/网格开关与撤销重做。
- `Canvas-Contact-Sheet.tsx` — 九宫格排版：从当前画布选图，按勾选顺序生成一张新的九宫格图片。
- `Canvas-Drawers.module.css` — 资料库、运行历史与全屏 Agent 对话抽屉样式。
- `Canvas-Drawers.tsx` — 浏览器画布资料库、运行历史与全屏 Agent 对话抽屉。
- `Canvas-Edge.tsx` — 自定义画布贝塞尔连线：默认精致细线/虚线，选中或运行态叠加流光脉冲，严格消费主题色变量。
- `Canvas-Editor.tsx` — 沉浸式无限画布编辑器：无顶条浮层布局、5 大模板多卡片弹窗、流光连线、底部控制胶囊与全屏 Agent 对话抽屉。
- `Canvas-Loading-Skeleton.module.css` — 无限画布打开过渡骨架屏样式：纯 GPU transform 扫光与淡点阵底纹，严格消费主题语义变量，适配深浅双主题与减弱动效。
- `Canvas-Loading-Skeleton.tsx` — 无限画布打开过渡骨架屏：淡点阵画布底纹 + 顶/底胶囊与居中三张扫光节点卡片骨架，平滑过渡至真实画布。
- `Canvas-Media-Controls.tsx` — 画布媒体编辑参数控件，按功能显示必要的裁剪框、输出规格、区间或文字。
- `Canvas-Media-Editor.module.css` — 基础媒体编辑面板：预览、参数和输出操作分区，沿用工作台主题。
- `Canvas-Media-Editor.tsx` — 画布媒体编辑器：选择画布素材、预览范围和输出结果，跨来源切换时终止当前处理。
- `Canvas-Menu.module.css` — 浏览器画布菜单沿用通用浮层的双色主题与紧凑行高。
- `Canvas-Menu.tsx` — 浏览器画布的指针菜单：共享节点目录，并把菜单限制在画布可见范围内。
- `Canvas-Template-Options.module.css` — 模板分类展开区域：子模板定位、选取动作与说明气泡。
- `Canvas-Template-Options.tsx` — 空画布分类展开后的模板项，分离应用模板和阅读说明的键盘入口。
- `Canvas-Templates.module.css` — 空画布手势提示、模板叠层及展开菜单，复用工作台双主题令牌。
- `Canvas-Templates.tsx` — 空画布中央引导与 5 大模板分类：点击主卡片后在其上下平滑弹出多张子模板卡片，点击即生成节点流。
- `Canvas-Tool-Catalog.tsx` — 无限画布功能目录，按操作类型搜索并跳转到真实素材处理或画布工具。
- `Canvas-Tool-Panels.tsx` — 画布侧栏的节点索引、模板目录与添加入口，共用现有节点和模板定义。
- `Canvas-Tools-Dialog.tsx` — 画布工具面板：用浏览器原生模态管理焦点、遮罩和 Esc 关闭。
- `Canvas-Tools.module.css` — 左侧工具栏、节点与模板目录、全部功能弹窗，颜色消费 LFAA 双主题令牌。
- `Canvas-Tools.tsx` — 无限画布左侧主工具栏及面板装配，复用资料库、节点、模板与运行命令。
- `Canvas-Top-Bar.module.css` — 画布顶部多画布标签栏样式：对齐参考图「项目名 | 画布 1 | [画布 2 ···] +」布局，全量消费主题语义变量。
- `Canvas-Top-Bar.tsx` — 画布顶部多画布标签栏：支持「< | 项目名 | 画布 1 | [画布 2 ···] + 列表」，··· 菜单含新窗口打开、重命名、复制与删除。
- `Canvas-Viewport.module.css` — React Flow 视口与空画布中央聚光点阵样式：深/浅双主题与壁纸背景模式自适应，严禁写死色值。
- `Canvas-Viewport.tsx` — React Flow 交互视图：拖动期间只更新渲染位置，落点才交给画布文档。
- `Canvas-Workspace.tsx` — 项目画布入口：默认展示「我的项目」创建与管理大厅，新建或选择项目后同步左二栏并自动绑定进入无限画布编辑器。
- `Canvas.module.css` — 沉浸式无限画布主样式：浮层胶囊、精致节点卡片、流光贝塞尔连线与底部控制条，全量使用主题语义变量。
- `Graph-Node.module.css` — 节点卡片与流光贝塞尔连线样式：外置标题栏、悬浮快捷胶囊、空态上传按钮与端口手柄，消费主题语义变量。
- `Graph-Node.tsx` — 节点卡片：外置标题栏、选中顶部悬浮胶囊工具条、空态上传按钮、文本双击编辑与圆形端口连接手柄。
- `Node-Dock.module.css` — 选中节点的底部悬浮生成控制台：严格消费 @lfaa/ui-theme 语义变量，支持明暗双主题。
- `Node-Dock.tsx` — 选中节点的底部悬浮生成控制台：严格还原参考图 8/9 的深色玻璃输入卡片，不挤占画布两侧空间。
- `canvas-clipboard.ts` — 浏览器画布剪贴板读取，只接受画布现有的素材格式与纯文本。
- `canvas-graph-helpers.ts` — 画布连线合法性校验与节点端口辅助函数：供 Canvas-Editor 消费，避免编辑器组件过长。
- `canvas-library-drag.ts` — 画布资料库拖放标记：仅在浏览器识别内部素材拖拽，文件路径留在编辑器内存中。
- `canvas-media-actions.ts` — 画布媒体编辑动作：在浏览器将编辑参数转换为独立的图片、视频或音轨。
- `canvas-media-image.ts` — 画布图像几何与输出：裁剪、转向、缩放、文字和九宫格均从原始像素渲染。
- `canvas-media-video.ts` — 浏览器视频处理：定位采样、画面变换与按音视频轨道导出，退出时释放媒体流。
- `template-catalog.ts` — 无限画布 5 大创作分类及多张子模板卡片预设，点击任一子模板一键生成多节点与连线图。
- `useCanvasDocument.ts` — 保持工作台编辑、宿主持久化和运行轮询各自的状态归属。
- `useCanvasHubActions.ts` — 画布项目大厅操作 Hook：集中处理画布项目重命名、复制、删除（含默认工作区画布独立删除）、移动文件夹以及画布分类文件夹增删改名。

### packages/client/ui-canvas/client/previs

- `Previs-Editor.tsx` — 白模预演编辑器：内置简模、人物走位、相机关键帧与可重复使用的媒体输出。
- `Previs.module.css` — 白模预演工作区布局，以语义主题呈现编辑控件，视口内由 Three.js 渲染。
- `Stage-Viewport.tsx` — 浏览器白模视口：自由机位、轨迹预览，以及选中对象的三轴操作。
- `stage-export.ts` — 在独立渲染画布输出当前静帧或按关键帧播放的真实视频文件。
- `stage-renderer.ts` — Three.js 简模与摄像机渲染。资源由所属视口或导出操作独占和清理。
- `stage-scene.ts` — 纯白模场景初始化与关键帧采样，供实时视口和静帧/短片导出共用。

### packages/client/ui-canvas/client/projects

- `Canvas-Hub-Card-Grid.tsx` — 无限画布「我的项目」网格卡片区：无外框极简缩略图 + 文件夹折耳造型卡片（支持行内改名）+ 下方独立标题/日期 + 右下更多操作触发按钮。
- `Canvas-Hub-Card-Menu.module.css` — 无限画布「我的项目」卡片更多菜单样式：遵循悬浮卡片规范，消费 --popover-* 与语义变量。
- `Canvas-Hub-Card-Menu.tsx` — 无限画布「我的项目」卡片更多操作浮层：支持打开、重命名、修改封面、创建副本、移动至分区与删除项目。
- `Canvas-Hub-Card.module.css` — 无限画布「我的项目」网格卡片样式：无外框极简布局（上方 16:10 满幅缩略图 + 下方独立标题与日期），保留跟随鼠标 1px 流光边框、扫光与悬停缩放。
- `Canvas-Hub-Header.tsx` — 画布项目大厅顶栏：负责面包屑导航、缩放滑块、搜索、排序、视图切换、回收站与「+ 新建」下拉菜单（新建项目 / 新建文件夹）。
- `Canvas-Hub-List.tsx` — 无限画布「我的项目」无边框极简列表视图：默认通透无外框，悬停高亮圆角行并浮现快捷操作与更多菜单。
- `Canvas-Projects-Hub.module.css` — 无限画布「我的项目」入口大厅样式：对齐双主题语义变量与窄栏自适应，严禁写死色值。
- `Canvas-Projects-Hub.tsx` — 无限画布「我的项目」入口大厅：展示已有画布的项目，支持首卡一键快建、顶栏弹窗自定义新建、缩放、搜索、排序、网格/列表切换与卡片更多操作菜单。
- `Canvas-Trash-Modal.module.css` — 无限画布「我的项目」回收站弹窗样式：1:1 对齐参考图（顶栏说明 + 多选卡片网格 + 底栏全选/彻底删除/恢复），全量消费语义变量。
- `Canvas-Trash-Modal.tsx` — 无限画布「我的项目」回收站弹窗：与统一回收站 /api/trash 接口联动，支持勾选恢复与二次确认彻底删除。
- `project-hub-helpers.ts` — 无限画布「我的项目」大厅纯逻辑：合并项目与画布摘要、按关键字筛选、按时间/名称排序与相对时间格式化。

### packages/client/ui-canvas/src

- `index.ts` — 无限画布浏览器包的 Host 占位入口，实际客户端通过 /client 挂载。

### packages/client/ui-canvas/tests

- `canvas-media-image.test.ts` — 浏览器媒体变换的几何测试：在 Node.js 验证裁剪与宫格输出的源像素范围。
- `canvas-node-move.test.ts` — 无限画布节点移动回归测试：在 Node.js 校验多选落点和无变化的拖动事件。
- `project-hub-helpers.test.ts` — 画布项目大厅纯逻辑回归测试：覆盖画布项目过滤、关键字搜索、排序与相对时间格式化。

### packages/client/ui-chat

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-chat/client

- `css-modules.d.ts` — 声明 @lfaa/chat/client 中 CSS Modules 的类型定义。
- `index.tsx` — 导出 @lfaa/chat/client Cordis 插件：装配对话工作区、最近会话来源、右栏工作台与设置中心页面。
- `locales.data.ts` — 管理 @lfaa/chat 浏览器端的纯数据文案表：时间线、活动动词、接入方式、方舟目录与右侧启动页。
- `locales.en.ts` — 管理 @lfaa/chat 浏览器端的英文文案字典。
- `locales.ts` — 管理 @lfaa/chat 浏览器端界面中英文文案字典：聚合数据表与双语字典，并提供按语言取字典的入口。
- `locales.types.ts` — 定义 @lfaa/chat 浏览器端中英文文案字典的共享键集合，供各语言字典与视图索引。
- `locales.zh.ts` — 管理 @lfaa/chat 浏览器端的简体中文文案字典。
- `shortcut-actions.ts` — 会话与右栏的快捷键动作注册：只登记真实可执行的功能；动作与界面按钮共用同一实现，键位由设置中心改写。
- `workbench-provider.tsx` — 聊天工作台提供方：把会话列表、新会话草稿行、行内菜单与项目工作区注入四栏 Shell。

### packages/client/ui-chat/client/composer

- `ChatComposer.tsx` — 聊天输入区：范围/项目栏、@ 提及 / 斜杠命令 / 技能弹层、附件与排队提示、输入框及其工具条、统计栏。
- `ComposerAddMenu.module.css` — 输入栏左下角 + 按钮、悬浮提示（添加文件等内容 @）及「添加上下文」弹层样式。
- `ComposerAddMenu.tsx` — 输入栏左下角「+」按钮与隐藏文件/文件夹选择器：点击直接展开输入框一体化上下文面板，避免悬浮卡片遮挡正文。
- `ComposerAttachmentChip.tsx` — 聊天输入附件：图片显示可点击查看大图的缩略图（右键可复制 / 另存为 / 移除），其他附件保留文件标签。
- `ComposerBottomBar.tsx` — 输入卡片底部工具条：汇总左侧 + 菜单、项目胶囊、权限/技能/插件入口与右侧模型、媒体、发送控件。
- `ComposerCapabilityPanel.module.css` — 输入卡片内联「技能 / 插件」搜索结果面板与底栏触发按钮样式：纯主题语义变量，窄栏自动收起文字。
- `ComposerCapabilityPanel.tsx` — 输入卡片内部一体化的「技能 / 插件」搜索结果面板与底栏触发按钮。
- `ComposerImagePreview.module.css` — 输入区图片大图预览：遮罩全屏、顶部工具条、默认约占屏幕七成的大图与缩放状态；颜色全部取 @lfaa/ui-theme 语义变量。
- `ComposerImagePreview.tsx` — 输入区图片的大图预览：默认约占屏幕七成（四周留白），可缩放到 1:1 或更大；被放大时改用像素化渲染避免发虚。
- `ComposerInputRow.tsx` — 输入卡片正文行：承载输入框与触发词/快捷键处理；行内按钮由底部工具条统一排版。
- `ComposerNotice.tsx` — 输入框上方的上下文提示条：显示一次性提示与关闭按钮。
- `ComposerProjectChip.tsx` — 渲染聊天模式与停靠态输入栏内紧跟 + 按钮右侧的独立项目胶囊，点击开关统一项目选择器。
- `ComposerProjectMenu.tsx` — 项目选择浮层：输入栏项目挂载条与引导区标题里的项目变量共用同一份搜索、项目列表与新建/解绑入口。
- `ComposerQueuePanel.module.css` — 输入区排队消息面板：条数摘要、逐条编辑/删除/立即插话/上移与运行提示。
- `ComposerQueuePanel.tsx` — 输入区排队消息面板：显示排队条数，支持编辑、删除、上移、立即插话发送与清空；并提供运行中提示。
- `ComposerQueueSection.tsx` — 输入栏排队消息区块：集中绑定 store 的排队操作，避免 ChatComposer 继续膨胀。
- `ComposerRightActions.module.css` — 输入栏右下角语音输入（Ctrl+M）、三竖条录音波形、发送与停止（Ctrl+D）按钮及快捷键提示样式。
- `ComposerRightActions.tsx` — 渲染输入栏右下角语音听写、发送与运行中取消按钮及其快捷键提示；组合键由工作台快捷键注册表提供。
- `ComposerScopeBar.module.css` — 聊天输入框上方挂载的工作位置与项目选择条及弹出浮层样式，消费 @lfaa/ui-theme 语义变量兼容明暗主题。
- `ComposerScopeBar.tsx` — 渲染聊天输入框上方的工作位置（此计算机/云端）与项目选择挂载条及搜索弹出浮层。
- `ComposerStats.tsx` — 输入栏底部统计条：上下文用量与本轮文件变更入口，独立于输入框主体。
- `ComposerTriggers.tsx` — 输入框上方三类触发浮层：@ 提及、/ 命令与 $ 技能，保持与原输入框同样的定位与选择行为。
- `MentionPopover.module.css` — 输入框上方 @ 提及与扩展上下文分组列表浮层样式（对应图三至图五）。
- `MentionPopover.tsx` — 渲染输入框上方的 @ 提及浮层，支持「添加 / LFAA 对话 / 插件」分组与键盘上下选择。
- `PermissionModePicker.module.css` — 底部权限模式切换胶囊与三种模式弹出菜单样式（对齐参考图层次与橙色警示态）。
- `PermissionModePicker.tsx` — 渲染输入栏底部的三种 Agent 权限模式切换器（请求批准 / 帮我审批 / 完全访问权限）及说明弹层。
- `Session-Mode.module.css` — 顶栏会话模式胶囊与下拉菜单：与权限模式浮层保持同一套玻璃层次与主题变量。
- `Session-Mode.tsx` — 会话模式选择与锁定展示：渲染在顶栏标题右侧，由 Host 提供可用预设。
- `SessionModeBar.module.css` — 顶栏模式徽标容器：失败时只加一圈提示色，不挤占标题。
- `SessionModeBar.tsx` — 顶栏标题右侧的会话模式徽标：精确切片订阅聊天快照，避免流式正文输出期间随每帧重绘。
- `composer-attachment-undo.ts` — 输入区附件插入历史：记录每次新增附件的批次与当时草稿，供 Ctrl+Z 只撤回「最近一次插入」。
- `composer-attachments.ts` — 输入区附件整理：把粘贴的图片、拖入的文件与绝对路径统一转成 ComposerAttachment，文件会存入会话附件库。
- `composer-capabilities.ts` — 输入栏「技能 / 插件」内联搜索数据与纯逻辑：目录缓存、常用记录、分组筛选与关键词高亮拆分。
- `composer-commands.ts` — 输入栏动作命令总线：语音听写、中止回复与推理强度选择由输入栏组件持有，
- `composer-context.ts` — 管理输入栏附件上下文芯片、@ 提及指令检索提取以及发送前上下文拼装的纯函数（无 DOM 依赖）。
- `composer-draft-memory.ts` — 输入区草稿记忆：按「项目新会话 / 已有会话」保存未发送的文字与附件（含图片文件），
- `composer-image-actions.ts` — 输入区图片附件的复制与另存为：把缩略图背后的原始字节写入剪贴板，或用同源 blob 地址触发浏览器下载。
- `composer-keyboard.ts` — 输入框键盘导航：@ / 斜杠 / 技能三种候选的方向键、Tab/Enter 选中、Esc 关闭，以及回车发送与 Ctrl+Enter 清空排队。
- `composer-paths.ts` — 输入区绝对路径识别：把粘贴或输入的本机绝对路径（Windows 盘符 / UNC / POSIX）识别成文件上下文。
- `composer-project-filter.ts` — 项目选择浮层的过滤规则：按项目名称或本地目录路径做不区分大小写的包含匹配。
- `local-speech.ts` — 在浏览器端通过 Web Audio 采集麦克风音频并编码为 16kHz 单声道 PCM WAV，供 Host 离线语音识别。
- `media-submit.ts` — 媒体直连提交：把输入栏草稿、图片附件与选定画幅整理成生成请求，供选中媒体模型时复用。
- `useCapabilitySearch.ts` — 输入栏「技能 / 插件」内联搜索状态 Hook：独立管理搜索词（不污染原草稿）、键盘上下回车与常用记录。
- `useChatComposer.ts` — 聊天输入栏状态机：草稿、附件、输入框交互与发送（含 /plan、/goal、/review 快捷指令）；@ / 斜杠 / 技能触发见 useComposerTriggers。
- `useComposerDraftMemory.ts` — 输入区草稿记忆接线：按会话/项目分区保存未发送输入，切换时恢复并防止文字串到别的会话。
- `useComposerInput.ts` — 输入框交互 Hook：随内容自动增高，并把粘贴/拖入的图片、文件与绝对路径转成附件。
- `useComposerTriggers.ts` — 输入栏触发层：@ 提及 / 斜杠命令 / 技能三种触发状态、候选列表与选中动作；草稿与发送仍在 useChatComposer。
- `useMediaOptions.ts` — 输入栏的生图选项：画幅与风格，以及发送后把宿主实际采用的比例回写到选择器。
- `useVoiceDictation.ts` — 管理聊天输入栏的语音听写状态与双引擎切换（优先浏览器在线识别，network 失败自动无缝切换本机离线 WAV 转写）。

### packages/client/ui-chat/client/conversation

- `Activity-Path-Tip.module.css` — 活动行路径气泡：文件行、目录行与工具目标共用一套定位、磨砂与浮起动效。
- `Activity-Path-Tip.tsx` — 活动行路径气泡：文件行与目录/工具行共用的唯一实现，悬停时在目标上方浮出完整路径。
- `AssistantTimeline.tsx` — 以正文为自然阶段分界，按「思维链 → 本轮正文 → 工具总菜单」三段顺序渲染流式与完成后的助手回复。
- `Browser-Evidence.tsx` — 在浏览器步骤卡中按需加载已认证的截图证据，关闭预览时释放图片资源。
- `Browser-Screenshot-Gallery.module.css` — 浏览器验收截图画廊样式：参考简洁图集形态，横向排布圆角缩略图，双主题全量消费 @lfaa/ui-theme 语义变量。
- `Browser-Screenshot-Gallery.tsx` — 浏览器验收截图画廊：以「已查看 N 张图像」简洁折叠行呈现横向圆角缩略图网格，点击缩略图可展开清晰大图。
- `Browser-Subagent-Card.module.css` — 思维链中的专属浏览器子智能体实时状态条与可展开步骤卡片，全量消费 @lfaa/ui-theme 语义变量。
- `Browser-Subagent-Card.tsx` — 思维链专属浏览器子智能体卡片：运行中实时显示「正在使用内置浏览器 · 思考中/动作 (Xs)」，支持展开逐条查看浏览器步骤并一键打开右栏。
- `ChatAnchorBar.module.css` — 聊天区左侧导航刻度锚点条样式：Dock 波形悬停放大、液态玻璃预览浮卡与书签高亮。
- `ChatAnchorBar.tsx` — 中央聊天区左侧「导航刻度锚点条」：按对话轮次展示刻度线、悬停波浪放大、预览浮卡、书签标记与点击平滑跳转。
- `ChatDeleteDialog.tsx` — 删除当前对话的二次确认弹窗：说明删除不可恢复，并由调用方执行真正的删除。
- `ChatErrorBanner.module.css` — 输入区上方的错误条：单行文案 + 可选的「用工作树并行」动作；只用 ui-theme 语义变量。
- `ChatErrorBanner.tsx` — 输入区上方的错误条：展示启动失败文案；工作区被占用时提供「用工作树并行」入口。
- `ChatFlowArea.module.css` — 中间对话会话区盒子：唯一滚动视口（跨至面板最底部，让滚动条直通底缘）+ 不遮挡滚动条的底部渐隐。
- `ChatFlowArea.tsx` — 中间对话会话区盒子：整个工作区唯一的滚动视口，底部渐隐画在视口内部，只淡出正文，不外溢到输入区。
- `ChatMessageList.tsx` — 聊天消息区：空会话引导（鱼形图标 / 可点项目变量的标题 / 聊天·工作分段 / 内嵌输入栏 / 统一轻量起步建议）与隔离记忆化的消息线程。
- `ChatMessageRow.tsx` — 单条消息隔离渲染单元：用 React.memo 保护历史消息，在末尾流式输出期间避免整条消息线程重复重绘。
- `ChatSuggestions.tsx` — 三条建议盒子：空会话引导区下方那一行建议，独立成件，改动它不会牵动会话区与输入区。
- `ChatTopBar.module.css` — 中间区域顶栏盒子：对话 / 轨迹切换条。只负责自己这一行的排版，不参与会话区与输入区的布局。
- `ChatTopBar.tsx` — 中间区域顶栏盒子：只管「对话 / 轨迹」两个视图入口与它自己的外壳，位置与会话区、输入区互不影响。
- `ChatWorkspace.attachments.module.css` — 输入区附件行与芯片样式：文件/路径标签、图片缩略图（可点开大图）与移除按钮，双主题变量适配。
- `ChatWorkspace.composer.module.css` — 聊天输入区（上下文提示、输入卡片与工具栏）样式，双主题变量适配；附件芯片样式在 attachments 分册。
- `ChatWorkspace.hero.module.css` — 聊天中心引导区：鱼形图标、标题、聊天/工作分段、内嵌输入栏、统一轻量起步建议与提示。
- `ChatWorkspace.module.css` — 中央核心聊天与 Agent 任务工作区样式，对齐深色炭黑与浅色纯白画布层次。
- `ChatWorkspace.tsx` — 渲染中央聊天工作区：空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏。
- `Clarification-Card.module.css` — 输入区澄清卡：问题、选项和操作分层，窄栏时输入框独占一行。
- `Clarification-Card.tsx` — 在输入框上方收集 Agent 的澄清答复。
- `ComposerDock.module.css` — 输入框大盒子：叠在会话区底缘之上，本体不吃指针（保证右侧直通到底的滚动条全程可悬停可拖），子控件恢复命中。
- `ComposerDock.tsx` — 输入框大盒子：提示条、回到底部、交接条、任务盒子、目标盒子与输入卡片都在这一行里，不再叠在正文上。
- `Conversation-Trace.module.css` — 独立轨迹使用紧凑列表与可关闭详情，适配主题和窄屏。
- `Conversation-Trace.tsx` — 独立展示当前会话的真实消息与 Agent 步骤，实时复用聊天 Store 中的快照。
- `File-Activity-Row.module.css` — 已完成文件活动行样式：动作语义色、彩标气泡芯片、悬停浮泡路径胶囊与柔和气泡弹性动效；全量消费 @lfaa/ui-theme 令牌。
- `File-Activity-Row.tsx` — 已完成文件活动行：以左侧语义图标与动词（已创建/已编辑/已删除/已分析）、彩色文件类型图标芯片、悬停精准路径与真实行号呈现，点击后在右栏展开对应源码。
- `HeroProjectTitle.tsx` — 新会话中心标题：把当前项目名渲染成可点击变量，点击后在标题下方展开项目选择器。
- `MarkdownContent.module.css` — 助手消息富文本 Markdown 排版样式：克制清晰的标题层级、标准列表、表格、语法高亮代码块与行内代码胶囊。
- `MarkdownContent.tsx` — 助手消息富文本 Markdown 渲染组件：提供克制优雅的文档排版、表格、代码块语法高亮与块级流式缓存。
- `MessageActionBars.module.css` — 消息操作栏（复制/评价/朗读/更多菜单/编辑消息）与已编辑文件折叠卡片样式。
- `MessageActionBars.tsx` — 消息操作栏与文件变更汇总卡片：提供用户消息复制/编辑、助手消息复制/评价/朗读/分支与记忆引用菜单及已编辑文件折叠卡片。
- `Step-Detail.module.css` — 步骤详情面板样式：标签页 + 键值行 + 等宽文本块，全部使用主题变量。
- `Step-Detail.tsx` — @lfaa/chat 步骤详情面板：点开某个动作后按「概览 / 参数 / 结果 / 计时」查看留痕，风格与聊天区一致。
- `StepTraceList.approval.module.css` — 待审批工具卡片样式：卡片容器、标题提示、参数块与批准/拒绝按钮，从 StepTraceList.module.css 拆出。
- `StepTraceList.module.css` — 助手状态、交错式工具链、活动折叠行及终端详情样式；全部消费 @lfaa/ui-theme 语义变量。
- `StepTraceList.tsx` — 显示 Agent 运行用时和现有的工具审批操作。
- `Subagent-Dispatch-Row.module.css` — 主聊天区子智能体突出派发提示与连续细竖线子事件流样式，全部消费 @lfaa/ui-theme 语义变量。
- `Subagent-Dispatch-Row.tsx` — 主聊天区子智能体突出派发提示卡：以机器人图标 +「<Role> 开始工作 / 正在工作中」状态条呈现，点击即自动展开右侧对应子智能体工作过程标签。
- `SuggestionChips.module.css` — 追问建议胶囊：圆角浮起、左侧短句、右侧箭头；背景与正文色全部取自主题变量。
- `SuggestionChips.tsx` — 追问建议卡片：与回复同一条消息里给出的下一步短句，点击即以该句作为下一条消息发送。
- `Thinking-Block.module.css` — 思维链块样式：脑形图标 + 状态标题 + 左侧细竖线引导的柔和思考正文，双主题自适应。
- `Thinking-Block.tsx` — 思维链与同轮执行折叠块：以脑形图标、实时状态与左侧细竖线引导呈现本轮思考正文及关联工具链，
- `Tool-Group-Fold.module.css` — 单阶段工具总菜单样式：左侧与正文同列对齐，展开后用细竖线包裹本阶段所有工具明细，双主题自适应。
- `Tool-Group-Fold.tsx` — 单阶段工具总菜单：平时收起为一行简洁动作概括，流式执行时自动展开并在结束后收起，展开后完整平铺原有工具明细行。
- `Tool-Step-Row.module.css` — 活动行展开详情与进行态目标彩标（终端输出、参数/结果预览、轨迹入口）：只服务 Tool-Step-Row。
- `Tool-Step-Row.tsx` — 工具链单行组件：按真实工具类型、文件彩标与执行状态呈现动作、目标参数、耗时与状态，已完成文件行委托 FileActivityRow 呈现。
- `Turn-Changes.tsx` — 右工作台的本轮变更，展示已保存的工具快照及操作顺序。
- `UserMessageAttachments.module.css` — 用户消息图片：图片即卡片，多张时按 2–3 列排开，不留气泡内边距。
- `UserMessageAttachments.tsx` — 渲染已发送用户消息中的图片：上传附件按会话读取附件库，引用图按路径读取会话内生成媒体。
- `WorkspaceDialogs.tsx` — 聊天工作区的会话级弹窗：新建项目对话框与删除会话确认框。
- `activity-label.ts` — 将 Host 的工具步骤转换为聊天活动摘要，保留可区分的动作和状态。
- `advice-options.ts` — 从助手最终回答的「建议/下一步」段落提取可选后续项，供界面编号展示、用户点选发送。
- `chat-scroll-model.ts` — 会话滚动的纯逻辑：贴底判定、scroll 来源分类、跟随开关与滚动记忆存取。
- `code-highlight.tsx` — 为右工作台 VS Code 代码查看器提供多语言词法高亮、嵌套标签/括号彩虹配对着色、语言徽标及面包屑路径解析。
- `markdown-parser.ts` — 轻量流式安全 Markdown 块级解析与代码语法分词器，用于渲染助手消息中的标题、列表、表格、引用与高亮代码块。
- `prior-suggestions.ts` — 历史追问建议前缀：算出「每条消息之前已经出现过哪些建议」，供消息行去重。
- `round-title.ts` — 为思维链每轮折叠块生成动态语义标题与图标类型：跟随本轮最新操作灵活变化，告别写死的「已思考」。
- `suggestion-block.ts` — 解析模型最终答复末尾的追问建议隐藏块：正文照常展示，建议交给按钮卡片渲染。
- `thread-window.ts` — 消息列窗口化的常量与纯计算：阈值、行高估算、开关判定。与 DOM 无关，便于单测。
- `timeline-stages.ts` — 时间线阶段构建器：按 iteration 还原轮次，并以“出现新正文”为自然分界合并连续无正文间隔的工具调用与思考记录。
- `trace-groups.ts` — @lfaa/chat 留痕分组：把步骤按「思考 / 读取 / 搜索 / 命令 / 文件变更 / 其他」归并，供展开区成组展示。
- `use-thread-window.ts` — 消息列窗口化 Hook：封装虚拟化器，只回答「渲染哪一段、每行多高、占位多高」。
- `useBoundedScroll.ts` — 管理任意「限高滚动视口」的滚动与边缘渐隐：内容持续追加时同步贴底，用户上滚阅读时立即暂停跟随，滚回底部自动恢复。
- `useChatLayoutInsets.ts` — 维护会话页两个布局测量值：外层视口预留的滚动条槽（收回）与输入区实际高度（正文让位）。
- `useChatScroll.ts` — 管理聊天视口的贴底跟随与滚动记忆：跟随只在「跟底态」发生，用户一有上滚意图立即交出滚动所有权，
- `useMessageActions.ts` — 消息区交互接线：编辑内容、分叉到新会话、继续中断消息、提问、审批，以及媒体引用的再生成。
- `useMessageFeedback.ts` — 消息反馈 Hook：读取已保存的赞/踩状态，并在切换时立即落盘；失败回滚界面状态。
- `useStarterSuggestions.ts` — 按项目拉取并缓存空会话的起步建议；追问建议不再单独请求，由模型在回复末尾随答案一起给出。
- `workspace-slice.ts` — 聊天区状态切片：只挑中央会话区真正用到的字段，会话列表、提醒、规则等变化不再带动整块聊天区重渲染。

### packages/client/ui-chat/client/models

- `Ark-Models.module.css` — 方舟套餐目录沿用模型表单的主题变量，为窄屏保留可换行的模型 ID。
- `Ark-Models.tsx` — 浏览器端方舟套餐模型目录：仅在已配置凭据时展示；按用途 → 品牌分组，并标注模型能力。
- `ModelProviderFooter.tsx` — 模型配置弹窗底部操作栏：左侧返回与删除，右侧测试连接、保存与保存并启用，窄屏下可分行。
- `ModelProviderForm.tsx` — 模型提供商配置弹窗的表单主体：渲染协议、地址、模型目录、上下文窗口、成本单价与 API Key 字段。
- `ModelProviderGrid.module.css` — 模型管理卡片网格与弹窗表单样式，配合 @lfaa/ui-primitives 居中弹窗使用。
- `ModelProviderGrid.tsx` — 渲染「模型管理」多提供商卡片网格：支持识别已配置状态与当前激活标识，点击任意卡片弹出居中配置弹窗。
- `ModelProviderModal.tsx` — 浏览器端模型配置弹窗：持有表单状态与初始化回填，处理模型同步、保存、测试、删除，并组合表单主体与底部操作栏。
- `ModelReasoningList.tsx` — 模型选择弹层的列表行：渲染可选模型行与已配置品牌卡槽行，复用选择器样式与目录状态文案。
- `ModelReasoningPicker.module.css` — 底部输入栏模型选择与推理强度弹窗组件样式，与 @lfaa/ui-primitives 的 PopoverCard / StepSliderPopover 配合使用。
- `ModelReasoningPicker.tsx` — 浏览器端聊天输入栏的模型选择器，连接当前模型档案、品牌切换和思考强度调节。
- `ModelReasoningTrigger.tsx` — 模型选择器的触发胶囊：分为「未配置模型」与「已选模型」两种展示，弹层由父级控制。
- `Provider-Access.module.css` — 提供商接入方式选择弹窗，复用工作台的浅色和深色主题变量。
- `Provider-Access.tsx` — 浏览器端模型接入选择弹窗，根据品牌套餐目录和已保存档案显示可用入口。
- `model-reasoning-options.ts` — 模型选择器的档位常量与纯计算：解析当前模型档案、可选模型清单、生效模型与推理档位，不涉及 React。
- `provider-catalog.ts` — 定义「模型管理」提供商卡片目录与官方 API 协议格式映射（OpenAI Chat / Responses / Anthropic Messages / Gemini generateContent）。
- `provider-plans.ts` — 定义模型管理中可直接用专属 API Key 接入的官方套餐，供浏览器选择与档案匹配。

### packages/client/ui-chat/client/session

- `GoalBar.module.css` — 输入框上方的目标条：单行、可编辑目标文字；只用 ui-theme 语义变量。
- `GoalBar.tsx` — 输入框上方的目标条：只读展示 Agent 维护的当前目标，允许用户编辑目标文字，完成状态不由界面改。
- `HandoffBar.module.css` — 输入区上方的交接条：单行展示标题与摘要，右侧接手/忽略；只用 ui-theme 语义变量。
- `HandoffBar.tsx` — 输入区上方的交接条：展示一条待接手任务的标题、摘要与来源，提供接手/忽略。
- `SessionActionMenu.module.css` — 聊天会话「⋮」上下文操作菜单样式：自适应深浅主题的毛玻璃弹窗、分隔线、快捷键右对齐与级联子菜单。
- `SessionActionMenu.tsx` — 渲染聊天会话「⋮」完整上下文操作菜单（重命名、置顶、标记未读、项目/分区归属、分叉、分享、复制、新窗口、归档与永久删除）。
- `SessionBars.tsx` — 输入区上方的会话固定条：未完成的任务卡与进行中的目标栏，按视图与状态决定是否占位。
- `SessionHoverCard.module.css` — 聊天会话行右侧悬浮详情卡片样式：自适应深浅主题的毛玻璃容器、所属项目、时间与未读小点。
- `SessionHoverCard.tsx` — 渲染左二聊天会话行悬停时右侧弹出的液态玻璃信息卡片：标题、所属项目、更新时间与未读状态。
- `SessionOverlays.tsx` — 聚合渲染左二聊天会话行的右侧悬浮卡片、操作菜单、重命名/删除确认弹窗与全局快捷键。
- `SessionRowActions.module.css` — 聊天会话行悬停快捷操作图标按钮样式，带圆形背景高亮与置顶强调态。
- `SessionRowActions.tsx` — 渲染左二聊天会话行右侧的三个快捷图标按钮（归档对话、置顶、⋮ 更多操作）。
- `SessionStatsBar.module.css` — 会话状态栏与明细浮层的样式，全部使用主题语义变量以适配深浅色。
- `SessionStatsBar.tsx` — 会话状态栏：显示轮次/步数、token 用量与上下文占用，点击展开明细浮层。
- `SessionSubmenu.tsx` — 会话操作菜单的四个二级面板：项目归属、分区归属、分叉、复制。
- `TodoDock.module.css` — 输入框上方任务卡：浅色/深色都只用 ui-theme 语义变量，避免写死颜色。
- `TodoDock.tsx` — 输入框上方的任务卡：渲染当前清单、递增步骤序号、各状态数量与折叠；没有清单时不占位。
- `session-menu-store.ts` — 管理左二聊天会话行的右侧悬浮信息卡与「⋮」操作菜单状态，支持悬停延迟平滑过渡。
- `session-todos.ts` — 从会话步骤里取最近一次任务清单，并统计各状态数量；供输入框上方的任务卡与活动行复用。

### packages/client/ui-chat/client/settings

- `AgentSettingsView.module.css` — 设置中心「模型与规则」页样式：只保留标签切换与只读规则块；页面骨架、分组与表单字段由 @lfaa/ui-primitives 提供。
- `AgentSettingsView.tsx` — 渲染设置中心「模型与规则」页：模型提供商网格、规则与长期记忆；表单按上下排字段组织，删除动作单独成组。
- `GeneralSettingsGeneralGroup.tsx` — 渲染设置中心「常规」页的主体分组：位置、运行环境、界面、历史与性能、启动与扩展；每组只放同类设置。
- `GeneralSettingsSecondary.tsx` — 渲染设置中心「常规」页下半部分分组：编辑器、Agent 行为、弹出窗口与趣味实验。
- `GeneralSettingsView.overlays.module.css` — 设置中心「常规」页的浮层样式：许可证详情弹窗与庆祝叠层，页面外观由 @lfaa/ui-primitives 的 SettingsSurface 提供。
- `GeneralSettingsView.tsx` — 渲染设置中心「常规」页：权限、常规、编辑器、Agent 行为、弹出窗口与趣味实验分组，以及开源许可证弹窗。
- `MemoryPanel.module.css` — 设置中心记忆面板的局部样式：只补筛选控件宽度，其余沿用设置中心的行式布局与主题变量。
- `MemoryPanel.tsx` — 设置中心「长期记忆」面板：新增、检索筛选、编辑与删除分组，删除固定落在页面最末的危险组。
- `NotificationSettingsGroup.tsx` — 通知设置分组：桌面通知权限、提醒项、提示音选择与自定义音频（删除动作单独成组放最后）。
- `NotificationSettingsView.tsx` — 设置中心「通知」页：装配桌面通知权限、轮次完成/权限/问题提醒、会话状态徽标与提示音。
- `ShortcutsSettingsView.module.css` — 键盘快捷键设置页：搜索框、键位芯片、冲突提示与页级重置按钮的局部样式；颜色一律取主题变量。
- `ShortcutsSettingsView.tsx` — 设置中心「键盘快捷键」页：列出所有已注册的真实动作，支持搜索、录制改键、清除与恢复默认，并提示冲突。
- `TerminalSettingsView.tsx` — 设置中心「终端」页：一行展示位置（右侧面板 / 底部面板），切换后立即生效并记住。
- `coding-settings-client.ts` — 客户端访问「设置 → 编码（Git 与代码审查）」与内置 Git / 审查接口的类型与请求函数。
- `general-settings-client.ts` — 兼容重导出通用设置契约与辅助函数，实体定义统一收敛于 shared/general-settings.ts。
- `memory-view.ts` — 记忆库的纯筛选与展示辅助：供设置中心记忆页与单测共用，不触碰 DOM 与网络。

### packages/client/ui-chat/client/shared

- `agent-workbench-sync.ts` — Agent 步骤到右侧工作台自动跟随动作的纯映射：把浏览器/文件/后台任务/子智能体活动转为右栏自动展开与切页指令。
- `file-activity.ts` — 将本轮文件快照和旧工具参数统一为聊天活动可用的文件定位。
- `general-settings.ts` — 浏览器端通用设置公共契约与默认值：供 store 与 settings 单向共享，打破 store ↔ settings 循环依赖。
- `notification-sound-api.ts` — 自定义提示音接口：上传、列表与删除由 Host 保存在本机，客户端只传文件名、MIME 与 base64 内容。
- `notification-sounds.ts` — 提示音播放层：内置音由 Web Audio 实时合成，自定义音从 Host 读取并解码缓存。
- `notifications.ts` — 浏览器/桌面系统通知策略：统一申请权限、显示桌面通知，并判断「仅在未聚焦时」是否该提醒。

### packages/client/ui-chat/client/store

- `chat-background-runs.ts` — 后台运行与待处理跟踪：维护运行中会话、需要用户确认/回答的会话，并在收尾或升级为待处理时触发通知。
- `chat-data-actions.ts` — 数据动作：资料库与存储、常规设置、模型档案、用户规则与长期记忆的读写。
- `chat-file-actions.ts` — 文件预览与右栏舞台动作：打开/切换/关闭文件标签、右栏面板请求与文件内容读取。
- `chat-http.ts` — 浏览器端聊天操作共用的 JSON HTTP 封装：统一请求头、错误文案与离线提示。
- `chat-preferences.ts` — 聊天偏好本地持久化：活动会话、权限模式与推理档位的 localStorage 读写（受限环境静默降级）。
- `chat-queue.ts` — 排队消息的纯数据操作：新增、删除、上移/下移、编辑与一次性取出全部，便于单测与状态复用。
- `chat-run-actions.ts` — 运行动作：发送消息、SSE 事件归并与断线恢复、审批决策、中止、权限模式与排队消息。
- `chat-session-actions.ts` — 会话动作：新建草稿、打开/删除/分叉/导出会话、改绑项目、会话元信息与默认模式。
- `chat-session-notifier.ts` — 会话通知器：按通用设置决定何时播放提示音、弹桌面通知，并对轮次完成提醒做短时去重。
- `chat-store-bootstrap.ts` — 聊天 Store 的启动与刷新编排：并发拉取会话、模型、规则、记忆、资料库与存储快照，再一次性写入状态。
- `chat-store-data-facade.ts` — 会话数据动作门面：把资料库、存储、模型配置、规则与长期记忆的委托从主 Store 拆出，保持单一职责。
- `chat-store-port.ts` — 聊天 Store 内部端口：核心壳向各动作模块暴露的最小状态与跨模块操作，避免模块互相直接依赖实现。
- `chat-store.ts` — 管理 @lfaa/chat 浏览器端会话列表、流式运行 SSE 订阅、工具审批、权限模式、模型配置、规则与长期记忆状态。
- `chat-types.ts` — 声明 @lfaa/chat/client 浏览器端状态与 API 数据模型（无 Node 专有依赖）。
- `draft-session-exit.ts` — 新会话草稿退场：先给侧栏行打上 draftExiting，让 CSS 收起高度，再由定时器从快照移除。
- `run-media-actions.ts` — 媒体生成动作：画幅计划、参考图上传、生成请求与本地占位插入/移除。
- `run-stream-handler.ts` — 运行事件归并：把 Host 推送的快照、增量、步骤、审批与结束事件写进当前会话，断流时记录降级状态。
- `stream-client.ts` — 浏览器端高可用流式订阅器：提供按片段序号幂等去重、RAF 节流批量渲染、心跳看门狗、指数退避重连与完整句边界续写辅助。
- `use-chat-selector.ts` — 聊天 Store 精确切片订阅 Hook：仅在所选字段实际变化时触发组件重渲染，避免流式增量引起整页陪跑。
- `workbench-persist.ts` — 管理右侧工作台标签页（文件/浏览器/审查/辅助面板/插件标签）、当前舞台、工作区文件树显隐与目录展开状态的浏览器持久化偏好。

### packages/client/ui-chat/client/workbench

- `AgentContextPanel.module.css` — 右侧工作台控制面板与子视图统一样式，全部复用 @lfaa/ui-theme 浅色/深色语义变量。
- `AgentContextPanel.tsx` — 重构后的右侧工作台面板：对齐参考图布局（搜索/URL、6 项入口、子智能体、后台任务）并保留文件标签与工作详情。
- `CodeBreadcrumbBar.tsx` — 代码查看器顶部可点击面包屑导航条与右侧操作栏（更多菜单 5 项、查看差异、刷新、切换文件树侧边栏）。
- `CodeSearchBar.tsx` — 代码查看器内嵌文本搜索栏：支持大小写切换、匹配统计、上一处/下一处跳转定位与快捷键关闭。
- `CodeSyntax.module.css` — 代码查看器多语言词法高亮与嵌套标签/括号 5 色彩虹循环配对着色，明暗双主题高对比度适配。
- `FileChangePreview.comment.module.css` — 代码查看器的行内批注表单（批注框、文本域与操作按钮）样式，双主题变量适配。
- `FileChangePreview.diff.module.css` — 代码查看器的 Diff 分栏视图：左侧修改前、右侧修改后，hunk 头横跨两栏，双主题变量适配。
- `FileChangePreview.module.css` — VS Code 风格全高代码查看器、路径面包屑、行内 + 批注及 Diff 对比样式，双主题变量适配。
- `FileChangePreview.search.module.css` — 代码查看器的内嵌搜索栏、输入框、结果计数与命中高亮样式，双主题变量适配。
- `FileChangePreview.tsx` — VS Code 风格只读代码与 Diff 查看器：支持可点击面包屑、更多菜单 5 项、内嵌搜索、刷新、切换侧栏、精确行定位及行内 + 批注；代码区支持自动换行开关。
- `FullscreenMiniComposer.module.css` — 全屏视图左下角可展开悬浮迷你对话栏样式，全量消费 @lfaa/ui-theme 语义变量。
- `FullscreenMiniComposer.tsx` — 全屏视图左下角悬浮迷你对话栏：点击输入框平滑向上展开，完整复用 AssistantTimeline 流式输出（含思维链、工具活动行、审批与 Markdown），点击外部自动缩小。
- `InlineComment.tsx` — 行内批注框：输入建议并提交到对话输入框；Esc 取消、Ctrl/Cmd+Enter 提交，挂载即聚焦。
- `ProjectWorkspacePane.module.css` — 左二「项目工作区」容器：让文件树填满栏位并自行滚动，外壳不额外加内边距。
- `ProjectWorkspacePane.tsx` — 左二「项目工作区」内容：复用右栏同款工作区文件树，点文件仍由聊天 store 打开到中间工作台。
- `Right-Workbench-Start.module.css` — 右栏启动页：参考 ChatGPT 的空态排版，搜索框 + 分区标题 + 自适应快捷卡片。
- `Right-Workbench-Start.tsx` — 右工作台启动页，复用项目文件、浏览器、历史地址联想和辅助面板入口，适用于空白浏览器标签。
- `RightFileTreePane.module.css` — 右辅助栏 VS Code 风格工作区文件树样式：含树形缩进线、文件类型着色与明暗双主题适配。
- `RightFileTreePane.tsx` — 右辅助栏 VS Code 风格工作区文件树：展示根目录与垂直缩进指引线、文件/目录语义图标、懒加载及双向联动高亮。
- `RightGitReviewPane.module.css` — 右侧 Git 变更列表与本轮变更样式（RightGitReviewPane / Turn-Changes），双主题变量适配。
- `RightGitReviewPane.tsx` — 右侧工作台 Git 变更列表，在文件行下方按需读取并展示真实差异。
- `RightSideAskPane.tsx` — 右栏「侧边提问」面板：在不打断主聊天长流的前提下进行轻量上下文问答。
- `RightSubagentsPane.tsx` — 右栏「子智能体与多 Agent 协作」面板：实时展示子智能体角色、状态、步骤数与输出结论。
- `RightTerminalPane.tsx` — 右栏「终端与后台任务」面板：支持快速发起后台命令、查看实时 stdout/stderr 输出与一键停止进程。
- `RightUtilityRail.module.css` — 最右侧图标轨：从 RightWorkbenchPane.module.css 拆出，独立维护。
- `RightUtilityRail.tsx` — 最右侧垂直图标菜单栏：收纳工作区文件树、工作区上下文、后台任务、子智能体、侧边提问、工作详情与审查/扩展入口。
- `RightWorkbenchActions.module.css` — 右工作台右上角操作按钮组、⋮/概览浮层菜单与嵌入式 Git 审查 Tab 样式，双主题变量适配。
- `RightWorkbenchActions.tsx` — 工作台快捷操作与概览控制：组合顶栏按钮组、“更多”与“概览”两个弹层，并持有菜单状态与任务数据。
- `RightWorkbenchPane.module.css` — IDE 化右侧工作台样式：顶栏与中间栏齐平、全高主舞台、可折叠辅助抽屉及最右图标轨，全量消费 @lfaa/ui-theme 变量。
- `RightWorkbenchPane.tsx` — IDE 化右侧工作台主壳：承接右侧栏状态持久化与请求，装配顶部标签、主体舞台与最右图标轨。
- `Start-Omnibox.module.css` — 启动页地址栏历史联想浮层：遵循悬浮卡片规范的实底叠加、同心圆角与语义令牌。
- `Start-Omnibox.tsx` — 启动页地址栏联想下拉：展示最近访问站点（带图标与标题）与搜索词，支持高亮匹配与逐条删除。
- `Subagent-Stage-View.module.css` — 右侧子智能体流式工作舞台样式：复用主对话视觉层次，全部消费 @lfaa/ui-theme 语义变量。
- `Subagent-Stage-View.tsx` — 右侧子智能体流式工作舞台：通过 /api/subagents/:id/stream 实时订阅并复用 AssistantTimeline 展示思考、工具链、回传提示与追问输入。
- `TerminalDockPane.module.css` — 工作台列内的底部终端：与左右栏统一采用 GPU 预览线拖拽、阻尼渐隐与松手平滑高度落位。
- `TerminalDockPane.tsx` — 底部终端面板：渲染在工作台列内部，位置跟随预览区；采用 GPU 预览线拖拽、阻尼吸附收起与松手平滑落位。
- `TerminalSurface.module.css` — 终端外壳：一行标题栏 + 撑满的终端正文，配色全部走主题变量。
- `TerminalSurface.tsx` — 终端外壳：标题栏带「移到下方 / 移到右栏」切换，正文是真实终端面板；两处位置复用同一组件、同一个 PTY。
- `WorkbenchAuxBody.tsx` — 右侧工作台辅助面板内容：文件树、工作区上下文、终端任务、子智能体、侧边提问与工作详情。
- `WorkbenchAuxPane.tsx` — 右侧工作台辅助面板外壳：宽度拖拽手柄、可折叠抽屉与面板头，内容由调用方渲染。
- `WorkbenchMoreMenu.tsx` — 渲染右侧工作台“更多”菜单：会话重命名、置顶、归档、复制与工作台入口。
- `WorkbenchOverviewMenu.tsx` — 渲染右侧工作台“概览”弹层：变更统计、子智能体与后台任务摘要及快捷入口。
- `WorkbenchStageContent.tsx` — 右侧工作台主体舞台：按当前标签渲染文件预览、工作区/本轮变更、内置浏览器或欢迎页，并组合辅助面板。
- `WorkbenchStatusList.tsx` — 右侧工作台欢迎页的运行状态列表：最近子智能体与后台任务，点击可跳到对应辅助面板。
- `WorkbenchTabMenu.module.css` — 标签右键菜单：固定定位浮层、单项行、键位提示与分隔线；颜色一律走主题变量。
- `WorkbenchTabMenu.tsx` — 右栏标签右键菜单：关闭系列、复制路径/网址与新建标签；快捷键提示取自工作台注册表，不写死。
- `WorkbenchTabs.tsx` — 右侧工作台顶部标签栏：辅助面板、文件预览、子智能体、变更审查与内置浏览器标签，新建按钮固定在行尾。
- `WorkbenchTopActions.tsx` — 渲染右侧工作台顶栏控制按钮组：更多、概览、跟随 Agent、最大化与收起侧面板；提示气泡统一带快捷键徽章。
- `WorkbenchTopBar.module.css` — 右栏全屏顶栏会话切换标签与标签承载区样式，全量消费 @lfaa/ui-theme 变量。
- `WorkbenchTopBar.tsx` — 右栏工作台顶栏：标签区与动作组装进左二栏、中间区同款胶囊，外观只由 @lfaa/ui-primitives 的 CapsuleBar 定义。
- `WorkspaceFileTabs.module.css` — 右栏文件页签和阅读区，沿用工作区主题与操作焦点。
- `WorkspaceFileTabs.tsx` — 在右侧上下文区域承载可切换、可关闭的源文件标签。
- `blank-tab-policy.ts` — 右侧工作台空白标签策略：空态占位「新标签页」何时自动补齐、何时必须让位给真实内容标签。
- `diff-view.ts` — 文件预览 Diff 视图的数据层：把 git 统一 diff 或「修改前/后」片段整理成左右分栏的行模型。
- `file-search-highlight.tsx` — 行内搜索高亮：把一行文本按查询切分并输出带 <mark> 的 React 节点，供文件预览复用。
- `new-tab.ts` — 工作台「新建标签页」动作：快捷键与「+」共用同一份展开 + 建标签语义。
- `start-omnibox-history.ts` — 右工作台启动页地址栏历史记录：合并内置浏览器浏览历史与本地输入记录，提供展示归一化、筛选与行内补全。
- `tab-order.ts` — 右侧工作台标签栏稳定排序纯函数：按真实打开顺序保序，且空白「新标签页」变身为内容标签时原位替换不跳位。
- `terminal-dock.tsx` — 底部终端面板注册：把位置偏好、Shell 底部面板与右栏「终端」标签串起来；失败不连累聊天视图。
- `terminal-placement.ts` — 终端展示位置偏好：右侧工作台标签（默认）或 Shell 底部面板，写入 localStorage 并广播给同页组件。
- `useAuxResize.ts` — 管理右侧辅助栏（工作区文件树 / 上下文 / 任务面板）的实时跟手拖拽调宽与本地偏好持久化。
- `useWorkbenchAuxTabs.ts` — 右侧工作台的辅助面板标签：终端、工作区上下文、侧边提问等各自成为可独立关闭、切换与持久化恢复的标签。
- `useWorkbenchBlankTab.ts` — 右栏空态占位标签的生命周期：面板一个标签都没有时补一个「新标签页」，出现真实内容标签后自动让位。
- `useWorkbenchBrowser.ts` — 右侧工作台内置浏览器状态与宿主操作：标签列表、初始 URL、外部快照与新建/关闭/导航处理。
- `useWorkbenchOpeners.ts` — 右栏打开动作：终端、侧边提问与变更审查标签的统一入口，负责替换空白标签与落位。
- `useWorkbenchRequests.ts` — 右侧工作台面板跳转请求处理：响应聊天消息点击与 Agent 自动跟随事件，统一调度舞台、DevTools 与辅助面板。
- `useWorkbenchSessionState.ts` — 右栏会话状态恢复与持久化：切换会话/刷新挂载时读回浏览器、审查、辅助标签与插件标签（如无限画布），恢复完成后再写回本地偏好。
- `useWorkbenchSubagents.ts` — 管理右侧工作台的子智能体多标签页状态：按需新建、切换、关闭，并与会话汇总状态实时同步。
- `useWorkbenchSummary.ts` — 右侧工作台后台概览轮询：按会话拉取后台任务与子智能体列表；仅在运行中或用户打开对应面板时轮询，空闲零开销。
- `useWorkbenchTabClose.ts` — 右侧工作台标签关闭：仅当关闭最后一个标签且没有任何其它标签（含插件标签如无限画布）时，才收起整个右栏。
- `useWorkbenchTabMenu.ts` — 右栏标签右键菜单与标签级快捷键：统一有序标签列表、当前舞台识别、单个/其他/右侧/全部关闭与前后切换。
- `useWorkbenchTabs.tsx` — 订阅工作台插件标签贡献；同一工作台实例管理它们的打开、切换、持久化恢复与清理。
- `workbench-titles.ts` — 右侧工作台辅助面板标题字典：按语言返回文件树、上下文、终端、子智能体、侧边提问与工作详情标题。

### packages/client/ui-chat/client/workbench/pane

- `PaneActionProps.ts` — 舞台顶栏「动作区」对象装配：把 RightWorkbenchPane 里的 actionProps 大对象搬出来，
- `PaneAuxBody.tsx` — 舞台辅助面板内容入口：把 RightWorkbenchPane 里「组装 WorkbenchAuxBody 的那堆 props」搬出来，
- `PaneStage.tsx` — 舞台主体布局：把 RightWorkbenchPane 里「分割区 + 最右图标轨 + 底部终端坞」这段 JSX 整体搬出，
- `PaneTabProps.ts` — 舞台顶栏「标签区」对象装配：把 RightWorkbenchPane 里的 tabProps 大对象搬出来，

### packages/client/ui-chat/src

- `index.ts` — @lfaa/client-ui-chat 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-chat/tests

- `activity-icon-slot.test.tsx` — 验证同级活动行（工具行 / 文件活动行）都以统一的「图标槽」开头：槽位等宽后，类型图标中心与动词起点才能对齐（开发规范 §3.5）。
- `activity-label.test.ts` — 验证活动与阶段文案：负责人指定的 19 条中文状态短语必须逐条对应真实状态，且不暴露内部工具名。
- `activity-summary.test.ts` — 验证多步活动摘要：用真实动作和对象说明这一轮做了什么，不再出现「N 项操作」这类空话。
- `advice-options.test.ts` — 验证智能追问提取：只从「建议/下一步」段落的列表项生成可选项，普通列表或不足两条时不出选项。
- `agent-workbench-sync.test.ts` — 验证 Agent 步骤到右侧工作台自动跟随动作的映射规则（浏览器、DevTools、文件、后台任务与子智能体）。
- `ark-models.test.tsx` — 验证方舟套餐目录：未配置凭据不显示模型；配置后四类模型统一用 chip，并标记非接口返回的「目录」条目。
- `blank-tab-policy.test.ts` — 右栏空白占位标签策略单测：空面板才补「新标签页」，切到真实内容标签后必须让位。
- `browser-subagent-card.test.tsx` — 验证思维链中专属浏览器子智能体卡片的运行中提示、步骤列表与完成态摘要渲染。
- `chat-anchor-bar.test.ts` — 验证轮次导航刻度滑动窗口：最多 20 根，以当前轮次居中并夹紧边界，保证所有轮次都能通过滚动/点击到达。
- `chat-bottom-hover.test.ts` — 验证中间区四个盒子互不重叠：会话区自己带底部渐隐，输入框单独一行，不再用遮罩盖住正文。
- `chat-error-banner.test.tsx` — 验证错误条：文案常驻，工作区冲突时多出「用工作树并行」入口。
- `chat-lifecycle.test.ts` — 验证 @lfaa/chat Host/Client 双端 Cordis 生命周期、最近会话注入与项目聊天计数统计。
- `chat-queue.test.ts` — 验证排队消息纯操作：新增去空、删除、编辑（空文本删除）、上下移动与队首取出。
- `chat-running-sessions.test.ts` — 验证后台状态机：运行集合去重、待处理徽标增减，以及首屏同步不补发历史通知。
- `chat-scroll-follow.test.ts` — 验证会话滚动所有权：流式贴底写入不得被误判成用户滚动，用户上滚必须立刻拿到控制权。
- `chat-store-actions.test.ts` — 验证聊天 Store 拆分后的动作模块：文件预览/右栏状态、会话草稿与打开、排队追问、偏好与记忆数据写入。
- `composer-attachment-undo.test.ts` — 验证输入区附件插入历史：Ctrl+Z 只撤最近一次插入、草稿被改动后交回原生撤销、手动移除同步裁剪历史。
- `composer-capabilities.test.ts` — 输入栏「技能 / 插件」内联搜索纯逻辑与上下文注入单测。
- `composer-draft-memory.test.ts` — 验证输入区草稿记忆的分区键、空草稿清理与切换分区后的恢复。
- `composer-image-actions.test.ts` — 验证图片附件另存为文件名的推导：保留原名与扩展名，缺扩展名时按 MIME 补全，空名回落 image。
- `composer-paths.test.ts` — 验证输入框绝对路径识别与上下文拼装：粘贴/手打路径都能进入消息上下文。
- `composer-project-binding.test.tsx` — 验证输入区项目入口融合（工作模式不重复显示项目、聊天模式紧跟 + 展示独立胶囊）及草稿项目记忆持久化。
- `composer-queue-panel.test.tsx` — 验证排队面板摘要与提示：收起/展开文案、全部发送提示，以及箭头位于操作之后。
- `composer-right-actions.test.tsx` — 验证输入框右下角动作：运行中显示暂停、中断可续写时显示继续、空闲时显示发送。
- `conversation-trace.test.tsx` — 验证独立轨迹按文本偏移呈现真实步骤，并兼容历史记录。
- `diff-view.test.ts` — 验证 Diff 分栏数据层：统一 diff 解析、修改前后片段对照、行号与空占位。
- `file-activity-row.test.tsx` — 验证文件活动行的彩标渲染、真实语义状态、悬停精准路径、真实行号展示，以及 read_file 点击打开右栏预览逻辑。
- `goal-actions.test.ts` — 验证目标文字编辑：PATCH 携带 sessionId 与 objective，成功后更新当前目标，空值不发请求。
- `goal-bar.test.tsx` — 验证输入框目标条：进行中/受阻文案、进度、编辑入口，以及完成后不渲染。
- `handoff-actions.test.ts` — 验证交接动作：加载待接手、接手后移除并刷新目标、忽略只本地移除。
- `handoff-bar.test.tsx` — 验证交接条：标题、摘要、来源与接手/忽略按钮。
- `hero-new-chat.test.tsx` — 验证新会话空态引导：不再渲染项目范围提示条与额外说明，只保留标题、模式、输入栏与起步建议。
- `inline-comment.test.tsx` — 验证行内批注框的结构：行号提示、输入框、取消/添加按钮，以及空草稿时禁用提交。
- `markdown-advice.test.ts` — 验证 Markdown 建议标题判定：命中建议/下一步类标题用强调样式，普通标题不受影响。
- `markdown-image.test.tsx` — 验证 Markdown 图片语法接入聊天渲染：本机媒体走 LocalMediaImage（SSR 阶段显示加载占位），不再输出原始 ![] 文本。
- `media-stream.test.ts` — 验证媒体生成流式解析：计划句先回调给占位，最终结果与错误事件都能正确处理。
- `memory-filter.test.ts` — 验证记忆库筛选纯函数：类型过滤、关键词匹配正文与标签、更新时间倒序。
- `model-groups.test.ts` — 验证配置卡片的模型分类：按用途归组，顺序固定，未知用途按对话模型处理。
- `model-option-row.test.tsx` — 验证模型选择行：方舟「控制台路由」已在副标题里时不再单独占一行，额外状态仍保留。
- `model-provider-form.test.tsx` — 验证套餐配置表单也提供「获取官方模型」，并把拉取到的全部模型列出可选（普通接口保留首屏截断）。
- `new-tab-shortcut.test.ts` — 验证「新建标签页」快捷键在工作台收起时也能生效：先把工作台展开，再切到浏览器标签舞台。
- `notifications.test.ts` — 验证通知策略：轮次完成档位与不支持 Notification API 时的安全回退。
- `provider-catalog.test.ts` — 提供商接入预设的回归测试：验证套餐凭据、计费路由和旧档案匹配保持隔离。
- `restore-skeleton.test.tsx` — 验证刷新恢复会话时不再闪现空态引导：恢复中只渲染会话骨架，详情回来后直接进入消息线程。
- `right-panel-blank-tab.test.tsx` — 回归：历史持久化里残留的空白浏览器状态，在文件标签已打开时不得再渲染出一个「新标签页」。
- `right-panel.test.tsx` — 验证重构后的右侧工作台面板渲染搜索/URL 栏、6 项工具入口及子智能体/后台任务区块。
- `run-stream-handler.test.ts` — 验证运行事件归并：增量追加、步骤 upsert、结束时的队列接续与错误落盘、断流降级。
- `session-todos.test.ts` — 验证从会话步骤里取任务清单：取最近一次、跨消息回退、状态统计。
- `shortcuts-settings.test.tsx` — 设置中心「键盘快捷键」页回归：只渲染已注册的真实动作，键位与动作标题来自工作台注册表。
- `start-omnibox-history.test.ts` — 右工作台启动页地址栏历史记录纯函数单测：归一化、合并去重、匹配排序与行内补全。
- `streaming-perf.test.ts` — 验证流式性能优化边界：shallowEqual 缓存命中、仅侧栏字段变化才通知外部、流式帧合并去重与轮次思考归并、
- `suggestion-block.test.tsx` — 验证追问建议解析：正文与隐藏块拆分、流式半截标记不外泄、容错与建议胶囊渲染。
- `terminal-settings.test.tsx` — 设置中心「终端」页回归：沿用统一页头、分组与行式结构，分段控件读取已保存的位置。
- `thinking-block-scroll.test.tsx` — 验证共享限高滚动视口的溢出边缘计算、实时自动贴底与手动上滚暂停逻辑，以及 ThinkingBlock 的 SSR 渲染结构。
- `thread-window.test.ts` — 验证窗口化的纯计算与阈值分支：短会话不启用、长会话启用、估算取均值、按会话挑高度。
- `timeline-stages.test.tsx` — 验证时间线三段顺序（思维链 → 正文 → 工具总菜单）、连续无正文工具阶段合并、工具菜单概括与历史 reasoning 兼容。
- `timeline-streaming.test.tsx` — 验证 AssistantTimeline 在流式轮次切换、工具执行、文本输出及完成态时始终保持连贯的活动反馈。
- `todo-activity-label.test.ts` — 验证任务清单在活动行里的文案：完成时显示真实进度，而不是裸 JSON 或统一措辞。
- `todo-dock.test.tsx` — 验证输入框上方任务卡：进度摘要、递增步骤序号、状态点、空清单不渲染、超过 12 条折叠余项。
- `todo-group-summary.test.tsx` — 验证一轮里有多步操作时，活动摘要会并列真实动作，不再只显示最后一步或退回「N 项操作」。
- `trace-groups.test.ts` — 验证留痕分组：按动作类型归并、保持出现顺序、统计数量并标记失败。
- `trace-todo-dock.test.tsx` — 验证轨迹视图顶部复用任务卡：有清单时渲染，没有清单时不渲染。
- `user-message-attachments.test.tsx` — 验证用户消息附件能进入对话气泡并提供可理解的图片加载状态。
- `workbench-header-capsule.test.ts` — 验证右侧工作台顶栏复用左二栏/中间区同一个胶囊：不再是一条自带底分割线的平栏。
- `workspace-isolate.test.ts` — 验证工作区占用后的「用工作树并行」：创建 worktree → 绑定会话 → 清掉冲突提示；未绑定项目时不发请求。

### packages/client/ui-connectors

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-connectors/client

- `css-modules.d.ts` — 浏览器端 CSS Modules 类型声明，由 Vite 处理实际样式。
- `index.tsx` — 浏览器 Cordis 插件：向设置中心注册「连接器」页面（MCP 服务器 + 命令行工具），卸载时撤销视图贡献。
- `locales.ts` — 设置中心「连接器」的中英文文案：MCP 分组与命令行工具共用一份字典。

### packages/client/ui-connectors/client/api

- `connectors-client.ts` — 浏览器端连接器请求封装：列表、目录、CLI 增删改、探测与测试；宿主令牌由 Web 入口统一注入。
- `mcp-client.ts` — 浏览器端 MCP 请求封装。宿主令牌由 Web 入口统一注入。

### packages/client/ui-connectors/client/connectors

- `Cli-Action-Editor.tsx` — CLI 动作编辑器：编辑动作 id、标题、说明、只读、超时与 argv（每行一个参数，对象行写 JSON），以及参数表。
- `Cli-Connector-Dialog.tsx` — CLI 连接器编辑弹窗：模板预填、可执行文件探测、工作目录、环境变量、审批与动作列表。
- `Cli-Export-Dialog.tsx` — 导出连接器弹窗：展示可复制的 JSON（含环境变量字面值，界面明确提示）并提供下载。
- `Cli-Import-Dialog.tsx` — 导入连接器弹窗：粘贴导出的 JSON（单个对象 / 数组 / connectors 数组），由宿主校验并以停用状态导入。
- `Cli-Tools-Section.tsx` — 「连接器」页的命令行工具分区：列表、启停、测试、编辑与删除；每个连接器对应一组 cli__ 工具。
- `Connector-Card.tsx` — 目录卡片：图标、名称、两行说明与类型标签，右下角是「+」或已连接状态。
- `Connector-Connect-Dialog.tsx` — 目录连接弹窗：只渲染条目声明的输入项（目录 / 令牌 / 连接串），提交后由宿主后台任务安装并连接。
- `Connector-Detail-Dialog.tsx` — 目录条目详情：连接状态、示例提示、使用的应用与关于信息，卸载放在底部危险操作。
- `Connectors-Directory.module.css` — 连接器目录样式：搜索栏、筛选 chips、卡片网格、卡片状态与详情浮层；只消费 @lfaa/ui-theme 语义变量。
- `Connectors-Directory.tsx` — 连接器目录：搜索、类型 / 分类筛选、卡片网格、连接任务进度与详情弹窗。
- `Connectors-Settings.module.css` — 连接器页与 CLI 编辑弹窗样式：只消费 @lfaa/ui-theme 语义变量，深浅色成对生效。
- `Connectors-Settings.tsx` — 设置中心「连接器」页：目录（卡片）在前，MCP 服务器与命令行工具作为管理页签在后。

### packages/client/ui-connectors/client/mcp

- `Mcp-Dialog.tsx` — 设置中心内的 MCP 录入弹窗，使用浏览器顶层避免被设置中心遮住。
- `Mcp-Servers-Section.tsx` — 「连接器」页的 MCP 分组：管理连接、项目范围、审批和工具列表（原独立 MCP 页，现并入连接器分区）。
- `Mcp-Settings.module.css` — MCP 设置页的状态提示、横排操作和双主题原生弹窗。

### packages/client/ui-connectors/src

- `index.ts` — 连接器设置界面包的 Host 入口，无运行期副作用。

### packages/client/ui-library

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-library/client

- `css-modules.d.ts` — 声明 @lfaa/library/client 中 CSS Modules 的类型定义。
- `index.tsx` — 导出 @lfaa/library/client Cordis 插件：注册资料库中心页、右栏检视器与存储设置页。

### packages/client/ui-library/client/settings

- `StorageSettingsView.module.css` — 设置中心「存储」页补充样式：路径文本、统计数值与位置模式单选项；页面骨架与行/表单来自 @lfaa/ui-primitives。
- `StorageSettingsView.tsx` — 渲染设置中心「存储」页：当前存储位置、用量统计与「默认 / 项目 / 自定义」三种位置模式的迁移表单。

### packages/client/ui-library/client/views

- `LibraryInspector.module.css` — 资料库右栏检视器样式：头部与顶栏齐平，主体按概览/媒体/资产分区块；全部消费主题语义变量。
- `LibraryInspector.tsx` — 资料库右栏检视器：未选中时展示存储概览，选中生成素材或资产后展示内容、提示词与操作。
- `LibraryMediaGrid.module.css` — 资料库「图像」分类样式：类型筛选胶囊与全宽生成素材缩略图网格；详情面板见 LibraryInspector.module.css。
- `LibraryMediaGrid.tsx` — 资料库「图像」分类：生成素材的类型筛选与缩略图网格；选中后的详情交给右栏检视器，不再占用画布宽度。
- `LibraryTrashView.module.css` — 资料库「回收站」页面样式：卡片多选网格、分类筛选胶囊与底部批量操作条，全量使用 @lfaa/ui-theme 语义变量。
- `LibraryTrashView.tsx` — 资料库「回收站」视图：统一管理最近 30 天内删除的素材、文档资产、无限画布与项目，支持按类型筛选、多选批量恢复与二次确认彻底删除。
- `LibraryView.cards.module.css` — 资料库卡片与选中态样式：资产/记忆卡片网格与删除按钮；详情改由右栏检视器展示。
- `LibraryView.module.css` — 资料库与资产库页面样式：紧凑顶部操作栏、分类标题与数量、主区容器与空态引导；卡片网格与选中态见 LibraryView.cards.module.css。
- `LibraryView.tsx` — 渲染「资料库」中心页：按左二分类展示生成素材、资产与记忆；选中项交给右栏检视器，页面本身不再放预览列。

### packages/client/ui-library/src

- `index.ts` — @lfaa/client-ui-library 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-library/tests

- `library-inspector.test.tsx` — 验证右栏检视器：未选中展示存储概览，选中媒体展示提示词与操作，选中资产时先显示读取态。
- `library-media.test.tsx` — 验证资料库「图像」分类的筛选、空态/错误态与卡片渲染，界面不暴露磁盘绝对路径。
- `plugin-lifecycle.test.ts` — 验证 @lfaa/library/client 注册资料库视图、右栏检视器与存储设置页，并在卸载时全部撤销。

### packages/client/ui-plugins

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-plugins/client

- `css-modules.d.ts` — 声明 CSS Modules 类型导出，供 @lfaa/plugins 浏览器端组件安全导入样式。
- `index.tsx` — @lfaa/plugins 浏览器端 Cordis 插件：注册插件中心主视图，并随运行状态动态挂卸各扩展详情页。
- `locales.ts` — @lfaa/plugins 浏览器端中英文界面文案字典：插件中心只管扩展插件的安装与启停，内置插件在设置中心。

### packages/client/ui-plugins/client/api

- `plugins-client.ts` — @lfaa/plugins 浏览器端 HTTP 请求封装，与 Host /api/plugins 接口通信。

### packages/client/ui-plugins/client/components

- `Add-Plugin.module.css` — 添加插件弹窗样式：复用主题变量，日志区固定高度可滚动，避免撑破界面。
- `Add-Plugin.tsx` — @lfaa/plugins 添加插件弹窗：支持 npm 包名 / GitHub 地址 / 本地目录三种来源，实时展示安装日志。
- `Plugin-Card.tsx` — @lfaa/plugins 插件中心已安装插件卡片：展示运行时状态、包名与失败原因，并承载启停/编辑/卸载操作。
- `Plugins-View.module.css` — @lfaa/plugins 插件中心主视图样式，完全使用 @lfaa/ui-theme 语义变量以适配深浅双主题与窄屏。
- `Plugins-View.tsx` — @lfaa/plugins 插件中心主视图：只管理外部/自研插件（安装、启停、卸载、二创），内置插件已迁到设置中心。

### packages/client/ui-plugins/client/inventory

- `Inventory-Card.tsx` — 插件清单卡片：折叠时显示标题、两行描述、条目 id 与状态标签；展开后显示完整名称、来源与状态事实。
- `Plugin-Inventory.module.css` — 设置中心「内置插件」页样式：卡片网格、分组标题与展开事实表，只消费 ui-theme 语义变量。
- `Plugin-Inventory.tsx` — 设置中心「内置插件」页：只读清单，按当前预设拆会话插件与全局插件，支持搜索与逐卡展开。
- `locales.ts` — 设置中心「内置插件」页的中英文文案：只放用户需要看到的词，不写实现说明。

### packages/client/ui-plugins/client/stream

- `add-stream.ts` — @lfaa/plugins 添加外部插件的流式请求封装：用 POST + fetch 流读取 SSE 安装日志与最终状态。

### packages/client/ui-plugins/src

- `index.ts` — @lfaa/client-ui-plugins 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-review

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-review/client

- `css-modules.d.ts` — 声明 @lfaa/review/client 中 CSS Modules 的类型定义。
- `index.tsx` — 导出 @lfaa/review/client Cordis 插件：注册内置代码审查工作台视图。

### packages/client/ui-review/client/settings

- `CodeReviewSettingsView.tsx` — 渲染设置中心「编码 → 代码审查」页：仅展示已真实接线的审查策略、自定义指令与已探测本地仓库。
- `CodingSettingsExtras.module.css` — 编码设置页（Git 与代码审查）补充控件样式：仓库清单行、搜索框与翻页；页面骨架与行/表单来自 @lfaa/ui-primitives。
- `GitSettingsView.tsx` — 渲染设置中心「编码 → Git」页：分支前缀、PR 合并策略、强制推送、草稿 PR、审查呈现方式与指令类表单。

### packages/client/ui-review/client/views

- `CodeReviewDiffPane.tsx` — 渲染内置代码审查工作台右侧面板：着色 Unified Diff 查看器、PR 草案预览与代码审查发现列表。
- `CodeReviewListPane.tsx` — 渲染内置代码审查工作台左侧清单面板：工作区变更暂存与提交、提交历史浏览及审查报告列表。
- `CodeReviewView.module.css` — 内置 Git 与代码审查工作台样式：顶栏分支条、双栏工作区变更/差异视图、提交列表与审查发现卡片。
- `CodeReviewView.tsx` — 渲染内置 Git 与代码审查工作台主界面：仓储分支管理、暂存提交、PR 草案、Diff 查看与代码审查报告。

### packages/client/ui-review/src

- `index.ts` — @lfaa/client-ui-review 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-review/tests

- `plugin-lifecycle.test.ts` — 验证 @lfaa/review/client 注册代码审查工作台，并在卸载时撤销视图贡献。

### packages/client/ui-sections

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-sections/client

- `css-modules.d.ts` — 为分区包 Client 侧 CSS Modules 提供类型声明。
- `index.tsx` — 导出分区包 Client Cordis 插件入口，向工作台注册自定义分区提供方并在删除分区时广播事件。
- `locales.ts` — 集中维护工作区自定义分区模块在中英文环境下的创建、重命名与管理文案。

### packages/client/ui-sections/client/components

- `SectionDialog.module.css` — 新建/重命名分区整页居中弹窗样式，沿用 LFAA 液态玻璃主题与强调色。
- `SectionDialog.tsx` — 新建或重命名分区的整页居中液态玻璃弹窗。
- `SectionRowActions.module.css` — 自定义分区标题栏操作按钮与弹出管理菜单样式。
- `SectionRowActions.tsx` — 渲染左二自定义分区标题行右侧操作按钮（··· 管理菜单与新聊天入口）。

### packages/client/ui-sections/client/store

- `section-store.ts` — 通过 /api/workspace/sections* 与 Host SectionsService 同步分区列表，并用本地缓存实现首屏无闪烁秒开与静默校对。

### packages/client/ui-sections/src

- `index.ts` — @lfaa/client-ui-sections 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-sections/tests

- `sections-lifecycle.test.ts` — 验证自定义分区包 Host 服务生命周期、CRUD/重名校验、级联清理以及 Client 插件注册与卸载。

### packages/client/ui-skills

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-skills/client

- `css-modules.d.ts` — 声明 CSS Modules 类型导出，供 @lfaa/skills 浏览器端组件安全导入样式。
- `index.tsx` — @lfaa/skills 浏览器端 Cordis 插件：向 Workbench 注册技能中心视图，并在卸载时清理。
- `locales.ts` — @lfaa/skills 浏览器端中英文界面文案字典。

### packages/client/ui-skills/client/skills

- `skills-client.ts` — @lfaa/skills 浏览器端 HTTP 请求封装，与 Host /api/skills 接口通信。

### packages/client/ui-skills/client/view

- `Skills-View.module.css` — @lfaa/skills 技能中心主视图样式，完全基于 @lfaa/ui-theme 语义变量以适配深浅双主题与窄屏。
- `Skills-View.tsx` — @lfaa/skills 技能中心主视图组件，支持按来源筛选、导入/新建、编辑、二创复制、启停与删除。

### packages/client/ui-skills/src

- `index.ts` — @lfaa/client-ui-skills 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-terminal

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-terminal/client

- `TerminalPane.module.css` — 真实终端面板容器：撑满所在面板，xterm 自己滚自己的内容。
- `TerminalPane.tsx` — 真实终端面板：xterm.js 负责 ANSI/光标渲染，WebSocket 负责输入输出，尺寸随容器自适应。
- `index.tsx` — @lfaa/client-ui-terminal 浏览器入口：导出真实终端面板组件与连接客户端。
- `terminal-client.ts` — 终端 WebSocket 客户端：负责握手（带一次性令牌）、重连、增开/关闭会话与发送输入。
- `terminal-types.ts` — 浏览器侧终端消息契约：与 @lfaa/terminal 的 Host 协议保持一致（结构相同，独立声明避免前端引 Host 依赖）。

### packages/client/ui-terminal/src

- `index.ts` — @lfaa/client-ui-terminal 包入口：只放与浏览器无关的常量；界面组件在 ./client（浏览器入口）。

### packages/client/ui-tool-media

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-tool-media/client

- `css-modules.d.ts` — 声明 @lfaa/tool-media/client 中 CSS Modules 的类型定义。
- `index.tsx` — 统一导出 @lfaa/tool-media 的浏览器端媒体 UI：媒体库弹窗、生成卡片、比例/风格选择器、
- `media-locales.ts` — 媒体生成与资料库素材的中英文文案表：随 @lfaa/tool-media 一起发布，供本包客户端组件复用，

### packages/client/ui-tool-media/client/compose

- `Media-Generating-Card.module.css` — 生成中的消息占位：按目标比例的骨架卡片 + 进度行，替代输入框上方的旧式状态条。
- `Media-Generating-Card.tsx` — 媒体生成中的消息占位：按目标画幅显示骨架卡片与进度，替换输入框上方那一行旧式状态提示。
- `MediaRatioPicker.module.css` — 图片比例选择器：与模型选择胶囊同高的轻量按钮，浮层内 4×2 比例网格。
- `MediaRatioPicker.tsx` — 输入栏图片比例选择器：自动识别，或固定 9:16 / 2:3 / 3:4 / 1:1 / 4:3 / 3:2 / 16:9。
- `MediaStylePicker.module.css` — 图片风格选择器：与比例选择器同款的轻量按钮 + 浮层网格。
- `MediaStylePicker.tsx` — 输入栏图片风格选择器：自动，或写真 / 电影感 / 插画 / 二次元 / 水彩 / 3D。

### packages/client/ui-tool-media/client/library

- `MediaLibraryDialog.module.css` — 生成素材库弹窗：网格缩略图、类型筛选、提示词复用与详情条。
- `MediaLibraryDialog.tsx` — 生成素材库弹窗：列出工作区/媒体目录里的生成图片、视频与语音，支持筛选、预览与复用提示词。
- `library-store.ts` — 资料库中心页与右栏检视器共享的客户端状态：选中项与生成素材列表各只有一个所有者，避免两处重复请求和选择漂移。
- `useLibraryState.ts` — 订阅资料库共享状态的 React 入口：中心页与右栏检视器使用同一份选中项与素材列表。

### packages/client/ui-tool-media/client/media

- `chat-media.ts` — 聊天素材来源和生成请求，供输入框、结果操作和发送动作共用。
- `media-library.ts` — 生成素材（图片/视频/语音）的公开数据契约、列表读取与筛选；资料库「图像」分类与输入框素材库弹窗共用，不持有 React 状态。
- `media-result-context.ts` — 将聊天消息的素材来源与操作传给 Markdown 内的预览组件。
- `media-thumb-cache.ts` — 生成素材缩略图缓存：优先用宿主磁盘缓存，其次浏览器缓存；缺失时只取一次原图并缩成 480/960px WebP，回传宿主供所有客户端复用。

### packages/client/ui-tool-media/client/thumbs

- `LocalMediaImage.module.css` — 聊天内生成图片预览：圆角卡片、柔和投影，不再用硬边框把画面切成一格。
- `LocalMediaImage.tsx` — 聊天内媒体预览：/api/media/* 需要令牌头，img 标签无法携带，改为 fetch 后转 blob URL 渲染。
- `MediaThumb.tsx` — 生成素材缩略图：进入视口附近才按需读取，浏览器内缩到 480px 并写入缓存；完整原图仍由 useMediaBlob 供右栏使用。

### packages/client/ui-tool-media/src

- `index.ts` — @lfaa/client-ui-tool-media 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-tool-media/tests

- `library-store.test.ts` — 验证资料库共享状态：选中项去重通知与清空、素材列表读取去重、删除同步移除与失败状态。
- `media-generating-card.test.tsx` — 生成中占位卡片：骨架宽高跟随目标比例，文案与比例标签中英文正确。
- `media-library.test.ts` — 验证生成素材的数据契约：类型/关键字筛选、徽章与体积文案、文件地址，以及宿主列表接口的读取与失败。
- `media-ratio-picker.test.tsx` — 输入栏比例选择器：自动状态与具体比例的触发文案、选项网格与选中态。
- `media-ratio-size.test.ts` — 图片尺寸换算比例：再次生图占位用（覆盖常见比例与不匹配情况）。
- `media-style-picker.test.tsx` — 输入栏风格选择器：自动状态、全部选项、选中态与中英文案。
- `media-thumb-cache.test.ts` — 验证缩略图缓存键随文件变化失效，语音素材不发起任何网络请求。

### packages/client/ui-workspace

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/client/ui-workspace/client

- `css-modules.d.ts` — 为工作区包 Client 侧 CSS Modules 提供类型声明。
- `index.tsx` — 导出工作区包 Client 插件入口，通过 Cordis inject 获取 workbench 服务并贡献项目、悬停/操作卡片及右侧上下文。
- `locales.ts` — 集中维护工作区插件在中英文环境下的本地项目、资源管理器选择、目录信任及工作区文案。

### packages/client/ui-workspace/client/project

- `EditProjectDialog.module.css` — 编辑项目整页居中弹窗样式，对齐参考设计并沿用 LFAA 液态玻璃主题变量与强调色。
- `EditProjectDialog.tsx` — 编辑项目弹窗：支持修改项目名、增删多个本机源文件夹，或从本地列表安全移除项目。
- `ProjectActionMenu.module.css` — 点击项目行“···”弹出的操作菜单样式，参考所附菜单结构并复用 LFAA 液态玻璃变量。
- `ProjectActionMenu.tsx` — 点击项目行“···”后在按钮下方弹出的操作菜单：支持置顶、编辑、分区、在资源管理器中打开、归档聊天（禁用态）与移除项目。
- `ProjectBriefField.module.css` — 项目简介输入区样式：只消费主题语义变量，深浅色共用同一套结构。
- `ProjectBriefField.tsx` — 项目简介输入区：创建/编辑项目共用，展示自动生成初稿、字数与重新生成入口。
- `ProjectContextPanel.module.css` — 右侧上下文面板卡片样式，复用 Shell 主题与液态玻璃变量。
- `ProjectContextPanel.tsx` — 渲染由 @lfaa/workspace 插件贡献到四栏右侧菜单栏的上下文详情与项目目录移除操作。
- `ProjectDialog.module.css` — 创建项目与目录信任确认弹窗样式，复用 LFAA 液态玻璃主题变量与强调色。
- `ProjectDialog.tsx` — 创建项目弹窗：支持输入名称、本机资源管理器选目录 / 远程说明，以及按“文档/lfaa”生成前的目录信任确认。
- `ProjectHoverCard.module.css` — 项目行“···”悬浮详情卡样式，复刻参考设计并沿用 LFAA 液态玻璃主题变量。
- `ProjectHoverCard.tsx` — 渲染项目行“···”触发的液态玻璃悬浮信息卡：展示项目名、置顶开关、聊天次数、源文件夹路径与“编辑项目”入口。
- `ProjectOverlays.tsx` — 宿主工作区项目悬浮卡片、操作下拉菜单与“编辑项目”整页弹窗的统一挂载宿主。
- `ProjectRowActions.module.css` — 左二项目行尾“···”与新建聊天操作按钮样式。
- `ProjectRowActions.tsx` — 渲染左二项目行右侧的两个快捷操作图标（··· 详情/操作菜单 与 ✎ 项目内新建聊天）。
- `ProjectSourcePicker.tsx` — 项目创建对话框的「来源文件夹」区域：已选目录的更换/清除，或选择目录 + 手填路径；远端来源显示未接入说明。
- `ProjectTrustPrompt.tsx` — 项目创建前的信任确认视图：展示目标路径与风险说明，确认后才真正落盘。
- `ProjectWorkspace.module.css` — 工作区插件贡献的主工作区视图与真实项目文件树样式，复用液态玻璃变量。
- `ProjectWorkspace.tsx` — 渲染由 @lfaa/workspace 插件贡献的项目概览页与绑定真实本地目录的文件工作区。
- `RemoveProjectDialog.tsx` — 移出项目二次确认弹窗：复用 @lfaa/ui-primitives 的共享 ConfirmDialog，明确告知仅从应用中移出。
- `useProjectBrief.ts` — 管理项目简介草稿：目录变化时自动生成初稿，用户编辑后不再覆盖，并暴露手动重新生成。

### packages/client/ui-workspace/client/shared

- `anchor.ts` — 浮层锚点矩形：项目行悬停卡、操作菜单与 store 共用的纯类型，避免 store 反向依赖组件。
- `worktree-types.ts` — 工作树客户端展示类型：字段由 /api/worktrees 返回，Host 侧契约在 @lfaa/worktree。

### packages/client/ui-workspace/client/store

- `local-project-store.ts` — 通过同源 /api/workspace/* RPC 与 Host WorkspaceService 同步真实本地项目和目录信息，并缓存快照实现首屏秒开与静默刷新。
- `project-menu-store.ts` — 管理左二项目行的 Hover 信息卡、Click 操作菜单、抑制滞留悬停与“编辑项目”弹窗状态。

### packages/client/ui-workspace/client/worktree

- `WorktreeDialog.module.css` — 新建工作树会话弹窗：复用主题语义变量，深浅色共用同一套结构。
- `WorktreeDialog.tsx` — 新建工作树会话弹窗：填写分支与可选起点，创建同级工作树后直接打开绑定的新会话。
- `WorktreeSection.module.css` — 项目详情的工作树区块样式：与工作树弹窗共用主题变量。
- `WorktreeSection.tsx` — 项目详情里的工作树区块：列出分支/目录/绑定会话与未提交改动，并提供受保护的删除入口。

### packages/client/ui-workspace/src

- `index.ts` — @lfaa/client-ui-workspace 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-workspace/tests

- `cordis-lifecycle.test.ts` — 验证四栏契约、Host 服务注册、项目目录解析与持久化的 Cordis 生命周期。

### packages/compaction/compaction

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/compaction/compaction/locale

- `en.json`
- `zh.json`

### packages/compaction/compaction/src

- `basic.ts` — @lfaa/compaction-basic：把上下文压缩做成可替换服务，默认复用 @lfaa/context 的预算压缩。
- `command.ts` — @lfaa/command-compact：把「立即压缩上下文」做成模型可调用的工具，下一轮运行生效。
- `index.ts` — @lfaa/compaction 上下文治理包入口：导出压缩服务、工具结果精简与 /compact 命令插件。
- `pruner.ts` — @lfaa/tool-result-pruner：工具结果的常规精简。清噪声、按行/字符截断，保留首尾并标注省略量。

### packages/compaction/compaction/tests

- `basic.test.ts` — 验证压缩服务：参数合并与回落、超预算时真的压缩、未超预算原样返回、溢出识别。
- `command.test.ts` — 验证强制压缩请求：一次性消费、真实压缩生效、未请求时不强压；工具端到端登记请求。
- `pruner.test.ts` — 验证结果精简：噪声清理、行列截断标注、按工具覆盖、失败结果不动、中间件链路生效。

### packages/core/agent

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/agent-group

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/agent-group/src

- `http-handler.ts` — @lfaa/agent-group HTTP 接口：启动一轮群聊（POST /api/group/runs）。
- `index.ts` — @lfaa/agent-group 入口：导出群聊编排、发言计划契约与 HTTP 处理器。
- `orchestrator.ts` — @lfaa/agent-group 群聊编排：把用户一条消息展开成「按顺序逐个 agent 发言」，共享同一份会话历史。
- `speaking-plan.ts` — @lfaa/agent-group 发言计划：代理人产出的「本轮谁发言、各自干什么」的严格契约与校验。

### packages/core/agent-group/tests

- `http-handler.test.ts` — 验证群聊接口：只接管 /api/group/runs、缺 sessionId 报 400、非群会话把原因透出。
- `orchestrator.test.ts` — 验证群聊编排：@ 顺序发言、第二位起不重复落用户消息、代理人兜底与发言人数上限。
- `speaking-plan.test.ts` — 验证发言计划的解析/校验，以及编排层「计划通过就照做、不通过就降级」的行为。

### packages/core/agent-profile

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/agent-profile/locale

- `en.json`
- `zh.json`

### packages/core/agent-profile/src

- `http-handler.ts` — @lfaa/agent-profile HTTP 接口：agent 定义与模型绑定的增删改查，供 Agents 页与会话顶栏使用。
- `index.ts` — @lfaa/agent-profile 包入口：导出契约、归一化、校验、服务与插件本体。
- `routed-llm.ts` — @lfaa/agent-profile 派发层：按绑定逐个尝试候选目标，失败按分类换目标，首 token 之后不再换。
- `routing.ts` — @lfaa/agent-profile 路由解析：把一份绑定摊平成有序候选队列，并判断哪些错误值得换目标。
- `sanitize.ts` — @lfaa/agent-profile 落盘数据归一：坏项丢弃、缺字段补默认，内置小鱼与默认绑定始终存在。
- `service.ts` — @lfaa/agent-profile Host 服务：agent 定义与模型绑定的读写、校验、内置项保护与默认回落。
- `store.ts` — @lfaa/agent-profile 存储层：把配置文件读成 unknown、原子写回；读失败一律当「没有文件」处理。
- `types.ts` — @lfaa/agent-profile 契约：agent 定义、模型绑定与生效优先级所需的类型、常量与纯函数。
- `validate.ts` — @lfaa/agent-profile 入参校验：把「能被界面传进来的东西」挡在落盘之前，错误文案直接可展示。

### packages/core/agent-profile/tests

- `agent-profile.test.ts` — 验证 agent 定义与模型绑定的持久化往返、内置项保护、校验拒绝与默认回落。
- `http-handler.test.ts` — 验证 agent / 绑定 HTTP 接口：列表、创建、改名、删除保护与业务错误转 400。
- `routing.test.ts` — 验证路由候选解析、错误分类与派发器换目标规则（首 token 后不换、认不出就不换）。
- `snapshot.test.ts` — 验证 agent 与绑定的导入导出：快照往返、按 id 覆盖、非法内容拒绝、内置 default 不被覆盖。

### packages/core/agent/locale

- `en.json`
- `zh.json`

### packages/core/agent/src

- `file-activity.ts` — 会话内文件活动解析：从已落盘消息或运行中步骤里定位本次文件操作的真实路径与预览。
- `http-handler.ts` — 为本机 Web 服务提供 /api/agent/* 任务启动、SSE 轨迹推送、人工审批与任务中止接口。
- `index.ts` — @lfaa/agent Host 侧 Cordis 服务：连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批。
- `plugin-config.ts` — Agent 插件配置契约：与 Agent 服务主体分开，供装配层与测试引用。
- `session-modules-hook.ts` — 会话模块兼容器：装配层在运行期注入的钩子状态与注销逻辑，独立于 Agent 服务主体。
- `stream-journal.ts` — 提供 @lfaa/agent 流式断线续传序号日志、句边界续写裁剪、脱敏日志及可观测性指标统计。
- `types.ts` — 定义 @lfaa/agent 的运行契约：权限模式、运行输入、Think/Act/Check 流式事件与人工审批句柄。

### packages/core/agent/src/context

- `agent-context.ts` — Agent 运行上下文装配：记忆召回、规则提示词、资料库摘要、背景图目录、技能/进度提示与模型能力价格解析。
- `agent-media.ts` — Agent 媒体生成指引与产物链接合并，仅处理运行上下文和工具输出。
- `clarification.ts` — 主 Agent 的澄清协议：模型提出问题后结束本次运行，等用户以新消息回答。
- `project-git.ts` — Agent Host 在调用模型前准备项目自身的 Git 基线，供内置 Git 工作台读取。

### packages/core/agent/src/run

- `act-round.ts` — 工具轮编排：补齐正文边界 → 记录 assistant 轮次 → 执行工具 → 回填重复提醒 → 写检查步骤 → 记录是否执行过工具。
- `act-runner.ts` — 执行一轮模型给出的工具调用：连续只读调用并行、写文件与命令串行，并按模型给出的顺序回填步骤与工具消息。
- `activity-file.ts` — 读取成功文件步骤关联的当前文本，只允许访问会话授权工作区。
- `agent-completion.ts` — 澄清请求收口：模型调用 ask_user 时终止本轮其余工具，把问题与选项作为本轮结论返回。
- `agent-fallback.ts` — 步数预算用尽时的收口总结：再压一次上下文、请求模型给出结论，并补齐最终步骤与统计。
- `agent-loop.ts` — 实现 Agent 核心任务循环：思考（Think）-> 行动（Act）-> 检查（Check）。
- `agent-usage.ts` — 运行用量与性能统计：累计 token/缓存命中、模型与工具耗时，并组装上下文构成与成本。
- `command-trace.ts` — 裁剪终端输出快照：步骤轨迹只保留尾部有限行数与字符，避免长日志把会话文件撑到兆字节级。
- `finish-round.ts` — 无工具调用时的收口：完成前自检（改了代码没验证先给一次补验证机会）→ 空响应判定 → 最终检查步骤 → 结果组装。
- `goal-continuation.ts` — 目标自动续跑判定：一轮结束后根据目标状态、轮次上限、暂停开关与会话忙闲决定是否继续。
- `goal-scheduler.ts` — 目标续跑调度：运行正常收尾后延迟判断并自动开下一轮；停止条件由 goal-continuation 纯函数决定。
- `loop-state.ts` — Agent 单次运行的循环状态：把预算、轮次、用量累积与完成前自检标记收进一个对象。
- `memory-autosave.ts` — 从用户明确陈述中提取值得跨会话记住的偏好或约定，作为长期记忆的确定性沉淀来源。
- `memory-writer.ts` — 每轮运行收口时的长期记忆提炼器：把本轮结论、决策与踩坑压成结构化记忆，做去重与冲突替代后写入。
- `model-round.ts` — Agent Host 模型轮次的超时与有限重试，保留已发出的正文和工具进度。
- `peer-sessions.test.ts` — 回归测试：验证同项目多会话可并行登记且彼此能生成准确的实时感知提示。
- `peer-sessions.ts` — 多会话并行协调器：允许同一工作区下多个会话并发运行，并向每个活跃会话动态注入同工作区其他并发会话的实时动作摘要，避免互相踩踏。
- `run-begin.ts` — Agent 运行启动器：校验会话与授权根、落盘用户/助手消息、登记运行记录并把执行循环交给 agent-loop。
- `run-compaction.ts` — 运行期压缩入口：优先使用挂载的压缩服务，未挂载时回落到 @lfaa/context 的内置实现。
- `run-context.ts` — 运行上下文装配：召回规则/记忆/资料库，拼装工作区与技能提示，创建用量跟踪、系统消息与初始对话。
- `run-memory.ts` — 运行收口后的长期记忆沉淀：显式偏好正则与每轮模型提炼并行推进，统一返回追加到轨迹的步骤。
- `run-options.ts` — 续跑复用的运行选项：延续用户上一轮选的模型、预算与权限模式，避免续跑悄悄退回默认值。
- `run-records.ts` — Agent 运行记录类型：活动运行、待审批请求与步骤增量/任务结算辅助，供服务层与运行启动器共用。
- `run-system.ts` — 系统提示词渲染：把各段提示按固定顺序拼成一条 system 消息内容，供运行循环每轮复用。
- `run-types.ts` — 定义 Agent 运行循环的依赖与输入契约，供循环主体与工具执行器共用，避免循环文件继续膨胀。
- `run-waiters.ts` — @lfaa/agent 运行等待器：记录「谁在等这次运行收口」，用于群聊串行编排与外部同步等待。
- `steering.ts` — 运行期插话：把运行中追加的用户消息（steer）并入当前对话，并在轨迹中留记录。
- `step-budget.ts` — 计算单轮 Agent 任务的工具步数预算：默认软预算可自动延长，显式上限保持硬约束。
- `think-round.ts` — Agent 单轮「思考」：渲染系统提示 → 预算内压缩 → 注入 steering → 记录 token 快照 → 调模型（含超限重试）。
- `todo-plan.ts` — 任务清单策略：把 todo_write 排到工具列表首位，并在多步任务迟迟不建清单时给一次提醒。
- `tool-policy.ts` — @lfaa/agent 运行装配辅助：把「某个 agent 的工具策略」解析出来交给工具层。
- `turn-snapshot.test.ts` — 回归测试：验证每轮改动快照在编辑与新建文件后可完整一键撤销。
- `turn-snapshot.ts` — 单轮代码修改「安全气囊」：在 Agent 单轮首次写入/编辑某个文件前记录原文快照，支持按消息轮次一键无损撤销。
- `verification.ts` — 判断一次运行是否修改了需要验证的代码，以及命令是否属于构建/测试/类型检查这类验证动作。
- `workspace-lease.ts` — 工作区租约：以「工作树路径 / 项目 / 授权根」为 scope，保证同一工作区同时只有一个会话在跑。

### packages/core/agent/src/tools

- `builtin-agent-tools.ts` — 为 LFAA 内置 Agent 注册记忆写入与资料库/资产库读写工具（随 AgentService 卸载自动清理）。
- `permission-policy.ts` — 实现三种权限模式（请求批准 ask / 帮我审批 smart / 完全访问 full）的审批决策、风险识别与 3 次自动放行计数持久化。
- `session-tools.ts` — 跨会话可见性工具：列出同一项目的会话、读取最近事件、等待另一个会话结束。
- `tool-call-args.ts` — 工具调用参数的解析与流式路径识别，供运行循环与工具执行器共用。
- `tool-result.ts` — 统一限制单个工具结果进入模型上下文的字符数，避免一次读取或检索把运行上下文撑爆。

### packages/core/agent/tests

- `agent-continuation.test.ts` — 验证续写运行：不写用户消息、保留任务清单，只新增一条助手消息；目标续跑自动接下一轮并停在上限。
- `agent-http-active-sessions.test.ts` — 验证 /api/agent/active-sessions 返回所有仍在运行的会话 id，供左二栏显示工作转圈。
- `agent-http-attachments.test.ts` — 验证 /api/agent/runs 把附件与引用图转成宿主校验后的落库字段，并忽略无法校验的来源。
- `agent-loop.context.test.ts` — 验证 @lfaa/agent 的上下文压缩、记忆召回与并行工具。
- `agent-loop.core.test.ts` — 验证 @lfaa/agent 的核心闭环、澄清、审批切换与权限模式。
- `agent-loop.streaming.test.ts` — 验证 @lfaa/agent 的流式重连、多步上限与软预算延长。
- `agent-loop.todos.test.ts` — 验证新一轮运行先清空上一轮清单，工具回传的 todos 仍广播事件并进入运行快照。
- `agent-loop.verify.test.ts` — 验证 @lfaa/agent 的完成前自检、耗时统计与重复调用提醒。
- `agent-media.test.ts` — 验证媒体指引包含「禁止编造链接」约束：Agent 未调用工具时不能声称图片已生成。
- `goal-continuation.test.ts` — 验证目标自动续跑的停止条件矩阵与续跑指令内容（纯函数，不启动真实运行）。
- `memory-autosave.test.ts` — 验证只把用户明确的偏好/约定沉淀为长期记忆，普通任务描述不命中。
- `memory-writer.test.ts` — 验证每轮长期记忆提炼器：JSON 容错解析、字段校验、开关与触发条件、写入作用域。
- `model-round.test.ts` — 验证模型请求静默退出、长推理限制及工具参数增量。
- `project-git.test.ts` — 验证自动 Git 基线会跳过疑似密钥文件，并仍尊重 .gitignore。
- `project-scope.test.ts` — 验证项目范围锚定：提示词内容，以及绑定项目的运行确实把项目名与简介送入系统提示。
- `read-file-activity.test.ts` — 验证 read_file 工具透传真实行号元数据，以及 readActivitySource 支持在授权工作区内读取源文件并拦截越界路径。
- `run-message-attachments.test.ts` — 验证 Agent 运行把用户图片附件与引用图写入用户消息，供聊天气泡还原缩略图。
- `run-routing.test.ts` — 验证「本次运行用哪个 agent、哪份绑定」的解析优先级，以及续跑缓存不丢这两个设置。
- `session-tools.test.ts` — 验证会话可见性工具：项目隔离、会话行格式、消息/步骤摘要与有界等待。
- `skills-catalog.test.ts` — 验证内置技能点名策略：优先技能必须出现在名单里，其余只报数量。
- `todo-plan.test.ts` — 验证任务清单策略：todo_write 排到工具首位，且提醒只在「没清单 + 已多步 + 没提醒过」时触发一次。
- `tool-result.test.ts` — 验证工具结果进入模型上下文前的统一限长与续读提示。
- `verification.test.ts` — 验证完成前自检对代码路径与构建/测试命令的识别规则。
- `workspace-lease-run.test.ts` — 验证同工作区多会话并行与并发感知：第二个会话可并发启动，收到同工作区活跃会话提示，运行结束后自动释放登记。
- `workspace-lease.test.ts` — 验证工作区租约：scope 解析、跨会话冲突拒绝、释放后接手与同会话重入。
- `worktree-roots.test.ts` — 验证绑定工作树的会话使用工作树根运行，并在工作树失效时明确失败而不是回退项目主目录。

### packages/core/browser

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/browser 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/core/browser/contract

- `index.ts` — 定义 @lfaa/browser 的多标签快照、控制台与网络请求记录、人工接管状态及配置契约。

### packages/core/browser/locale

- `en.json`
- `zh.json`

### packages/core/browser/src

- `http-handler.ts` — 提供 /api/browser/* 导航、多标签管理、动态视口、真实键鼠、Console/Network 日志、人工接管及配置接口。
- `index.ts` — @lfaa/browser Host 侧 Cordis 服务：统一注册 DSH 风格独占驱动槽位、内置浏览器工具与生命周期清理。
- `runtime-utils.ts` — 浏览器运行时公共校验、可执行路径探测与 DOM 快照提取辅助函数。
- `types.ts` — @lfaa/browser 类型入口：契约已下沉到 contract/，这里保留原路径重导出以免改动全部内部引用。

### packages/core/browser/src/downloads

- `browser-downloads.test.ts` — 浏览器下载回归：验证规则、同名并发落盘、确认归属及真实 Chromium 附件导航。
- `browser-downloads.ts` — 统一管理内置浏览器下载的确认、传输、落盘与终态，供 Playwright 和桌面 Host 共用。
- `download-file.ts` — 安全命名并提交浏览器下载文件，避免网页文件名越界或并发下载覆盖已有文件。
- `download-policy.ts` — 下载域名匹配与策略裁决。运行在 Host，独立于已有的浏览规则匹配。
- `playwright-download.ts` — 适配 Playwright 下载与附件导航。会话负责把上下文事件接入下载协调器。

### packages/core/browser/src/session

- `agent-overlay.ts` — Agent 页面操控可视化指示层：极简无边框虚拟指针、柔和点击涟漪与轻量悬浮动作标签。
- `browser-idle-throttle.ts` — 后台无头浏览器空闲省电节流器：当前端使用原生 iframe 展示且无推流订阅与 Agent 操作时，暂停后台动画渲染并在下次操作前毫秒唤醒。
- `browser-service.ts` — 基于 playwright-core 驱动本机 Edge/Chrome，支持会话多标签页、动态视口同步、真实键鼠操作及 Console/Network 采集。
- `browser-session-types.ts` — 浏览器运行时内部类型：单标签条目、会话状态与日志条数上限，供运行时、标签监听与快照组装共享。
- `browser-tabs.ts` — 浏览器标签监听：为新建 Page 挂 Console/网络/导航/关闭事件并维护会话状态里的标签表。
- `cdp-input.ts` — 将前端轻量输入负载映射为 Chromium CDP Input 协议命令，绕过 Playwright 定位与截图往返实现毫秒级键鼠响应。
- `page-init.ts` — 内置浏览器页面初始化脚本，标记受控页面并关闭根滚动越界。
- `registry.ts` — 参考 DSH @deepseek-ai/dsh-browser-use 的独占命名注册槽位，确保同一时刻仅有一个浏览器实现注册并受 Cordis 生命周期托管。
- `screencast-manager.ts` — 管理基于 Playwright 常驻 CDPSession 的 2x 无损 PNG Screencast 实时推流与毫秒级输入直通。
- `session-driver.ts` — 浏览器页面驱动：导航、前进后退、刷新、快照、求值，以及点击/悬停/输入/按键/滚动等页面交互。

### packages/core/browser/src/settings

- `browser-data-http.ts` — 处理 /api/browser/{history,downloads,passwords,contacts,clear-data} 数据管理路由，保持主 http-handler 精简。
- `browser-data-store.test.ts` — 回归测试：验证网站访问规则匹配、浏览历史读写及本地 AES-256-GCM 加密密码库与 CSV 导入导出。
- `browser-data-store.ts` — 管理内置浏览器的浏览历史、下载历史、本地加密密码库（AES-256-GCM）与联系信息自动填充数据。
- `browser-settings.test.ts` — 内置浏览器设置回归：下载位置跟随系统「下载」目录、旧默认值迁移、自定义与恢复默认。
- `browser-settings.ts` — 内置浏览器设置读写：归一化完整偏好（常规、下载、权限规则、站点权限、密码偏好、扩展与完整 CDP）并落盘缓存。
- `system-downloads.ts` — 解析本机系统「下载」目录：Windows 走已知文件夹注册表项（支持用户重定向到其它盘），Linux 走 XDG，其余回退 ~/Downloads。

### packages/core/browser/src/snapshot

- `browser-snapshot.ts` — 浏览器快照组装：外观/DPR 同步、CDP 帧元数据、活动会话快照、空闲快照与人工接管快照。

### packages/core/browser/src/tools

- `browser-diagnose.ts` — 内置浏览器一键页面体检与诊断工具集（browser_diagnose / browser_console / browser_network）。
- `browser-tools.ts` — 为小鱼 Agent 注册内置浏览器工具集（导航、元素快照、点击、输入、滚动、按键、截图、控制台排查）。

### packages/core/browser/tests

- `browser-diagnose.test.ts` — 验证 browser_diagnose 7 类缺陷汇总报告、空异常通过态、快照报错自动透出与探针脚本语法合法性。
- `browser-service.test.ts` — 验证 @lfaa/browser 的独占驱动注册、URL 安全校验、真实本机 Edge 浏览交互与卸载清理。

### packages/core/context

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/context/src

- `context-budget.ts` — 运行内上下文预算：压缩早期工具结果、必要时丢弃过老轮次，并在供应商报上下文超限时提供降级依据。
- `index.ts` — @lfaa/context：上下文预算与压缩的纯函数入口，供 Agent 运行时按预算压缩会话。

### packages/core/context/tests

- `context-budget.test.ts` — 验证运行内上下文压缩：保留首条 system、最近轮次与工具调用配对，并识别上下文超限错误。

### packages/core/crew

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/crew/locale

- `en.json`
- `zh.json`

### packages/core/crew/src

- `crew-runner.ts` — crew 串行执行器：按任务拓扑序接力子智能体，交接前验收，结束后归档运行期记忆。
- `guardrail.ts` — 交接前的结构验收：从 expectedOutput 里解析 JSON 与必含字段要求，输出不合格时给出可回传的原因。
- `index.ts` — @lfaa/crew Host 侧 Cordis 服务：注册 run_crew 工具，把任务图交给串行执行器并汇总交付。
- `task-graph.ts` — 任务图的纯函数校验与拓扑排序：id 唯一、依赖存在、无环，排序保持声明顺序的稳定。
- `types.ts` — @lfaa/crew 契约：任务定义、运行结果与验收结论；只放类型，不依赖运行时。

### packages/core/crew/tests

- `crew-plugin.test.ts` — 验证 crew 插件装配：run_crew 工具注册成功，未装配子智能体时给出可读错误而不是崩溃。
- `crew-runner.test.ts` — 验证 crew 串行执行器：依赖顺序、上游交付注入、验收重试、失败跳过与运行期记忆归档。
- `guardrail.test.ts` — 验证交接验收：最短长度、JSON 可解析、必含字段与重试提示的构造。
- `task-graph.test.ts` — 验证任务图校验与拓扑排序：重复 id、缺失依赖、自依赖、环与稳定顺序。

### packages/core/fs

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/fs/src

- `index.ts` — @lfaa/fs：工作区路径安全与文件遍历的公开入口。
- `sandbox.ts` — 校验工作区路径沙箱，防止路径穿越、前缀伪装或符号链接逃逸到授权目录之外；仅完全访问权限模式允许越界。
- `workspace-filter.ts` — 工作区遍历过滤器：统一忽略目录、应用私有路径与超限文件，供文件检索类工具复用。

### packages/core/fs/tests

- `fs.test.ts` — 验证工作区路径边界、私有路径过滤与遍历忽略规则。

### packages/core/guard

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/guard/src

- `command-safety.ts` — 命令安全基线：拦截引用应用私有文件的命令，并把命令执行写入本地审计日志。
- `index.ts` — @lfaa/guard：命令安全与超时策略的纯函数入口，供工具层在执行前做拦截与参数收敛。
- `repeat-call.ts` — 重复工具调用提醒：同一工具以完全相同的参数连续调用时，在阈值处生成建议性提醒，不阻断执行。
- `timeout.ts` — 命令超时策略：把工具参数里的 timeoutMs 收敛到安全区间，避免过短误杀或过长拖死单轮任务。

### packages/core/guard/tests

- `guard.test.ts` — 验证命令安全拦截与前台命令时限归一化。
- `repeat-call.test.ts` — 验证重复工具调用的阈值提醒、参数规范化与链重置。

### packages/core/jobs

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/jobs/locale

- `en.json`
- `zh.json`

### packages/core/jobs/src

- `http-handler.ts` — 提供 /api/jobs* 后台任务查询、终端命令启动与终止接口。
- `index.ts` — @lfaa/jobs Host 侧 Cordis 服务：注册后台命令工具并管理会话级后台进程池。
- `job-manager.ts` — 后台任务进程池：维护会话归属、有界字节缓冲、中文编码解码与跨平台进程树终止。
- `types.ts` — 定义 @lfaa/jobs 后台任务契约：任务状态、快照结构与启动参数。

### packages/core/jobs/tests

- `jobs-service.test.ts` — 验证 @lfaa/jobs 后台任务启动、输出读取、会话隔离、停止清理及 Cordis 生命周期。

### packages/core/llm

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/llm 构建入口：主入口、方舟套餐路由与千问 Token Plan 目录三个公开子路径。

### packages/core/llm/locale

- `en.json`
- `zh.json`

### packages/core/llm/src

- `ark-plan.ts` — 方舟个人套餐公开模型目录与思考参数契约，供 Host 请求适配和浏览器模型选择共用。
- `capabilities.ts` — 解析并优先采信模型提供商 /models 返回的真实思考强度能力（effort.supported_levels），无多档参数时不虚构假数据。
- `config-sanitize.ts` — 模型配置的读取清洗：兼容历史字段、修复乱码名称，并生成默认档案。
- `context-window.ts` — @lfaa/llm 上下文窗口推断：模型名里的容量标记优先（如 32k / 128k / 1m），
- `http-handler.ts` — 为本机 Web 服务提供 /api/llm/* HTTP 接口，绝不向浏览器返回原始 API Key。
- `index.ts` — @lfaa/llm Host 侧 Cordis 服务：管理模型配置与安全凭据，并驱动思考与推理调用。
- `protocol-utils.ts` — 提供 @lfaa/llm 的协议识别、校验、URL 规范化与 SSE 增量行解析工具。
- `text-repair.ts` — 修复被错误按 GBK 解码后保存的 UTF-8 文本（典型「千问」→「鍗冮棶」双重编码乱码）。
- `token-plan.ts` — 千问 Token Plan 套餐模型目录：兼容模式 /models 只返回部分模型，视频模型（如 happyhorse）需要按官方套餐清单补齐。
- `types.ts` — 定义 @lfaa/llm 包的 Host 侧无 DOM 公共契约类型：模型配置、API 协议格式、官方模型能力、思考强度与流式事件。

### packages/core/llm/src/adapters

- `anthropic-adapter.ts` — Anthropic Messages API (`/v1/messages`) 适配器，支持 Claude 官方及 DeepSeek Anthropic 格式接口。
- `gemini-adapter.ts` — Google Gemini 原生 generateContent / streamGenerateContent 协议适配器。
- `openai-adapter.ts` — Host 侧 Chat Completions 适配器，用统一的 LLM 契约处理方舟、DeepSeek、OpenAI 和 Ollama 的响应。
- `responses-adapter.ts` — OpenAI Responses API (`/responses`) 适配器，支持 OpenAI 与 DeepSeek Responses 接口及流式工具调用。

### packages/core/llm/src/media

- `media-audio.ts` — 媒体生成 · 语音合成：Qwen-TTS / 方舟语音接口适配与模型选择。
- `media-models.ts` — 厂商媒体模型候选与档案查找，供模型发布和生成适配器共用。
- `media-video.ts` — 视频任务的请求体组装与响应解析（纯函数），供媒体生成适配器复用；端点解析仍留在 media.ts。
- `media.ts` — 媒体生成（生图）适配：把套餐里的图像模型调用到厂商图片接口，统一返回 base64/URL 与错误信息。

### packages/core/llm/tests

- `ark-plan.test.ts` — 验证方舟套餐目录、官方思考档位及 OpenAI Chat 适配器发送的实际参数。
- `capabilities.test.ts` — 验证模型能力推断：套餐同步的 /models 列表缺少 effort 元数据时，按模型家族补出真实思考能力。
- `context-window.test.ts` — 验证上下文窗口推断：模型名里的容量标记优先，家族兜底，无法确定时返回 undefined。
- `llm-service.test.ts` — 验证 @lfaa/llm Cordis 服务注册、API Key 脱敏持久化、活跃模型切换及流式/非流式适配器调用。
- `media-routing.test.ts` — 验证视频生成默认只使用当前配置，跨套餐必须由调用方显式指定，避免静默调用其他厂商。
- `media-watermark.test.ts` — 验证方舟生图默认关闭厂商水印：未显式开启时不发送 watermark:true。
- `media.test.ts` — 验证生图适配纯函数：端点与风格解析、尺寸归一化、请求体组装、响应解析与生图档案选择。
- `text-repair.test.ts` — 验证乱码修复：UTF-8 文本被按 GBK 解码后保存的名称能还原，正常中英文名不被误改。
- `token-plan.test.ts` — 验证千问 Token Plan 官方套餐目录补齐：/models 不返回的视频模型（happyhorse）也要出现在清单里。

### packages/core/memory

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/memory/locale

- `en.json`
- `zh.json`

### packages/core/memory/src

- `http-handler.ts` — 为本机 Web 服务提供 /api/memory*、/api/library* 与 /api/storage* HTTP 接口，支持记忆、资产库与无损存储迁移。
- `index.ts` — @lfaa/memory Host 侧 Cordis 服务：统一对外提供短期会话记忆、长期事实记忆、资料库资产/产物及存储迁移服务。
- `longterm-store.ts` — 管理长期事实记忆存储（<dataRoot>/long-term-memory.json）：结构化条目、去重合并、冲突替代、上限归档与关键词召回。
- `memory-entry.ts` — 长期记忆条目的读取归一化与生命周期辅助函数：旧格式兼容、归档路径推导与淘汰打分。
- `memory-ranking.ts` — 长期记忆的纯函数检索与去重工具：中文 bi-gram 分词、BM25 打分、时间衰减、作用域加权与预算截断。
- `memory-settings.ts` — 记忆行为设置：自动提炼、条目上限与召回预算，存于 ~/.lfaa/memory-settings.json，与资料库数据分离。
- `memory-write-queue.ts` — 长期记忆文件的安全读写层：进程内串行写队列、临时文件原子替换、按 mtime 热重载，避免并发写互相覆盖。
- `types.ts` — @lfaa/memory 的领域契约：会话类型由 @lfaa/session 提供，资料库/存储类型由 @lfaa/storage 提供；本文件保留长期记忆条目。

### packages/core/memory/tests

- `longterm-store.test.ts` — 验证长期记忆存储：并发写入不丢条目、旧格式兼容、去重、冲突替代、上限归档与命中回写。
- `memory-ranking.test.ts` — 验证记忆检索的纯函数：中文 bi-gram 分词、BM25 排序、作用域可见性、时间衰减与预算截断。
- `memory-service.test.ts` — 验证 @lfaa/memory 短期会话持久化、项目聊天计数（不含归档）、窗口裁剪及长期记忆召回。

### packages/core/metrics

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/metrics/src

- `cost.ts` — 按模型档案的人民币单价把 token 用量换算成成本，供会话状态栏与 Token 浮层展示。
- `estimate.ts` — 上下文 token 估算：按 DSH token-meter 的固定密度口径（4 字符/token + 结构/角色开销）适配 LFAA 的扁平消息结构。
- `index.ts` — @lfaa/metrics：运行指标、token 估算、人民币成本与会话统计的纯函数入口，Host 与浏览器端共用。
- `session-stats.ts` — 会话统计聚合：从已持久化的消息记录计算轮次、工具步数、模型/工具耗时、首 token、吞吐、上下文与成本。

### packages/core/metrics/tests

- `cost.test.ts` — 验证按模型单价把 token 用量换算成人民币成本。
- `estimate.test.ts` — 验证上下文 token 估算与 DSH token-meter 的固定密度口径一致。
- `session-stats.test.ts` — 验证会话统计聚合：轮次、工具步数、模型/工具耗时、首 token、吞吐、token 构成、上下文与成本。

### packages/core/rules

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/rules/locale

- `en.json`
- `zh.json`

### packages/core/rules/src

- `http-handler.ts` — 为本机 Web 服务提供 /api/rules* HTTP 接口，用于查看分层规则及保存用户全局规则。
- `index.ts` — @lfaa/rules Host 侧 Cordis 服务：强制系统规则基线、发现项目规则文件、持久化用户全局规则并按优先级拼装系统提示词。
- `types.ts` — 定义 @lfaa/rules 的无 DOM 领域契约：规则层级、规则文档及提示词装配输出。

### packages/core/rules/tests

- `rules-service.test.ts` — 验证 @lfaa/rules 分层规则加载顺序（系统 > 项目 > 用户）、项目规则自动发现及卸载清理。

### packages/core/session

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/session/src

- `index.ts` — @lfaa/session：会话领域类型、本地会话存储、标题与会话摘要的公开入口。
- `session-digest.ts` — 从会话步骤轨迹提炼工具要点：供上下文摘要、滚动摘要与运行记录复用，只保留路径、命令与工具计数。
- `session-normalize.ts` — @lfaa/session 落盘数据归一：群聊配置与待回答澄清都从磁盘的未知形状还原，坏数据一律降级。
- `session-store.ts` — 管理本地短期会话记忆文件（~/.lfaa/sessions/*.json）与上下文窗口摘要裁剪。
- `todos.ts` — 任务清单条目的归一化：读取历史会话与工具入参共用同一套校验，避免两处规则漂移。
- `types.ts` — 会话领域契约：消息、步骤轨迹、运行指标、会话摘要与创建/更新输入。

### packages/core/session/tests

- `session.test.ts` — 验证会话存储的创建、追加消息、读取与列表摘要。
- `todos.test.ts` — 验证会话记录持久化任务清单：写入后能读回、分叉会复制、非法条目被丢弃。

### packages/core/settings

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/settings/src

- `coding-settings.ts` — 管理 LFAA「设置 → 编码（Git 与代码审查）」持久化配置（存于 ~/.lfaa/coding-settings.json）。
- `general-settings.ts` — 管理 LFAA「设置 → 常规」持久化配置（存于 ~/.lfaa/general-settings.json），并动态检测当前系统用户的默认项目外聊天目录。
- `index.ts` — @lfaa/settings：常规设置与编码设置的持久化入口，供聊天 Host 与设置 HTTP 路由共用。

### packages/core/settings/tests

- `settings.test.ts` — 验证常规设置与编码设置的默认值、阈值归一化和持久化。

### packages/core/storage

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/storage/src

- `asset-store.ts` — 管理资料库本地资产与 Agent 产物存储（<dataRoot>/agent-outputs、user-assets 及 vault-index.json）。
- `index.ts` — @lfaa/storage：资料库布局、资产存取与数据根迁移的公开入口。
- `storage-manager.ts` — 管理 LFAA 资料库与资产库本地根路径配置、旧数据接管、统计及无损跨目录迁移（Copy-Verify-Switch）。
- `types.ts` — 资料库与存储配置的领域类型：资产元数据、保存输入、存储位置与迁移结果。
- `vault-layout.ts` — 定义 LFAA 资料库目录规范常量（data/ 下仅放 agent-outputs、user-assets、long-term-memory.json、vault-index.json），历史会话固定存放在 ~/.lfaa/sessions。

### packages/core/storage/tests

- `storage.test.ts` — 验证资料库资产的保存、列出、读取与删除。

### packages/core/subagent

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/subagent/locale

- `en.json`
- `zh.json`

### packages/core/subagent/src

- `browser-subagent.ts` — 浏览器专属子智能体辅助：工具白名单判定、可读步骤标签映射、浏览器类型识别与专属系统指令拼装。
- `http-handler.ts` — 提供 /api/subagents* 查询、SSE 流式订阅、追问与中止接口，供右侧栏实时渲染子智能体工作舞台。
- `index.ts` — @lfaa/subagent Host 侧 Cordis 服务：注册多 Agent 协作工具并托管隔离子运行生命周期。
- `subagent-presets.ts` — 定义多角色子智能体（research / coder / browser / reviewer）的默认权限、步数预算与提示词模板。
- `subagent-service.ts` — 进程内子智能体调度核心：为子智能体创建隔离会话上下文、过滤权限边界与并发限流。
- `types.ts` — 定义 @lfaa/subagent 进程内子智能体状态、流式事件、协作参数与配置契约。

### packages/core/subagent/tests

- `subagent-memory.test.ts` — 验证子智能体收口把结论与失败点写成团队记忆：作用域、归属会话与写入者标记。
- `subagent-service.test.ts` — 验证 @lfaa/subagent 并发派发、上下文隔离、递归深度防护、权限隔离与停止清理。

### packages/core/system-prompt

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md` — @lfaa/system-prompt
- `package.json`
- `tsconfig.json`

### packages/core/system-prompt/locale

- `en.json`
- `zh.json`

### packages/core/system-prompt/src

- `index.ts` — @lfaa/system-prompt：系统提示词分段注册服务。插件按需追加段落，Agent 在组装 system 时统一合并。

### packages/core/system-prompt/tests

- `system-prompt.test.ts` — 验证系统提示词服务的排序、替换、注销、异步求值与容错。

### packages/core/tool-todo

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/tool-todo/locale

- `en.json`
- `zh.json`

### packages/core/tool-todo/src

- `index.ts` — @lfaa/tool-todo 插件入口：向工具注册表贡献任务清单的写入与读取能力，清单作为会话状态落盘。

### packages/core/tool-todo/tests

- `todo.test.ts` — 验证任务清单工具：参数校验、整表替换、会话落盘与读取、非法输入不落库。

### packages/core/tools

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/core/tools/locale

- `en.json`
- `zh.json`

### packages/core/tools/src

- `builtin-tools.ts` — 提供内置核心工作区工具集（读文件、列目录、文本搜索、写文件、命令执行）。
- `edit-tools.crlf.test.ts` — 回归测试：验证 edit_file 在 CRLF 文件与 LF target 混用时能自动匹配并保留原始行尾。
- `edit-tools.ts` — 提供唯一命中校验的局部编辑工具：命中多处时拒绝执行，避免一次替换误改整份文件。
- `git-tools.ts` — 为智能体提供只读 Git 检查工具（git_status / git_diff），免去调用 exec 审批即可直接感知分支与改动。
- `index.ts` — @lfaa/tools Host 侧 Cordis 服务：统一管理工具注册表、内置工作区工具与权限安全执行。
- `search-tools.ts` — 提供 glob 文件名匹配与 grep 正则内容检索两个只读工具，替代整树逐文件盲目扫描。
- `types.ts` — 定义 @lfaa/tools 的无 DOM 领域契约：工具权限级别、参数协议、执行上下文及结果结构。

### packages/core/tools/tests

- `grep-file-path.test.ts` — 回归测试：验证 grep 工具既支持目录路径也支持单个文件路径（不再对单文件触发 ENOTDIR）。
- `tools-service.test.ts` — 验证 @lfaa/tools 路径沙箱越界拦截、文件读写/搜索工具执行与 Cordis 插件注册注销。

### packages/extension/connectors

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/connectors 构建入口：主入口在 lib/types/src 下（契约与源码同一 TypeScript 工程）。

### packages/extension/connectors/contract

- `index.ts` — 定义连接器（MCP / CLI）列表、CLI 动作模板与参数 schema 的浏览器安全契约；不回流可执行文件细节以外的敏感值。

### packages/extension/connectors/locale

- `en.json`
- `zh.json`

### packages/extension/connectors/src

- `catalog-runner.ts` — 目录连接任务：MCP 走「写配置 → 等连接」，CLI 走「缺命令就静默安装 → 写连接器」，进度写回任务对象。
- `cli-config.ts` — 校验 CLI 连接器配置与动作模板：占位符、参数 schema、argv 结构与危险字符都在这里拦住，执行层不再兜底。
- `cli-exec.ts` — CLI 连接器的进程层：解析可执行文件、按 argv 直接启动（不经过 shell）、超时或取消时回收进程树并截断输出。
- `cli-templates.ts` — 三个内置 CLI 连接器模板（gh / docker / pnpm）：只预填可执行文件、动作与参数 schema，不安装二进制、不写入密钥。
- `config-store.ts` — 用本机独立密钥加密 CLI 连接器配置（环境变量可能带凭据），以原子替换写入 ~/.lfaa/connectors.json。
- `connector-routes.ts` — 接入宿主令牌网关，提供连接器列表、CLI 增删改、探测与测试接口；响应只返回摘要与可编辑配置。
- `connector-service.ts` — 连接器聚合服务：把 MCP 服务器与 CLI 工具统一成一份列表，并把每个 CLI 动作注册成受审批约束的工具。
- `index.ts` — 连接器 Host 插件入口：装配聚合服务（MCP 只读展示 + CLI 工具）并公开 /api/connectors 路由。
- `installer.ts` — 静默安装：只执行内置目录声明的固定参数，按可用安装器选择 winget / choco / scoop / npm。

### packages/extension/connectors/src/catalog

- `cli.ts` — 内置目录的 CLI 条目：声明式动作复用模板，安装方式按 winget / choco / scoop / npm 依次尝试。
- `entry.ts` — 目录条目构造辅助：收敛重复字段，内置目录只关心差异部分。
- `index.ts` — 内置连接器目录：MCP 与 CLI 条目交错排列，首屏同时出现两类，避免整屏都是同一种连接器。
- `mcp.ts` — 内置目录的 MCP 条目：全部对应 npm 上真实存在的服务器包，首次连接由 npx 完成下载。

### packages/extension/connectors/tests

- `connectors.test.ts` — 验证 CLI 连接器：工具注册与启停、参数按 argv 传递不经 shell、超时回收、探测与 HTTP 接口。

### packages/extension/mcp

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — MCP 能力包构建入口，源码与公开契约使用同一 TypeScript 工程。

### packages/extension/mcp/contract

- `index.ts` — MCP 设置接口的浏览器安全契约。连接参数只由客户端写入，Host 不回显。

### packages/extension/mcp/locale

- `en.json`
- `zh.json`

### packages/extension/mcp/src

- `config-store.ts` — 用本机独立密钥加密所有连接字段，并以原子替换写入 MCP 配置。
- `connection.ts` — 使用官方协议客户端管理 MCP 传输、工具分页及取消。此模块只运行在 Host。
- `index.ts` — MCP Host 插件入口，管理连接服务并公开设置路由。
- `mcp-routes.ts` — 接入宿主令牌网关，提供 MCP 设置接口，响应只返回安全摘要。
- `mcp-service.ts` — Cordis MCP 服务：串行提交配置、独立管理连接，并随连接生命周期注销工具。
- `server-config.ts` — 校验 MCP 连接设置与 Claude Desktop/Cursor 导入内容，仅在 Host 使用。

### packages/extension/mcp/tests

- `echo-server.fixture.mjs` — 本地 MCP Stdio 夹具，用真实 SDK 协议模拟一个回显工具。
- `mcp-service.test.ts` — 验证原生 MCP 通过真实 Stdio/HTTP/SSE 握手、工具生命周期、审批元数据与加密持久化。

### packages/extension/plugins

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/plugins 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/extension/plugins/contract

- `index.ts` — @lfaa/plugins 公开契约：定义插件清单、安装记录、运行状态与可安装目录条目，无 Node 或 DOM 依赖。

### packages/extension/plugins/locale

- `en.json`
- `zh.json`

### packages/extension/plugins/src

- `index.ts` — @lfaa/plugins Host 侧 Cordis 服务：管理插件安装、启停、卸载、二创与运行状态。

### packages/extension/plugins/src/catalog

- `install-spec.ts` — 插件安装来源解析：把用户输入的包名 / GitHub 地址 / 本地路径 / tarball 归类，供 profile 安装使用。
- `module-aliases.ts` — 合包后的旧插件 module 名迁移表：包名合并后，旧 profile 记录与旧会话模块列表都要映射到新包名。
- `package-meta.ts` — 插件包显示元数据：从包目录读取 package.json 与 locale/<lang>.json 的 meta 段落，供插件清单投影使用。
- `plugin-presets.ts` — 插件模式预设持久化：记录当前默认模式，校验可用性并提供新会话的模块组合。
- `preset-summary.ts` — 插件模式预设的契约与摘要：预设由 bundle 提供，插件包不反向依赖 bundle。
- `record-id.ts` — 包名到稳定记录 id 的规整规则：安装记录、目录与二创共用同一套 id。

### packages/extension/plugins/src/inventory

- `plugin-inventory.ts` — 插件清单只读投影：把 Cordis Loader 条目与 bundle 静态装配模块合成一份快照，不做缓存。

### packages/extension/plugins/src/manager

- `builtin-state.ts` — 内置插件的启停持久化：记录被停用的模块名，启动时据此给对应 Loader 条目置 disabled。
- `fork-plugin.ts` — 插件二创：把插件包复制到 profile/plugins/<新 id>，换成独立包名并完成依赖探测；失败即回滚。
- `install-external.ts` — 外部插件安装：校验来源 → `pnpm add` → 识别包名 → 登记 → 自动启用；任一环节失败回滚，不留半装状态。
- `plugin-manager.ts` — @lfaa/plugins Host 侧插件生命周期管理器：基于 Cordis Loader 实现真实装载、卸载与 profile 持久化。
- `plugin-records.ts` — 插件记录持久化：profile 下 installed.json 的读写、原子替换与 cordis.yml 同步回调。
- `pnpm-spawn.ts` — pnpm 子进程调用：参数层拒绝 shell 元字符、Windows 下统一引用，并优先用 node 直接跑 pnpm 入口。
- `profile-packages.ts` — Profile 目录与依赖管理：目录骨架、cordis.yml 快照、pnpm 执行、包名/入口解析与仓库包定位。
- `record-hygiene.ts` — 插件记录的合包迁移：旧 module 名归一化，并按记录 id 合并重复项（启用状态取并集）。

### packages/extension/plugins/src/routes

- `plugin-routes.ts` — 为本机 Web 服务提供 /api/plugins/* HTTP 接口，管理插件安装、启用、停用、卸载、编辑与二创。

### packages/extension/plugins/tests

- `install-spec.test.ts` — 验证插件安装来源解析：npm 包名、GitHub 地址、本地目录与压缩包各自归类，非法输入明确拒绝。
- `module-aliases.test.ts` — 验证合包后的插件 module 名迁移：旧会话模块名与旧 profile 记录都要映射到新包名。
- `plugin-inventory.test.ts` — 验证插件清单投影：包元数据读取、Loader 条目相位、静态装配顺序与只读接口返回。
- `plugin-routes.test.ts` — 验证插件安装流式接口：只接受 POST + JSON，SSE 逐行推送日志并以 done/failed 收尾。
- `plugins-lifecycle.test.ts` — 验证 @lfaa/plugins 基于 Cordis Loader 的真实安装、启用、停用、卸载与 profile 持久化。
- `pnpm-spawn.test.ts` — 验证 pnpm 子进程调用层：安装来源拒绝 shell 元字符、Windows 命令行全部引用、优先绕开 shell。

### packages/extension/skills

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/skills 构建入口：主入口在 lib/types/src 下（契约与源码同工程），并随产物复制内置技能文档。

### packages/extension/skills/contract

- `index.ts` — @lfaa/skills 公开契约：定义技能来源、摘要、详情、编辑输入与插件技能注册接口，无 Node 或 DOM 依赖。

### packages/extension/skills/locale

- `en.json`
- `zh.json`

### packages/extension/skills/src

- `index.ts` — @lfaa/skills Host 侧 Cordis 服务：统一暴露技能发现、Git 安装、编辑、二创、启停与 Agent 按需加载工具。
- `skill-format.ts` — @lfaa/skills 技能文档与标识校验工具：负责 ID 合法性校验、slug 归一化以及 SKILL.md frontmatter 解析与组装。
- `skill-routes.ts` — 为本机 Web 服务提供 /api/skills/* HTTP 接口，支持技能列表、详情、编辑、二创、启停与删除。
- `skill-service.ts` — @lfaa/skills Host 侧技能管理逻辑：发现内置/项目技能、管理个人技能文件、Git 安装与插件技能注册，提供原子保存与二创。

### packages/extension/skills/tests

- `skills-lifecycle.test.ts` — @lfaa/skills 生命周期与二创回归测试：覆盖个人/项目/插件技能发现、版本冲突、二创复制与运行前校验。

### packages/feedback/message-feedback

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/feedback/message-feedback/locale

- `en.json`
- `zh.json`

### packages/feedback/message-feedback/src

- `index.ts` — @lfaa/message-feedback：消息反馈服务。赞/踩与备注持久化在 ~/.lfaa/feedback.json，供聊天界面记录与回读。

### packages/feedback/message-feedback/tests

- `message-feedback.test.ts` — 验证消息反馈：入参归一化、持久化 upsert/remove 与 HTTP 接口的成功/失败分支。

### packages/fs/fs-observation-policy

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md` — @lfaa/fs-observation-policy
- `package.json`
- `tsconfig.json`

### packages/fs/fs-observation-policy/locale

- `en.json`
- `zh.json`

### packages/fs/fs-observation-policy/src

- `index.ts` — @lfaa/fs-observation-policy：写前必读。写文件/改文件前，同一会话必须先读过该文件，避免盲改。

### packages/fs/fs-observation-policy/tests

- `fs-observation-policy.test.ts` — 验证写前必读：已存在文件未读时拦截、读过放行、新建文件放行、会话隔离。

### packages/goal/goal

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/goal/goal/locale

- `en.json`
- `zh.json`

### packages/goal/goal/src

- `http-handler.ts` — @lfaa/goal：目标 HTTP 接口，供聊天界面读取当前会话目标并保存用户编辑的目标文字。
- `index.ts` — @lfaa/goal 目标能力包入口：导出目标服务与目标工具，并组合成默认插件。
- `service.ts` — @lfaa/goal：会话目标服务。目标与进展持久化在 ~/.lfaa/goals.json，供目标工具与界面读取。

### packages/goal/goal/src/tool

- `goal-tool.ts` — @lfaa/tool-goal：把目标服务包装成模型可调用的目标工具（新建 / 更新 / 查看）。

### packages/goal/goal/tests

- `goal-service.test.ts` — 验证目标服务的持久化往返、状态流转与进度归一。
- `http-handler.test.ts` — 验证目标 HTTP 接口：按会话读取目标、编辑目标文字、空值与跨会话编辑被拒绝。
- `tool-goal.test.ts` — 验证目标工具的输出格式、参数归一，以及在真实 Cordis 上下文里注册进工具表。

### packages/guard/timeout-policy

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md` — @lfaa/timeout-policy
- `package.json`
- `tsconfig.json`

### packages/guard/timeout-policy/locale

- `en.json`
- `zh.json`

### packages/guard/timeout-policy/src

- `index.ts` — @lfaa/timeout-policy：为所有工具执行套一层统一超时，超时中止 signal 并返回可读失败结果。

### packages/guard/timeout-policy/tests

- `timeout-policy.test.ts` — 验证超时策略：超时返回可读结果并中止信号，快工具原样通过，父级取消向内传递。

### packages/host/terminal

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/host/terminal/locale

- `en.json`
- `zh.json`

### packages/host/terminal/src

- `index.ts` — @lfaa/terminal Host 插件入口：注册 terminal 服务，并导出 WebSocket 升级处理器给 web-server 挂载。
- `terminal-service.ts` — @lfaa/terminal Host 服务：按聊天会话维护一个真实 PTY（node-pty），负责输入、窗口尺寸与进程回收。
- `types.ts` — @lfaa/terminal 契约：会话描述、启动参数与 WebSocket 消息格式。
- `ws-handler.ts` — @lfaa/terminal WebSocket 升级处理：/api/terminal 走一次性令牌校验，再把双向帧转给 TerminalService。

### packages/host/terminal/tests

- `terminal-service.test.ts` — 真实终端 Host 服务单测：起 PTY、写输入拿到回显、改尺寸、杀掉进程后池子里不再有它。

### packages/host/web-server

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/host/web-server/src

- `desktop-downloads.ts` — 桌面宿主的私有下载 IPC。校验消息并把 Electron 暂存文件交给浏览器服务，HTTP 客户端无法发布该消息。
- `detect-root.ts` — @lfaa/web-server：从起始目录向上定位 LFAA 工程根目录，供开发模式回退使用。
- `dev-server.ts` — @lfaa/web-server：开发模式宿主：启动 Vite 开发服务器，并把同一套 /api 网关与令牌注入挂到它上面。
- `index.ts` — @lfaa/web-server：公开入口：开发宿主（Vite）、生产宿主（静态托管）与共用运行时装配。
- `runtime.ts` — @lfaa/web-server：装配 Host 运行时（沙箱、bundle、各能力处理器与统一网关），并生成一次性接口令牌。
- `static-files.ts` — @lfaa/web-server：生产静态托管的文件层实现：MIME、路径边界、Range、缓存头与响应工具。
- `static-server.ts` — @lfaa/web-server：生产模式宿主：只监听本机，静态托管 Web 产物，并把 /api 交给同一套网关与一次性令牌。

### packages/host/web-server/src/handlers

- `handlers-backgrounds.ts` — @lfaa/web-server：个人背景图接口：列表、上传、读取与删除；文件保存在本机 ~/.lfaa/backgrounds。
- `handlers-canvas.ts` — Host 网关内的项目画布路由，所有操作先通过本机令牌及项目登记校验。
- `handlers-chat.ts` — @lfaa/web-server：构造会话与运行相关处理器（聊天、编码会话、媒体直连生成、Agent 运行）。
- `handlers-notifications.ts` — @lfaa/web-server：提供自定义通知提示音的上传、列表、读取与删除接口；文件保存在本机 ~/.lfaa/notification-sounds。
- `handlers-trash.ts` — 统一回收站 HTTP 处理器：提供 /api/trash/* 列表/预览/恢复/彻底删除/清空接口，并拦截画布、项目、素材与资料库资产的默认 DELETE 请求转入 30 天回收站。
- `handlers.ts` — @lfaa/web-server：构造常规能力 HTTP 处理器（工作区、技能、插件、模型、记忆、媒体文件等），并集中提供

### packages/host/web-server/src/trash

- `trash-store.ts` — 统一回收站本地存储：按 FreeDesktop 风格以 meta.json + payload/ 管理素材、资产、画布与项目的软删除、30 天自动清理、恢复与彻底删除。

### packages/host/web-server/tests

- `backgrounds.test.ts` — 验证个人背景图接口：上传、列表、读图、删除；直接放进目录的文件也会被发现；非图片与超大内容被拒绝。
- `notification-sounds.test.ts` — 验证自定义提示音接口：上传、列表、读取文件与删除，并拒绝非音频与超大内容。
- `static-server.test.ts` — 验证生产静态托管的关键边界：令牌注入、MIME 与缓存、目录穿越、SPA 回退、Range 与只读方法限制。
- `trash-store.test.ts` — 统一回收站 TrashStore 回归测试：覆盖软删除、30 天自动清理、预览解析、彻底删除与清空。

### packages/interaction/commands

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/interaction/commands/locale

- `en.json`
- `zh.json`

### packages/interaction/commands/src

- `index.ts` — @lfaa/commands：斜杠命令注册 seam。插件向 Host 注册命令，聊天输入栏通过 /api/commands 发现并执行。

### packages/interaction/commands/tests

- `commands.test.ts` — 验证斜杠命令 seam：注册/注销、内置命令展开、执行异常与 HTTP 分支。

### packages/media/canvas

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — 将画布 Host 插件打包为默认入口，公开契约保留编译后的独立入口。

### packages/media/canvas/contract

- `index.ts` — 无限画布公开契约，供浏览器编辑器和 Host 验证器共用。

### packages/media/canvas/locale

- `en.json`
- `zh.json`

### packages/media/canvas/src

- `canvas-folders.ts` — 无限画布分类文件夹持久化存储：读写 ~/.lfaa/canvas/folders.json，支持增删改查。
- `canvas-runner.ts` — 画布运行器复用现有模型服务，按节点版本记录实际提交输入与输出。
- `canvas-service.ts` — Cordis 画布服务：串行保存同一画布及提交记录，生成操作在独立任务中运行。
- `canvas-store.ts` — Host 持久化项目画布、素材与独立的运行记录。
- `graph.ts` — Host 校验画布文档、端口和素材版本，拒绝跨项目引用与循环。
- `index.ts` — 无限画布宿主插件入口，供 Cordis Loader 与 HTTP 装配使用。

### packages/media/canvas/tests

- `board-actions.test.ts` — 画布复制与删除服务回归测试：验证复制画布节点与资产、以及删除画布目录。
- `canvas-folders.test.ts` — 画布分类文件夹存储单测：覆盖创建、列出、重名拦截、重命名与删除。
- `canvas-recovery.test.ts` — 验证宿主重新装配后续查已提交的厂商任务，其他镜头的已选结果保持可用。
- `graph.test.ts` — 验证画布连线端口、版本固定和快照拒绝规则。
- `project-summaries.test.ts` — 画布项目摘要存储回归测试：验证过滤无画布项目、统计画布数量、取最新画布与封面图片资产。
- `unified-media-storage.test.ts` — 验证画布资产统一存放在资料库 .lfaa-media/{images,videos} 目录、写入 sidecar 元数据，并支持直接链接资料库素材。

### packages/media/tool-media

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/media/tool-media/locale

- `en.json`
- `zh.json`

### packages/media/tool-media/src

- `image-ratio.ts` — @lfaa/tool-media：生图比例识别与尺寸映射（纯函数，供媒体直连、generate_image 工具与计划接口共用）。
- `index.ts` — @lfaa/tool-media：把套餐里的生图模型包装成 generate_image 工具，生成图片保存到工作区并返回路径。
- `media-direct.ts` — 媒体直连生成接口：选中生图/生视频/语音模型时，输入描述直接生成媒体并写入会话消息。
- `media-http.ts` — 生成素材的 HTTP 接口：文件读取/删除、素材库列表与元数据 sidecar 读写。
- `media-thumb.ts` — 媒体缩略图磁盘缓存：浏览器生成一次 WebP 后回传给 Host 落盘，之后任何客户端只读小图，不再反复读取整份原图。
- `video-options.ts` — 视频直连参数解析：从用户描述里读出时长，并去掉“帮我生成一个…五秒视频”这类指令词，

### packages/media/tool-media/tests

- `image-ratio.test.ts` — 验证生图比例识别与尺寸映射：明确比例优先、等值换算、未指定时用常用默认比例。
- `media-direct-video.test.ts` — 验证视频直连：时长解析、指令清理、导演扩写与 NDJSON 计划事件。
- `media-helpers.ts` — 媒体包测试共用的 HTTP 假请求/假响应与 1×1 PNG 常量，供工具测试与接口测试复用。
- `media-http.test.ts` — 验证媒体文件接口与素材库接口：允许根校验（含 Windows 大小写）、越界拒绝、删除与 sidecar 清理。
- `media-thumb.test.ts` — 验证宿主缩略图缓存：GET 未生成返回 204、POST 后可按宽度命中、越界拒绝与非法内容校验。
- `tool-media.test.ts` — 验证媒体工具：generate_image 调用模型服务、落盘文件并返回路径；缺少提示词时给出可读错误。
- `video-options.test.ts` — 验证视频直连参数解析：从描述读取时长，并清掉指令词与时长尾巴。

### packages/plan/plan-mode

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/plan/plan-mode/locale

- `en.json`
- `zh.json`

### packages/plan/plan-mode/src

- `index.ts` — @lfaa/plan-mode：计划模式。开启后写/执行类工具被中间件拦截，只留下只读探查，先给计划再动手。

### packages/plan/plan-mode/tests

- `plan-mode.test.ts` — 验证计划模式：进入后写/执行工具被拦截、只读仍可用、退出恢复、会话之间互不影响。
- `plan-to-todos.test.ts` — 验证计划文本转任务清单：分步才建清单、写入会话、单行计划不落库、会话缺失不报错。

### packages/sandbox/sandbox

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/sandbox/sandbox/locale

- `en.json`
- `zh.json`

### packages/sandbox/sandbox/src

- `index.ts` — @lfaa/sandbox 安全边界包入口：导出沙箱契约、执行策略与本地后端；默认只挂策略，本地后端由装配层单独提供。
- `policy.ts` — @lfaa/sandbox-policy：逐次沙箱策略。按工具指定本次执行使用的沙箱模式，缺省沿用调用方。
- `seam.ts` — @lfaa/sandbox 抽象契约：文件影响模式、沙箱策略与执行前判定接口，不绑定具体后端。

### packages/sandbox/sandbox/src/local

- `command-policy.ts` — 命令级写入与危险操作分析：解析重定向与常见写入命令，并识别与模式无关的灾难性操作。
- `index.ts` — @lfaa/sandbox-local 本地后端：在工具层按模式判定写入与命令，明确标注不具备进程级强制。

### packages/sandbox/sandbox/tests

- `command-policy.test.ts` — 验证命令级策略：重定向与写入命令受工作区约束，灾难性命令在任何模式下都拒绝。
- `policy.test.ts` — 验证逐次沙箱策略：模式解析、写入/命令按模式拦截、只对配置的工具生效。
- `sandbox.test.ts` — 验证本地沙箱后端的三种模式判定：只读拒绝、工作区限制、全权放行。
- `tools-enforcement.test.ts` — 验证沙箱与工具层的集成：只读模式拦截写入与命令，工作区模式放行工作区内写入。

### packages/schedule/tool-schedule

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md` — @lfaa/tool-schedule
- `package.json`
- `tsconfig.json`

### packages/schedule/tool-schedule/locale

- `en.json`
- `zh.json`

### packages/schedule/tool-schedule/src

- `index.ts` — @lfaa/tool-schedule：持久化定时任务（一次性或重复），提供创建、查看、取消与到期领取工具。

### packages/schedule/tool-schedule/tests

- `tool-schedule.test.ts` — 验证定时任务：时间解析、重复推进、到期领取与工具端到端（临时存储）。

### packages/session/handoff

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/session/handoff/locale

- `en.json`
- `zh.json`

### packages/session/handoff/src

- `http-handler.ts` — @lfaa/handoff：交接 HTTP 接口，供聊天界面读取待处理交接并接手/取消；接手时创建同目标 goal。
- `index.ts` — @lfaa/handoff 交接能力包入口：导出交接服务、工具与 HTTP 接口，并组合成默认插件。
- `service.ts` — @lfaa/handoff：会话交接服务。交接单持久化在 ~/.lfaa/handoffs.json，供交接工具与界面读取。

### packages/session/handoff/src/tool

- `handoff-tool.ts` — @lfaa/tool-handoff：把交接服务包装成模型可调用的交接工具（创建 / 查看 / 接手 / 取消）。

### packages/session/handoff/tests

- `handoff-service.test.ts` — 验证交接服务：创建/方向过滤/项目隔离、接手与取消权限、持久化往返。
- `http-handler.test.ts` — 验证交接 HTTP：按会话列待接手、接手时创建目标、跨项目拒绝、取消。

### packages/session/session-title

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/session/session-title/locale

- `en.json`
- `zh.json`

### packages/session/session-title/src

- `index.ts` — @lfaa/session-title：会话标题服务。提供启发式简洁标题与可选的模型生成标题（失败自动回落）。

### packages/session/session-title/tests

- `session-title.test.ts` — 验证会话标题：启发式清洗、模型输出归一、模型失败回落与 HTTP 接口分支。

### packages/shell/shell

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/shell/shell/locale

- `en.json`
- `zh.json`

### packages/shell/shell/src

- `index.ts` — LFAA Host 的 Shell 服务，统一前台命令的执行时限、取消、增量输出及结算。

### packages/shell/shell/src/bash

- `resolve-bash.ts` — Bash 本地执行入口，区分原生 Bash、Git Bash 和选择的 WSL 路由。

### packages/shell/shell/src/env

- `command-output.ts` — Shell 环境的标准输出解码。接收原始字节，兼容 UTF-8 及 Windows 本地控制台。

### packages/shell/shell/src/pwsh

- `resolve-pwsh.ts` — Windows 进程适配，直接启动 PowerShell 或 CMD，并在 PowerShell 使用 UTF-8。

### packages/shell/shell/tests

- `encoding.test.ts` — 验证各输出流独立识别 Unicode 编码，分段预览保留未完成字符。
- `execution.test.ts` — 用真实子进程验证 Shell 执行中的输出、非零退出与命令时限。

### packages/spill/spill-local

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md` — @lfaa/spill-local
- `package.json`
- `tsconfig.json`

### packages/spill/spill-local/locale

- `en.json`
- `zh.json`

### packages/spill/spill-local/src

- `index.ts` — @lfaa/spill-local：超长工具结果落到本机文件，只回首尾窗口与文件路径，避免上下文被撑爆。

### packages/spill/spill-local/tests

- `spill-local.test.ts` — 验证长结果落盘：短结果不动、长结果写文件并只回窗口，文件名与元数据正确。

### packages/ui/icons

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/ui-icons 构建入口：主入口在 lib/types/src 下（契约与源码同工程），Client 组件由 ./client 源码直出。

### packages/ui/icons/client

- `FileTypeIcon.module.css` — 类型图标渲染样式：统一尺寸与极淡暗色描边，避免浅色背景上的白色文档图标糊成一片（深色主题下描边几乎不可见）。
- `css-modules.d.ts` — 为图标包 Client 侧 CSS Modules 提供类型声明。
- `glyphs.ts` — 彩色文件 / 文件夹类型图标数据：从 @iconify-json/vscode-icons@1.2.30（MIT，见同目录 LICENSES/）提取，只保留文件树用到的图标。
- `index.tsx` — 文件类型图标组件：按扩展名或目录职责取彩色字形，渲染为内联 SVG；文件树、标签栏、面包屑与变更列表共用。

### packages/ui/icons/contract

- `file-glyphs.ts` — 文件 / 文件夹类型图标的纯映射：扩展名、特殊文件名与目录职责 → 图标 key。
- `index.ts` — @lfaa/ui-icons 公共契约：文件/文件夹图标 key 的映射规则，供文件树、标签栏与面包屑共同消费。

### packages/ui/icons/LICENSES

- `vscode-icons-LICENSE.txt`

### packages/ui/icons/src

- `index.ts` — @lfaa/ui-icons Host 入口：文件/目录图标映射与类型，React 组件见 ./client。

### packages/ui/icons/tests

- `file-glyphs.test.tsx` — 验证 @lfaa/ui-icons 的映射与渲染：扩展名、特殊文件名、目录职责都应命中存在的彩色图标，而不是统一兜底。

### packages/ui/layout

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/ui-layout 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/ui/layout/client

- `css-modules.d.ts` — 为 Client 中的 CSS Modules 提供静态类名类型。
- `index.tsx` — 导出浏览器工作区插件入口与服务类型，不把 React 或 DOM 引入 Host 入口。
- `locales.ts` — 集中维护 Shell、导航和本地项目界面的中英文文案。
- `shortcut-defaults.ts` — 快捷键默认键位总表（唯一来源）：动作注册与悬停提示都从这里取，避免两处漂移。
- `shortcut-state.ts` — 快捷键状态：动作注册表 + 用户键位覆盖，从 workbench-service 抽出，控制服务文件体量。
- `shortcuts.ts` — 工作台快捷键基础设施：真实动作注册表元数据、键位标准化与匹配、冲突检测，以及浏览器本地键位持久化。
- `workbench-service.ts` — 在浏览器 Cordis 上下文中注册并管理四栏工作台服务与插件贡献生命周期。
- `workbench-snapshot.ts` — 浏览器工作台的订阅快照，集中描述四栏与插件贡献的公开读取状态。

### packages/ui/layout/client/navigation

- `AppMenu.module.css` — 更多应用悬浮卡片与图钉操作：按 docs/standards/floating-cards.md 对齐账号卡片的几何、密度与视觉。
- `AppMenu.tsx` — 展示更多应用：按悬浮卡片规范贴左二栏展开，桌面支持固定入口，手机汇总底栏收纳项。
- `DomainSidebarMenu.tsx` — 根据左一导航栏选中的功能域（资料库、图像、定时任务、插件、代码审查与扩展），动态渲染对应的左二功能菜单。
- `GroupHeaderTools.tsx` — 渲染左二分组标题栏右侧按需显现的排序下拉按钮与快捷操作按钮（如新建项目 / 新聊天）。
- `ModeMenu.module.css`
- `ModeMenu.tsx` — 模式卡片：按悬浮卡片规范贴左二栏展开，复用账号卡片的几何、密度与交互。
- `NavigationGroups.module.css` — 工作区侧栏专属“新聊天”按钮与项目排序/创建工具栏样式（其余列表样式复用 SidebarSectionList）。
- `NavigationGroups.tsx` — 管理工作区“新聊天”与置顶、自定义分区、项目、最近聊天分组，并复用 SidebarSectionList 渲染。
- `NavigationIcon.tsx` — 将统一的 Tabler 图标映射为侧栏可复用组件；「working」使用圆弧图标表示 Agent 运行中。
- `NavigationNewChatButton.tsx` — 侧栏顶部的「新聊天」入口按钮，负责选中态样式与无障碍标记，点击行为由父级注入。
- `NavigationRail.module.css` — 一级图标栏及其悬浮菜单，使用 Shell 提供的主题变量。
- `NavigationRail.tsx` — 呈现工作台一级图标栏，负责直接导航、更多菜单及本地工作区状态。
- `NavigationSidebar.module.css` — 左二导航栏顶部工具、模式切换与设置菜单容器。
- `NavigationSidebar.tsx` — 复用同一套左二菜单栏骨架，根据 WorkbenchDomainConfig 切换头部形态与业务菜单内容。
- `Toolbar-Tip.tsx` — 左二栏工具栏与列表行的浮层提示：用 portal 渲染到 body，避免被左栏层叠上下文与胶囊裁切。
- `UserMenu.module.css` — 用户菜单固定在一级图标栏左下角，并跟随 Shell 主题变量。
- `UserMenu.tsx` — 展示本地用户菜单，并复用现有外观设置入口与主题插件提供的头部快捷操作。
- `app-menu-geometry.ts` — 更多应用菜单几何：卡片贴着左二会话栏内侧展开，宽度跟随该栏而不盖住中间会话区。
- `chat-time-buckets.ts` — 聊天模式的会话时间分桶：今天 / 昨天 / 最近 7 天内；7 天以外不进列表（不删除，搜索仍可找到）。
- `chat-time-groups.ts` — 聊天模式左二栏：把会话按「今天 / 昨天 / 最近（7 天内）」分组，复用工作模式的会话行与分组外观。
- `mode-menu-geometry.ts` — 模式菜单几何：卡片钉在左二栏内侧展开，宽度跟随该栏，不盖住中间会话区。
- `navigation-groups-config.ts` — 组装左二栏「置顶 / 自定义分区 / 项目」三个分组配置，不持有 React 状态，选中态与拖放事件由调用方注入。
- `navigation-items.ts` — 侧栏导航行构建器：把项目、会话与最近记录转换为 SidebarSectionList 的统一行配置，不持有 React 状态。
- `navigation.ts` — 定义浏览器 Shell 共用的导航与最近列表类型，项目类型由公共契约提供。
- `popover-geometry.ts` — 悬浮卡片几何共用口径：与 @lfaa/ui-theme 的 --popover-* 令牌保持一致，
- `session-list-paging.ts` — 左二栏会话分页：每批显示 6 条会话，项目子会话与「最近」分组共用同一套窗口计算与展开/收起控件。
- `use-navigation-prefs.ts` — 集中管理左二会话项目菜单栏的展开/收起、排序与活跃分组记忆，刷新页面后完整恢复用户操作。
- `use-session-window.ts` — 左二栏会话窗口状态：项目子会话按行记录展开批次，「最近」分组共享一条窗口；折叠项目时重置。
- `usePinnedApps.ts` — 读取并持久化侧栏固定的应用入口，默认固定参考图中的站点。
- `user-menu-geometry.ts` — 用户菜单浮层几何：让账号卡片贴着左二会话栏内侧展开，宽度跟随该栏而不压到中间会话区。
- `workbench-domains.ts` — 集中定义四栏/三栏工作台域配置、共用导航目标与视图标题解析，避免各组件分散硬编码。

### packages/ui/layout/client/panels

- `ContextPanel.module.css` — 四栏右侧菜单栏样式，使用统一主题变量并与左二栏视觉一致。
- `ContextPanel.tsx` — 呈现四栏布局的右侧上下文菜单栏，渲染插件注册的上下文面板。
- `SearchDialog.module.css` — 搜索弹层为 Shell 导航提供聚焦后的快速入口。
- `SearchDialog.tsx` — 搜索弹层：同时搜索会话标题/消息正文、侧栏功能与本地项目，支持键盘选择与命中片段高亮。
- `SettingsDialog.module.css` — 设置中心弹窗样式：压暗背景、居中玻璃卡片、左栏目录与右内容滚动区；颜色全部取自主题变量。
- `SettingsDialog.tsx` — 设置中心弹窗：把原先占满工作区的设置页收敛为居中卡片（左栏目录 + 右内容区），
- `SettingsMenu.tsx` — 将设置中心目录映射为通用 SidebarSectionList 配置，复用同一套左二菜单栏组件与样式。
- `SidebarSectionList.badge.module.css` — 会话行工作树分支标签样式；与侧栏主样式分开，避免单文件继续膨胀。
- `SidebarSectionList.controls.module.css`
- `SidebarSectionList.create.module.css` — 左二列表末尾弱化操作行的样式（如「+ 创建新项目」），与主列表样式分文件以控制单文件行数。
- `SidebarSectionList.module.css` — 统一的左二菜单栏分组、列表、搜索框与空态样式，供工作区与设置中心共用。
- `SidebarSectionList.presence.module.css` — 新会话草稿行的进出场：只让草稿行收起/展开高度，历史会话行保持即时切换。
- `SidebarSectionList.tsx` — 统一的左二菜单栏列表原语：复用搜索框、分组标题、折叠能力、拖拽分区、空态与液态玻璃交互样式。
- `SidebarStatus.module.css` — 静音会话的小铃铛关闭标记：只表达通知状态，不抢主标签。
- `settings-catalog.ts` — 定义设置中心目录的分组与中英文标题：只登记已接入的页面，未接入不占目录位。

### packages/ui/layout/client/shell

- `BottomDock.module.css` — 底部面板：固定在中间+右栏下方，高度固定、内容撑满，边框与配色走主题变量。
- `BottomDock.tsx` — Shell 底部面板容器：标签条 + 收起按钮，内容由插件通过 workbench.registerBottomPanel 贡献。
- `DesktopTitleBar.module.css`
- `DesktopTitleBar.tsx` — 桌面端单行一体化顶栏与 A1 三级色阶圆角主画布外框：
- `PaneAnim.module.css`
- `ResizeHandle.module.css` — 浏览器工作台的左右栏分隔手柄、高亮反馈及拖拽裁剪。
- `ShellBackground.module.css`
- `ShellBottomDock.module.css` — 底部面板宿主：上沿预览线拖拽、阻尼渐隐与松手平滑高度过渡，配色走主题变量。
- `ShellBottomDock.tsx` — Shell 底部面板宿主：有贡献且展开时占第二行（跨中间+右侧两列），与侧栏共用方案 A 预览线拖拽与平滑吸附收起。
- `ShellLeftColumn.tsx` — 组合四栏 Shell 左栏：一级图标栏、窄屏抽屉遮罩、左二导航侧栏与宽度拖拽手柄。
- `ShellRightColumn.tsx` — 组合四栏 Shell 右栏：拖拽宽度手柄与插件上下文面板。
- `ShellSettingsDialog.tsx` — 设置中心弹窗宿主：以覆盖层形式盖在当前工作区之上，关闭时保留 150ms 平滑退场后卸载。
- `ShellWorkspace.tsx` — 渲染四栏 Shell 中央工作区：顶部栏、插件视图、项目视图、欢迎页与功能占位页。
- `SidebarResizeHandle.tsx` — 渲染桌面端左二栏或右侧栏边缘的垂直拖拽调宽手柄。
- `WorkbenchShell.module.css` — 四栏可折叠工作区主结构，消费 @lfaa/ui-theme 提供的明暗与玻璃配色变量。
- `WorkbenchShell.tsx` — 装配主题、四栏可折叠骨架，并通过 Cordis workbench 服务响应业务插件贡献。
- `WorkspaceBar.tsx` — 渲染工作区顶部栏：左侧栏展开/收起按钮、当前标题、插件工作区快捷入口与右侧栏展开/收起按钮。
- `bottom-panel-state.ts` — 底部面板状态：展开标志 + 贡献表，从 workbench-service 抽出来，避免服务文件继续膨胀。
- `library-tabs.ts` — 资料库分类标识与校验：从 workbench-service 抽出，控制服务文件体量。
- `pane-anim.ts` — Shell 布局编排动画原语：最大化/还原时让会话列与工作台在同一时间轴上互补变形——
- `sidebar-resize.ts` — 计算左二栏与右侧栏拖拽调宽、弹性阻尼压缩、中心区保护与 50% 阈值磁吸折叠纯函数。
- `ui-preferences.ts` — 统一管理浏览器端 Shell 交互记忆（路由、设置中心子页、左右栏折叠、分组展开、自定义分区折叠、排序与模式），刷新后完整保留用户操作。
- `use-pane-anim.ts` — Shell 布局编排动画的编排入口：把一次布局变更包成「先定格 → 切换排版 → 补间 → 归位」，
- `use-pointer-idle-guard.ts` — 刷新后的指针 / 焦点守卫：浏览器可能把焦点还给上次点过的按钮，指针也还停在原处。
- `use-sidebar-mode.ts` — 左二内容模式（会话列表 / 项目工作区）的本地状态与持久化，避免 Shell 主组件继续膨胀。
- `use-workspace-mode-sync.ts` — 聊天 / 工作模式与项目绑定的同步：聊天模式不绑项目，回到工作模式时恢复上次项目。
- `usePaneMotionSuspend.ts` — 面板轨道过渡的暂停开关：窗口缩放与拖拽吸附由指针／视口直接驱动宽度，这期间暂停轨道过渡，
- `useShellShortcuts.ts` — 四栏 Shell 的全局快捷键：注册壳层/导航动作，并按注册表键位分发；Esc 保持固定语义。
- `useSidebarResize.ts` — 管理浏览器工作台的左右栏调宽、弹性吸附和本地宽度偏好。
- `useVerticalResize.ts` — 管理底部面板的实时跟手纵向拖拽、0.3 弹性阻尼、50% 阈值平滑磁吸收起与键盘调高。
- `useViewportMode.ts` — 监听桌面、平板与手机断点，供四栏 Shell 切换侧栏抽屉与移动底栏模式。
- `vertical-resize.ts` — 计算底部面板（如终端）纵向拖拽调高、0.3 弹性阻尼、50% 磁吸折叠与预览线偏移纯函数。

### packages/ui/layout/contract

- `index.js` — 声明四栏 Shell 的无 DOM 公共区域标识与跨包插件贡献契约，供 Host 与 Client 共同使用。
- `index.js.map`
- `index.ts` — 声明四栏 Shell 的无 DOM 公共区域标识与跨包插件贡献契约，供 Host 与 Client 共同使用。

### packages/ui/layout/src

- `index.ts` — @lfaa/ui-layout Host 入口：共享契约已下沉到 contract/，这里只做重导出以保持公开入口不变。

### packages/ui/layout/tests

- `app-menu-geometry.test.ts` — 更多应用菜单浮层几何单测：卡片必须落在左二栏内，宽度跟栏走且不压住中间会话区。
- `chat-time-groups.test.ts` — 验证聊天模式的时间分桶：今天 / 昨天 / 最近 7 天内，7 天外不进列表；分组顺序与空组隐藏。
- `contribution-detach.test.tsx` — 验证界面贡献「可拆卸」：注册的视图/上下文面板被 dispose 后只移除自己，其余贡献与外壳照常渲染。
- `domain-sidebar.test.tsx` — 验证资料库左二菜单已把「图像」并入分类，旧图像域的 热门/模板/我的图像 占位菜单不再出现。
- `mode-menu-geometry.test.ts` — 模式菜单浮层几何单测：卡片必须落在左二栏内，宽度跟栏走且不压住会话区。
- `navigation-groups.test.ts` — 验证左二导航的项目分组语义：置顶只在顶部增加快捷入口，项目本身仍留在「项目」或所属自定义分区里。
- `persistence-lifecycle.test.ts` — 验证四栏 Shell 与界面交互偏好的浏览器持久化记忆（导航路由、设置子页、左右栏折叠、分组收起、分区折叠、排序与模式）。
- `preview-pane.test.tsx` — 验证「预览区在左」下两列的收起/展开语义：关掉最后一个标签只收预览列，展开时补回分屏。
- `resize-preview.test.ts` — 验证左右栏与底部面板统一预览线拖拽、阻尼吸附纯函数、左栏 CollapsePane 包裹与过渡样式契约。
- `session-draft-row.test.ts` — 验证新会话草稿在项目下的侧栏行：立即可见、当前选中、点击只回到草稿而不打开历史会话。
- `session-list-paging.test.ts` — 验证会话列表分页：每批 6 条、逐批展开、全部展开后收起，以及项目行与「最近」分组的控件接线。
- `session-running-indicator.test.tsx` — 验证左二会话行的任务状态联动：进行中显示转圈，完成且未读显示小圆点，两者互斥；正在查看的会话不显示完成点。
- `settings-dialog.test.tsx` — 验证设置中心改为弹窗呈现：目录/关闭入口可访问，未接入设置项退化为占位说明，
- `shortcut-defaults.test.ts` — 默认快捷键表守护：键位不重复，且不落在浏览器 / 系统会截走的组合上（避免「设了没反应」）。
- `shortcuts.test.ts` — 快捷键基础设施单测：键位标准化、展示、默认值与用户覆盖合并、冲突检测。
- `toolbar-tip.test.ts` — 验证左二栏工具提示的贴边位移：位移量只由锚点中心与气泡宽度决定，重复计算不再变化。
- `user-menu-geometry.test.ts` — 用户菜单浮层几何单测：卡片宽度必须跟着左二栏走，不能盖到中间会话区。
- `workspace-bar-toggle.test.tsx` — 验证工作区顶栏的展开/收起入口统一由共享 PanelToggleButton 渲染：文案、展开状态与右栏隐藏规则保持一致。
- `workspace-scroll-viewport.test.tsx` — 验证工作区中央与左二滚动视口预留稳定槽位，长内容出现滚动条时不挤动标题与列表内容。

### packages/ui/primitives

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/ui-primitives 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/ui/primitives/client

- `CapsuleBar.module.css`
- `CapsuleBar.tsx` — 工作台头部胶囊条：左二菜单栏头部与中间区域顶栏共用同一份「圆角卡片 + 一排动作」外观，
- `CollapsePane.module.css` — 折叠容器布局与裁剪：撑满所在轨道、裁剪溢出内容；宽度动画交给调用方的容器样式。
- `CollapsePane.tsx` — 共享折叠面板容器：展开即挂载、收起后等过渡结束再卸载，并裁剪溢出的固定宽度内容，
- `ConfirmDialog.module.css` — 共享二次确认弹窗样式：居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本。
- `ConfirmDialog.tsx` — 共享二次确认弹窗组件：采用居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本，供删除/移除等高风险操作复用。
- `HoverTip.module.css` — 共享悬停提示胶囊样式：正上方居中对齐、暗色半透明磨砂胶囊与快捷键徽章。
- `HoverTip.tsx` — 共享悬停提示胶囊：portal 到 body 渲染，按触发元素位置自动落在上方或下方，并在视口边缘内收避让。
- `ModalDialog.module.css` — @lfaa/ui-primitives 居中弹窗通用样式：遮罩、弹窗尺寸与统一进场动效预设（scale / fade / slide-up）。
- `ModalDialog.tsx` — 提供全局统一的居中弹窗组件：支持 Escape 与遮罩关闭、自定义尺寸、图标头与集中可调进场动画预设。
- `PanelToggleButton.module.css` — 共享展开/收起按钮样式：只用语义与动效变量，尺寸由 --panel-toggle-size 交给调用方适配各断点。
- `PanelToggleButton.tsx` — 共享「展开/收起」图标按钮：分栏线随展开状态滑动，过渡时长与曲线统一消费 @lfaa/ui-theme 动效令牌。
- `PopoverCard.module.css` — @lfaa/ui-primitives 锚点浮层弹窗样式：支持上下左右锚点与平滑缩放弹出动效。
- `PopoverCard.tsx` — 提供可复用的锚点浮层卡片容器：复用共享外部点击与 Escape 退出逻辑，并支持平滑进出场过渡。
- `ScrollArea.module.css`
- `ScrollArea.tsx` — 共享滚动容器：统一「透明轨道 + 强调色圆角滑块」的细滚动条，并负责滚动方向、槽位预留与滚动高亮反馈。
- `StatusBanner.module.css` — @lfaa/ui-primitives 语义化提示通知横幅样式：支持 success / error / warning / info / loading 统一对比度与动效。
- `StatusBanner.tsx` — 提供全站复用的语义化状态通知横幅（success / error / warning / info / loading），统一通知视觉对比度与关闭交互。
- `StepSliderPopover.module.css` — @lfaa/ui-primitives 步进滑块弹窗样式：带圆点刻度轨道、主题色进度条、大圆手柄及重设按钮。
- `StepSliderPopover.tsx` — 提供可复用的离散档位滑块弹窗内容组件（如推理强度调节）：支持平滑拖拽与磁吸阈值、圆点点击、键盘调节、无规则流星粒子流及闪电极强开关。
- `css-modules.d.ts` — 浏览器组件使用的 CSS Modules 声明，将导入的局部类名暴露为字符串映射。
- `index.tsx` — 统一导出 @lfaa/ui-primitives 共享交互组件（折叠面板与展开按钮、居中弹窗、浮层卡片、步进滑块、滚动容器）与设置中心通用控件。
- `useDismissibleLayer.ts` — 共享浮层关闭监听 Hook：统一处理外部指针点击、Escape 关闭与焦点归还，消除各菜单重复事件绑定。
- `usePanePresence.ts` — 面板挂载保持：展开立即挂载，收起后保留内容等过渡结束再卸载；供 CollapsePane 及其他折叠容器复用。
- `useVisibleInterval.ts` — 可见性感知的轮询 Hook：标签页在后台时停表、回到前台立即补一次再恢复，供工作台各面板共用。

### packages/ui/primitives/client/base

- `BasePrimitives.module.css` — Base UI 无头原语的 LFAA 双主题薄皮肤（DropdownMenu / UiSwitch / UiSelect / UiTabs / UiTooltip），全量消费 @lfaa/ui-theme 语义变量。
- `ContextMenu.tsx` — 基于 @base-ui/react/context-menu 封装的通用右键菜单原语：在指针位置或长按处展开，复用下拉菜单的双主题皮肤与条目。
- `DropdownMenu.tsx` — 基于 @base-ui/react/menu 封装的通用下拉菜单原语：自动防溢出定位、键盘导航、焦点恢复与双主题适配。
- `UiSelect.tsx` — 基于 @base-ui/react/select 封装的通用下拉选择器：键盘导航、防溢出定位与双主题皮肤。
- `UiSwitch.tsx` — 基于 @base-ui/react/switch 封装的双主题触感开关原语。
- `UiTabs.tsx` — 基于 @base-ui/react/tabs 封装的平滑滑块分段标签原语。
- `UiTooltip.tsx` — 基于 @base-ui/react/tooltip 封装的轻量悬浮提示原语：自动避障定位与悬停防抖。

### packages/ui/primitives/client/settings

- `SettingSelect.tsx` — 设置中心「可搜索下拉」与「多选下拉」：带图标、副标题与搜索过滤的受控选项弹层，供所有设置页统一使用。
- `SettingsControls.module.css` — 设置中心控件层：表单字段、输入框、按钮、开关、分段选择与危险操作组；全部使用主题变量，禁止写死颜色。
- `SettingsControls.tsx` — 设置中心通用结构：页外壳、无边框分组、左名称右控件的设置行、上下排表单字段、开关、分段选择与危险操作组。
- `SettingsSelect.module.css` — 设置中心可搜索下拉：触发器、圆角弹层、选项行与选中勾；颜色全部取自主题变量。
- `SettingsSurface.module.css` — 设置中心排版层：页外壳、无边框分组、左名称右控件的设置行与只读值文本；不提供任何卡片外观，颜色全部取自主题变量。
- `settingsStyles.ts` — 合并设置中心两层样式模块（排版层 + 控件层），让各设置页仍只导入一个 settingsStyles 对象。

### packages/ui/primitives/contract

- `index.ts` — 定义 @lfaa/ui-primitives 无 DOM 公共契约类型与纯计算工具函数，供 Host 与各业务 UI 包统一复用弹窗尺寸、动效预设及步进计算。

### packages/ui/primitives/src

- `index.ts` — @lfaa/ui-primitives Host 入口：共享契约已下沉到 contract/，这里只做重导出以保持公开入口不变。

### packages/ui/primitives/tests

- `base-primitives.test.tsx` — 验证基于 @base-ui/react 封装的 5 个通用交互原语（DropdownMenu / UiSwitch / UiSelect / UiTabs / UiTooltip）在 SSR 下渲染正常、无障碍属性完整。
- `capsule-bar.test.tsx` — 验证共享胶囊外壳：子内容、类名合并与属性透传，确保左二栏与中间区顶栏消费的是同一份外观。
- `panel-toggle.test.tsx` — 验证共享折叠面板按钮的状态表达：动作文案、aria-expanded、左右镜像与分栏线标记都随状态变化。
- `primitives-contract.test.ts` — 验证 @lfaa/ui-primitives 共享交互原语包导出、步进比值计算及包边界契约。
- `scroll-area.test.tsx` — 验证共享滚动容器 ScrollArea 的 SSR 输出：方向标记、常驻槽标记、附加类名与内容包裹都正确，

### packages/ui/theme

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/ui-theme 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/ui/theme/client

- `appearance-store.ts` — 在浏览器端管理 LFAA 主题与液态玻璃配置，启动即同步至根元素 CSS 变量并监听系统明暗切换。
- `background-api.ts` — 个人背景图接口：列表、上传与删除；文件由 Host 保存在本机 ~/.lfaa/backgrounds，客户端只传文件名、MIME 与 base64。
- `css-modules.d.ts` — 为主题包 Client 侧 CSS Modules 提供类型声明。
- `index.tsx` — 导出主题包的 Client Cordis 插件入口：启动即同步主题 CSS 变量，并向工作台注册“外观”设置视图。
- `locales.ts` — 集中维护主题与外观设置页面在中英文环境下的展示文案。
- `scrollbars.css`
- `tokens.css`

### packages/ui/theme/client/assets/backgrounds

- `cherry-blossom-shore.webp`
- `cherry-blossom-village.webp`
- `cherry-blossom-waterfront.webp`
- `flower-meadow-castle.webp`
- `forest-bridge-evening.webp`
- `golden-wheat-field.webp`
- `index.ts` — 内置背景图清单：backgrounds/ 目录下放入图片即被自动发现，新增图片不需要改这里；
- `lakeside-pagoda-morning.webp`
- `manifest.json`
- `minecraft-world.webp`
- `ocean-cliff-sunset.webp`
- `rainy-grassland.webp`
- `service-room.webp`
- `snowy-cabin-interior.webp`
- `steamcmd-world.webp`
- `tropical-coast-day.webp`
- `writing-desk.webp`
- `writing-yunjian.webp`

### packages/ui/theme/client/components

- `AccentSelect.module.css` — 强调色下拉菜单与苹果液态玻璃浮层样式。
- `AccentSelect.tsx` — 提供带色点预览与自定义取色器的强调色下拉菜单，使用 Portal 挂载到 body 避免被毛玻璃卡片裁切或偏移。
- `AppearanceAdvanced.module.css`
- `AppearanceAdvanced.tsx` — 呈现外观设置「高级设置」分区里的字号、字体、主题与显示、动效与光标分组，全部沿用设置中心的行式结构
- `AppearanceSettings.module.css`
- `AppearanceSettings.tsx` — 呈现设置中心「外观」页：顶部是分区选项卡，没有常驻预览舞台。
- `AppearanceTabs.tsx` — 外观页顶部的「预设 / 高级设置」选项卡：受控组件，支持左右方向键与 Home/End 在两项间切换。
- `AppearanceThemeDetail.module.css`
- `AppearanceThemeDetail.tsx` — 外观设置「高级」里的主题细项：主题预设（含导入/复制）、强调色、背景、前景与界面字体。
- `ThemeGallery.module.css` — 主题选择卡片网格：分轴排版（明暗模式 3 列、主题方案 5 列），选中态使用强调色光环与角标；全消费主题变量。
- `ThemeGallery.tsx` — 主题选择网格：支持明暗模式（3 列）与主题方案（5 列）分轴展示，悬停驱动实时预览，点击应用；
- `ThemeHoverPreview.module.css`
- `ThemeHoverPreview.tsx` — 主题悬停预览：鼠标移入主题卡时在光标旁浮出实时预览，并用「预览」光标替代系统指针；
- `ThemeModeQuickSwitch.module.css` — 三档外观开关：玻璃轨道 + 带辉光的圆角方块滑块 + 像素太阳/月亮；深色档冷光、浅色档暖光。
- `ThemeModeQuickSwitch.tsx` — 用户菜单头部的三档外观开关：左=深色、中=跟随系统、右=浅色。
- `ThemePreview.module.css`
- `ThemePreview.tsx` — 主题实时预览面板：用真实主题色渲染一枚迷你工作台窗口，切换主题时颜色平滑过渡；供外观页与主题库共用。
- `ThemeSelect.tsx` — 通用外观设置页液态玻璃下拉选择器：复用强调色菜单视觉规范，替代原生浏览器 <select> 弹窗。
- `hover-preview-position.ts` — 悬停预览卡的贴边翻转：纯函数，便于单测；组件只负责把结果写成 transform。
- `pixel-glyph.ts` — 外观开关的像素图标：9×9 点阵上的月亮与太阳，按参考图的方块颗粒感手工排布。
- `theme-looks.ts` — 主题方案取样：一套主题 = 一套配色 + 一张背景（或纯色）。
- `theme-tiles.ts` — 主题网格取样：把「明暗模式 + 主题预设」拼成主题卡列表，供外观页与复用方共用（纯函数，便于单测）。
- `use-theme-backgrounds.ts` — 个人背景主题的列表与动作：启动加载、上传、二次确认删除；删除正在使用的图时回退到纯色主题。

### packages/ui/theme/contract

- `index.ts` — 定义外观与液态玻璃主题系统的数据模型、预设配置及安全序列化工具。

### packages/ui/theme/src

- `index.ts` — @lfaa/ui-theme Host 入口：共享契约已下沉到 contract/，这里只做重导出以保持公开入口不变。

### packages/ui/theme/tests

- `appearance-layer.test.ts` — 静态层级守卫：外观页的下拉菜单 Portal 到 body，层级必须高于设置中心弹窗；
- `background-columns.test.ts` — 静态护栏：背景图模式下四栏必须统一走同一档薄纱（--color-column / --column-wash），
- `desktop-theme-bridge.test.ts` — 桌面端主题桥接回归测试：验证 AppearanceStore 优先从桌面持久化桥恢复主题，并在切换明暗时实时同步给桌面主进程。
- `sakura-preset.test.ts` — 樱花粉预设回归：契约取样、深浅令牌成对、正文与弱化文字对比度是否达标。
- `theme-hover.test.ts` — 验证悬停预览卡的贴边翻转：默认落在光标右下，靠近视口右/下边缘时翻到另一侧。
- `theme-lifecycle.test.ts` — 验证主题包 Host/契约预设导出及 Client 插件在工作台注册与卸载清理。
- `theme-looks.test.ts` — 验证主题墙取样：主题 = 配色 + 背景；纯色、内置背景与个人背景排在同一面墙上，只有配色与背景都对上才算当前主题。
- `theme-mode-switch.test.tsx` — 验证账号菜单里的三档外观开关：档位顺序、当前选中项、图标随解析出的明暗切换。
- `theme-tiles.test.ts` — 验证主题网格取样：模式卡与预设卡的数量、选中标记、强调色解析与「跟随系统」双取样。

### packages/web/web

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/web/web/locale

- `en.json`
- `zh.json`

### packages/web/web/src

- `index.ts` — @lfaa/web 浏览器/网页能力包入口：导出能力 seam、HTTP 抓取实现与 fetch_url 工具，并组合成默认插件。
- `seam.ts` — @lfaa/web：网页能力 seam。多个抓取实现按优先级注册，工具与 Agent 只依赖本服务，便于替换实现。

### packages/web/web/src/fetch

- `http-fetch.ts` — @lfaa/web-fetch-http：用本机 HTTP 客户端实现网页抓取 seam，限制超时与单页体积。

### packages/web/web/src/tool

- `fetch-url-tool.ts` — @lfaa/tool-web 插件入口：提供 web_search 全网搜索与 fetch_url 网页正文抓取两个轻量只读工具。
- `web-search-tool.ts` — 轻量全网搜索工具（web_search）：免密钥直接抓取公开搜索结果，支持 DuckDuckGo 与 Bing 双源回退，返回精简标题、链接与摘要。

### packages/web/web/tests

- `fetch-url-tool.test.ts` — 验证网页工具的安全校验与正文抽取：协议限制、内网拦截、HTML 转文本。
- `http-fetch.test.ts` — 验证 HTTP 抓取实现的协议校验、体积截断与真实请求路径。
- `web-search-tool.test.ts` — 验证 web_search 工具：Bing / DuckDuckGo HTML 解析、uddg 链接解包、结果格式化与 Cordis 插件注册/卸载。
- `web-service.test.ts` — 验证网页 seam 的实现排序、注销与失败回退语义。

### packages/workspace/sections

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/sections 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/workspace/sections/contract

- `index.ts` — 定义自定义分区包在 Host 与 Client 间共享的无 DOM 领域数据结构。

### packages/workspace/sections/locale

- `en.json`
- `zh.json`

### packages/workspace/sections/src

- `http-handler.ts` — 为 Web 开发服务提供 /api/workspace/sections* HTTP RPC 路由桥接。
- `index.ts` — 声明自定义分区包的 Host 侧 Cordis 服务与无 DOM 领域契约，严禁导入 React、DOM 或 CSS。
- `types.ts` — @lfaa/sections 类型入口：契约已下沉到 contract/，这里保留原路径重导出以免改动全部内部引用。

### packages/workspace/workspace

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/workspace 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/workspace/workspace/contract

- `index.ts` — 定义工作区 Host 侧与 RPC 共享的无 DOM 领域数据结构。

### packages/workspace/workspace/locale

- `en.json`
- `zh.json`

### packages/workspace/workspace/src

- `default-workspace.ts` — 内置「默认工作区」项目条目的常量与构造函数：不写入 projects.json，由列表与查询时动态合成。
- `dir-resolvers.ts` — 默认项目目录与「项目外聊天」目录的解析器：装配层在运行期注入，可回滚。
- `http-handler.ts` — 为仅监听本机 127.0.0.1 的 Web 开发服务提供 /api/workspace/* HTTP 中间件桥接。
- `index.ts` — 声明工作区包的 Host 侧 Cordis 服务与无 DOM 领域契约，严禁导入 React、DOM 或 CSS。
- `plugin-config.ts` — 工作区插件配置契约：与工作区服务主体分开，供装配层与测试引用。
- `project-brief.ts` — 依据项目目录生成项目简介初稿：只读 README/清单与顶层条目，结果确定、可离线测试，不写文件也不调用模型。
- `project-fs-read.ts` — 项目目录只读检视与文本文件安全预览：严格校验授权根目录边界并拦截符号链接越界与二进制文件。
- `project-records.ts` — 项目记录归一化与路径边界：解析存储记录、去重根目录、校验目标是否落在项目授权目录内。
- `project-store.ts` — 项目存储与默认项目目录同步：读写 ~/.lfaa/projects.json，并让项目列表跟随 <文档>/lfaa 下的真实文件夹。
- `system-paths.ts` — 负责动态解析本机文档目录（含 Windows 重定向路径）、安全目录名及原生文件夹选择器；严禁导入 React 或 DOM。
- `types.ts` — @lfaa/workspace 类型入口：契约已下沉到 contract/，这里保留原路径重导出以免改动全部内部引用。

### packages/workspace/workspace/tests

- `canvas-boundary.test.ts` — 画布项目边界、物理目录隔离与默认工作区删除单测。
- `project-brief.test.ts` — 验证项目简介生成器：README 摘要、清单兜底、空目录兜底与长度上限。

### packages/workspace/worktree

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/worktree 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/workspace/worktree/contract

- `index.ts` — 定义 Git 工作树的公开契约：记录、创建/删除输入、状态与目录检查结果，无 Node 或 DOM 依赖。

### packages/workspace/worktree/locale

- `en.json`
- `zh.json`

### packages/workspace/worktree/src

- `git-command.ts` — 统一的安全 Git 调用：固定超时、禁用交互，并在检出类命令上禁用钩子、fsmonitor 与仓库自定义过滤器。
- `http-handler.ts` — 为本机 Web 服务提供 /api/worktrees 工作树列出、创建、检查与删除接口；鉴权与内容类型由网关统一处理。
- `index.ts` — @lfaa/worktree Host 入口：注册工作树服务并默认导出插件本体，供 Cordis Loader 按包名装载。
- `store.ts` — 持久化工作树索引：只保存创建记录，真实目录与变更状态每次向文件系统和 Git 询问。
- `worktree-service.ts` — Host 侧工作树服务：在项目仓库同级创建独立检出目录，提供状态查询与带安全校验的清理。

### packages/workspace/worktree/tests

- `http-handler.test.ts` — 验证 /api/worktrees 路由：列出、创建、删除与错误映射；服务本身由 worktree-service 测试覆盖。
- `worktree-service.test.ts` — 验证工作树服务的创建、查询、删除与安全边界：同级目录、分支校验、钩子禁用与脏目录保护。

### patches

- `README.md` — 第三方依赖补丁（pnpm patch）

### scripts

- `README.md` — 仓库脚本
- `build.mjs` — 构建入口：清空 lib → tsc -b 产出 lib/types → tsdown 打包出 lib 入口 → 构建 Web 产物。
- `canvas-shot-fixture.ts` — 画布截图夹具：使用编辑器现有直达参数与内存接口，避免改动本机项目数据。
- `check-allowlist.json`
- `check-architecture.mjs` — 依赖方向护栏：扫全仓 packages/ 的跨包导入，按 docs/architecture/dependency-rules.json 判定是否越界。
- `check-architecture.test.mjs` — 验证依赖护栏规则本身：跨功能 UI 复用、客户端越界、.tsx 落位、内核反向依赖、装配边、BOM 与未声明依赖。
- `check-client-layout.mjs`
- `check-doc-links.mjs`
- `check-logs.mjs` — 日志体检：dev-log 卷内标题编号与 updata-log 文件名编号必须各自唯一；同一轮两类日志共用编号是允许的。
- `check-logs.test.mjs` — 验证日志体检：同类日志重号判错、基线可登记历史重号、基线外的重号仍然判错、基线条目过期提示，
- `check-workspace.mjs` — 仓库边界检查：校验包命名、跨包子路径、Host/Client 隔离、依赖一致性、锁文件顺序、循环依赖、中文文件头与文件规模。
- `check-workspace.test.mjs` — 验证 check-workspace 的新增规则本身：文件规模、client 越界相对导入、写死颜色与豁免清单棘轮。
- `ensure-dependencies.mjs` — 仓库依赖状态预检与安全增量安装脚本：核对 workspace/lockfile，缺依赖时只补装缺失的包并自愈依赖链接。
- `ensure-dependencies.test.mjs` — 依赖预检脚本的回归测试：覆盖 Windows 换行、BOM 与「仅包块顺序不同」的锁文件兼容性。
- `ensure-lib.mjs` — 开发启动前产物自检：关键包 lib 缺失时自动重建，避免“tsbuildinfo 还在但产物没了”导致的启动失败。
- `gen-repository-map.mjs` — 生成仓库目录说明书：按真实文件系统输出骨架与每个源码文件的中文职责首行。
- `install-hooks.mjs` — 安装仓库级 Git 钩子：把 core.hooksPath 指向 .githooks，并确保钩子可执行。
- `lfaa.ps1` — LFAA Windows 菜单入口：安装当前工作区依赖，并在应用入口就绪后启动 Web。
- `lint-allowlist.json`
- `lint-workspace.mjs` — 仓库级 Lint：用仓库已有的 TypeScript 编译器 API 做 AST 规则检查（无需联网安装 linter）。
- `lint-workspace.test.mjs` — 验证 lint-workspace 的规则与棘轮豁免：用临时夹具覆盖各条规则、豁免、过期提示与注释误报。
- `log-number-baseline.json`
- `probe-boot.mjs` — 整机启动探针：用隔离的用户目录装配完整 Host 运行时，确认核心服务与 HTTP 路由都能量出来。
- `probe-loader.mjs` — Loader 装载探针：按 cordis.yml 直接以包名装载 @lfaa 插件 → 卸载 → 重装 → 二创。
- `sync-manifests.mjs` — 包清单生成器：按 DSH 模型写入 main/types/exports、files、repository 与 publishConfig。
- `sync-readmes.mjs` — 包 README 生成器：按 DSH 结构生成每个包的 README.md（英文）与 README.zh.md（中文）。
- `sync-tsconfig.mjs` — 仓库构建配置生成器：按 DSH 模型生成 tsconfig.base.json 的 paths 门面、每包 tsconfig 与 host 聚合工程。
- `test-css-loader.mjs` — 测试期样式桩：Node 不能直接加载 *.module.css，这里把样式模块统一替换成类名代理，
- `test.mjs` — 统一测试入口：枚举 packages 与 scripts 下的 node:test 用例文件，交给 Node 测试运行器执行。
- `ui-shot-tasks.ts` — 截图任务清单：每条任务 = 名称 + 分组 + 说明 + 视口/主题 + 交互步骤。
- `ui-shot.mts` — UI 截图工具：起生产宿主 → 无头 Edge/Chrome 按任务表逐项操作 → 出图到 shots/ 并写 manifest.json。
- `verify-canvas-motion.mts` — 无限画布的拖拽与缩放手感校验：用浏览器内隔离画布夹具（本地 5173）检查拖拽只落盘一次、
- `verify-coordination.mts` — 交接条与目标条真实浏览器验收：在隔离 HOME 中启动 Host，创建两个会话并 seed 一条交接，
- `verify-hover-scroll.mts` — 悬停抖动的红/绿反馈环：把会话滚到最底部，逐个悬停动作按钮并向下滚轮，
- `verify-stream-scroll.mts` — 会话滚动的红/绿反馈环：内容持续增长（流式输出）时，用户上滚必须真的停住、不能被贴底写回；
- `verify-translation-pairing.mjs` — 包 README 双语配对校验：按英文标题分段哈希，记录到 README.i18n.yaml，并在校验模式下报告漂移。
- `verify-translation-pairing.test.mjs` — 回归测试：README 双语配对脚本必须在 Windows CRLF 检出下判定一致，避免 CI 因换行差异误报过期。
- `verify-web.mts` — 生产构建产物浏览器验收：用本机 Edge/Chrome 无头打开工作台，依次检查壳层、资料库、代码审查、

## 4. 只做统计的目录

| 目录 | 文件数 | 子目录数 | 说明 |
| --- | --- | --- | --- |
| `docs/dev-log` | 5 | 1 | 按每 200 条任务编号汇总的开发日志卷 |
| `docs/updata-log` | 506 | 1 | 面向用户的单条更新说明 |
| `vendor` | 14 | 4 | 内嵌的上游运行时源码 |
| `packages/extension/skills/src/builtin-skills` | 639 | 153 |  |
