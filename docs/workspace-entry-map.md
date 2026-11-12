# LFAA 运行入口与包装配图

<!-- 由 scripts/check-workspace.mjs --write 生成，不手工维护包名、Profile 或 Bundle 列表。 -->

本图从 App 的 `package.json`、CLI Profile 的 `package.json`、Bundle package metadata 与 `cordis.patch.yml` 生成。它显示源码中的依赖/装配声明；不证明插件已运行、能力可用或通过真实宿主验收。

## 应用入口直接依赖

| 入口 | package | 生产 workspace 依赖 | 工程/测试 workspace 依赖 |
|---|---|---:|---:|
| [apps/cli](../apps/cli) | `@yubboo/lfaa` | 47 | 1 |
| [apps/daemon](../apps/daemon) | `lfaa-daemon` | 2 | 0 |
| [apps/desktop-electron](../apps/desktop-electron) | `lfaa-desktop-electron` | 0 | 0 |
| [apps/desktop-tauri](../apps/desktop-tauri) | `lfaa-desktop-tauri` | 0 | 0 |
| [apps/web](../apps/web) | `lfaa-web` | 23 | 0 |

<details><summary>apps/cli 生产 workspace 依赖（47）</summary>

- [`lfaa-agent`](../packages/core/agent)
- [`lfaa-agent-loop`](../packages/core/agent-loop)
- [`lfaa-agent-preset`](../packages/preset/agent-preset)
- [`lfaa-api-account-controller`](../packages/api/account-controller)
- [`lfaa-api-gateway`](../packages/api/gateway)
- [`lfaa-api-github-connection-controller`](../packages/api/github-connection-controller)
- [`lfaa-api-job-controller`](../packages/api/job-controller)
- [`lfaa-api-minecraft-controller`](../packages/api/minecraft-controller)
- [`lfaa-api-remotes`](../packages/api/remotes)
- [`lfaa-api-session-controller`](../packages/api/session-controller)
- [`lfaa-api-settings-controller`](../packages/api/settings-controller)
- [`lfaa-api-steamcmd-controller`](../packages/api/steamcmd-controller)
- [`lfaa-api-workspace-files`](../packages/api/workspace-files)
- [`lfaa-api-writing-controller`](../packages/api/writing-controller)
- [`lfaa-app-boot`](../packages/boot/app-boot)
- [`lfaa-authorization`](../packages/credentials/authorization)
- [`lfaa-base`](../packages/bundle/base)
- [`lfaa-computer-use`](../packages/computer-use/computer-use)
- [`lfaa-daemon-app`](../packages/bundle/daemon-app)
- [`lfaa-desktop-computer-use`](../packages/bundle/desktop-computer-use)
- [`lfaa-document-writing`](../packages/document/writing)
- [`lfaa-fs`](../packages/fs/fs)
- [`lfaa-games-minecraft`](../packages/games/minecraft)
- [`lfaa-games-steamcmd`](../packages/games/steamcmd)
- [`lfaa-hmr`](../packages/boot/hmr)
- [`lfaa-home-paths`](../packages/util/home-paths)
- [`lfaa-hook-protocol`](../packages/hooks/hook-protocol)
- [`lfaa-host-daemon`](../packages/host/daemon)
- [`lfaa-host-webserver`](../packages/host/webserver)
- [`lfaa-identity-auth`](../packages/identity/auth)
- [`lfaa-jobs`](../packages/jobs/jobs)
- [`lfaa-launch-environment`](../packages/util/launch-environment)
- [`lfaa-llm`](../packages/llm/llm)
- [`lfaa-permission-presets`](../packages/interaction/permission-presets)
- [`lfaa-session`](../packages/core/session)
- [`lfaa-session-persistence-jsonl`](../packages/session/session-persistence-jsonl)
- [`lfaa-settings`](../packages/settings/settings)
- [`lfaa-skill-rea`](../packages/skill/rea)
- [`lfaa-skill-writing`](../packages/skill/writing)
- [`lfaa-storage-domain`](../packages/storage/storage-domain)
- [`lfaa-storage-json`](../packages/storage/storage-json)
- [`lfaa-storage-sqlite`](../packages/storage/storage-sqlite)
- [`lfaa-telemetry-logger`](../packages/telemetry/logger)
- [`lfaa-tools`](../packages/core/tools)
- [`lfaa-util-values`](../packages/util/values)
- [`lfaa-web-app`](../packages/bundle/web-app)
- [`lfaa-workspace-data-directory`](../packages/workspace/data-directory)

</details>

<details><summary>apps/cli 工程/测试 workspace 依赖（1）</summary>

- [`lfaa-test-support-api`](../packages/test-support/api)

