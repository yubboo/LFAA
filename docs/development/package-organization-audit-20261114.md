# packages 全仓职责盘点与整理批次

审查基线：2026-11-14，仓库 `E:\lfaa1\lfaa`，分支 `main`。

## 盘点范围与当前证据

实际目录、包名、源码入口、静态消费者、清单/Bundle/Profile 声明以生成的 [全包清单](../harness-packages.json) 为准。本页只登记逐目录审查状态和问题，不另立包目录或装配清单。

- packages/ 初始盘点有 388 个两级目录、233 个 workspace 包和 155 个不可执行占位。Agent Loop 设置 UI、输入触发菜单和附件界面归位并同步后，当前生成清单记录 236 个实现包、152 个占位；占位不代表已有或应机械实现的功能。
- 初始源码快照有 826 个 TypeScript/JavaScript 源文件，56 个超过 500 行、21 个超过 1,000 行；这些数字是盘点基线，行数只用于定位候选，不单独构成拆分理由。`ApplicationWorkspace` 已从 2,854 行拆至 534 行；`AiWorkChat.tsx` 从初始 3,171 行降至当前 2,467 行，消息行、锚点轨道、模型选择、审批/澄清问题、计划/反馈、语音视图、写作提案审阅、输入触发菜单和附件视图/上传状态已分批归位。下表的大文件行数仍是初始盘点快照。
- 53 个实现包目前没有包级 README；先在触及该 Owner 的批次补齐职责/入口/依赖/状态，不进行机械批量造文档。
- `ApplicationWorkspace` 首批拆分已完成并通过 Client 类型检查、工作区包构建、226 包 Gate、差异检查及当前源码 `/work` 桌面实页观察；窄短视口边界见[拆分合同](repository-skeleton-modularization-20261114.md#lfaa-repository-skeleton-modularization-20261114)。后续包级审计与迁移按下方问题顺序继续，保留共享工作树里的其它改动。

## 模型上下文的实际位置

| 职责 | 当前源码位置 | Owner 边界 |
|---|---|---|
| 稳定系统指引、权限表达和提示词顺序组合 | `packages/core/system-prompt/src/index.ts` | 组合核心指引；领域提示词正文归 `packages/prompt/*`，人格正文归 `packages/preset/persona`。 |
| 本轮 Git、工作区、写作、记忆及模型路由背景的采集/格式化和组装 | `packages/core/agent-loop/src/execute-turn.ts` 采集；`packages/core/agent-loop/src/request-context.ts` 格式化与组合；辅以 `workbench-context.ts`、`workspace-context.ts`、`runtime-context.ts` | Agent Loop 编排请求；Session、Memory、Workspace、Git 等实际数据仍归各 Owner。 |
| 将动态背景放入 Provider 请求、并在同步规范历史前剥离临时内容 | `packages/llm/llm/src/completion.ts` | LLM Owner 负责请求协议和消息转换，不持有领域背景数据。 |
| 领域 Prompt 内容和按需加载 | `packages/prompt/writing/src/*`、`packages/prompt/minecraft/src/*`、`packages/prompt/prompt/src/*` | 提示词内容、摘要与加载由对应 Prompt Owner 管理，不在系统组合器或 UI 中复制。 |
| 记忆、会话与工作区事实来源 | `packages/core/conversation-memory`、`packages/core/session`、`packages/workspace/workspace`、`packages/workspace/agent-git` | 各领域 Owner 提供真实数据；模型上下文只是本轮请求投影。 |

`packages/context/*` 的六个子目录当前没有可执行代码或装配。只有在逐项确认某个来源适合独立 Owner 后，才把对应适配归入该组；不把系统提示词、Agent Loop、LLM 请求或领域数据整体搬进一个通用上下文包。

## 全目录审查表

`清单状态`来自生成清单。尚未沿源码、调用方和装配核对完成的产品实现包先标记“证据不足待核验”；工程/测试包按其非产品运行职责单独标记；占位目录标记“占位不可用”，对应功能是否已经归入其它 Owner 仍需按职责审查。

| 目录 | 清单状态 | 本轮审查结论 | 跟进项 |
|---|---|---|---|
| `packages/acp/acp` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/api/account-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/agent-git-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/ai-video-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/attachment-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/browser-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/canvas-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/connectivity-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/gateway` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/github-connection-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/job-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/knowledge-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/local-model-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/minecraft-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/plugin-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/remotes` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/session-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/settings-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/steamcmd-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/terminal-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/workflow-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/workspace-controller` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/workspace-files` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/api/writing-controller` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/attachment/attachment` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/attachment/attachment-local` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/boot/app-boot` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/boot/capability-installs` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/boot/capability-mcp` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/boot/capability-prompt` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/boot/capability-skill` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/boot/cmdline` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/boot/config-editor` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/boot/hmr` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/boot/knowledge-library` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/boot/plugin-manager` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/browser-use/browser-use` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/bundle/acp-app` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/bundle/base` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/bundle/daemon-app` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/bundle/desktop-computer-use` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/bundle/headless` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/bundle/sdk-app` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/bundle/sdk-minimal` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/bundle/web-app` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/canvas/canvas` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/canvas/canvas-generation` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/canvas/tool-canvas` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/connection` | implemented | 批次拆分进行中 | AUDIT-CONNECTION |
| `packages/client/file-upload` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/hmr` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/locale` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/modules` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/product-analytics` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/resources` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/shortcuts` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/store` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-agent-preset` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-approval` | implemented | 有证据保留 | AUDIT-UI-APPROVAL |
| `packages/client/ui-attachment` | implemented | 已归入职责 | AUDIT-UI-ATTACHMENT |
| `packages/client/ui-brand-official` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-chat` | implemented | 确认错位待修复 | AUDIT-AI-WORK-CHAT |
| `packages/client/ui-commands` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/client/ui-connectivity` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-conversation` | implemented | 有证据保留 | AUDIT-UI-CONVERSATION |
| `packages/client/ui-deliverables` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-directory-picker-browse` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-directory-picker-native` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-dockkit` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-goal` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-input-trigger` | implemented | 有证据保留 | AUDIT-UI-INPUT-TRIGGER |
| `packages/client/ui-jobs` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-layout` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-message-feedback` | implemented | 有证据保留 | AUDIT-UI-MESSAGE-FEEDBACK |
| `packages/client/ui-minecraft` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-model-selection` | implemented | 有证据保留 | AUDIT-UI-MODEL-SELECTION |
| `packages/client/ui-open-in-app` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-permission-presets` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-plan` | implemented | 有证据保留 | AUDIT-UI-PLAN |
| `packages/client/ui-plugin-manager` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-primitives` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-reference` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-renderer` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-schedule` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-session` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-settings` | implemented | 确认错位待修复 | AUDIT-SETTINGS-PAGE |
| `packages/client/ui-settings-account` | implemented | 有证据保留 | AUDIT-SETTINGS-PAGE |
| `packages/client/ui-settings-agent-loop` | implemented | 有证据保留 | AUDIT-SETTINGS-AGENT-LOOP |
| `packages/client/ui-settings-general` | implemented | 有证据保留 | AUDIT-SETTINGS-PAGE |
| `packages/client/ui-settings-models` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-settings-plugin-inventory` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-settings-plugins` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-settings-session-log` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-settings-shell` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-settings-subagent` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-settings-web-search` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-shortcuts` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/client/ui-sidebar` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-sidebar-browser` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-sidebar-documentpreview` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-sidebar-files` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-sidebar-right` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-sidebar-terminal` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-skill` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-slots` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-subagent` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-theme` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-tool` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-trajectory` | implemented | 有证据保留 | AUDIT-UI-TRAJECTORY |
| `packages/client/ui-user-questions` | implemented | 有证据保留 | AUDIT-UI-USER-QUESTIONS |
| `packages/client/ui-workflow` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/client/ui-workflow-run` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/client/ui-workspace` | implemented | 确认错位待修复 | AUDIT-UI-A / AUDIT-CANVAS-WORKSPACE / AUDIT-PENDING |
| `packages/client/ui-writing` | implemented | 有证据保留 | AUDIT-UI-WRITING |
| `packages/client/web` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/compaction/command-compact` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/compaction/compaction` | implemented | 有证据保留 | AUDIT-COMPACTION-DEPENDENCY |
| `packages/compaction/compaction-basic` | implemented | 有证据保留 | AUDIT-COMPACTION-DEPENDENCY |
| `packages/compaction/compaction-image-offload` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/compaction/compaction-tool-result-pruner` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/computer-use/computer-use` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/context/agent-instructions` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/context/file-reference` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/context/file-reference-local` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/context/session-reference` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/context/time-context` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/context/tmux-context` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/core/agent` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/core/agent-default-model` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/core/agent-loop` | implemented | 确认错位待修复 | AUDIT-CORE-A |
| `packages/core/agent-tool-presentation` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/core/conversation-memory` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/core/scope` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/core/session` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/core/system-prompt` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/core/tools` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/credentials/authorization` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/credentials/credential-flows` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/credentials/credentials` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/credentials/credentials-local` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/credentials/deepseek-account` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/credentials/deepseek-account-platform` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/deliverables/tool-present` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/deliverables/workspace-changes` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/document/office-to-pdf` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/document/tool-writing` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/document/writing` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/experimental/agent-team` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/agent-team-profile` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/api-speech-to-text` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/auto-review` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/browser-use-chrome-devtools-mcp` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/browser-use-playwright-mcp` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/browser-use-runtime` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/browser-use-stagehand-native` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/client-ui-agent-team` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/client-ui-voice-input` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/computer-use-cua-driver-mcp` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/computer-use-cua-driver-native` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/inspector` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/ptc-runtime-python` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/schedule-bundle` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/speech-to-text` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/speech-to-text-sensevoice` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/tool-agent-team` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/voice-input-bundle` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/webworker-packer` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/experimental/webworker-runtime` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/extensions/cordis-client-runner` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/extensions/cordis-host-runner` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/extensions/tool-cordis` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/extensions/ui-cordis` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/feedback/command-feedback` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/feedback/message-feedback` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/fs/fs` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/fs/fs-local` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/fs/fs-observation-policy` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/fs/fs-sandbox` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/fs/tool-fs` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/fs/tool-fs-search` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/fs/tool-str-replace-editor` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/games/minecraft` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/games/runtime-manager` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/games/steamcmd` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/games/tool-minecraft` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/games/tool-runtime` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/games/tool-steamcmd` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/goal/command-goal` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/goal/goal` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/goal/goal-round-driver` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/goal/tool-goal` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/guard/repeat-tool-reminder` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/guard/timeout-policy` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/hooks/hook-protocol` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/hooks/hooks-claude-code` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/hooks/hooks-codex` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/daemon` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/host/directory-picker` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/directory-picker-auto` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/directory-picker-browse` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/directory-picker-native` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/frontend-static` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/git` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/host/open-in-app` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/plugin-inventory` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/product-telemetry-otel` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/host/project-files` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/host/runtime-environment` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/host/tool-daemon` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/host/webserver` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/identity/anonymous-user-id` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/identity/auth` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/integrations/github` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/interaction/commands` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/interaction/permission-presets` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/interaction/tool-ask-user` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/interaction/user-approval` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/interaction/user-questions` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/jobs/jobs` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/jobs/jobs-local` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/jobs/tool-jobs` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/knowledge/knowledge-library` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/llm/deepseek-llm-api-extensions` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/llm/llm` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/llm/llm-deepseek` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/llm/llm-deepseek-account` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/llm/llm-deepseek-api-key` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/llm/llm-local-runtime` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/llm/llm-minimax-h3` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/llm/llm-moss-image` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/llm/llm-pi-ai` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/llm/llm-retry` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/llm/plugin-package-inventory-deepseek` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/llm/token-meter` | implemented | 有证据保留 | AUDIT-COMPACTION-DEPENDENCY |
| `packages/lsp/lsp` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/lsp/lsp-stdio` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/lsp/tool-lsp` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/mcp/mcp-client` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/mcp/mcp-resources` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/network/game-connectivity` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/plan/plan-mode` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/preset/agent-preset` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/preset/agent-preset-registry` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/preset/domain-experts` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/preset/persona` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/prompt/minecraft` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/prompt/prompt` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/prompt/writing` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/ptc-runtime/ptc-runtime` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/ptc-runtime/ptc-runtime-node` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/runtime-diagnostics/invariants` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/sandbox/sandbox` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/sandbox/sandbox-local` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/sandbox/sandbox-policy` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/sandbox/sandbox-windows-acl` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/schedule/schedule` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/sdk/client` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/sdk/protocol` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/sdk/sdk-client` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/sdk/sdk-protocol` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/sdk/server` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/session-query/session-log-export` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session-query/session-query` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session-query/session-query-sqlite` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session-query/tool-session-query` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/session/session-checkpoint-policy` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-format` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-format-catalog` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-format-v0-to-v1` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-format-v1-to-v2` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-format-v2-to-v3` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-format-v3-to-v4` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-log-deepseek` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/session/session-persistence` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-persistence-jsonl` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/session/session-projection` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-projection-cache` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-stats` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-telemetry` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-telemetry-otel` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-title` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/session/session-title-all-prompts-llm` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/session/session-title-first-prompt-llm` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/session/session-title-llm` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/session/session-turn-outline` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/settings/settings` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/settings/settings-snapshots` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/shell/bash-local` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/shell/bash-sandbox` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/shell/pwsh-local` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/shell/pwsh-sandbox` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/shell/shell` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/shell/shell-env` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/shell/tool-bash` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/shell/tool-bash-persistent` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/shell/tool-pwsh` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/shell/tool-pwsh-persistent` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/shell/tool-shell` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/skill/minecraft` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/skill/rea` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/skill/skill` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/skill/skill-badge` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/skill/skill-filesystem` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/skill/skill-office` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/skill/tool-skill` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/skill/tool-workspace-dependencies` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/skill/writing` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/spill/spill` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/spill/spill-local` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/spill/spill-policy` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/ssh/fs-ssh` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/ssh/sandbox-ssh` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/ssh/ssh` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/ssh/subprocess-ssh` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/storage/storage` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/storage/storage-domain` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/storage/storage-json` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/storage/storage-sqlite` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subagent/subagent` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subagent/subagent-acp` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/subagent/subagent-claude-code` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subagent/subagent-codex` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subagent/subagent-dsh-sdk` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/subagent/subagent-fork-in-process` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/subagent/subagent-in-process-driver` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/subagent/subagent-spawn-in-process` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/subagent/tool-subagent` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subagent/tool-subagent-control` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subprocess/subprocess` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subprocess/subprocess-local` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/subprocess/win32-process` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/telemetry/logger` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/telemetry/otel` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/terminal/terminal` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/terminal/terminal-bash` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/terminal/tool-terminal` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/test-support/agent-loop-testkit` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/test-support/api` | implemented | 工程/测试专用 | AUDIT-README / AUDIT-TEST-SUPPORT |
| `packages/test-support/client-runtime` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/test-support/llm-mock-server` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/test-support/llm-replay` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/test-support/loader-smoke` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/test-support/remote-mock` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/test-support/session-snapshot` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/todo/tool-todo` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/typert/generator` | implemented | 工程/测试专用 | AUDIT-TYPERT-GENERATOR |
| `packages/typert/loader` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/typert/protocol` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/typert/registry` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/util/atomic-write` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/brand` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/chunked-list` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/code-language` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/crypto` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/deque` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/home-paths` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/util/http-proxy` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/launch-environment` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/util/lazy-require` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/native-command` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/output-retention` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/package-manifest` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/time` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/timeout` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/util/values` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/util/workspace-path` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/video/ai-video` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/video/bilibili-video` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/video/tool-ai-video` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/video/tool-bilibili-video` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/web/tool-web` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/web/web` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/web/web-fetch-http` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/web/web-search-deepseek` | implemented | 证据不足待核验 | AUDIT-README |
| `packages/web/web-search-exa` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/web/web-search-perplexity` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/webhook/webhook` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/webhook/webhook-github` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/workflow/app-agent-adapter` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/workflow/dag-engine` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/workflow/minecraft-adapter` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/workflow/tool-ralph` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/workflow/tool-workflow` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/workflow/workflow` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/workflow/workflow-ptc` | placeholder | 占位不可用 | AUDIT-PLACEHOLDER |
| `packages/workspace/agent-git` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/workspace/data-directory` | implemented | 证据不足待核验 | AUDIT-PENDING |
| `packages/workspace/workspace` | implemented | 证据不足待核验 | AUDIT-PENDING |

## 已确认的整理问题

| ID | 证据与范围 | 处理决定 | 状态 |
|---|---|---|---|
| AUDIT-PLACEHOLDER | 当前 152 个目录在生成清单中没有 package manifest、源码入口或装配，标记为 `placeholder`；占位索引由 `scripts/check-workspace.mjs` 同步生成并由 Gate 校验。 | 逐项查相邻 Owner 是否已有对应功能、当前是否存在真实消费者；只有证实错位或用户目标需要时才填充。保留无消费者/平台不适用项。 | 仍待逐项核验；当前清单/索引来自同一目录扫描 |
| AUDIT-README | 实现包中有目录缺少包级 README，具体路径列于清单 JSON 的 `evidence.readme`。 | 在对应包被核验或迁移时补齐其职责合同；不为纯搬文件批量生成空说明。 | 待按批处理 |
| AUDIT-PENDING | 实现状态、静态调用方和装配声明不能单独证明唯一 Owner、数据/权限边界或运行验收。 | 按 `docs/development/package-responsibilities.zh.md` 第 2、7 节沿真实源码逐目录核对。 | 进行中 |
| AUDIT-LARGE-FILES | 初始盘点快照中记录了多份超过 1,000 行和 500 行的源码；后续已完成的 UI-A 拆分让相关行数变化，需判断其余文件是否混合多个职责，不能只凭行数搬迁。 | 下表作为候选定位基线，按职责边界拆分成批合同；先保留已有 API、Owner 与行为。 | 候选待核验 |
| AUDIT-CONTEXT | 模型上下文按职责由 `core/system-prompt` 组合稳定指引、`core/agent-loop` 采集并格式化本轮背景、`llm/llm` 注入临时请求消息并在规范历史同步前剥离；Session/Memory/Workspace/Agent Git/Writing 等继续持有原始事实。逐项读取 `packages/context/*` 六个占位，没有任何源码、package.json 或组合声明；其职责是工程指令、文件引用、本机文件引用、会话引用、时间和 tmux 来源适配，不是整个模型上下文的总 Owner。源码搜索未发现 tmux/这些引用适配器实现。 | 已核实当前模型上下文位置；纯格式化/组合已提取为 `core/agent-loop/src/request-context.ts`。无证据把现有模块搬进 context 组；六个占位继续如实登记不可用。 | 当前路径审查完成 |
| AUDIT-CONNECTION | 初始 `packages/client/connection/src/api.ts` 有 3,795 行、377 个导出函数和 209 个导出类型；跨 UI 包均从该 facade 取不同领域 API。 | 按领域提取 Connection 请求/类型模块，保持现有 `api.js` 导出兼容入口和统一认证、错误、取消合同；逐批核对调用方与包依赖。 | 已将 AI Run/SSE、Minecraft Workflow、Typert、Host Task、AI Office、健康、附件、错误兜底和各领域 DTO 归入模块；兼容 `api.ts` 当前 53 行。Connection 定向构建、Client 类型检查、233 包 Gate 和差异检查通过；整个 packages/ 仍按审计合同继续逐 Owner 核验 |
| AUDIT-COMPACTION-DEPENDENCY | `packages/compaction/compaction-basic/src/index.ts` 导入 Agent Loop 的 Token 估算函数和默认上下文窗口，且其 package.json 反向声明 `lfaa-agent-loop`；Agent Loop 本身执行通用回合，不应成为压缩引擎的底层依赖。真正的共享 Token 估算 Owner 是 `packages/llm/token-meter`，压缩协议/不变量由 `packages/compaction/compaction` 持有。 | 已改为调用 `lfaa-token-meter` 的 `estimatePromptTokens`，对无效上下文窗口安全跳过压缩，移除对 `lfaa-agent-loop` 的包依赖；为协议包、基础压缩包补齐职责 README，并修正过期的“无 Token Meter”注释。 | 已完成包构建、Host 类型检查、226 包 Gate 和差异检查 |
| AUDIT-AI-WORK-CHAT | `AiWorkChat.tsx` 本批降至 2,537 行，仍负责聊天编排与跨领域连接；消息行、锚点视图、计划横幅、反馈、模型选择、审批、澄清、全屏语音、写作提案审阅与会话滚动生命周期已分到明确模块。 | Composer、流订阅和 Run 状态仍是独立候选；API、Session、Run/SSE、发送、权限与附件 Owner 不搬迁。继续按职责拆分，不以单次 Hook 抽取视为完成。 | UI-B-2 已拆滚动 Hook；持续拆分 |
| AUDIT-SETTINGS-PAGE | `SettingsPage.tsx` 从初始盘点快照 4,995 行降至当前 4,559 行；通用偏好表单已归 `ui-settings-general`，账号标签/资料/安全视图分别归入 `ui-settings-account`，Agent Loop 预算组归入 `ui-settings-agent-loop`，设置页仍负责 React/数据装配与多个分类 UI。 | 分类 ID/标签目录、深链和账户级本地视图 key 由 `settings-page-model.ts` 维护；设置页仍持有远端数据读取/缓存、账户草稿、校验、自动保存及领域副作用，Settings Owner 仍持有 schema/持久化。其余分类继续核验和拆分。 | UI-E-1 桌面/窄屏、UI-E-2 常规分类桌面、UI-E-3 账号标签桌面/390×844/390×640、UI-E-4 资料/安全桌面/390×844/390×640 实页通过；UI-E-5 与本批验证结果见 `AUDIT-SETTINGS-AGENT-LOOP`；账号/设置包构建、Client 类型检查、Web 构建、233 包 Gate 和差异检查通过；现有结构断言已随 Owner 路径更新但未运行；其余设置分类继续核验和拆分 |
| AUDIT-SETTINGS-AGENT-LOOP | `scripts/package-responsibilities.mjs` 将 `ui-settings-agent-loop` 定义为 Agent 循环预算设置 UI；原“推理参数”表单此前留在 `SettingsPage.tsx`，目标包只有占位。 | 已将受控运行参数视图归入 `ui-settings-agent-loop/src/AgentLoopSettingsGroup.tsx`；`ui-settings` 继续持有 `UserSettings.aiRuntime`、账户、自动保存和副作用，并向视图传入原值与更新回调。沙箱模式、请求/工具安全上限和默认值均复用 `util-values` 唯一合同；不复制授权/执行逻辑。 | `ui-settings-agent-loop`、`ui-settings` 包构建、Client `tsc --noEmit`、Web 构建（4,061 模块）、234 包 Gate、`git diff --check` 与当前源码 `/settings?section=ai` 桌面/390×844/390×640 实页均通过；只读检查，未更改设置。Web 构建有既有 CSS 注释压缩警告。未新增或运行产品测试 |
| AUDIT-CANVAS-WORKSPACE | `CanvasWorkspace.tsx` 原本同时容纳页面协调、项目与 React Flow 模型互转、摘要更新及素材/节点交叉引用清理。 | 首批将纯项目/节点映射函数与默认 UI 数据整理归入 `src/canvas-workspace/project-model.ts`；页面、API、保存冲突和生成工作流仍留原 Owner。组件主文件仍约 2.2k 行，后续继续逐项拆分视图与状态协调。 | 首批源码归位；相关构建、类型/Gate、Canvas 实页结果记录于主任务合同；问题持续处理中 |
| AUDIT-UI-MESSAGE-FEEDBACK | 职责注解将该包定为消息反馈交互组件；原有聊天已实现原因选择/详情输入/提交弹窗和正负反馈按钮。Connection/Session 分别持有认证 API 与持久化。 | 已将受控反馈视图、理由目录和专属 CSS 移入该包；聊天继续管理状态并调用原 API，Session 继续持久化。经 `ui-chat` 静态依赖消费，不创建独立 Cordis 能力。 | 源码归位、包构建与类型/Gate 检查通过；本次未复验实页 |
| AUDIT-UI-PLAN | 职责注解将该包定为计划模式/结果展示；聊天原先内嵌计划模式状态横幅与退出/批准动作。 | 已将横幅和专属 CSS 移入该包；Session/Agent Loop 状态及聊天动作仍由原 Owner 提供，不创建独立路由或权限。 | 源码归位、包构建与类型/Gate 检查通过；本次未复验实页 |
| AUDIT-UI-MODEL-SELECTION | 职责注解将该包定为模型目录/能力参数展示；聊天原先内嵌模型搜索/分页、账户模型选项、键盘选项导航和推理力度视图。 | 已将 Popover 内视图与专属 CSS 移入该包；目录过滤和状态留在聊天协调层，能力标签复用 `ui-settings-models`，写入仍调用原 Settings/Connection API。新包作为聊天静态依赖消费，不独立注入运行时能力。 | 源码归位、Impeccable detector（源文件）返回空列表、包构建与类型/Gate 检查通过；本次未复验实页 |
| AUDIT-UI-APPROVAL | 职责注解将该包定为审批请求与真实决定界面；聊天原先在 Composer 和回复时间线中直接绘制审批卡/审批记录。 | 已把待审批卡、已决记录与审批专属 CSS 移入该包；审批 API、Authorization 和运行状态仍调用现有 Chat/Permission/Agent Loop Owner。 | 源码归位、Impeccable detector 返回空列表、包构建与类型/Gate 检查通过；本次未复验实页 |
| AUDIT-UI-USER-QUESTIONS | 职责注解将该包定为用户澄清问题与答案交互；聊天原先在 Composer 和回复时间线中直接绘制问题卡、选项、答案和已回答状态。 | 已把待回答卡、历史答案记录与专属 CSS 移入该包；问题状态/回复提交仍由 Chat/Session/Agent Loop Owner 管理。 | 源码归位、Impeccable detector 返回空列表、包构建与类型/Gate 检查通过；本次未复验实页 |
| AUDIT-UI-WRITING | `ui-writing` 是已有写作 UI Owner；AI 写作提案审阅弹窗原先留在 `ui-chat`，其中包含原文/提案对照、真实状态说明及应用/拒绝入口。 | 已将只读审阅视图和专属 CSS 导出到 `ui-writing`；提案加载、应用/拒绝、状态刷新及 Connection 请求仍由 `ui-chat` 调用现有 Writing Owner。 | 源码归位；最终包构建、Client 类型/Gate 与差异检查结果记录于主任务合同；实页未重新验收 |
| AUDIT-UI-CONVERSATION | `package-responsibilities.mjs` 将 `ui-conversation` 定为对话容器/消息交互 UI，但它原来是空占位；会话问题锚点轨道、消息到锚点投影、滚动跟随/布局算法和观察器清理都实现于 `ui-chat`。 | 已将 `ConversationAnchorRail`、锚点投影、滚动测量/跟随和锚点专属 CSS 归入 `ui-conversation`；`ui-chat` 仍持有 Session/消息流和持久化偏好，旧源码路径由转发模块保持兼容。 | 源码归位、UI Conversation/Chat 构建、Client 类型/Gate、差异检查及 `/work` 桌面锚点渲染/跳转记录于主合同；窄/短视口未验 |
| AUDIT-UI-INPUT-TRIGGER | `package-responsibilities.mjs` 将 `ui-input-trigger` 定为输入触发与快捷交互 UI；`ui-chat` 原先内嵌 slash 命令/mention 关联菜单 DOM、候选呈现及专属 CSS。 | 已将受控 `ComposerTriggerMenu`、菜单类型和 CSS 归入该包；触发解析、候选/禁用投影、快捷键导航、草稿插入、Session 关联写入及菜单高度观察仍由 `ui-chat` 持有。显示继续消费 Connection/Session/能力 Owner 提供的既有值，未新增权限或服务。 | 本批 package/build/type/Gate/Impeccable/实页证据见主任务合同 UI-B-3；无新设置或用户数据写入 |
| AUDIT-UI-ATTACHMENT | `package-responsibilities.mjs` 将 `ui-attachment` 定为附件选择、预览与状态界面；聊天原先内嵌选择按钮、文件输入、待发送附件 DOM 和专属预览 CSS。 | 已把受控附件选择控件、待发送预览/移除视图和 CSS 移入 `ui-attachment`；文件验证/编码/上传、Connection API、错误/忙碌状态、附件消费及消息/Run 限制由 `ui-chat` Owner 负责，其中上传状态与字节处理现由 `hooks/useComposerAttachments.ts` 持有。 | 包构建、Client 类型、Web 构建和 236 包 Gate 通过；Impeccable 有三条既有边框告警；Host Browser Dock 503 导致当前 `/work` 实页仍停在空加载页，附件展示未能实测，详见主合同 UI-B-4/5 |
| AUDIT-UI-TRAJECTORY | `package-responsibilities.mjs` 将 `ui-trajectory` 定为公开执行轨迹展示 Owner，但它原来是空占位；轨迹投影、耗时摘要/共享计时器、轨迹 JSX 和工具组/状态动效样式散落在 `ui-chat`。 | 已将 `response-timeline.ts`、`activity-duration.ts`、`activity-clock.ts`、`AiExecutionTrajectory.tsx` 和对应轨迹 CSS 移入 `ui-trajectory`；`ui-chat` 保留稳定消息回复、AI Markdown、文件变更与交互 Owner，通过兼容转发保留原源码入口。隐藏推理、Session/Run 与权限逻辑不进入该包。 | 源码归位、轨迹包与聊天包构建、Client 类型/Gate、差异检查及当前源码 `/work` 桌面轨迹观察记录于主任务合同；窄/短视口未验 |

## 初始盘点快照中的超大源码候选

| 行数 | 文件 |
|---:|---|
| 4995 | `packages/client/ui-settings/src/SettingsPage.tsx` |
| 3795 | `packages/client/connection/src/api.ts` |
| 3171 | `packages/client/ui-chat/src/AiWorkChat.tsx` |
| 2747 | `packages/storage/storage-sqlite/src/database.ts` |
| 2549 | `packages/host/daemon/src/daemon.mjs` |
| 2477 | `packages/client/ui-workspace/src/CanvasWorkspace.tsx` |
| 2320 | `packages/core/agent-loop/src/execute-turn.ts` |
| 2135 | `packages/settings/settings/src/service.ts` |
| 2087 | `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` |
| 1841 | `packages/video/ai-video/src/index.ts` |
| 1802 | `packages/core/session/src/sessions.ts` |
| 1344 | `packages/browser-use/browser-use/src/session-manager.ts` |
| 1300 | `packages/client/ui-layout/src/Workbench.tsx` |
| 1238 | `packages/client/ui-sidebar-files/src/FileManagerPage.tsx` |
| 1201 | `packages/document/writing/src/service.ts` |
| 1113 | `packages/games/minecraft/src/service.ts` |
| 1055 | `packages/client/ui-dockkit/src/ResizableWorkbench.tsx` |
| 1035 | `packages/knowledge/knowledge-library/src/index.ts` |
| 1027 | `packages/client/ui-plugin-manager/src/PluginManagerPage.tsx` |
| 1020 | `packages/canvas/tool-canvas/src/index.ts` |
| 1010 | `packages/canvas/canvas/src/index.ts` |

## 分批顺序

1. **已完成** `ApplicationWorkspace` 子模块拆分与直接验证，记录共享工作树状态；不覆盖其它任务的并行改动。
2. 完成 388 个目录的 Owner/入口/消费者/依赖/装配证据核验，更新本表的结论和问题 ID；先从现有 157 个占位与超大多职责文件开始，并检查其真实相邻 Owner。
3. 按问题风险拆迁移批次：完成 Client/UI 与 Agent/Context 后，处理 API/Connection，再处理 Storage/Session、Host/Daemon、Settings/Domain；每批分别登记稳定入口、设置/数据/权限边界、直接验证和未测范围。
4. 每批迁移后清除已无消费者的旧实现副本，更新对应包 README、依赖、清单/装配与生成清单；只有所有目录有证据结论、确认错位问题关闭或记录阻塞后，整个目标才完成。

## 归属映射原则

- UI 组件、布局和样式放在相应 `packages/client/ui-*` Owner；纯展示和输入事件留在视图，数据读取、请求、状态、副作用和导航流程按职责归入具名 Hook/控制器/模块。根组件负责组合。
- 领域数据/规则归原领域服务；API Controller 只做认证传输和参数/响应适配；Tool、Prompt、Skill、Persona、Bundle、Boot 不能复制业务规则或正文。
- `packages/context`、`packages/skill`、`packages/util` 等目录名不自动成为任何相似功能的 Owner；沿公开接口和实际消费者确认后再决定是否实现对应占位。
- 单文件出现多个稳定职责才拆分；拆后每个模块要有唯一职责、清晰属性/服务合同与消费者，不为减少行数建立万能 Hook、万能上下文包或无消费者薄封装。

