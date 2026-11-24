# LFAA 仓库目录说明书

> 本文件由 `pnpm map:sync`（[scripts/gen-repository-map.mjs](../../scripts/gen-repository-map.mjs)）按真实文件系统生成，**不要手改**。
> 骨架发生变化（新增/删除/移动文件、包或目录）后，必须在同一轮运行 `pnpm map:sync` 并提交，否则 `pnpm check` 会失败。

当前快照：**61 个包、1722 个文件、308 个子目录**（不含 node_modules、构建产物与运行数据）。

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
├── .agent/  (107 个文件)
│   └── skills/  (107 个文件)
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
│       └── ui-screenshot/  (1 个文件)
├── .githooks/  (1 个文件)
├── .github/  (1 个文件)
│   └── workflows/  (1 个文件)
├── apps/  (34 个文件)
│   ├── cli/  (3 个文件)
│   │   └── src/  (1 个文件)
│   ├── desktop/  (15 个文件)
│   │   ├── resources/  (1 个文件)
│   │   ├── scripts/  (3 个文件)
│   │   └── src/  (6 个文件)
│   ├── desktop-host/  (5 个文件)
│   │   └── src/  (1 个文件)
│   └── web/  (10 个文件)
│       ├── public/  (2 个文件)
│       └── src/  (3 个文件)
├── docs/  (365 个文件)
│   ├── architecture/  (11 个文件)
│   ├── dev-log/  (4 个文件)
│   ├── features/  (24 个文件)
│   ├── plans/  (4 个文件)
│   ├── standards/  (1 个文件)
│   ├── templates/  (2 个文件)
│   └── updata-log/  (317 个文件)
├── packages/  (1147 个文件)
│   ├── api/  (7 个文件)
│   │   └── gateway/  # @lfaa/api-gateway  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── attachment/  (7 个文件)
│   │   └── attachment-local/  # @lfaa/attachment-local  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── bundle/  (8 个文件)
│   │   └── web/  # @lfaa/bundle-web  (8 个文件)
│   │       ├── src/  (2 个文件)
│   │       └── tests/  (1 个文件)
│   ├── chat/  (31 个文件)
│   │   ├── chat/  # @lfaa/chat  (12 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── library/  # @lfaa/library  (6 个文件)
│   │   │   └── src/  (1 个文件)
│   │   └── review/  # @lfaa/review  (13 个文件)
│   │       ├── src/  (7 个文件)
│   │       └── tests/  (1 个文件)
│   ├── client/  (431 个文件)
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
│   │   ├── ui-browser/  # @lfaa/client-ui-browser  (18 个文件)
│   │   │   ├── client/  (12 个文件)
│   │   │   │   ├── api/  (1 个文件)
│   │   │   │   ├── panes/  (7 个文件)
│   │   │   │   └── settings/  (2 个文件)
│   │   │   └── src/  (1 个文件)
│   │   ├── ui-chat/  # @lfaa/client-ui-chat  (231 个文件)
│   │   │   ├── client/  (186 个文件)
│   │   │   │   ├── composer/  (34 个文件)
│   │   │   │   ├── conversation/  (37 个文件)
│   │   │   │   ├── models/  (16 个文件)
│   │   │   │   ├── session/  (19 个文件)
│   │   │   │   ├── settings/  (10 个文件)
│   │   │   │   ├── shared/  (4 个文件)
│   │   │   │   ├── store/  (18 个文件)
│   │   │   │   └── workbench/  (41 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (39 个文件)
│   │   ├── ui-library/  # @lfaa/client-ui-library  (20 个文件)
│   │   │   ├── client/  (11 个文件)
│   │   │   │   ├── settings/  (2 个文件)
│   │   │   │   └── views/  (7 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── ui-plugins/  # @lfaa/client-ui-plugins  (17 个文件)
│   │   │   ├── client/  (11 个文件)
│   │   │   │   ├── api/  (1 个文件)
│   │   │   │   ├── components/  (6 个文件)
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
│   │   ├── ui-tool-media/  # @lfaa/client-ui-tool-media  (33 个文件)
│   │   │   ├── client/  (20 个文件)
│   │   │   │   ├── compose/  (6 个文件)
│   │   │   │   ├── library/  (4 个文件)
│   │   │   │   ├── media/  (4 个文件)
│   │   │   │   └── thumbs/  (3 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (7 个文件)
│   │   └── ui-workspace/  # @lfaa/client-ui-workspace  (40 个文件)
│   │       ├── client/  (33 个文件)
│   │       │   ├── project/  (22 个文件)
│   │       │   ├── shared/  (2 个文件)
│   │       │   ├── store/  (2 个文件)
│   │       │   └── worktree/  (4 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── compaction/  (12 个文件)
│   │   └── compaction/  # @lfaa/compaction  (12 个文件)
│   │       ├── src/  (4 个文件)
│   │       └── tests/  (3 个文件)
│   ├── core/  (292 个文件)
│   │   ├── agent/  # @lfaa/agent  (70 个文件)
│   │   │   ├── src/  (42 个文件)
│   │   │   │   ├── context/  (4 个文件)
│   │   │   │   ├── run/  (29 个文件)
│   │   │   │   └── tools/  (5 个文件)
│   │   │   └── tests/  (23 个文件)
│   │   ├── agent-group/  # @lfaa/agent-group  (12 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── agent-profile/  # @lfaa/agent-profile  (18 个文件)
│   │   │   ├── src/  (9 个文件)
│   │   │   └── tests/  (4 个文件)
│   │   ├── browser/  # @lfaa/browser  (22 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── src/  (13 个文件)
│   │   │   │   ├── session/  (6 个文件)
│   │   │   │   ├── settings/  (1 个文件)
│   │   │   │   ├── snapshot/  (1 个文件)
│   │   │   │   └── tools/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── context/  # @lfaa/context  (8 个文件)
│   │   │   ├── src/  (2 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── fs/  # @lfaa/fs  (9 个文件)
│   │   │   ├── src/  (3 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── guard/  # @lfaa/guard  (11 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   ├── jobs/  # @lfaa/jobs  (10 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── llm/  # @lfaa/llm  (33 个文件)
│   │   │   ├── src/  (18 个文件)
│   │   │   │   ├── adapters/  (4 个文件)
│   │   │   │   └── media/  (4 个文件)
│   │   │   └── tests/  (9 个文件)
│   │   ├── memory/  # @lfaa/memory  (10 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── metrics/  # @lfaa/metrics  (12 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (3 个文件)
│   │   ├── rules/  # @lfaa/rules  (9 个文件)
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
│   │   ├── subagent/  # @lfaa/subagent  (10 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── system-prompt/  # @lfaa/system-prompt  (7 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── tool-todo/  # @lfaa/tool-todo  (7 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   └── tools/  # @lfaa/tools  (11 个文件)
│   │       ├── src/  (5 个文件)
│   │       └── tests/  (1 个文件)
│   ├── extension/  (38 个文件)
│   │   ├── plugins/  # @lfaa/plugins  (25 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── src/  (13 个文件)
│   │   │   │   ├── catalog/  (4 个文件)
│   │   │   │   ├── manager/  (7 个文件)
│   │   │   │   └── routes/  (1 个文件)
│   │   │   └── tests/  (5 个文件)
│   │   └── skills/  # @lfaa/skills  (13 个文件)
│   │       ├── contract/  (1 个文件)
│   │       ├── src/  (5 个文件)
│   │       │   └── builtin-skills/  (2 个文件)
│   │       │       ├── lfaa-skill-creator/  (1 个文件)
│   │       │       └── minecraft-plugin-dev/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── feedback/  (7 个文件)
│   │   └── message-feedback/  # @lfaa/message-feedback  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── fs/  (7 个文件)
│   │   └── fs-observation-policy/  # @lfaa/fs-observation-policy  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── goal/  (12 个文件)
│   │   └── goal/  # @lfaa/goal  (12 个文件)
│   │       ├── src/  (4 个文件)
│   │       │   └── tool/  (1 个文件)
│   │       └── tests/  (3 个文件)
│   ├── guard/  (7 个文件)
│   │   └── timeout-policy/  # @lfaa/timeout-policy  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── host/  (16 个文件)
│   │   └── web-server/  # @lfaa/web-server  (16 个文件)
│   │       ├── src/  (9 个文件)
│   │       │   └── handlers/  (3 个文件)
│   │       └── tests/  (2 个文件)
│   ├── interaction/  (7 个文件)
│   │   └── commands/  # @lfaa/commands  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── media/  (18 个文件)
│   │   └── tool-media/  # @lfaa/tool-media  (18 个文件)
│   │       ├── src/  (6 个文件)
│   │       └── tests/  (7 个文件)
│   ├── plan/  (8 个文件)
│   │   └── plan-mode/  # @lfaa/plan-mode  (8 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (2 个文件)
│   ├── sandbox/  (14 个文件)
│   │   └── sandbox/  # @lfaa/sandbox  (14 个文件)
│   │       ├── src/  (5 个文件)
│   │       │   └── local/  (2 个文件)
│   │       └── tests/  (4 个文件)
│   ├── schedule/  (7 个文件)
│   │   └── tool-schedule/  # @lfaa/tool-schedule  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── session/  (18 个文件)
│   │   ├── handoff/  # @lfaa/handoff  (11 个文件)
│   │   │   ├── src/  (4 个文件)
│   │   │   │   └── tool/  (1 个文件)
│   │   │   └── tests/  (2 个文件)
│   │   └── session-title/  # @lfaa/session-title  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── shell/  (11 个文件)
│   │   └── shell/  # @lfaa/shell  (11 个文件)
│   │       ├── src/  (4 个文件)
│   │       │   ├── bash/  (1 个文件)
│   │       │   ├── env/  (1 个文件)
│   │       │   └── pwsh/  (1 个文件)
│   │       └── tests/  (2 个文件)
│   ├── spill/  (7 个文件)
│   │   └── spill-local/  # @lfaa/spill-local  (7 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── ui/  (131 个文件)
│   │   ├── icons/  # @lfaa/ui-icons  (15 个文件)
│   │   │   ├── LICENSES/  (1 个文件)
│   │   │   ├── client/  (4 个文件)
│   │   │   ├── contract/  (2 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   ├── layout/  # @lfaa/ui-layout  (68 个文件)
│   │   │   ├── client/  (50 个文件)
│   │   │   │   ├── navigation/  (21 个文件)
│   │   │   │   ├── panels/  (13 个文件)
│   │   │   │   └── shell/  (12 个文件)
│   │   │   ├── contract/  (3 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (8 个文件)
│   │   ├── primitives/  # @lfaa/ui-primitives  (25 个文件)
│   │   │   ├── client/  (16 个文件)
│   │   │   │   └── settings/  (2 个文件)
│   │   │   ├── contract/  (1 个文件)
│   │   │   ├── src/  (1 个文件)
│   │   │   └── tests/  (1 个文件)
│   │   └── theme/  # @lfaa/ui-theme  (23 个文件)
│   │       ├── client/  (14 个文件)
│   │       │   └── components/  (9 个文件)
│   │       ├── contract/  (1 个文件)
│   │       ├── src/  (1 个文件)
│   │       └── tests/  (1 个文件)
│   ├── web/  (12 个文件)
│   │   └── web/  # @lfaa/web  (12 个文件)
│   │       ├── src/  (4 个文件)
│   │       │   ├── fetch/  (1 个文件)
│   │       │   └── tool/  (1 个文件)
│   │       └── tests/  (3 个文件)
│   └── workspace/  (38 个文件)
│       ├── sections/  # @lfaa/sections  (10 个文件)
│       │   ├── contract/  (1 个文件)
│       │   └── src/  (3 个文件)
│       ├── workspace/  # @lfaa/workspace  (14 个文件)
│       │   ├── contract/  (1 个文件)
│       │   ├── src/  (6 个文件)
│       │   └── tests/  (1 个文件)
│       └── worktree/  # @lfaa/worktree  (14 个文件)
│           ├── contract/  (1 个文件)
│           ├── src/  (5 个文件)
│           └── tests/  (2 个文件)
├── patches/  (1 个文件)
├── scripts/  (33 个文件)
├── shots/  (6 个文件)
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
| client | `@lfaa/client-ui-chat` | `packages/client/ui-chat` | LFAA 核心聊天与 Agent 工作台业务包，提供会话管理、流式思考/行动/检查步骤可视化与模型规则设置界面。（浏览器半，已从 @lfaa/chat 拆出）。 |
| client | `@lfaa/client-ui-library` | `packages/client/ui-library` | LFAA 资料库功能包：图像/资产/记忆分类浏览、右栏检视器与存储位置设置。（浏览器半，已从 @lfaa/library 拆出）。 |
| client | `@lfaa/client-ui-plugins` | `packages/client/ui-plugins` | plugins（浏览器半，已从 @lfaa/plugins 拆出）。 |
| client | `@lfaa/client-ui-review` | `packages/client/ui-review` | LFAA 代码审查功能包：内置 Git 变更操作、编码设置与代码审查工作台，含审查报告 Host 服务。（浏览器半，已从 @lfaa/review 拆出）。 |
| client | `@lfaa/client-ui-sections` | `packages/client/ui-sections` | LFAA 工作区自定义分区管理包，提供 Host 分区持久化服务、HTTP RPC 与侧栏分区交互 UI 插件。（浏览器半，已从 @lfaa/sections 拆出）。 |
| client | `@lfaa/client-ui-skills` | `packages/client/ui-skills` | skills（浏览器半，已从 @lfaa/skills 拆出）。 |
| client | `@lfaa/client-ui-tool-media` | `packages/client/ui-tool-media` | LFAA 媒体生成工具：调用套餐里的生图模型生成图片，保存到工作区并返回文件路径。（浏览器半，已从 @lfaa/tool-media 拆出）。 |
| client | `@lfaa/client-ui-workspace` | `packages/client/ui-workspace` | LFAA 工作区与本地项目插件包，提供 Host 服务契约与 Client 侧栏/工作区/右侧上下文面板贡献。（浏览器半，已从 @lfaa/workspace 拆出）。 |
| compaction | `@lfaa/compaction` | `packages/compaction/compaction` | LFAA 上下文治理包：可替换的上下文压缩服务、单条工具结果精简与 /compact 命令。 |
| core | `@lfaa/agent` | `packages/core/agent` | LFAA Agent 任务循环引擎，聚合 LLM 大脑、工具手脚、记忆与规则四大能力执行 Think -> Act -> Check 闭环。 |
| core | `@lfaa/agent-group` | `packages/core/agent-group` | LFAA 群聊编排：把一条消息展开成按序的多个 agent 发言，共享同一份会话历史。 |
| core | `@lfaa/agent-profile` | `packages/core/agent-profile` | LFAA agent 定义与模型绑定：持久化可添加的 agent、路由组与其默认绑定，供会话与派发层读取。 |
| core | `@lfaa/browser` | `packages/core/browser` | LFAA 内置浏览器服务与可视化控制面板：遵循 DSH browser-use 独占注册契约，基于 playwright-core 复用本机 Edge/Chrome 驱动。 |
| core | `@lfaa/context` | `packages/core/context` | LFAA 上下文预算与压缩：按字符预算压缩早期工具结果、保留最近轮次，并识别上下文超限错误（参考 DSH context 包的独立职责）。 |
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
| extension | `@lfaa/plugins` | `packages/extension/plugins` |  |
| extension | `@lfaa/skills` | `packages/extension/skills` |  |
| feedback | `@lfaa/message-feedback` | `packages/feedback/message-feedback` | LFAA 消息反馈服务：持久化对助手回复的赞/踩与备注，供聊天界面记录与回读。 |
| fs | `@lfaa/fs-observation-policy` | `packages/fs/fs-observation-policy` | LFAA 写前必读策略：写文件或改文件之前，同一会话必须先读取过该文件。 |
| goal | `@lfaa/goal` | `packages/goal/goal` | LFAA 目标服务：把会话目标、进度与受阻原因持久化，供目标工具与界面读取。 |
| guard | `@lfaa/timeout-policy` | `packages/guard/timeout-policy` | LFAA 工具超时策略：为每次工具执行套统一超时，超时中止信号并返回可读结果。 |
| host | `@lfaa/web-server` | `packages/host/web-server` | LFAA Web 宿主服务：装配运行时与全部 HTTP 接口，开发态托管 Vite、生产态托管 Web 产物。 |
| interaction | `@lfaa/commands` | `packages/interaction/commands` | LFAA 斜杠命令注册 seam：插件注册命令，聊天输入栏通过 /api/commands 发现并执行。 |
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
- `tsdown.config.ts` — 桌面主进程构建：只打包本地源码；Electron 与 workspace 包保持外部依赖（由安装包内 node_modules 提供）。

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
- `start.mjs` — 启动桌面端：先校验构建产物存在，再用本机 Electron 打开 apps/desktop。

### apps/desktop/src

- `host-process.ts` — 桌面宿主子进程：用 Electron 的 Node 模式拉起 apps/desktop-host，经 IPC 获取本机地址并负责优雅退出。
- `log.ts` — 桌面端日志：启动失败、宿主异常与未捕获错误写入 ~/.lfaa/logs/desktop.log，便于用户回传排查。
- `main.ts` — LFAA 桌面端主进程：单实例、拉起桌面宿主子进程、创建主窗口，并在退出时先停宿主再退出。
- `menu.ts` — 安装中文应用菜单：Windows 上菜单缺失会连带 Ctrl+C/V/A 失效，所以编辑角色的快捷键必须显式保留。
- `paths.ts` — 解析桌面端运行路径：开发态指向仓库内产物，安装态指向 resources/app；用户数据仍在 ~/.lfaa。
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

- `index.ts` — @lfaa/bundle-web 装配插件：把 Web Host 的基础能力、Loader 与跨服务联线组合成一个 bundle。
- `presets.ts` — @lfaa/bundle-web 模式预设：会话插件是从全局插件清单里挑出的子集，模式即该子集的命名组合。

### packages/bundle/web/tests

- `presets.test.ts` — 验证模式预设：会话插件必须是全局清单的子集，未知模式回退标准模式。

### packages/chat/chat

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

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

### packages/client/ui-browser/client/panes

- `BrowserDevToolsDrawer.tsx` — 内置浏览器底部可折叠 DevTools 抽屉：按 Console 与 Network 分页查看页面异常与请求状态。
- `BrowserTabs.tsx` — 内置浏览器顶部多标签栏：标签切换、关闭与新建；标签数据与激活/关闭操作由父组件传入。
- `BrowserToolbar.tsx` — 内置浏览器工具栏：前进/后退/刷新、网址输入、视口预设、DevTools 开关与人工接管/附带页面操作。
- `BrowserViewport.tsx` — 内置浏览器实时视口：把 CDP 画面映射为可点击/滚轮/键盘直输的交互区，空白时展示就绪提示与本地快捷入口。
- `RightBrowserPane.devtools.module.css` — 内置浏览器 DevTools 抽屉：标签、控制台/网络列表与日志行样式，双主题变量适配。
- `RightBrowserPane.module.css` — 全高全宽内置浏览器容器、多标签栏、工具栏、交互视口与 DevTools 样式，全量使用 @lfaa/ui-theme 语义变量。
- `RightBrowserPane.tsx` — 全高全宽内置浏览器视图：串联标签、工具栏、实时视口与 DevTools 抽屉，并同步 CDP 画面与视口尺寸。

### packages/client/ui-browser/client/settings

- `BrowserSettings.module.css` — 设置中心「浏览器」视图样式：页面容器、配置卡片、字段行、勾选项与保存按钮，全部使用 @lfaa/ui-theme 语义变量，浅色/深色共用。
- `BrowserSettingsView.tsx` — 设置中心「浏览器」视图：配置驱动通道（Edge/Chrome）、自定义路径、无头模式与本地调试免审开关。

### packages/client/ui-browser/src

- `index.ts` — @lfaa/client-ui-browser 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

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

### packages/client/ui-chat/client/composer

- `ChatComposer.tsx` — 聊天输入区：范围/项目栏、@ 提及 / 斜杠命令 / 技能弹层、附件与排队提示、输入框及其工具条、统计栏。
- `ComposerAddMenu.module.css` — 输入栏左下角 + 按钮、悬浮提示（添加文件等内容 @）及「添加上下文」弹层样式。
- `ComposerAddMenu.tsx` — 渲染输入框左下角 + 按钮、图一「添加文件等内容 @」提示条及图二「添加上下文」菜单。
- `ComposerAttachmentChip.tsx` — 聊天输入附件：图片显示可移除的缩略图，其他附件保留文件标签。
- `ComposerMediaLibrary.tsx` — 输入框工具栏的「生成素材库」入口：图标按钮 + 素材库弹窗，复用提示词回填输入框。
- `ComposerNotice.tsx` — 输入框上方的上下文提示条：显示一次性提示与关闭按钮。
- `ComposerQueuePanel.module.css` — 输入区排队消息面板：条数摘要、逐条编辑/删除/立即插话/上移与运行提示。
- `ComposerQueuePanel.tsx` — 输入区排队消息面板：显示排队条数，支持编辑、删除、上移、立即插话发送与清空；并提供运行中提示。
- `ComposerQueueSection.tsx` — 输入栏排队消息区块：集中绑定 store 的排队操作，避免 ChatComposer 继续膨胀。
- `ComposerRightActions.module.css` — 输入栏右下角语音输入（Ctrl+M）、三竖条录音波形、发送与停止（Ctrl+D）按钮及快捷键提示样式。
- `ComposerRightActions.tsx` — 渲染输入栏右下角语音输入（Ctrl+M 波形状态）、发送与运行中取消（Ctrl+D）按钮及快捷键提示。
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
- `SessionModeBar.tsx` — 顶栏标题右侧的会话模式徽标：订阅聊天快照，替代原先挤在输入栏工具栏里的模式选择。
- `composer-attachments.ts` — 输入区附件整理：把粘贴的图片、拖入的文件与绝对路径统一转成 ComposerAttachment，文件会存入会话附件库。
- `composer-context.ts` — 管理输入栏附件上下文芯片、@ 提及指令检索提取以及发送前上下文拼装的纯函数（无 DOM 依赖）。
- `composer-keyboard.ts` — 输入框键盘导航：@ / 斜杠 / 技能三种候选的方向键、Tab/Enter 选中、Esc 关闭，以及回车发送与 Ctrl+Enter 清空排队。
- `composer-paths.ts` — 输入区绝对路径识别：把粘贴或输入的本机绝对路径（Windows 盘符 / UNC / POSIX）识别成文件上下文。
- `local-speech.ts` — 在浏览器端通过 Web Audio 采集麦克风音频并编码为 16kHz 单声道 PCM WAV，供 Host 离线语音识别。
- `media-submit.ts` — 媒体直连提交：把输入栏草稿、图片附件与选定画幅整理成生成请求，供选中媒体模型时复用。
- `useChatComposer.ts` — 聊天输入栏状态机：草稿、附件、输入框交互与发送（含 /plan、/goal、/review 快捷指令）；@ / 斜杠 / 技能触发见 useComposerTriggers。
- `useComposerInput.ts` — 输入框交互 Hook：随内容自动增高，并把粘贴/拖入的图片、文件与绝对路径转成附件。
- `useComposerTriggers.ts` — 输入栏触发层：@ 提及 / 斜杠命令 / 技能三种触发状态、候选列表与选中动作；草稿与发送仍在 useChatComposer。
- `useMediaOptions.ts` — 输入栏的生图选项：画幅与风格，以及发送后把宿主实际采用的比例回写到选择器。
- `useVoiceDictation.ts` — 管理聊天输入栏的语音听写状态与双引擎切换（优先浏览器在线识别，network 失败自动无缝切换本机离线 WAV 转写）。

### packages/client/ui-chat/client/conversation

- `AssistantTimeline.tsx` — 以正文偏移和真实操作记录渲染流式回复及完成后的过程回看。
- `ChatAnchorBar.module.css` — 聊天区左侧导航刻度锚点条样式：Dock 波形悬停放大、液态玻璃预览浮卡与书签高亮。
- `ChatAnchorBar.tsx` — 中央聊天区左侧「导航刻度锚点条」：按对话轮次展示刻度线、悬停波浪放大、预览浮卡、书签标记与点击平滑跳转。
- `ChatDeleteDialog.tsx` — 删除当前对话的二次确认弹窗：说明删除不可恢复，并由调用方执行真正的删除。
- `ChatErrorBanner.module.css` — 输入区上方的错误条：单行文案 + 可选的「用工作树并行」动作；只用 ui-theme 语义变量。
- `ChatErrorBanner.tsx` — 输入区上方的错误条：展示启动失败文案；工作区被占用时提供「用工作树并行」入口。
- `ChatMessageList.tsx` — 聊天消息区：空会话引导（标题/副标题/起步提示）与消息线程（按日分隔、用户气泡、助手时间线与完成态操作）。
- `ChatWorkspace.composer.module.css` — 聊天输入区（附件、上下文提示、输入卡片与工具栏）样式，双主题变量适配。
- `ChatWorkspace.module.css` — 中央核心聊天与 Agent 任务工作区样式，对齐深色炭黑与浅色纯白画布层次。
- `ChatWorkspace.tsx` — 渲染中央聊天工作区：空会话引导、流式回复、Agent 思考/行动/检查轨迹卡片与底部输入栏。
- `Clarification-Card.module.css` — 输入区澄清卡：问题、选项和操作分层，窄栏时输入框独占一行。
- `Clarification-Card.tsx` — 在输入框上方收集 Agent 的澄清答复。
- `Conversation-Trace.module.css` — 独立轨迹使用紧凑列表与可关闭详情，适配主题和窄屏。
- `Conversation-Trace.tsx` — 独立展示当前会话的真实消息与 Agent 步骤，实时复用聊天 Store 中的快照。
- `Live-Fish.module.css` — 小鱼游动动画：水平往返 + 轻微上下浮动 + 尾巴摆动，全部使用主题变量。
- `Live-Fish.tsx` — @lfaa/chat 实时状态的小鱼动画：替代转圈指示，鱼身沿路径摆动并循环游动。
- `MarkdownContent.module.css` — 助手消息富文本 Markdown 排版样式：标题层级、列表圆点、精美表格、语法高亮代码块与行内代码胶囊。
- `MarkdownContent.tsx` — 助手消息富文本 Markdown 渲染组件：消除原始 ** / - 等标记符，提供精美排版、表格、代码块语法高亮与一键复制。
- `MessageActionBars.module.css` — 消息操作栏（复制/评价/朗读/更多菜单/编辑消息）与已编辑文件折叠卡片样式。
- `MessageActionBars.tsx` — 消息操作栏与文件变更汇总卡片：提供用户消息复制/编辑、助手消息复制/评价/朗读/分支与记忆引用菜单及已编辑文件折叠卡片。
- `Step-Detail.module.css` — 步骤详情面板样式：标签页 + 键值行 + 等宽文本块，全部使用主题变量。
- `Step-Detail.tsx` — @lfaa/chat 步骤详情面板：点开某个动作后按「概览 / 参数 / 结果 / 计时」查看留痕，风格与聊天区一致。
- `StepTraceList.approval.module.css` — 待审批工具卡片样式：卡片容器、标题提示、参数块与批准/拒绝按钮，从 StepTraceList.module.css 拆出。
- `StepTraceList.module.css` — 助手状态、活动折叠行及终端详情，使用工作区浅色和深色主题变量；审批卡片样式见 StepTraceList.approval.module.css。
- `StepTraceList.tsx` — 显示 Agent 运行用时和现有的工具审批操作。
- `Turn-Changes.tsx` — 右工作台的本轮变更，展示已保存的工具快照及操作顺序。
- `UserMessageAttachments.module.css` — 用户消息图片：图片即卡片，多张时按 2–3 列排开，不留气泡内边距。
- `UserMessageAttachments.tsx` — 渲染已发送用户消息中的图片：上传附件按会话读取附件库，引用图按路径读取会话内生成媒体。
- `WorkspaceDialogs.tsx` — 聊天工作区的会话级弹窗：新建项目对话框与删除会话确认框。
- `activity-label.ts` — 将 Host 的工具步骤转换为聊天活动摘要，保留可区分的动作和状态。
- `advice-options.ts` — 从助手最终回答的「建议/下一步」段落提取可选后续项，供界面编号展示、用户点选发送。
- `code-highlight.tsx` — 为右工作台 VS Code 代码查看器提供多语言词法高亮、嵌套标签/括号彩虹配对着色、语言徽标及面包屑路径解析。
- `markdown-parser.ts` — 轻量流式安全 Markdown 块级解析与代码语法分词器，用于渲染助手消息中的标题、列表、表格、引用与高亮代码块。
- `trace-groups.ts` — @lfaa/chat 留痕分组：把步骤按「思考 / 读取 / 搜索 / 命令 / 文件变更 / 其他」归并，供展开区成组展示。
- `useChatScroll.ts` — 管理聊天视口的底部跟随，监听流式正文、工具和输入栏引起的高度变化。
- `useMessageActions.ts` — 消息区交互接线：编辑内容、分叉到新会话、继续中断消息、提问、审批，以及媒体引用的再生成。
- `useMessageFeedback.ts` — 消息反馈 Hook：读取已保存的赞/踩状态，并在切换时立即落盘；失败回滚界面状态。

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

- `AgentSettingsView.module.css` — 设置中心“模型、规则与记忆配置”页面样式。
- `AgentSettingsView.tsx` — 渲染“模型、规则与记忆配置”页面（注册在 settings:config）：模型管理采用多提供商卡片网格+居中配置弹窗，并支持规则与长期记忆。
- `GeneralSettingsGeneralGroup.tsx` — 渲染设置中心「常规」页中的核心「常规」设置分组（项目外聊天目录、Shell、语言、历史、推理强度、开源许可证与插件等）。
- `GeneralSettingsSecondary.tsx` — 渲染设置中心「常规」页下半部分分组：编辑器、弹出窗口、通知与趣味实验。
- `GeneralSettingsView.overlays.module.css` — 设置中心「常规」页的浮层样式：许可证详情弹窗与庆祝叠层，页面外观由 @lfaa/ui-primitives 的 SettingsSurface 提供。
- `GeneralSettingsView.tsx` — 渲染设置中心「常规」主页面：权限卡片、常规/编辑器/通知子分组装配与开源许可证弹窗。
- `NotificationSettingsGroup.tsx` — 通知设置分组：桌面通知权限、轮次完成/权限/问题提醒、会话状态徽标、事件提示音与自定义音频。
- `NotificationSettingsView.tsx` — 设置中心「通知」页：装配桌面通知权限、轮次完成/权限/问题提醒、会话状态徽标与提示音。
- `coding-settings-client.ts` — 客户端访问「设置 → 编码（Git 与代码审查）」与内置 Git / 审查接口的类型与请求函数。
- `general-settings-client.ts` — 提供浏览器端通用设置默认结构、长路径中间省略格式化、开源依赖读取及轻量提示音播放辅助。

### packages/client/ui-chat/client/shared

- `file-activity.ts` — 将本轮文件快照和旧工具参数统一为聊天活动可用的文件定位。
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
- `run-media-actions.ts` — 媒体生成动作：画幅计划、参考图上传、生成请求与本地占位插入/移除。
- `run-stream-handler.ts` — 运行事件归并：把 Host 推送的快照、增量、步骤、审批与结束事件写进当前会话，断流时记录降级状态。
- `stream-client.ts` — 浏览器端高可用流式订阅器：提供按片段序号幂等去重、RAF 节流批量渲染、心跳看门狗、指数退避重连与完整句边界续写辅助。
- `workbench-persist.ts` — 管理右侧工作台标签页、当前舞台、工作区文件树显隐与目录展开状态的浏览器持久化偏好。

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
- `InlineComment.tsx` — 行内批注框：输入建议并提交到对话输入框；Esc 取消、Ctrl/Cmd+Enter 提交，挂载即聚焦。
- `Right-Workbench-Start.module.css` — 浏览器与空白工作台共用的启动页，按实际窗格宽度排列快捷操作。
- `Right-Workbench-Start.tsx` — 右工作台启动页，复用项目文件、浏览器和辅助面板入口，适用于空白浏览器标签。
- `RightFileTreePane.module.css` — 右辅助栏 VS Code 风格工作区文件树样式：含树形缩进线、文件类型着色与明暗双主题适配。
- `RightFileTreePane.tsx` — 右辅助栏 VS Code 风格工作区文件树：展示根目录与垂直缩进指引线、文件/目录语义图标、懒加载及双向联动高亮。
- `RightGitReviewPane.module.css` — 右侧 Git 变更列表与本轮变更样式（RightGitReviewPane / Turn-Changes），双主题变量适配。
- `RightGitReviewPane.tsx` — 右侧工作台 Git 变更列表，在文件行下方按需读取并展示真实差异。
- `RightSideAskPane.tsx` — 右栏「侧边提问」面板：在不打断主聊天长流的前提下进行轻量上下文问答。
- `RightSubagentsPane.tsx` — 右栏「子智能体与多 Agent 协作」面板：实时展示子智能体角色、状态、步骤数与输出结论。
- `RightTerminalPane.tsx` — 右栏「终端与后台任务」面板：支持快速发起后台命令、查看实时 stdout/stderr 输出与一键停止进程。
- `RightUtilityRail.tsx` — 最右侧垂直图标菜单栏：收纳工作区文件树、工作区上下文、后台任务、子智能体、侧边提问、工作详情与审查/扩展入口。
- `RightWorkbenchActions.module.css` — 右工作台右上角操作按钮组、⋮/概览浮层菜单与嵌入式 Git 审查 Tab 样式，双主题变量适配。
- `RightWorkbenchActions.tsx` — 工作台快捷操作与概览控制：组合顶栏按钮组、“更多”与“概览”两个弹层，并持有菜单状态与任务数据。
- `RightWorkbenchPane.module.css` — IDE 化右侧工作台样式：顶栏与中间栏齐平、全高主舞台、可折叠辅助抽屉及最右图标轨，全量消费 @lfaa/ui-theme 变量。
- `RightWorkbenchPane.tsx` — IDE 化右侧工作台主壳：承接右侧栏状态持久化与请求，装配顶部标签、主体舞台与最右图标轨。
- `WorkbenchAuxBody.tsx` — 右侧工作台辅助面板内容：文件树、工作区上下文、终端任务、子智能体、侧边提问与工作详情。
- `WorkbenchAuxPane.tsx` — 右侧工作台辅助面板外壳：宽度拖拽手柄、可折叠抽屉与面板头，内容由调用方渲染。
- `WorkbenchMoreMenu.tsx` — 渲染右侧工作台“更多”菜单：会话重命名、置顶、归档、复制与工作台入口。
- `WorkbenchOverviewMenu.tsx` — 渲染右侧工作台“概览”弹层：变更统计、子智能体与后台任务摘要及快捷入口。
- `WorkbenchStageContent.tsx` — 右侧工作台主体舞台：按当前标签渲染文件预览、工作区/本轮变更、内置浏览器或欢迎页，并组合辅助面板。
- `WorkbenchStatusList.tsx` — 右侧工作台欢迎页的运行状态列表：最近子智能体与后台任务，点击可跳到对应辅助面板。
- `WorkbenchTabs.tsx` — 右侧工作台顶部标签栏：工作台/辅助面板、文件预览、内置浏览器、变更审查标签与新建浏览器标签按钮。
- `WorkbenchTopActions.tsx` — 渲染右侧工作台顶栏控制按钮组：更多、概览、最大化与收起侧面板。
- `WorkspaceFileTabs.module.css` — 右栏文件页签和阅读区，沿用工作区主题与操作焦点。
- `WorkspaceFileTabs.tsx` — 在右侧上下文区域承载可切换、可关闭的源文件标签。
- `diff-view.ts` — 文件预览 Diff 视图的数据层：把 git 统一 diff 或「修改前/后」片段整理成左右分栏的行模型。
- `file-search-highlight.tsx` — 行内搜索高亮：把一行文本按查询切分并输出带 <mark> 的 React 节点，供文件预览复用。
- `useAuxResize.ts` — 管理右侧辅助栏（工作区文件树 / 上下文 / 任务面板）的指针拖拽调宽与本地偏好持久化。
- `useWorkbenchBrowser.ts` — 右侧工作台内置浏览器状态与宿主操作：标签列表、初始 URL、外部快照与新建/关闭/导航处理。
- `useWorkbenchSummary.ts` — 右侧工作台后台概览轮询：按会话拉取后台任务与子智能体列表，供顶栏与欢迎页状态行展示。
- `workbench-titles.ts` — 右侧工作台辅助面板标题字典：按语言返回文件树、上下文、终端、子智能体、侧边提问与工作详情标题。

### packages/client/ui-chat/src

- `index.ts` — @lfaa/client-ui-chat 的 Host 半：只放可被两端共享的稳定标识，界面实现见 ./client。

### packages/client/ui-chat/tests

- `activity-label.test.ts` — 验证活动与阶段文案：负责人指定的 19 条中文状态短语必须逐条对应真实状态，且不暴露内部工具名。
- `activity-summary.test.ts` — 验证多步活动摘要：用真实动作和对象说明这一轮做了什么，不再出现「N 项操作」这类空话。
- `advice-options.test.ts` — 验证智能追问提取：只从「建议/下一步」段落的列表项生成可选项，普通列表或不足两条时不出选项。
- `ark-models.test.tsx` — 验证方舟套餐目录：未配置凭据不显示模型；配置后四类模型统一用 chip，并标记非接口返回的「目录」条目。
- `chat-anchor-bar.test.ts` — 验证轮次导航刻度滑动窗口：最多 20 根，以当前轮次居中并夹紧边界，保证所有轮次都能通过滚动/点击到达。
- `chat-error-banner.test.tsx` — 验证错误条：文案常驻，工作区冲突时多出「用工作树并行」入口。
- `chat-lifecycle.test.ts` — 验证 @lfaa/chat Host/Client 双端 Cordis 生命周期、最近会话注入与项目聊天计数统计。
- `chat-queue.test.ts` — 验证排队消息纯操作：新增去空、删除、编辑（空文本删除）、上下移动与队首取出。
- `chat-running-sessions.test.ts` — 验证后台状态机：运行集合去重、待处理徽标增减，以及首屏同步不补发历史通知。
- `chat-store-actions.test.ts` — 验证聊天 Store 拆分后的动作模块：文件预览/右栏状态、会话草稿与打开、排队追问、偏好与记忆数据写入。
- `composer-paths.test.ts` — 验证输入框绝对路径识别与上下文拼装：粘贴/手打路径都能进入消息上下文。
- `composer-queue-panel.test.tsx` — 验证排队面板摘要与提示：收起/展开文案、全部发送提示，以及箭头位于操作之后。
- `composer-right-actions.test.tsx` — 验证输入框右下角动作：运行中显示暂停、中断可续写时显示继续、空闲时显示发送。
- `conversation-trace.test.tsx` — 验证独立轨迹按文本偏移呈现真实步骤，并兼容历史记录。
- `diff-view.test.ts` — 验证 Diff 分栏数据层：统一 diff 解析、修改前后片段对照、行号与空占位。
- `goal-actions.test.ts` — 验证目标文字编辑：PATCH 携带 sessionId 与 objective，成功后更新当前目标，空值不发请求。
- `goal-bar.test.tsx` — 验证输入框目标条：进行中/受阻文案、进度、编辑入口，以及完成后不渲染。
- `handoff-actions.test.ts` — 验证交接动作：加载待接手、接手后移除并刷新目标、忽略只本地移除。
- `handoff-bar.test.tsx` — 验证交接条：标题、摘要、来源与接手/忽略按钮。
- `inline-comment.test.tsx` — 验证行内批注框的结构：行号提示、输入框、取消/添加按钮，以及空草稿时禁用提交。
- `markdown-advice.test.ts` — 验证 Markdown 建议标题判定：命中建议/下一步类标题用强调样式，普通标题不受影响。
- `markdown-image.test.tsx` — 验证 Markdown 图片语法接入聊天渲染：本机媒体走 LocalMediaImage（SSR 阶段显示加载占位），不再输出原始 ![] 文本。
- `media-stream.test.ts` — 验证媒体生成流式解析：计划句先回调给占位，最终结果与错误事件都能正确处理。
- `model-groups.test.ts` — 验证配置卡片的模型分类：按用途归组，顺序固定，未知用途按对话模型处理。
- `model-option-row.test.tsx` — 验证模型选择行：方舟「控制台路由」已在副标题里时不再单独占一行，额外状态仍保留。
- `model-provider-form.test.tsx` — 验证套餐配置表单也提供「获取官方模型」，并把拉取到的全部模型列出可选（普通接口保留首屏截断）。
- `notifications.test.ts` — 验证通知策略：轮次完成档位与不支持 Notification API 时的安全回退。
- `provider-catalog.test.ts` — 提供商接入预设的回归测试：验证套餐凭据、计费路由和旧档案匹配保持隔离。
- `right-panel.test.tsx` — 验证重构后的右侧工作台面板渲染搜索/URL 栏、6 项工具入口及子智能体/后台任务区块。
- `run-stream-handler.test.ts` — 验证运行事件归并：增量追加、步骤 upsert、结束时的队列接续与错误落盘、断流降级。
- `session-todos.test.ts` — 验证从会话步骤里取任务清单：取最近一次、跨消息回退、状态统计。
- `timeline-streaming.test.tsx` — 验证 AssistantTimeline 在流式轮次切换、工具执行、文本输出及完成态时始终保持连贯的活动反馈。
- `todo-activity-label.test.ts` — 验证任务清单在活动行里的文案：完成时显示真实进度，而不是裸 JSON 或统一措辞。
- `todo-dock.test.tsx` — 验证输入框上方任务卡：进度摘要、递增步骤序号、状态点、空清单不渲染、超过 12 条折叠余项。
- `todo-group-summary.test.tsx` — 验证一轮里有多步操作时，活动摘要会并列真实动作，不再只显示最后一步或退回「N 项操作」。
- `trace-groups.test.ts` — 验证留痕分组：按动作类型归并、保持出现顺序、统计数量并标记失败。
- `trace-todo-dock.test.tsx` — 验证轨迹视图顶部复用任务卡：有清单时渲染，没有清单时不渲染。
- `user-message-attachments.test.tsx` — 验证用户消息附件能进入对话气泡并提供可理解的图片加载状态。
- `workspace-isolate.test.ts` — 验证工作区占用后的「用工作树并行」：创建 worktree → 绑定会话 → 清掉冲突提示；未绑定项目时不发请求。

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

- `StorageSettingsView.module.css` — 设置中心「存储」视图样式：统计面板、路径模式单选卡片、自定义目录与迁移回执。
- `StorageSettingsView.tsx` — 渲染设置中心「存储」视图：支持默认目录 / 项目推荐目录 / 自定义目录切换，并执行无损数据迁移。

### packages/client/ui-library/client/views

- `LibraryInspector.module.css` — 资料库右栏检视器样式：头部与顶栏齐平，主体按概览/媒体/资产分区块；全部消费主题语义变量。
- `LibraryInspector.tsx` — 资料库右栏检视器：未选中时展示存储概览，选中生成素材或资产后展示内容、提示词与操作。
- `LibraryMediaGrid.module.css` — 资料库「图像」分类样式：类型筛选胶囊与全宽生成素材缩略图网格；详情面板见 LibraryInspector.module.css。
- `LibraryMediaGrid.tsx` — 资料库「图像」分类：生成素材的类型筛选与缩略图网格；选中后的详情交给右栏检视器，不再占用画布宽度。
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
- `locales.ts` — @lfaa/plugins 浏览器端中英文界面文案字典。

### packages/client/ui-plugins/client/api

- `plugins-client.ts` — @lfaa/plugins 浏览器端 HTTP 请求封装，与 Host /api/plugins 接口通信。

### packages/client/ui-plugins/client/components

- `Add-Plugin.module.css` — 添加插件弹窗样式：复用主题变量，日志区固定高度可滚动，避免撑破界面。
- `Add-Plugin.tsx` — @lfaa/plugins 添加插件弹窗：支持 npm 包名 / GitHub 地址 / 本地目录三种来源，实时展示安装日志。
- `Catalog-Card.tsx` — @lfaa/plugins 插件中心目录卡片：区分「已装配」「已安装」与可安装三种状态，并提供安装入口。
- `Plugin-Card.tsx` — @lfaa/plugins 插件中心已安装插件卡片：展示运行时状态、包名与失败原因，并承载启停/编辑/卸载操作。
- `Plugins-View.module.css` — @lfaa/plugins 插件中心主视图样式，完全使用 @lfaa/ui-theme 语义变量以适配深浅双主题与窄屏。
- `Plugins-View.tsx` — @lfaa/plugins 插件中心主视图：汇总真实状态与可安装目录，操作前二次确认并展示执行进度。

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

- `CodeReviewSettingsView.tsx` — 渲染设置中心「编码 → 代码审查」配置页：子标签页（偏好设置 / 审查智能体）、真实代码仓库列表与个人偏好。
- `CodingSettingsExtras.module.css` — 编码设置页面（Git 与代码审查）补充控件样式，与 @lfaa/ui-primitives 的 SettingsSurface.module.css 配合使用。
- `GitSettingsView.tsx` — 渲染设置中心「编码 → Git」配置页：分支前缀、PR 合并策略、强制推送、草稿 PR、/review 展示方式及提交/PR 指令。

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
- `RemoveProjectDialog.module.css` — 移出项目二次确认弹窗样式，采用居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本。
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

### packages/core/agent/src

- `http-handler.ts` — 为本机 Web 服务提供 /api/agent/* 任务启动、SSE 轨迹推送、人工审批与任务中止接口。
- `index.ts` — @lfaa/agent Host 侧 Cordis 服务：连接 llm/tools/memory/rules 四大能力并管理任务运行态、SSE 订阅与工具审批。
- `stream-journal.ts` — 提供 @lfaa/agent 流式断线续传序号日志、句边界续写裁剪、脱敏日志及可观测性指标统计。
- `types.ts` — 定义 @lfaa/agent 的运行契约：权限模式、运行输入、Think/Act/Check 流式事件与人工审批句柄。

### packages/core/agent/src/context

- `agent-context.ts` — Agent 运行上下文装配：记忆召回、规则提示词、资料库摘要、技能/进度提示与模型能力价格解析。
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
- `model-round.ts` — Agent Host 模型轮次的超时与有限重试，保留已发出的正文和工具进度。
- `run-begin.ts` — Agent 运行启动器：校验会话与授权根、落盘用户/助手消息、登记运行记录并把执行循环交给 agent-loop。
- `run-compaction.ts` — 运行期压缩入口：优先使用挂载的压缩服务，未挂载时回落到 @lfaa/context 的内置实现。
- `run-context.ts` — 运行上下文装配：召回规则/记忆/资料库，拼装工作区与技能提示，创建用量跟踪、系统消息与初始对话。
- `run-options.ts` — 续跑复用的运行选项：延续用户上一轮选的模型、预算与权限模式，避免续跑悄悄退回默认值。
- `run-records.ts` — Agent 运行记录类型：活动运行、待审批请求与审批摘要，供服务层与运行启动器共用。
- `run-system.ts` — 系统提示词渲染：把各段提示按固定顺序拼成一条 system 消息内容，供运行循环每轮复用。
- `run-types.ts` — 定义 Agent 运行循环的依赖与输入契约，供循环主体与工具执行器共用，避免循环文件继续膨胀。
- `run-waiters.ts` — @lfaa/agent 运行等待器：记录「谁在等这次运行收口」，用于群聊串行编排与外部同步等待。
- `steering.ts` — 运行期插话：把运行中追加的用户消息（steer）并入当前对话，并在轨迹中留记录。
- `step-budget.ts` — 计算单轮 Agent 任务的工具步数预算：默认软预算可自动延长，显式上限保持硬约束。
- `think-round.ts` — Agent 单轮「思考」：渲染系统提示 → 预算内压缩 → 注入 steering → 记录 token 快照 → 调模型（含超限重试）。
- `todo-plan.ts` — 任务清单策略：把 todo_write 排到工具列表首位，并在多步任务迟迟不建清单时给一次提醒。
- `tool-policy.ts` — @lfaa/agent 运行装配辅助：把「某个 agent 的工具策略」解析出来交给工具层。
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
- `model-round.test.ts` — 验证模型请求静默退出、长推理限制及工具参数增量。
- `project-git.test.ts` — 验证自动 Git 基线会跳过疑似密钥文件，并仍尊重 .gitignore。
- `project-scope.test.ts` — 验证项目范围锚定：提示词内容，以及绑定项目的运行确实把项目名与简介送入系统提示。
- `run-message-attachments.test.ts` — 验证 Agent 运行把用户图片附件与引用图写入用户消息，供聊天气泡还原缩略图。
- `run-routing.test.ts` — 验证「本次运行用哪个 agent、哪份绑定」的解析优先级，以及续跑缓存不丢这两个设置。
- `session-tools.test.ts` — 验证会话可见性工具：项目隔离、会话行格式、消息/步骤摘要与有界等待。
- `todo-plan.test.ts` — 验证任务清单策略：todo_write 排到工具首位，且提醒只在「没清单 + 已多步 + 没提醒过」时触发一次。
- `tool-result.test.ts` — 验证工具结果进入模型上下文前的统一限长与续读提示。
- `verification.test.ts` — 验证完成前自检对代码路径与构建/测试命令的识别规则。
- `workspace-lease-run.test.ts` — 验证运行级工作区租约：同工作区第二个会话被拒绝，首个运行收尾后可以接手，租约随运行释放。
- `workspace-lease.test.ts` — 验证工作区租约：scope 解析、跨会话冲突拒绝、释放后接手与同会话重入。
- `worktree-roots.test.ts` — 验证绑定工作树的会话使用工作树根运行，并在工作树失效时明确失败而不是回退项目主目录。

### packages/core/browser

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `inplace.mjs`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/browser 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/core/browser/contract

- `index.ts` — 定义 @lfaa/browser 的多标签快照、控制台与网络请求记录、人工接管状态及配置契约。

### packages/core/browser/src

- `http-handler.ts` — 提供 /api/browser/* 导航、多标签管理、动态视口、真实键鼠、Console/Network 日志、人工接管及配置接口。
- `index.ts` — @lfaa/browser Host 侧 Cordis 服务：统一注册 DSH 风格独占驱动槽位、内置浏览器工具与生命周期清理。
- `runtime-utils.ts` — 浏览器运行时公共校验、可执行路径探测与 DOM 快照提取辅助函数。
- `types.ts` — @lfaa/browser 类型入口：契约已下沉到 contract/，这里保留原路径重导出以免改动全部内部引用。

### packages/core/browser/src/session

- `browser-service.ts` — 基于 playwright-core 驱动本机 Edge/Chrome，支持会话多标签页、动态视口同步、真实键鼠操作及 Console/Network 采集。
- `browser-session-types.ts` — 浏览器运行时内部类型：单标签条目、会话状态与日志条数上限，供运行时、标签监听与快照组装共享。
- `browser-tabs.ts` — 浏览器标签监听：为新建 Page 挂 Console/网络/导航/关闭事件并维护会话状态里的标签表。
- `registry.ts` — 参考 DSH @deepseek-ai/dsh-browser-use 的独占命名注册槽位，确保同一时刻仅有一个浏览器实现注册并受 Cordis 生命周期托管。
- `screencast-manager.ts` — 管理基于 Playwright CDPSession 的 Chromium Screencast 实时推流，代替低帧率截屏轮询。
- `session-driver.ts` — 浏览器页面驱动：导航、前进后退、刷新、快照、求值，以及点击/悬停/输入/按键/滚动等页面交互。

### packages/core/browser/src/settings

- `browser-settings.ts` — 内置浏览器设置读写：设置文件路径、偏好归一化与缓存，更新时报告 headless 变化以便运行时重建浏览器。

### packages/core/browser/src/snapshot

- `browser-snapshot.ts` — 浏览器快照组装：外观/DPR 同步、CDP 帧元数据、活动会话快照、空闲快照与人工接管快照。

### packages/core/browser/src/tools

- `browser-tools.ts` — 为小鱼 Agent 注册内置浏览器工具集（导航、元素快照、点击、输入、滚动、按键、截图、控制台排查）。

### packages/core/browser/tests

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

### packages/core/memory/src

- `http-handler.ts` — 为本机 Web 服务提供 /api/memory*、/api/library* 与 /api/storage* HTTP 接口，支持记忆、资产库与无损存储迁移。
- `index.ts` — @lfaa/memory Host 侧 Cordis 服务：统一对外提供短期会话记忆、长期事实记忆、资料库资产/产物及存储迁移服务。
- `longterm-store.ts` — 管理长期事实记忆存储（~/.lfaa/memory.json），支持按项目/全局写入、列表管理与关键词召回。
- `types.ts` — @lfaa/memory 的领域契约：会话类型由 @lfaa/session 提供，资料库/存储类型由 @lfaa/storage 提供；本文件保留长期记忆条目。

### packages/core/memory/tests

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

### packages/core/subagent/src

- `http-handler.ts` — 提供 /api/subagents* 查询与中止接口，供右侧栏实时显示子智能体列表与执行详情。
- `index.ts` — @lfaa/subagent Host 侧 Cordis 服务：注册多 Agent 协作工具并托管隔离子运行生命周期。
- `subagent-service.ts` — 进程内子智能体调度核心：为子智能体创建隔离会话上下文、过滤权限边界与并发限流。
- `types.ts` — 定义 @lfaa/subagent 进程内子智能体状态、协作参数与配置契约。

### packages/core/subagent/tests

- `subagent-service.test.ts` — 验证 @lfaa/subagent 并发派发、上下文隔离、递归深度防护、权限隔离与停止清理。

### packages/core/system-prompt

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md` — @lfaa/system-prompt
- `package.json`
- `tsconfig.json`

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

### packages/core/tools/src

- `builtin-tools.ts` — 提供内置核心工作区工具集（读文件、列目录、文本搜索、写文件、命令执行）。
- `edit-tools.ts` — 提供唯一命中校验的局部编辑工具：命中多处时拒绝执行，避免一次替换误改整份文件。
- `index.ts` — @lfaa/tools Host 侧 Cordis 服务：统一管理工具注册表、内置工作区工具与权限安全执行。
- `search-tools.ts` — 提供 glob 文件名匹配与 grep 正则内容检索两个只读工具，替代整树逐文件盲目扫描。
- `types.ts` — 定义 @lfaa/tools 的无 DOM 领域契约：工具权限级别、参数协议、执行上下文及结果结构。

### packages/core/tools/tests

- `tools-service.test.ts` — 验证 @lfaa/tools 路径沙箱越界拦截、文件读写/搜索工具执行与 Cordis 插件注册注销。

### packages/extension/plugins

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/plugins 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/extension/plugins/contract

- `index.ts` — @lfaa/plugins 公开契约：定义插件清单、安装记录、运行状态与可安装目录条目，无 Node 或 DOM 依赖。

### packages/extension/plugins/src

- `index.ts` — @lfaa/plugins Host 侧 Cordis 服务：管理插件安装、启停、卸载、二创与运行状态。

### packages/extension/plugins/src/catalog

- `install-spec.ts` — 插件安装来源解析：把用户输入的包名 / GitHub 地址 / 本地路径 / tarball 归类，供 profile 安装使用。
- `module-aliases.ts` — 合包后的旧插件 module 名迁移表：包名合并后，旧 profile 记录与旧会话模块列表都要映射到新包名。
- `plugin-catalog.ts` — 可安装插件目录：本仓已具备默认导出的插件包清单，以及包名到稳定记录 id 的规整规则。
- `plugin-presets.ts` — 插件模式预设持久化：记录当前默认模式，校验可用性并提供新会话的模块组合。

### packages/extension/plugins/src/manager

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
- `plugin-routes.test.ts` — 验证插件安装流式接口：只接受 POST + JSON，SSE 逐行推送日志并以 done/failed 收尾。
- `plugins-lifecycle.test.ts` — 验证 @lfaa/plugins 基于 Cordis Loader 的真实安装、启用、停用、卸载与 profile 持久化。
- `pnpm-spawn.test.ts` — 验证 pnpm 子进程调用层：安装来源拒绝 shell 元字符、Windows 命令行全部引用、优先绕开 shell。

### packages/extension/skills

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/skills 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/extension/skills/contract

- `index.ts` — @lfaa/skills 公开契约：定义技能来源、摘要、详情、编辑输入与插件技能注册接口，无 Node 或 DOM 依赖。

### packages/extension/skills/src

- `index.ts` — @lfaa/skills Host 侧 Cordis 服务：统一暴露技能发现、Git 安装、编辑、二创、启停与 Agent 按需加载工具。
- `skill-routes.ts` — 为本机 Web 服务提供 /api/skills/* HTTP 接口，支持技能列表、详情、编辑、二创、启停与删除。
- `skill-service.ts` — @lfaa/skills Host 侧技能管理逻辑：发现内置/项目技能、管理个人技能文件、Git 安装与插件技能注册，提供原子保存与二创。

### packages/extension/skills/src/builtin-skills/lfaa-skill-creator

- `SKILL.md`

### packages/extension/skills/src/builtin-skills/minecraft-plugin-dev

- `SKILL.md`

### packages/extension/skills/tests

- `skills-lifecycle.test.ts` — @lfaa/skills 生命周期与二创回归测试：覆盖个人/项目/插件技能发现、版本冲突、二创复制与运行前校验。

### packages/feedback/message-feedback

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

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

### packages/guard/timeout-policy/src

- `index.ts` — @lfaa/timeout-policy：为所有工具执行套一层统一超时，超时中止 signal 并返回可读失败结果。

### packages/guard/timeout-policy/tests

- `timeout-policy.test.ts` — 验证超时策略：超时返回可读结果并中止信号，快工具原样通过，父级取消向内传递。

### packages/host/web-server

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/host/web-server/src

- `detect-root.ts` — @lfaa/web-server：从起始目录向上定位 LFAA 工程根目录，供开发模式回退使用。
- `dev-server.ts` — @lfaa/web-server：开发模式宿主：启动 Vite 开发服务器，并把同一套 /api 网关与令牌注入挂到它上面。
- `index.ts` — @lfaa/web-server：公开入口：开发宿主（Vite）、生产宿主（静态托管）与共用运行时装配。
- `runtime.ts` — @lfaa/web-server：装配 Host 运行时（沙箱、bundle、各能力处理器与统一网关），并生成一次性接口令牌。
- `static-files.ts` — @lfaa/web-server：生产静态托管的文件层实现：MIME、路径边界、Range、缓存头与响应工具。
- `static-server.ts` — @lfaa/web-server：生产模式宿主：只监听本机，静态托管 Web 产物，并把 /api 交给同一套网关与一次性令牌。

### packages/host/web-server/src/handlers

- `handlers-chat.ts` — @lfaa/web-server：构造会话与运行相关处理器（聊天、编码会话、媒体直连生成、Agent 运行）。
- `handlers-notifications.ts` — @lfaa/web-server：提供自定义通知提示音的上传、列表、读取与删除接口；文件保存在本机 ~/.lfaa/notification-sounds。
- `handlers.ts` — @lfaa/web-server：构造常规能力 HTTP 处理器（工作区、技能、插件、模型、记忆、媒体文件等），并集中提供

### packages/host/web-server/tests

- `notification-sounds.test.ts` — 验证自定义提示音接口：上传、列表、读取文件与删除，并拒绝非音频与超大内容。
- `static-server.test.ts` — 验证生产静态托管的关键边界：令牌注入、MIME 与缓存、目录穿越、SPA 回退、Range 与只读方法限制。

### packages/interaction/commands

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/interaction/commands/src

- `index.ts` — @lfaa/commands：斜杠命令注册 seam。插件向 Host 注册命令，聊天输入栏通过 /api/commands 发现并执行。

### packages/interaction/commands/tests

- `commands.test.ts` — 验证斜杠命令 seam：注册/注销、内置命令展开、执行异常与 HTTP 分支。

### packages/media/tool-media

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

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

### packages/sandbox/sandbox/src

- `index.ts` — @lfaa/sandbox 安全边界包入口：导出沙箱契约、执行策略与本地后端，并组合成默认插件。
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
- `workbench-service.ts` — 在浏览器 Cordis 上下文中注册并管理四栏工作台服务与插件贡献生命周期。

### packages/ui/layout/client/navigation

- `AppMenu.module.css` — 更多应用弹层与固定到一级栏的图钉操作。
- `AppMenu.tsx` — 展示更多应用。桌面支持固定入口，手机汇总从底栏移入的功能。
- `DomainSidebarMenu.tsx` — 根据左一导航栏选中的功能域（资料库、图像、定时任务、插件、代码审查与扩展），动态渲染对应的左二功能菜单。
- `GroupHeaderTools.tsx` — 渲染左二分组标题栏右侧按需显现的排序下拉按钮与快捷操作按钮（如新建项目 / 新聊天）。
- `NavigationGroups.module.css` — 工作区侧栏专属“新聊天”按钮与项目排序/创建工具栏样式（其余列表样式复用 SidebarSectionList）。
- `NavigationGroups.tsx` — 管理工作区“新聊天”与置顶、自定义分区、项目、最近聊天分组，并复用 SidebarSectionList 渲染。
- `NavigationIcon.tsx` — 将统一的 Tabler 图标映射为侧栏可复用组件；「working」使用圆弧图标表示 Agent 运行中。
- `NavigationNewChatButton.tsx` — 侧栏顶部的「新聊天」入口按钮，负责选中态样式与无障碍标记，点击行为由父级注入。
- `NavigationRail.module.css` — 一级图标栏及其悬浮菜单，使用 Shell 提供的主题变量。
- `NavigationRail.tsx` — 呈现工作台一级图标栏，负责直接导航、更多菜单及本地工作区状态。
- `NavigationSidebar.module.css` — 左二导航栏顶部工具、模式切换与设置菜单容器。
- `NavigationSidebar.tsx` — 复用同一套左二菜单栏骨架，根据 WorkbenchDomainConfig 切换头部形态与业务菜单内容。
- `UserMenu.module.css` — 用户菜单固定在一级图标栏左下角，并跟随 Shell 主题变量。
- `UserMenu.tsx` — 展示本地用户菜单，并复用现有外观设置入口与主题插件提供的头部快捷操作。
- `navigation-groups-config.ts` — 组装左二栏「置顶 / 自定义分区 / 项目」三个分组配置，不持有 React 状态，选中态与拖放事件由调用方注入。
- `navigation-items.ts` — 侧栏导航行构建器：把项目、会话与最近记录转换为 SidebarSectionList 的统一行配置，不持有 React 状态。
- `navigation.ts` — 定义浏览器 Shell 共用的导航与最近列表类型，项目类型由公共契约提供。
- `session-list-paging.ts` — 左二栏会话分页：每批显示 6 条会话，项目子会话与「最近」分组共用同一套窗口计算与展开/收起控件。
- `use-session-window.ts` — 左二栏会话窗口状态：项目子会话按行记录展开批次，「最近」分组共享一条窗口；折叠项目时重置。
- `usePinnedApps.ts` — 读取并持久化侧栏固定的应用入口，默认固定参考图中的站点。
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
- `SidebarSectionList.module.css` — 统一的左二菜单栏分组、列表、搜索框与空态样式，供工作区与设置中心共用。
- `SidebarSectionList.tsx` — 统一的左二菜单栏列表原语：复用搜索框、分组标题、折叠能力、拖拽分区、空态与液态玻璃交互样式。
- `SidebarStatus.module.css` — 静音会话的小铃铛关闭标记：只表达通知状态，不抢主标签。
- `settings-catalog.ts` — 定义设置中心左二栏的分组目录与中英文标题，保持未接入项状态透明。

### packages/ui/layout/client/shell

- `ResizeHandle.module.css` — 浏览器工作台的左右栏分隔手柄、高亮反馈及拖拽裁剪。
- `ShellLeftColumn.tsx` — 组合四栏 Shell 左栏：一级图标栏、窄屏抽屉遮罩、左二导航侧栏与宽度拖拽手柄。
- `ShellRightColumn.tsx` — 组合四栏 Shell 右栏：拖拽宽度手柄与插件上下文面板。
- `ShellWorkspace.tsx` — 渲染四栏 Shell 中央工作区：顶部栏、插件视图、项目视图、欢迎页与功能占位页。
- `SidebarResizeHandle.tsx` — 渲染桌面端左二栏或右侧栏边缘的垂直拖拽调宽手柄。
- `WorkbenchShell.module.css` — 四栏可折叠工作区主结构，消费 @lfaa/ui-theme 提供的明暗与玻璃配色变量。
- `WorkbenchShell.tsx` — 装配主题、四栏可折叠骨架，并通过 Cordis workbench 服务响应业务插件贡献。
- `WorkspaceBar.tsx` — 渲染工作区顶部栏：左侧栏展开/收起按钮、当前标题、本地模式状态、插件工作区快捷入口与右侧栏展开/收起按钮。
- `sidebar-resize.ts` — 计算左二栏与右侧栏拖拽调宽、弹性阻尼压缩、中心区保护与 50% 阈值磁吸折叠纯函数。
- `ui-preferences.ts` — 统一管理浏览器端 Shell 交互记忆（路由、左右栏折叠、分组展开、自定义分区折叠、排序与模式），刷新后完整保留用户操作。
- `useSidebarResize.ts` — 管理浏览器工作台的左右栏调宽、弹性吸附和本地宽度偏好。
- `useViewportMode.ts` — 监听桌面、平板与手机断点，供四栏 Shell 切换侧栏抽屉与移动底栏模式。

### packages/ui/layout/contract

- `index.js` — 声明四栏 Shell 的无 DOM 公共区域标识与跨包插件贡献契约，供 Host 与 Client 共同使用。
- `index.js.map`
- `index.ts` — 声明四栏 Shell 的无 DOM 公共区域标识与跨包插件贡献契约，供 Host 与 Client 共同使用。

### packages/ui/layout/src

- `index.ts` — @lfaa/ui-layout Host 入口：共享契约已下沉到 contract/，这里只做重导出以保持公开入口不变。

### packages/ui/layout/tests

- `contribution-detach.test.tsx` — 验证界面贡献「可拆卸」：注册的视图/上下文面板被 dispose 后只移除自己，其余贡献与外壳照常渲染。
- `domain-sidebar.test.tsx` — 验证资料库左二菜单已把「图像」并入分类，旧图像域的 热门/模板/我的图像 占位菜单不再出现。
- `navigation-groups.test.ts` — 验证左二导航的项目分组语义：置顶只在顶部增加快捷入口，项目本身仍留在「项目」或所属自定义分区里。
- `persistence-lifecycle.test.ts` — 验证四栏 Shell 与界面交互偏好的浏览器持久化记忆（导航路由、左右栏折叠、分组收起、分区折叠、排序与模式）。
- `session-list-paging.test.ts` — 验证会话列表分页：每批 6 条、逐批展开、全部展开后收起，以及项目行与「最近」分组的控件接线。
- `session-running-indicator.test.tsx` — 验证左二会话行的任务状态联动：进行中显示转圈，完成且未读显示小圆点，两者互斥；正在查看的会话不显示完成点。
- `settings-dialog.test.tsx` — 验证设置中心改为弹窗呈现：目录/关闭入口可访问，未接入设置项退化为占位说明，
- `workspace-scroll-viewport.test.tsx` — 验证 ShellWorkspace 把顶栏与内容滚动区拆开：设置中心等长页面出现滚动条时不再挤压标题栏与正文宽度。

### packages/ui/primitives

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/ui-primitives 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/ui/primitives/client

- `ConfirmDialog.module.css` — 共享二次确认弹窗样式：居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本。
- `ConfirmDialog.tsx` — 共享二次确认弹窗组件：采用居中液态玻璃卡片、柔和暗红警示按钮与高对比度文本，供删除/移除等高风险操作复用。
- `HoverTip.module.css` — 共享悬停提示胶囊样式：正上方居中对齐、暗色半透明磨砂胶囊与快捷键徽章。
- `HoverTip.tsx` — 共享悬停提示胶囊组件：统一在触发按钮正上方居中展示暗色圆角提示与快捷键徽章。
- `ModalDialog.module.css` — @lfaa/ui-primitives 居中弹窗通用样式：遮罩、弹窗尺寸与统一进场动效预设（scale / fade / slide-up）。
- `ModalDialog.tsx` — 提供全局统一的居中弹窗组件：支持 Escape 与遮罩关闭、自定义尺寸、图标头与集中可调进场动画预设。
- `PopoverCard.module.css` — @lfaa/ui-primitives 锚点浮层弹窗样式：支持上下左右锚点与平滑缩放弹出动效。
- `PopoverCard.tsx` — 提供可复用的锚点浮层卡片容器：自动处理外部点击关闭与 Escape 退出，供模型选择器和工具浮窗复用。
- `StatusBanner.module.css` — @lfaa/ui-primitives 语义化提示通知横幅样式：支持 success / error / warning / info / loading 统一对比度与动效。
- `StatusBanner.tsx` — 提供全站复用的语义化状态通知横幅（success / error / warning / info / loading），统一通知视觉对比度与关闭交互。
- `StepSliderPopover.module.css` — @lfaa/ui-primitives 步进滑块弹窗样式：带圆点刻度轨道、主题色进度条、大圆手柄及重设按钮。
- `StepSliderPopover.tsx` — 提供可复用的离散档位滑块弹窗内容组件（如推理强度调节）：支持平滑拖拽与磁吸阈值、圆点点击、键盘调节、无规则流星粒子流及闪电极强开关。
- `css-modules.d.ts` — 浏览器组件使用的 CSS Modules 声明，将导入的局部类名暴露为字符串映射。
- `index.tsx` — 统一导出 @lfaa/ui-primitives 共享交互组件（居中弹窗、浮层卡片、步进滑块）与设置中心通用控件。

### packages/ui/primitives/client/settings

- `SettingsControls.tsx` — 提供设置中心「常规」页复用的分组卡片、条目行、开关与圆角弹出式下拉选择菜单（支持图标、副标题与搜索过滤）。
- `SettingsSurface.module.css` — 设置中心「常规」视图样式：高密度原生桌面分组卡片、分隔线、开关滑块与分段选择器；许可证弹窗与庆祝叠层见 GeneralSettingsView.overlays.module.css。

### packages/ui/primitives/contract

- `index.ts` — 定义 @lfaa/ui-primitives 无 DOM 公共契约类型与纯计算工具函数，供 Host 与各业务 UI 包统一复用弹窗尺寸、动效预设及步进计算。

### packages/ui/primitives/src

- `index.ts` — @lfaa/ui-primitives Host 入口：共享契约已下沉到 contract/，这里只做重导出以保持公开入口不变。

### packages/ui/primitives/tests

- `primitives-contract.test.ts` — 验证 @lfaa/ui-primitives 共享交互原语包导出、步进比值计算及包边界契约。

### packages/ui/theme

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`
- `tsdown.config.ts` — @lfaa/ui-theme 构建入口：主入口在 lib/types/src 下（契约与源码同工程）。

### packages/ui/theme/client

- `appearance-store.ts` — 在浏览器端管理 LFAA 主题与液态玻璃配置，启动即同步至根元素 CSS 变量并监听系统明暗切换。
- `css-modules.d.ts` — 为主题包 Client 侧 CSS Modules 提供类型声明。
- `index.tsx` — 导出主题包的 Client Cordis 插件入口：启动即同步主题 CSS 变量，并向工作台注册“外观”设置视图。
- `locales.ts` — 集中维护主题与外观设置页面在中英文环境下的展示文案。
- `tokens.css`

### packages/ui/theme/client/components

- `AccentSelect.module.css` — 强调色下拉菜单与苹果液态玻璃浮层样式。
- `AccentSelect.tsx` — 提供带色点预览与自定义取色器的强调色下拉菜单，使用 Portal 挂载到 body 避免被毛玻璃卡片裁切或偏移。
- `AppearanceAdvanced.module.css` — 外观页高级设置区的数值输入、分段器、开关与对比度滑块样式。
- `AppearanceAdvanced.tsx` — 呈现外观设置页的可折叠“高级”分组：字号、动态效果、独立明暗、侧边栏半透明与对比度等实时调节。
- `AppearanceSettings.module.css` — 外观设置页苹果液态玻璃卡片、模式预览胶囊、色值输入、分段器与滑块样式。
- `AppearanceSettings.tsx` — 呈现设置中心“外观”页面：模式预览、液态玻璃主题预设、强调色、背景/前景、字体与高级选项。
- `ThemeModeQuickSwitch.module.css` — 用户菜单头部右侧的外观模式快捷切换胶囊与三选一液态玻璃浮层样式。
- `ThemeModeQuickSwitch.tsx` — 用户账户菜单头部右侧的外观模式快捷切换胶囊与“跟随系统 / 浅色模式 / 深色模式”三选一浮层菜单。
- `ThemeSelect.tsx` — 通用外观设置页液态玻璃下拉选择器：复用强调色菜单视觉规范，替代原生浏览器 <select> 弹窗。

### packages/ui/theme/contract

- `index.ts` — 定义外观与液态玻璃主题系统的数据模型、预设配置及安全序列化工具。

### packages/ui/theme/src

- `index.ts` — @lfaa/ui-theme Host 入口：共享契约已下沉到 contract/，这里只做重导出以保持公开入口不变。

### packages/ui/theme/tests

- `theme-lifecycle.test.ts` — 验证主题包 Host/契约预设导出及 Client 插件在工作台注册与卸载清理。

### packages/web/web

- `README.i18n.yaml` — 双语配对记录：按英文标题分段记录英文 / 中文段落哈希。
- `README.md`
- `README.zh.md`
- `package.json`
- `tsconfig.json`

### packages/web/web/src

- `index.ts` — @lfaa/web 浏览器/网页能力包入口：导出能力 seam、HTTP 抓取实现与 fetch_url 工具，并组合成默认插件。
- `seam.ts` — @lfaa/web：网页能力 seam。多个抓取实现按优先级注册，工具与 Agent 只依赖本服务，便于替换实现。

### packages/web/web/src/fetch

- `http-fetch.ts` — @lfaa/web-fetch-http：用本机 HTTP 客户端实现网页抓取 seam，限制超时与单页体积。

### packages/web/web/src/tool

- `fetch-url-tool.ts` — @lfaa/tool-web 插件入口：提供 fetch_url 工具，抓取公开网页并转成可读正文。

### packages/web/web/tests

- `fetch-url-tool.test.ts` — 验证网页工具的安全校验与正文抽取：协议限制、内网拦截、HTML 转文本。
- `http-fetch.test.ts` — 验证 HTTP 抓取实现的协议校验、体积截断与真实请求路径。
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

### packages/workspace/workspace/src

- `http-handler.ts` — 为仅监听本机 127.0.0.1 的 Web 开发服务提供 /api/workspace/* HTTP 中间件桥接。
- `index.ts` — 声明工作区包的 Host 侧 Cordis 服务与无 DOM 领域契约，严禁导入 React、DOM 或 CSS。
- `project-brief.ts` — 依据项目目录生成项目简介初稿：只读 README/清单与顶层条目，结果确定、可离线测试，不写文件也不调用模型。
- `project-records.ts` — 项目记录归一化与路径边界：解析存储记录、去重根目录、校验目标是否落在项目授权目录内。
- `system-paths.ts` — 负责动态解析本机文档目录（含 Windows 重定向路径）、安全目录名及原生文件夹选择器；严禁导入 React 或 DOM。
- `types.ts` — @lfaa/workspace 类型入口：契约已下沉到 contract/，这里保留原路径重导出以免改动全部内部引用。

### packages/workspace/workspace/tests

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
- `check-allowlist.json`
- `check-architecture.mjs` — 依赖方向护栏：扫全仓 packages/ 的跨包导入，按 docs/architecture/dependency-rules.json 判定是否越界。
- `check-architecture.test.mjs` — 验证依赖护栏规则本身：跨功能 UI 复用、客户端越界、.tsx 落位、内核反向依赖、装配边、BOM 与未声明依赖。
- `check-client-layout.mjs`
- `check-doc-links.mjs`
- `check-logs.mjs` — 日志编号体检：dev-log 卷内标题编号与 updata-log 文件名编号必须各自唯一；同一轮两类日志共用编号是允许的。
- `check-logs.test.mjs` — 验证日志编号体检：同类日志重号判错、基线可登记历史重号、基线外的重号仍然判错、基线条目过期提示。
- `check-workspace.mjs` — 仓库边界检查：校验包命名、跨包子路径、Host/Client 隔离、依赖一致性、循环依赖、中文文件头与文件规模。
- `check-workspace.test.mjs` — 验证 check-workspace 的新增规则本身：文件规模、client 越界相对导入、写死颜色与豁免清单棘轮。
- `ensure-dependencies.mjs` — 仓库依赖状态预检与安全增量安装脚本：在 Node 环境中核对 workspace/lockfile，避免破坏性重建。
- `ensure-dependencies.test.mjs` — 依赖预检脚本的回归测试：覆盖 Windows 换行与 pnpm 规范化副本的兼容性。
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
- `test.mjs` — 统一测试入口：枚举 packages 与 scripts 下的 node:test 用例文件，交给 Node 测试运行器执行。
- `ui-shot-tasks.ts` — 截图任务清单：每条任务 = 名称 + 分组 + 说明 + 视口/主题 + 交互步骤。
- `ui-shot.mts` — UI 截图工具：起生产宿主 → 无头 Edge/Chrome 按任务表逐项操作 → 出图到 shots/ 并写 manifest.json。
- `verify-coordination.mts` — 交接条与目标条真实浏览器验收：在隔离 HOME 中启动 Host，创建两个会话并 seed 一条交接，
- `verify-translation-pairing.mjs` — 包 README 双语配对校验：按英文标题分段哈希，记录到 README.i18n.yaml，并在校验模式下报告漂移。
- `verify-translation-pairing.test.mjs` — 回归测试：README 双语配对脚本必须在 Windows CRLF 检出下判定一致，避免 CI 因换行差异误报过期。
- `verify-web.mts` — 生产构建产物浏览器验收：用本机 Edge/Chrome 无头打开工作台，依次检查壳层、资料库、代码审查、

## 4. 只做统计的目录

| 目录 | 文件数 | 子目录数 | 说明 |
| --- | --- | --- | --- |
| `docs/dev-log` | 4 | 1 | 按每 200 条任务编号汇总的开发日志卷 |
| `docs/updata-log` | 317 | 1 | 面向用户的单条更新说明 |
| `vendor` | 14 | 4 | 内嵌的上游运行时源码 |