</details>

<details><summary>apps/daemon 生产 workspace 依赖（2）</summary>

- [`lfaa-app-boot`](../packages/boot/app-boot)
- [`lfaa-daemon-app`](../packages/bundle/daemon-app)

</details>

<details><summary>apps/daemon 工程/测试 workspace 依赖（0）</summary>

无直接 workspace 工程/测试依赖。

</details>

<details><summary>apps/desktop-electron 生产 workspace 依赖（0）</summary>

无直接 workspace 生产依赖。

</details>

<details><summary>apps/desktop-electron 工程/测试 workspace 依赖（0）</summary>

无直接 workspace 工程/测试依赖。

</details>

<details><summary>apps/desktop-tauri 生产 workspace 依赖（0）</summary>

无直接 workspace 生产依赖。

</details>

<details><summary>apps/desktop-tauri 工程/测试 workspace 依赖（0）</summary>

无直接 workspace 工程/测试依赖。

</details>

<details><summary>apps/web 生产 workspace 依赖（23）</summary>

- [`lfaa-client-connection`](../packages/client/connection)
- [`lfaa-client-modules`](../packages/client/modules)
- [`lfaa-client-resources`](../packages/client/resources)
- [`lfaa-client-store`](../packages/client/store)
- [`lfaa-client-ui-chat`](../packages/client/ui-chat)
- [`lfaa-client-ui-commands`](../packages/client/ui-commands)
- [`lfaa-client-ui-dockkit`](../packages/client/ui-dockkit)
- [`lfaa-client-ui-layout`](../packages/client/ui-layout)
- [`lfaa-client-ui-minecraft`](../packages/client/ui-minecraft)
- [`lfaa-client-ui-primitives`](../packages/client/ui-primitives)
- [`lfaa-client-ui-renderer`](../packages/client/ui-renderer)
- [`lfaa-client-ui-settings`](../packages/client/ui-settings)
- [`lfaa-client-ui-settings-account`](../packages/client/ui-settings-account)
- [`lfaa-client-ui-settings-general`](../packages/client/ui-settings-general)
- [`lfaa-client-ui-settings-models`](../packages/client/ui-settings-models)
- [`lfaa-client-ui-shortcuts`](../packages/client/ui-shortcuts)
- [`lfaa-client-ui-sidebar`](../packages/client/ui-sidebar)
- [`lfaa-client-ui-sidebar-browser`](../packages/client/ui-sidebar-browser)
- [`lfaa-client-ui-sidebar-files`](../packages/client/ui-sidebar-files)
- [`lfaa-client-ui-theme`](../packages/client/ui-theme)
- [`lfaa-client-ui-workspace`](../packages/client/ui-workspace)
- [`lfaa-client-ui-writing`](../packages/client/ui-writing)
- [`lfaa-client-web`](../packages/client/web)

</details>

<details><summary>apps/web 工程/测试 workspace 依赖（0）</summary>

无直接 workspace 工程/测试依赖。

</details>

## Control Plane Profile

| Profile | 来源 | Bundle 顺序 | Plugin 声明数 | 工作区包依赖闭包 |
|---|---|---|---:|---:|
| `daemon` | [apps/cli/config/profiles/daemon/package.json](../apps/cli/config/profiles/daemon/package.json) | [`lfaa-daemon-app`](../packages/bundle/daemon-app) | 1 | 28 |
| `desktop` | [apps/cli/config/profiles/desktop/package.json](../apps/cli/config/profiles/desktop/package.json) | [`lfaa-base`](../packages/bundle/base) → [`lfaa-web-app`](../packages/bundle/web-app) → [`lfaa-desktop-computer-use`](../packages/bundle/desktop-computer-use) | 164 | 190 |
| `web` | [apps/cli/config/profiles/web/package.json](../apps/cli/config/profiles/web/package.json) | [`lfaa-base`](../packages/bundle/base) → [`lfaa-web-app`](../packages/bundle/web-app) → [`lfaa-desktop-computer-use`](../packages/bundle/desktop-computer-use) | 164 | 190 |

### Profile `daemon`

Bundle 顺序来自 [apps/cli/config/profiles/daemon/package.json](../apps/cli/config/profiles/daemon/package.json)；插件清单由各 Bundle patch 按顺序合并。工作区依赖闭包只沿包清单中的 `dependencies` 和 `optionalDependencies` 展开。

包依赖闭包：28 个 workspace 包；逐包角色见 [JSON 清单](harness-packages.json)。

### Profile `desktop`

Bundle 顺序来自 [apps/cli/config/profiles/desktop/package.json](../apps/cli/config/profiles/desktop/package.json)；插件清单由各 Bundle patch 按顺序合并。工作区依赖闭包只沿包清单中的 `dependencies` 和 `optionalDependencies` 展开。

包依赖闭包：190 个 workspace 包；逐包角色见 [JSON 清单](harness-packages.json)。

### Profile `web`

Bundle 顺序来自 [apps/cli/config/profiles/web/package.json](../apps/cli/config/profiles/web/package.json)；插件清单由各 Bundle patch 按顺序合并。工作区依赖闭包只沿包清单中的 `dependencies` 和 `optionalDependencies` 展开。

包依赖闭包：190 个 workspace 包；逐包角色见 [JSON 清单](harness-packages.json)。

## Profile 所选 Bundle 的插件声明

`required` 记录来自 patch；未标记为必需的条目显示为可选。外部依赖与 LFAA workspace 包分开列出。

### [`lfaa-base`](../packages/bundle/base)

来源：[packages/bundle/base/cordis.patch.yml](../packages/bundle/base/cordis.patch.yml)

| Plugin ID | Cordis 名称 | 工作区包/来源 | 必需 |
|---|---|---|---|
| `storage-hub` | `lfaa-storage-hub` | [`lfaa-storage-hub`](../packages/storage/storage) | 是 |
| `typert-registry` | `lfaa-typert-registry` | [`lfaa-typert-registry`](../packages/typert/registry) | 是 |
| `typert-loader` | `lfaa-typert-loader` | [`lfaa-typert-loader`](../packages/typert/loader) | 是 |
| `storage` | `lfaa-storage-sqlite` | [`lfaa-storage-sqlite`](../packages/storage/storage-sqlite) | 是 |
| `storage-json` | `lfaa-storage-json` | [`lfaa-storage-json`](../packages/storage/storage-json) | 是 |
| `storage-domain` | `lfaa-storage-domain` | [`lfaa-storage-domain`](../packages/storage/storage-domain) | 是 |
| `session-persistence-jsonl` | `lfaa-session-persistence-jsonl` | [`lfaa-session-persistence-jsonl`](../packages/session/session-persistence-jsonl) | 是 |
| `session-format` | `lfaa-session-format` | [`lfaa-session-format`](../packages/session/session-format) | 是 |
| `session-format-catalog` | `lfaa-session-format-catalog` | [`lfaa-session-format-catalog`](../packages/session/session-format-catalog) | 是 |
| `session-persistence` | `lfaa-session-persistence` | [`lfaa-session-persistence`](../packages/session/session-persistence) | 是 |
| `session-projection` | `lfaa-session-projection` | [`lfaa-session-projection`](../packages/session/session-projection) | 否 |
| `session-projection-cache` | `lfaa-session-projection-cache` | [`lfaa-session-projection-cache`](../packages/session/session-projection-cache) | 否 |
| `session-stats` | `lfaa-session-stats` | [`lfaa-session-stats`](../packages/session/session-stats) | 否 |
| `session-title` | `lfaa-session-title` | [`lfaa-session-title`](../packages/session/session-title) | 否 |
| `session-title-llm` | `lfaa-session-title-llm` | [`lfaa-session-title-llm`](../packages/session/session-title-llm) | 否 |
| `session-title-first-prompt-llm` | `lfaa-session-title-first-prompt-llm` | [`lfaa-session-title-first-prompt-llm`](../packages/session/session-title-first-prompt-llm) | 否 |
| `session-title-all-prompts-llm` | `lfaa-session-title-all-prompts-llm` | [`lfaa-session-title-all-prompts-llm`](../packages/session/session-title-all-prompts-llm) | 否 |
| `session-turn-outline` | `lfaa-session-turn-outline` | [`lfaa-session-turn-outline`](../packages/session/session-turn-outline) | 否 |
| `session-format-v0-to-v1` | `lfaa-session-format-v0-to-v1` | [`lfaa-session-format-v0-to-v1`](../packages/session/session-format-v0-to-v1) | 否 |
| `session-format-v1-to-v2` | `lfaa-session-format-v1-to-v2` | [`lfaa-session-format-v1-to-v2`](../packages/session/session-format-v1-to-v2) | 否 |
| `session-format-v2-to-v3` | `lfaa-session-format-v2-to-v3` | [`lfaa-session-format-v2-to-v3`](../packages/session/session-format-v2-to-v3) | 否 |
| `session-format-v3-to-v4` | `lfaa-session-format-v3-to-v4` | [`lfaa-session-format-v3-to-v4`](../packages/session/session-format-v3-to-v4) | 否 |
| `session-checkpoint-policy` | `lfaa-session-checkpoint-policy` | [`lfaa-session-checkpoint-policy`](../packages/session/session-checkpoint-policy) | 否 |
| `session-telemetry` | `lfaa-session-telemetry` | [`lfaa-session-telemetry`](../packages/session/session-telemetry) | 否 |
| `session-telemetry-otel` | `lfaa-session-telemetry-otel` | [`lfaa-session-telemetry-otel`](../packages/session/session-telemetry-otel) | 否 |
| `session-query` | `lfaa-session-query` | [`lfaa-session-query`](../packages/session-query/session-query) | 否 |
| `session-query-sqlite` | `lfaa-session-query-sqlite` | [`lfaa-session-query-sqlite`](../packages/session-query/session-query-sqlite) | 否 |
| `session-log-export` | `lfaa-session-log-export` | [`lfaa-session-log-export`](../packages/session-query/session-log-export) | 否 |
| `auth` | `lfaa-identity-auth` | [`lfaa-identity-auth`](../packages/identity/auth) | 是 |
| `credentials` | `lfaa-credentials` | [`lfaa-credentials`](../packages/credentials/credentials) | 是 |
| `settings` | `lfaa-settings` | [`lfaa-settings`](../packages/settings/settings) | 是 |
| `credential-flows` | `lfaa-credential-flows` | [`lfaa-credential-flows`](../packages/credentials/credential-flows) | 是 |
| `github-integration` | `lfaa-github-integration` | [`lfaa-github-integration`](../packages/integrations/github) | 否 |
| `agent-default-model` | `lfaa-agent-default-model` | [`lfaa-agent-default-model`](../packages/core/agent-default-model) | 是 |
| `llm` | `lfaa-llm` | [`lfaa-llm`](../packages/llm/llm) | 是 |
| `llm-pi-ai` | `lfaa-llm-pi-ai` | [`lfaa-llm-pi-ai`](../packages/llm/llm-pi-ai) | 否 |
| `llm-retry` | `lfaa-llm-retry` | [`lfaa-llm-retry`](../packages/llm/llm-retry) | 否 |
| `token-meter` | `lfaa-token-meter` | [`lfaa-token-meter`](../packages/llm/token-meter) | 否 |
| `mcp` | `lfaa-mcp-client` | [`lfaa-mcp-client`](../packages/mcp/mcp-client) | 是 |
| `subagent` | `lfaa-subagent` | [`lfaa-subagent`](../packages/subagent/subagent) | 是 |
| `subagent-in-process-driver` | `lfaa-subagent-in-process-driver` | [`lfaa-subagent-in-process-driver`](../packages/subagent/subagent-in-process-driver) | 是 |
| `subagent-claude-code` | `lfaa-subagent-claude-code` | [`lfaa-subagent-claude-code`](../packages/subagent/subagent-claude-code) | 是 |
| `subagent-codex` | `lfaa-subagent-codex` | [`lfaa-subagent-codex`](../packages/subagent/subagent-codex) | 是 |
| `tool-subagent` | `lfaa-tool-subagent` | [`lfaa-tool-subagent`](../packages/subagent/tool-subagent) | 是 |
| `tool-subagent-control` | `lfaa-tool-subagent-control` | [`lfaa-tool-subagent-control`](../packages/subagent/tool-subagent-control) | 是 |
| `data-directory` | `lfaa-workspace-data-directory` | [`lfaa-workspace-data-directory`](../packages/workspace/data-directory) | 是 |
| `workspace` | `lfaa-workspace-workspace` | [`lfaa-workspace-workspace`](../packages/workspace/workspace) | 是 |
| `nodes` | `lfaa-host-daemon` | [`lfaa-host-daemon`](../packages/host/daemon) | 是 |
| `jobs` | `lfaa-jobs` | [`lfaa-jobs`](../packages/jobs/jobs) | 是 |
| `schedule` | `lfaa-schedule` | [`lfaa-schedule`](../packages/schedule/schedule) | 是 |
| `ssh` | `lfaa-ssh` | [`lfaa-ssh`](../packages/ssh/ssh) | 否 |
| `fs-ssh` | `lfaa-fs-ssh` | [`lfaa-fs-ssh`](../packages/ssh/fs-ssh) | 否 |
| `subprocess-ssh` | `lfaa-subprocess-ssh` | [`lfaa-subprocess-ssh`](../packages/ssh/subprocess-ssh) | 否 |
| `sandbox-ssh` | `lfaa-sandbox-ssh` | [`lfaa-sandbox-ssh`](../packages/ssh/sandbox-ssh) | 否 |
| `game-connectivity` | `lfaa-game-connectivity` | [`lfaa-game-connectivity`](../packages/network/game-connectivity) | 是 |
| `attachment-local` | `lfaa-attachment-local` | [`lfaa-attachment-local`](../packages/attachment/attachment-local) | 是 |
| `files` | `lfaa-fs` | [`lfaa-fs`](../packages/fs/fs) | 是 |
| `fs-local` | `lfaa-fs-local` | [`lfaa-fs-local`](../packages/fs/fs-local) | 是 |
| `tool-fs` | `lfaa-tool-fs` | [`lfaa-tool-fs`](../packages/fs/tool-fs) | 是 |
| `tool-fs-search` | `lfaa-tool-fs-search` | [`lfaa-tool-fs-search`](../packages/fs/tool-fs-search) | 是 |
| `tool-str-replace-editor` | `lfaa-tool-str-replace-editor` | [`lfaa-tool-str-replace-editor`](../packages/fs/tool-str-replace-editor) | 是 |
| `win32-process` | `lfaa-win32-process` | [`lfaa-win32-process`](../packages/subprocess/win32-process) | 是 |
| `subprocess-local` | `lfaa-subprocess-local` | [`lfaa-subprocess-local`](../packages/subprocess/subprocess-local) | 是 |
| `terminal-bash` | `lfaa-terminal-bash` | [`lfaa-terminal-bash`](../packages/terminal/terminal-bash) | 是 |
| `terminal` | `lfaa-terminal` | [`lfaa-terminal`](../packages/terminal/terminal) | 是 |
| `tool-terminal` | `lfaa-tool-terminal` | [`lfaa-tool-terminal`](../packages/terminal/tool-terminal) | 是 |
| `permissions` | `lfaa-permission-presets` | [`lfaa-permission-presets`](../packages/interaction/permission-presets) | 是 |
| `user-approval` | `lfaa-user-approval` | [`lfaa-user-approval`](../packages/interaction/user-approval) | 是 |
| `user-questions` | `lfaa-user-questions` | [`lfaa-user-questions`](../packages/interaction/user-questions) | 是 |
| `runtime-manager` | `lfaa-runtime-manager` | [`lfaa-runtime-manager`](../packages/games/runtime-manager) | 是 |
| `minecraft` | `lfaa-games-minecraft` | [`lfaa-games-minecraft`](../packages/games/minecraft) | 是 |
| `steamcmd` | `lfaa-games-steamcmd` | [`lfaa-games-steamcmd`](../packages/games/steamcmd) | 是 |
| `writing` | `lfaa-document-writing` | [`lfaa-document-writing`](../packages/document/writing) | 是 |
| `agent` | `lfaa-agent` | [`lfaa-agent`](../packages/core/agent) | 是 |
| `hooks` | `lfaa-hook-protocol` | [`lfaa-hook-protocol`](../packages/hooks/hook-protocol) | 是 |
| `agent-loop` | `lfaa-agent-loop` | [`lfaa-agent-loop`](../packages/core/agent-loop) | 是 |
| `compaction-basic` | `lfaa-compaction-basic` | [`lfaa-compaction-basic`](../packages/compaction/compaction-basic) | 是 |
| `spill-local` | `lfaa-spill-local` | [`lfaa-spill-local`](../packages/spill/spill-local) | 是 |
| `command-compact` | `lfaa-command-compact` | [`lfaa-command-compact`](../packages/compaction/command-compact) | 否 |
| `workflow` | `lfaa-workflow` | [`lfaa-workflow`](../packages/workflow/workflow) | 是 |
| `workflow-dag-engine` | `lfaa-workflow-dag-engine` | [`lfaa-workflow-dag-engine`](../packages/workflow/dag-engine) | 否 |
| `workflow-app-agent-adapter` | `lfaa-workflow-app-agent-adapter` | [`lfaa-workflow-app-agent-adapter`](../packages/workflow/app-agent-adapter) | 否 |
| `workflow-minecraft-adapter` | `lfaa-workflow-minecraft-adapter` | [`lfaa-workflow-minecraft-adapter`](../packages/workflow/minecraft-adapter) | 否 |
| `sessions` | `lfaa-session` | [`lfaa-session`](../packages/core/session) | 是 |
| `tools` | `lfaa-tools` | [`lfaa-tools`](../packages/core/tools) | 是 |
| `knowledge-library` | `lfaa-knowledge-library-runtime` | [`lfaa-knowledge-library-runtime`](../packages/boot/knowledge-library) | 是 |
| `ask-user` | `lfaa-tool-ask-user` | [`lfaa-tool-ask-user`](../packages/interaction/tool-ask-user) | 是 |
| `tool-shell` | `lfaa-tool-shell` | [`lfaa-tool-shell`](../packages/shell/tool-shell) | 是 |
| `shell` | `lfaa-shell` | [`lfaa-shell`](../packages/shell/shell) | 是 |
| `shell-env` | `lfaa-shell-env` | [`lfaa-shell-env`](../packages/shell/shell-env) | 是 |
| `pwsh-local` | `lfaa-pwsh-local` | [`lfaa-pwsh-local`](../packages/shell/pwsh-local) | 是 |
| `sandbox-windows-acl` | `lfaa-sandbox-windows-acl` | [`lfaa-sandbox-windows-acl`](../packages/sandbox/sandbox-windows-acl) | 是 |
| `pwsh-sandbox` | `lfaa-pwsh-sandbox` | [`lfaa-pwsh-sandbox`](../packages/shell/pwsh-sandbox) | 是 |
| `bash-local` | `lfaa-bash-local` | [`lfaa-bash-local`](../packages/shell/bash-local) | 是 |
| `bash-sandbox` | `lfaa-bash-sandbox` | [`lfaa-bash-sandbox`](../packages/shell/bash-sandbox) | 是 |
| `tool-skill` | `lfaa-tool-skill` | [`lfaa-tool-skill`](../packages/skill/tool-skill) | 是 |
| `skill` | `lfaa-skill` | [`lfaa-skill`](../packages/skill/skill) | 是 |
| `skill-filesystem` | `lfaa-skill-filesystem` | [`lfaa-skill-filesystem`](../packages/skill/skill-filesystem) | 是 |
| `skill-office` | `lfaa-skill-office` | [`lfaa-skill-office`](../packages/skill/skill-office) | 否 |
| `web` | `lfaa-web` | [`lfaa-web`](../packages/web/web) | 是 |
| `web-fetch-http` | `lfaa-web-fetch-http` | [`lfaa-web-fetch-http`](../packages/web/web-fetch-http) | 否 |
| `web-search-deepseek` | `lfaa-web-search-deepseek` | [`lfaa-web-search-deepseek`](../packages/web/web-search-deepseek) | 否 |
| `tool-web` | `lfaa-tool-web` | [`lfaa-tool-web`](../packages/web/tool-web) | 是 |
| `tool-session-query` | `lfaa-tool-session-query` | [`lfaa-tool-session-query`](../packages/session-query/tool-session-query) | 是 |
| `tool-workflow` | `lfaa-tool-workflow` | [`lfaa-tool-workflow`](../packages/workflow/tool-workflow) | 是 |
| `capability-installs` | `lfaa-capability-installs` | [`lfaa-capability-installs`](../packages/boot/capability-installs) | 是 |
| `plugin-manager` | `lfaa-plugin-manager` | [`lfaa-plugin-manager`](../packages/boot/plugin-manager) | 是 |
| `capability-skill` | `lfaa-capability-skill` | [`lfaa-capability-skill`](../packages/boot/capability-skill) | 是 |
| `capability-mcp` | `lfaa-capability-mcp` | [`lfaa-capability-mcp`](../packages/boot/capability-mcp) | 是 |
| `capability-prompt` | `lfaa-capability-prompt` | [`lfaa-capability-prompt`](../packages/boot/capability-prompt) | 是 |
| `agent-preset` | `lfaa-agent-preset` | [`lfaa-agent-preset`](../packages/preset/agent-preset) | 是 |
| `persona` | `lfaa-persona` | [`lfaa-persona`](../packages/preset/persona) | 是 |
| `prompt-minecraft` | `lfaa-prompt-minecraft` | [`lfaa-prompt-minecraft`](../packages/prompt/minecraft) | 是 |
| `prompt-writing` | `lfaa-prompt-writing` | [`lfaa-prompt-writing`](../packages/prompt/writing) | 是 |
| `domain-experts` | `lfaa-domain-experts` | [`lfaa-domain-experts`](../packages/preset/domain-experts) | 是 |
| `prompt-tools` | `lfaa-prompt` | [`lfaa-prompt`](../packages/prompt/prompt) | 是 |
| `skill-minecraft` | `lfaa-skill-minecraft` | [`lfaa-skill-minecraft`](../packages/skill/minecraft) | 是 |
| `skill-writing` | `lfaa-skill-writing` | [`lfaa-skill-writing`](../packages/skill/writing) | 是 |
| `skill-rea` | `lfaa-skill-rea` | [`lfaa-skill-rea`](../packages/skill/rea) | 是 |
| `tool-minecraft` | `lfaa-tool-minecraft` | [`lfaa-tool-minecraft`](../packages/games/tool-minecraft) | 是 |
| `tool-steamcmd` | `lfaa-tool-steamcmd` | [`lfaa-tool-steamcmd`](../packages/games/tool-steamcmd) | 是 |
| `tool-runtime` | `lfaa-tool-runtime` | [`lfaa-tool-runtime`](../packages/games/tool-runtime) | 是 |
| `tool-writing` | `lfaa-tool-writing` | [`lfaa-tool-writing`](../packages/document/tool-writing) | 是 |
| `deliverables-tool-present` | `lfaa-deliverables-tool-present` | [`lfaa-deliverables-tool-present`](../packages/deliverables/tool-present) | 是 |
| `tool-daemon` | `lfaa-tool-daemon` | [`lfaa-tool-daemon`](../packages/host/tool-daemon) | 是 |
| `hmr` | `lfaa-hmr` | [`lfaa-hmr`](../packages/boot/hmr) | 否 |

### [`lfaa-daemon-app`](../packages/bundle/daemon-app)

来源：[packages/bundle/daemon-app/cordis.patch.yml](../packages/bundle/daemon-app/cordis.patch.yml)

| Plugin ID | Cordis 名称 | 工作区包/来源 | 必需 |
|---|---|---|---|
| `daemon` | `lfaa-host-daemon/daemon` | [`lfaa-host-daemon`](../packages/host/daemon) | 是 |

### [`lfaa-desktop-computer-use`](../packages/bundle/desktop-computer-use)

来源：[packages/bundle/desktop-computer-use/cordis.patch.yml](../packages/bundle/desktop-computer-use/cordis.patch.yml)

| Plugin ID | Cordis 名称 | 工作区包/来源 | 必需 |
|---|---|---|---|
| `computer-use` | `lfaa-computer-use` | [`lfaa-computer-use`](../packages/computer-use/computer-use) | 否 |
| `browser-use` | `lfaa-browser-use` | [`lfaa-browser-use`](../packages/browser-use/browser-use) | 否 |
| `api-browser-controller` | `lfaa-api-browser-controller` | [`lfaa-api-browser-controller`](../packages/api/browser-controller) | 否 |

### [`lfaa-web-app`](../packages/bundle/web-app)

来源：[packages/bundle/web-app/cordis.patch.yml](../packages/bundle/web-app/cordis.patch.yml)

| Plugin ID | Cordis 名称 | 工作区包/来源 | 必需 |
|---|---|---|---|
| `api-gateway` | `lfaa-api-gateway` | [`lfaa-api-gateway`](../packages/api/gateway) | 是 |
| `api-account-controller` | `lfaa-api-account-controller` | [`lfaa-api-account-controller`](../packages/api/account-controller) | 否 |
| `api-writing-controller` | `lfaa-api-writing-controller` | [`lfaa-api-writing-controller`](../packages/api/writing-controller) | 否 |
| `api-attachment-controller` | `lfaa-api-attachment-controller` | [`lfaa-api-attachment-controller`](../packages/api/attachment-controller) | 否 |
| `api-knowledge-controller` | `lfaa-api-knowledge-controller` | [`lfaa-api-knowledge-controller`](../packages/api/knowledge-controller) | 否 |
| `api-session-controller` | `lfaa-api-session-controller` | [`lfaa-api-session-controller`](../packages/api/session-controller) | 否 |
| `api-terminal-controller` | `lfaa-api-terminal-controller` | [`lfaa-api-terminal-controller`](../packages/api/terminal-controller) | 否 |
| `api-workflow-controller` | `lfaa-api-workflow-controller` | [`lfaa-api-workflow-controller`](../packages/api/workflow-controller) | 否 |
| `llm-local-runtime` | `lfaa-llm-local-runtime` | [`lfaa-llm-local-runtime`](../packages/llm/llm-local-runtime) | 否 |
| `llm-moss-image` | `lfaa-llm-moss-image` | [`lfaa-llm-moss-image`](../packages/llm/llm-moss-image) | 否 |
| `llm-minimax-h3` | `lfaa-llm-minimax-h3` | [`lfaa-llm-minimax-h3`](../packages/llm/llm-minimax-h3) | 否 |
| `video-ai-video` | `lfaa-video-ai-video` | [`lfaa-video-ai-video`](../packages/video/ai-video) | 否 |
| `video-bilibili-video` | `lfaa-video-bilibili-video` | [`lfaa-video-bilibili-video`](../packages/video/bilibili-video) | 否 |
| `api-ai-video-controller` | `lfaa-api-ai-video-controller` | [`lfaa-api-ai-video-controller`](../packages/api/ai-video-controller) | 否 |
| `api-local-model-controller` | `lfaa-api-local-model-controller` | [`lfaa-api-local-model-controller`](../packages/api/local-model-controller) | 否 |
| `tool-ai-video` | `lfaa-video-tool-ai-video` | [`lfaa-video-tool-ai-video`](../packages/video/tool-ai-video) | 否 |
| `tool-bilibili-video` | `lfaa-video-tool-bilibili-video` | [`lfaa-video-tool-bilibili-video`](../packages/video/tool-bilibili-video) | 否 |
| `canvas` | `lfaa-canvas` | [`lfaa-canvas`](../packages/canvas/canvas) | 否 |
| `api-canvas-controller` | `lfaa-api-canvas-controller` | [`lfaa-api-canvas-controller`](../packages/api/canvas-controller) | 否 |
| `canvas-generation` | `lfaa-canvas-generation` | [`lfaa-canvas-generation`](../packages/canvas/canvas-generation) | 否 |
| `tool-canvas` | `lfaa-canvas-tool-canvas` | [`lfaa-canvas-tool-canvas`](../packages/canvas/tool-canvas) | 否 |
| `api-settings-controller` | `lfaa-api-settings-controller` | [`lfaa-api-settings-controller`](../packages/api/settings-controller) | 是 |
| `api-github-connection-controller` | `lfaa-api-github-connection-controller` | [`lfaa-api-github-connection-controller`](../packages/api/github-connection-controller) | 否 |
| `api-minecraft-controller` | `lfaa-api-minecraft-controller` | [`lfaa-api-minecraft-controller`](../packages/api/minecraft-controller) | 否 |
| `api-connectivity-controller` | `lfaa-api-connectivity-controller` | [`lfaa-api-connectivity-controller`](../packages/api/connectivity-controller) | 否 |
| `api-plugin-controller` | `lfaa-api-plugin-controller` | [`lfaa-api-plugin-controller`](../packages/api/plugin-controller) | 否 |
| `api-steamcmd-controller` | `lfaa-api-steamcmd-controller` | [`lfaa-api-steamcmd-controller`](../packages/api/steamcmd-controller) | 否 |
| `api-workspace-files` | `lfaa-api-workspace-files` | [`lfaa-api-workspace-files`](../packages/api/workspace-files) | 否 |
| `api-workspace-controller` | `lfaa-api-workspace-controller` | [`lfaa-api-workspace-controller`](../packages/api/workspace-controller) | 否 |
| `api-agent-git-controller` | `lfaa-api-agent-git-controller` | [`lfaa-api-agent-git-controller`](../packages/api/agent-git-controller) | 否 |
| `api-job-controller` | `lfaa-api-job-controller` | [`lfaa-api-job-controller`](../packages/api/job-controller) | 否 |
| `webserver` | `lfaa-host-webserver` | [`lfaa-host-webserver`](../packages/host/webserver) | 是 |
| `dsh-client-modules` | `@deepseek-ai/dsh-client-modules` | 外部包/未进入 workspace | 是 |
| `dsh-client-ui-renderer` | `@deepseek-ai/dsh-client-ui-renderer` | 外部包/未进入 workspace | 是 |
| `dsh-client-hmr` | `@deepseek-ai/dsh-client-hmr` | 外部包/未进入 workspace | 是 |

## 没有已知产品代码或 Profile 消费者的源码包

以下仅是静态复核线索：已登记测试、工程清单依赖或 README 用途会一并列出。没有当前产品消费者不等于可以删除；需要结合包合同和外部消费者继续判断。

| 包 | 运行树标记 | 测试消费者 | 清单消费者 | 结论提示 |
|---|---|---|---|---|
| [lfaa-client-file-upload](../packages/client/file-upload) | Client 源码包；未列入 apps/web 依赖 | [apps/cli/tests/client-file-upload.test.mjs](../apps/cli/tests/client-file-upload.test.mjs) | 无 | 无当前产品代码/Profile 引用；存在测试引用，需确认产品或工程用途 |
| [lfaa-compaction-image-offload](../packages/compaction/compaction-image-offload) | 随控制端运行树打包 | 无静态测试引用 | 无 | 无当前代码/Profile 引用，需确认接入、工程用途或退役状态 |
| [lfaa-compaction-tool-result-pruner](../packages/compaction/compaction-tool-result-pruner) | 随控制端运行树打包 | 无静态测试引用 | 无 | 无当前代码/Profile 引用，需确认接入、工程用途或退役状态 |
| [lfaa-sdk-client](../packages/sdk/sdk-client) | 随控制端运行树打包 | [apps/cli/tests/harness-agent-api.test.mjs](../apps/cli/tests/harness-agent-api.test.mjs) | 无 | 无当前产品代码/Profile 引用；存在测试引用，需确认产品或工程用途 |
