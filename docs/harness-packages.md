# LFAA Harness 目录对标清单

参考：[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)，提交 `639ed015397290b3745d163aafe02ffee4aa3f84`。

上游 316 个两级包目录原名保留；当前 88 个包有实际源码或装配配置（86 个运行产品能力包、1 个工程期生成器、1 个长期测试支持包）。`占位` 只保留 `.gitkeep`，不承诺对应能力已实现；有源码也不代表已经通过 DSH 行为对齐或真实运行验收，P0 逐包映射见 [P0 能力核对记录](harness-p0-audit.md)。原有业务按职责迁入这些包，LFAA 专属包列为扩展。

## acp

`packages/test-support/api` 为长期测试资源，保留源码和夹具；默认产品包构建与控制端/节点发布运行树均排除它，目录清单的“实现”不代表参与产品装配。

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/acp/acp](<H:/LFAA/packages/acp/acp>) | — | 占位 | DSH 同名目录 |

## api

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/api/account-controller](<H:/LFAA/packages/api/account-controller>) | lfaa-api-account-controller | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/gateway](<H:/LFAA/packages/api/gateway>) | lfaa-api-gateway | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/job-controller](<H:/LFAA/packages/api/job-controller>) | lfaa-api-job-controller | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/remotes](<H:/LFAA/packages/api/remotes>) | lfaa-api-remotes | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/session-controller](<H:/LFAA/packages/api/session-controller>) | lfaa-api-session-controller | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/settings-controller](<H:/LFAA/packages/api/settings-controller>) | lfaa-api-settings-controller | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/terminal-controller](<H:/LFAA/packages/api/terminal-controller>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/api/workspace-controller](<H:/LFAA/packages/api/workspace-controller>) | lfaa-api-workspace-controller | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/workspace-files](<H:/LFAA/packages/api/workspace-files>) | lfaa-api-workspace-files | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/api/minecraft-controller](<H:/LFAA/packages/api/minecraft-controller>) | lfaa-api-minecraft-controller | 实际实现 | LFAA 扩展 |
| [H:/LFAA/packages/api/steamcmd-controller](<H:/LFAA/packages/api/steamcmd-controller>) | lfaa-api-steamcmd-controller | 实际实现 | LFAA 扩展 |
| [H:/LFAA/packages/api/writing-controller](<H:/LFAA/packages/api/writing-controller>) | lfaa-api-writing-controller | 实际实现 | LFAA 扩展 |
| [H:/LFAA/packages/api/plugin-controller](<H:/LFAA/packages/api/plugin-controller>) | lfaa-api-plugin-controller | 实际实现 | LFAA 扩展 |

## attachment

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/attachment/attachment](<H:/LFAA/packages/attachment/attachment>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/attachment/attachment-local](<H:/LFAA/packages/attachment/attachment-local>) | — | 占位 | DSH 同名目录 |

## boot

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/boot/app-boot](<H:/LFAA/packages/boot/app-boot>) | lfaa-app-boot | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/boot/capability-installs](<H:/LFAA/packages/boot/capability-installs>) | lfaa-capability-installs | 实际实现 | LFAA 跨类型能力适配器 |
| [H:/LFAA/packages/boot/cmdline](<H:/LFAA/packages/boot/cmdline>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/boot/config-editor](<H:/LFAA/packages/boot/config-editor>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/boot/hmr](<H:/LFAA/packages/boot/hmr>) | lfaa-hmr | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/boot/plugin-manager](<H:/LFAA/packages/boot/plugin-manager>) | lfaa-plugin-manager | 实际实现 | DSH 同名目录 |

## browser-use

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/browser-use/browser-use](<H:/LFAA/packages/browser-use/browser-use>) | — | 占位 | DSH 同名目录 |

## bundle

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/bundle/acp-app](<H:/LFAA/packages/bundle/acp-app>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/bundle/base](<H:/LFAA/packages/bundle/base>) | lfaa-base | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/bundle/headless](<H:/LFAA/packages/bundle/headless>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/bundle/sdk-app](<H:/LFAA/packages/bundle/sdk-app>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/bundle/sdk-minimal](<H:/LFAA/packages/bundle/sdk-minimal>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/bundle/web-app](<H:/LFAA/packages/bundle/web-app>) | lfaa-web-app | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/bundle/daemon-app](<H:/LFAA/packages/bundle/daemon-app>) | lfaa-daemon-app | 实际实现 | LFAA 扩展 |

## client

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/client/connection](<H:/LFAA/packages/client/connection>) | lfaa-client-connection | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/file-upload](<H:/LFAA/packages/client/file-upload>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/hmr](<H:/LFAA/packages/client/hmr>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/locale](<H:/LFAA/packages/client/locale>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/modules](<H:/LFAA/packages/client/modules>) | lfaa-client-modules | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/product-analytics](<H:/LFAA/packages/client/product-analytics>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/resources](<H:/LFAA/packages/client/resources>) | lfaa-client-resources | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/shortcuts](<H:/LFAA/packages/client/shortcuts>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/store](<H:/LFAA/packages/client/store>) | lfaa-client-store | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-agent-preset](<H:/LFAA/packages/client/ui-agent-preset>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-approval](<H:/LFAA/packages/client/ui-approval>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-attachment](<H:/LFAA/packages/client/ui-attachment>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-brand-official](<H:/LFAA/packages/client/ui-brand-official>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-chat](<H:/LFAA/packages/client/ui-chat>) | lfaa-client-ui-chat | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-commands](<H:/LFAA/packages/client/ui-commands>) | lfaa-client-ui-commands | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-conversation](<H:/LFAA/packages/client/ui-conversation>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-deliverables](<H:/LFAA/packages/client/ui-deliverables>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-directory-picker-browse](<H:/LFAA/packages/client/ui-directory-picker-browse>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-directory-picker-native](<H:/LFAA/packages/client/ui-directory-picker-native>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-dockkit](<H:/LFAA/packages/client/ui-dockkit>) | lfaa-client-ui-dockkit | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-goal](<H:/LFAA/packages/client/ui-goal>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-input-trigger](<H:/LFAA/packages/client/ui-input-trigger>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-jobs](<H:/LFAA/packages/client/ui-jobs>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-layout](<H:/LFAA/packages/client/ui-layout>) | lfaa-client-ui-layout | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-message-feedback](<H:/LFAA/packages/client/ui-message-feedback>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-model-selection](<H:/LFAA/packages/client/ui-model-selection>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-open-in-app](<H:/LFAA/packages/client/ui-open-in-app>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-permission-presets](<H:/LFAA/packages/client/ui-permission-presets>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-plan](<H:/LFAA/packages/client/ui-plan>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-plugin-manager](<H:/LFAA/packages/client/ui-plugin-manager>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-primitives](<H:/LFAA/packages/client/ui-primitives>) | lfaa-client-ui-primitives | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-reference](<H:/LFAA/packages/client/ui-reference>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-renderer](<H:/LFAA/packages/client/ui-renderer>) | lfaa-client-ui-renderer | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-schedule](<H:/LFAA/packages/client/ui-schedule>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-session](<H:/LFAA/packages/client/ui-session>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings](<H:/LFAA/packages/client/ui-settings>) | lfaa-client-ui-settings | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-account](<H:/LFAA/packages/client/ui-settings-account>) | lfaa-client-ui-settings-account | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-agent-loop](<H:/LFAA/packages/client/ui-settings-agent-loop>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-general](<H:/LFAA/packages/client/ui-settings-general>) | lfaa-client-ui-settings-general | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-models](<H:/LFAA/packages/client/ui-settings-models>) | lfaa-client-ui-settings-models | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-plugin-inventory](<H:/LFAA/packages/client/ui-settings-plugin-inventory>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-plugins](<H:/LFAA/packages/client/ui-settings-plugins>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-session-log](<H:/LFAA/packages/client/ui-settings-session-log>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-shell](<H:/LFAA/packages/client/ui-settings-shell>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-subagent](<H:/LFAA/packages/client/ui-settings-subagent>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-settings-web-search](<H:/LFAA/packages/client/ui-settings-web-search>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-shortcuts](<H:/LFAA/packages/client/ui-shortcuts>) | lfaa-client-ui-shortcuts | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-sidebar](<H:/LFAA/packages/client/ui-sidebar>) | lfaa-client-ui-sidebar | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-sidebar-browser](<H:/LFAA/packages/client/ui-sidebar-browser>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-sidebar-documentpreview](<H:/LFAA/packages/client/ui-sidebar-documentpreview>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-sidebar-files](<H:/LFAA/packages/client/ui-sidebar-files>) | lfaa-client-ui-sidebar-files | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-sidebar-right](<H:/LFAA/packages/client/ui-sidebar-right>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-sidebar-terminal](<H:/LFAA/packages/client/ui-sidebar-terminal>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-skill](<H:/LFAA/packages/client/ui-skill>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-slots](<H:/LFAA/packages/client/ui-slots>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-subagent](<H:/LFAA/packages/client/ui-subagent>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-theme](<H:/LFAA/packages/client/ui-theme>) | lfaa-client-ui-theme | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-tool](<H:/LFAA/packages/client/ui-tool>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-trajectory](<H:/LFAA/packages/client/ui-trajectory>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-user-questions](<H:/LFAA/packages/client/ui-user-questions>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-workflow-run](<H:/LFAA/packages/client/ui-workflow-run>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-workspace](<H:/LFAA/packages/client/ui-workspace>) | lfaa-client-ui-workspace | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/web](<H:/LFAA/packages/client/web>) | lfaa-client-web | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/client/ui-minecraft](<H:/LFAA/packages/client/ui-minecraft>) | lfaa-client-ui-minecraft | 实际实现 | LFAA 扩展 |
| [H:/LFAA/packages/client/ui-writing](<H:/LFAA/packages/client/ui-writing>) | lfaa-client-ui-writing | 实际实现 | LFAA 扩展 |

## compaction

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/compaction/command-compact](<H:/LFAA/packages/compaction/command-compact>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/compaction/compaction](<H:/LFAA/packages/compaction/compaction>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/compaction/compaction-basic](<H:/LFAA/packages/compaction/compaction-basic>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/compaction/compaction-image-offload](<H:/LFAA/packages/compaction/compaction-image-offload>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/compaction/compaction-tool-result-pruner](<H:/LFAA/packages/compaction/compaction-tool-result-pruner>) | — | 占位 | DSH 同名目录 |

## computer-use

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/computer-use/computer-use](<H:/LFAA/packages/computer-use/computer-use>) | lfaa-computer-use | 已实现；Windows 桌面实机验收待完成 | LFAA CUA Driver SDK 适配 |

## context

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/context/agent-instructions](<H:/LFAA/packages/context/agent-instructions>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/context/file-reference](<H:/LFAA/packages/context/file-reference>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/context/file-reference-local](<H:/LFAA/packages/context/file-reference-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/context/session-reference](<H:/LFAA/packages/context/session-reference>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/context/time-context](<H:/LFAA/packages/context/time-context>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/context/tmux-context](<H:/LFAA/packages/context/tmux-context>) | — | 占位 | DSH 同名目录 |

## core

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/core/agent](<H:/LFAA/packages/core/agent>) | lfaa-agent | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/core/agent-default-model](<H:/LFAA/packages/core/agent-default-model>) | lfaa-agent-default-model | 实际实现 | DSH 同名目录；插件注入凭据引用读取模型密钥，账户/模型状态仍归设置中心 |
| [H:/LFAA/packages/core/agent-loop](<H:/LFAA/packages/core/agent-loop>) | lfaa-agent-loop | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/core/agent-tool-presentation](<H:/LFAA/packages/core/agent-tool-presentation>) | lfaa-agent-tool-presentation | 实际实现 | DSH 同名目录；仅呈现原生 function calling，不含 PTC |
| [H:/LFAA1/packages/core/conversation-memory](<H:/LFAA1/packages/core/conversation-memory>) | lfaa-conversation-memory | 实际实现 | LFAA 扩展；账户级有界记忆 Owner，由 AI Work 设置控制生成资格 |
| [H:/LFAA/packages/core/scope](<H:/LFAA/packages/core/scope>) | lfaa-scope | 实际实现 | DSH 同名目录；过滤可见范围，不替代授权 |
| [H:/LFAA/packages/core/session](<H:/LFAA/packages/core/session>) | lfaa-session | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/core/system-prompt](<H:/LFAA/packages/core/system-prompt>) | lfaa-system-prompt | 实际实现 | DSH 同名目录；按 LFAA Owner 顺序组装提示词 |
| [H:/LFAA/packages/core/tools](<H:/LFAA/packages/core/tools>) | lfaa-tools | 实际实现 | DSH 同名目录 |

## credentials

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [packages/credentials/authorization](packages/credentials/authorization) | lfaa-authorization | 实际实现 | LFAA 登录 Cookie 与角色校验中间件；DSH 凭据获取流程由 `lfaa-credential-flows` 提供，避免混淆两类授权 |
| [packages/credentials/credential-flows](packages/credentials/credential-flows) | lfaa-credential-flows | 实际实现 | LFAA 插件化凭据授权流程；由活动插件身份归属，支持账户隔离、取消/卸载及本次提交确认 |
| [packages/credentials/credentials](packages/credentials/credentials) | lfaa-credentials | 实际实现 | DSH 同名目录；按插件身份提供凭据引用和记录接口，密文由 Settings 唯一加密存储持有 |
| [H:/LFAA/packages/credentials/credentials-local](<H:/LFAA/packages/credentials/credentials-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/credentials/deepseek-account](<H:/LFAA/packages/credentials/deepseek-account>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/credentials/deepseek-account-platform](<H:/LFAA/packages/credentials/deepseek-account-platform>) | — | 占位 | DSH 同名目录 |

## deliverables

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/deliverables/tool-present](<H:/LFAA/packages/deliverables/tool-present>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/deliverables/workspace-changes](<H:/LFAA/packages/deliverables/workspace-changes>) | — | 占位 | DSH 同名目录 |

## document

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/document/office-to-pdf](<H:/LFAA/packages/document/office-to-pdf>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/document/writing](<H:/LFAA/packages/document/writing>) | lfaa-document-writing | 实际实现 | LFAA 扩展 |

## experimental

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/experimental/agent-team](<H:/LFAA/packages/experimental/agent-team>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/agent-team-profile](<H:/LFAA/packages/experimental/agent-team-profile>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/api-speech-to-text](<H:/LFAA/packages/experimental/api-speech-to-text>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/auto-review](<H:/LFAA/packages/experimental/auto-review>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/browser-use-chrome-devtools-mcp](<H:/LFAA/packages/experimental/browser-use-chrome-devtools-mcp>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/browser-use-playwright-mcp](<H:/LFAA/packages/experimental/browser-use-playwright-mcp>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/browser-use-runtime](<H:/LFAA/packages/experimental/browser-use-runtime>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/browser-use-stagehand-native](<H:/LFAA/packages/experimental/browser-use-stagehand-native>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/client-ui-agent-team](<H:/LFAA/packages/experimental/client-ui-agent-team>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/client-ui-voice-input](<H:/LFAA/packages/experimental/client-ui-voice-input>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/computer-use-cua-driver-mcp](<H:/LFAA/packages/experimental/computer-use-cua-driver-mcp>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/computer-use-cua-driver-native](<H:/LFAA/packages/experimental/computer-use-cua-driver-native>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/inspector](<H:/LFAA/packages/experimental/inspector>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/ptc-runtime-python](<H:/LFAA/packages/experimental/ptc-runtime-python>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/schedule-bundle](<H:/LFAA/packages/experimental/schedule-bundle>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/speech-to-text](<H:/LFAA/packages/experimental/speech-to-text>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/speech-to-text-sensevoice](<H:/LFAA/packages/experimental/speech-to-text-sensevoice>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/tool-agent-team](<H:/LFAA/packages/experimental/tool-agent-team>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/voice-input-bundle](<H:/LFAA/packages/experimental/voice-input-bundle>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/webworker-packer](<H:/LFAA/packages/experimental/webworker-packer>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/experimental/webworker-runtime](<H:/LFAA/packages/experimental/webworker-runtime>) | — | 占位 | DSH 同名目录 |

## extensions

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/extensions/cordis-client-runner](<H:/LFAA/packages/extensions/cordis-client-runner>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/extensions/cordis-host-runner](<H:/LFAA/packages/extensions/cordis-host-runner>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/extensions/tool-cordis](<H:/LFAA/packages/extensions/tool-cordis>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/extensions/ui-cordis](<H:/LFAA/packages/extensions/ui-cordis>) | — | 占位 | DSH 同名目录 |

## feedback

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/feedback/command-feedback](<H:/LFAA/packages/feedback/command-feedback>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/feedback/message-feedback](<H:/LFAA/packages/feedback/message-feedback>) | — | 占位 | DSH 同名目录 |

## fs

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/fs/fs](<H:/LFAA/packages/fs/fs>) | lfaa-fs | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/fs/fs-local](<H:/LFAA/packages/fs/fs-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/fs/fs-observation-policy](<H:/LFAA/packages/fs/fs-observation-policy>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/fs/fs-sandbox](<H:/LFAA/packages/fs/fs-sandbox>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/fs/tool-fs](<H:/LFAA/packages/fs/tool-fs>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/fs/tool-fs-search](<H:/LFAA/packages/fs/tool-fs-search>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/fs/tool-str-replace-editor](<H:/LFAA/packages/fs/tool-str-replace-editor>) | — | 占位 | DSH 同名目录 |

## goal

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/goal/command-goal](<H:/LFAA/packages/goal/command-goal>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/goal/goal](<H:/LFAA/packages/goal/goal>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/goal/goal-round-driver](<H:/LFAA/packages/goal/goal-round-driver>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/goal/tool-goal](<H:/LFAA/packages/goal/tool-goal>) | — | 占位 | DSH 同名目录 |

## guard

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/guard/repeat-tool-reminder](<H:/LFAA/packages/guard/repeat-tool-reminder>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/guard/timeout-policy](<H:/LFAA/packages/guard/timeout-policy>) | — | 占位 | DSH 同名目录 |

## hooks

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/hooks/hook-protocol](<H:/LFAA/packages/hooks/hook-protocol>) | lfaa-hook-protocol | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/hooks/hooks-claude-code](<H:/LFAA/packages/hooks/hooks-claude-code>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/hooks/hooks-codex](<H:/LFAA/packages/hooks/hooks-codex>) | — | 占位 | DSH 同名目录 |

## host

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/host/directory-picker](<H:/LFAA/packages/host/directory-picker>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/directory-picker-auto](<H:/LFAA/packages/host/directory-picker-auto>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/directory-picker-browse](<H:/LFAA/packages/host/directory-picker-browse>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/directory-picker-native](<H:/LFAA/packages/host/directory-picker-native>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/frontend-static](<H:/LFAA/packages/host/frontend-static>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/open-in-app](<H:/LFAA/packages/host/open-in-app>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/plugin-inventory](<H:/LFAA/packages/host/plugin-inventory>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/product-telemetry-otel](<H:/LFAA/packages/host/product-telemetry-otel>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/host/webserver](<H:/LFAA/packages/host/webserver>) | lfaa-host-webserver | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/host/daemon](<H:/LFAA/packages/host/daemon>) | lfaa-host-daemon | 实际实现 | LFAA 扩展 |

## identity

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/identity/anonymous-user-id](<H:/LFAA/packages/identity/anonymous-user-id>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/identity/auth](<H:/LFAA/packages/identity/auth>) | lfaa-identity-auth | 实际实现 | LFAA 扩展 |

## interaction

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/interaction/commands](<H:/LFAA/packages/interaction/commands>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/interaction/permission-presets](<H:/LFAA/packages/interaction/permission-presets>) | lfaa-permission-presets | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/interaction/tool-ask-user](<H:/LFAA/packages/interaction/tool-ask-user>) | lfaa-tool-ask-user | 实际实现 | DSH 同名目录；只接入既有 Agent Run 问题通道 |
| [H:/LFAA1/packages/interaction/user-approval](<H:/LFAA1/packages/interaction/user-approval>) | lfaa-user-approval | 实际实现 | DSH 同名目录；提供账户隔离的审批状态唤醒，不持有审批记录 |
| [H:/LFAA/packages/interaction/user-questions](<H:/LFAA/packages/interaction/user-questions>) | `lfaa-user-questions` | 部分实现（通道中立回答者注册与 Agent Run 适配；其他通道待接） | DSH 同名目录 |

## jobs

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/jobs/jobs](<H:/LFAA/packages/jobs/jobs>) | lfaa-jobs | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/jobs/jobs-local](<H:/LFAA/packages/jobs/jobs-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/jobs/tool-jobs](<H:/LFAA/packages/jobs/tool-jobs>) | — | 占位 | DSH 同名目录 |

## llm

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/llm/deepseek-llm-api-extensions](<H:/LFAA/packages/llm/deepseek-llm-api-extensions>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/llm](<H:/LFAA/packages/llm/llm>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/llm-deepseek](<H:/LFAA/packages/llm/llm-deepseek>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/llm-deepseek-account](<H:/LFAA/packages/llm/llm-deepseek-account>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/llm-deepseek-api-key](<H:/LFAA/packages/llm/llm-deepseek-api-key>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/llm-pi-ai](<H:/LFAA/packages/llm/llm-pi-ai>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/llm-retry](<H:/LFAA/packages/llm/llm-retry>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/plugin-package-inventory-deepseek](<H:/LFAA/packages/llm/plugin-package-inventory-deepseek>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/llm/token-meter](<H:/LFAA/packages/llm/token-meter>) | — | 占位 | DSH 同名目录 |

## lsp

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/lsp/lsp](<H:/LFAA/packages/lsp/lsp>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/lsp/lsp-stdio](<H:/LFAA/packages/lsp/lsp-stdio>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/lsp/tool-lsp](<H:/LFAA/packages/lsp/tool-lsp>) | — | 占位 | DSH 同名目录 |

## mcp

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/mcp/mcp-client](<H:/LFAA/packages/mcp/mcp-client>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/mcp/mcp-resources](<H:/LFAA/packages/mcp/mcp-resources>) | — | 占位 | DSH 同名目录 |

## plan

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/plan/plan-mode](<H:/LFAA/packages/plan/plan-mode>) | — | 占位 | DSH 同名目录 |

## preset

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/preset/agent-preset](<H:/LFAA/packages/preset/agent-preset>) | lfaa-agent-preset | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/preset/agent-preset-registry](<H:/LFAA/packages/preset/agent-preset-registry>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/preset/persona](<H:/LFAA/packages/preset/persona>) | — | 占位 | DSH 同名目录 |

## ptc-runtime

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/ptc-runtime/ptc-runtime](<H:/LFAA/packages/ptc-runtime/ptc-runtime>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/ptc-runtime/ptc-runtime-node](<H:/LFAA/packages/ptc-runtime/ptc-runtime-node>) | — | 占位 | DSH 同名目录 |

## runtime-diagnostics

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/runtime-diagnostics/invariants](<H:/LFAA/packages/runtime-diagnostics/invariants>) | — | 占位 | DSH 同名目录 |

## sandbox

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/sandbox/sandbox](<H:/LFAA/packages/sandbox/sandbox>) | lfaa-sandbox | 实际实现 | P0 沙箱提供方接口与失败关闭结果核验；执行器待 P2 |
| [H:/LFAA/packages/sandbox/sandbox-local](<H:/LFAA/packages/sandbox/sandbox-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/sandbox/sandbox-policy](<H:/LFAA/packages/sandbox/sandbox-policy>) | lfaa-sandbox-policy | 实际实现 | P0 按目标节点验证的逐调用策略合同；设置与会话 Owner 接线待核 |
| [H:/LFAA/packages/sandbox/sandbox-windows-acl](<H:/LFAA/packages/sandbox/sandbox-windows-acl>) | — | 占位 | DSH 同名目录 |

## schedule

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/schedule/schedule](<H:/LFAA/packages/schedule/schedule>) | — | 占位 | DSH 同名目录 |

## sdk

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/sdk/client](<H:/LFAA/packages/sdk/client>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/sdk/protocol](<H:/LFAA/packages/sdk/protocol>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/sdk/server](<H:/LFAA/packages/sdk/server>) | — | 占位 | DSH 同名目录 |

## session

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/session/session-checkpoint-policy](<H:/LFAA/packages/session/session-checkpoint-policy>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-format](<H:/LFAA/packages/session/session-format>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-format-catalog](<H:/LFAA/packages/session/session-format-catalog>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-format-v0-to-v1](<H:/LFAA/packages/session/session-format-v0-to-v1>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-format-v1-to-v2](<H:/LFAA/packages/session/session-format-v1-to-v2>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-format-v2-to-v3](<H:/LFAA/packages/session/session-format-v2-to-v3>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-format-v3-to-v4](<H:/LFAA/packages/session/session-format-v3-to-v4>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-log-deepseek](<H:/LFAA/packages/session/session-log-deepseek>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-persistence](<H:/LFAA/packages/session/session-persistence>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-persistence-jsonl](<H:/LFAA/packages/session/session-persistence-jsonl>) | lfaa-session-persistence-jsonl | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-projection](<H:/LFAA/packages/session/session-projection>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-projection-cache](<H:/LFAA/packages/session/session-projection-cache>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-stats](<H:/LFAA/packages/session/session-stats>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-telemetry](<H:/LFAA/packages/session/session-telemetry>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-telemetry-otel](<H:/LFAA/packages/session/session-telemetry-otel>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-title](<H:/LFAA/packages/session/session-title>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-title-all-prompts-llm](<H:/LFAA/packages/session/session-title-all-prompts-llm>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-title-first-prompt-llm](<H:/LFAA/packages/session/session-title-first-prompt-llm>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-title-llm](<H:/LFAA/packages/session/session-title-llm>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session/session-turn-outline](<H:/LFAA/packages/session/session-turn-outline>) | — | 占位 | DSH 同名目录 |

## session-query

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/session-query/session-log-export](<H:/LFAA/packages/session-query/session-log-export>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session-query/session-query](<H:/LFAA/packages/session-query/session-query>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session-query/session-query-sqlite](<H:/LFAA/packages/session-query/session-query-sqlite>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/session-query/tool-session-query](<H:/LFAA/packages/session-query/tool-session-query>) | — | 占位 | DSH 同名目录 |

## settings

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/settings/settings](<H:/LFAA/packages/settings/settings>) | lfaa-settings | 实际实现 | DSH 同名目录 |

## shell

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/shell/bash-local](<H:/LFAA/packages/shell/bash-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/bash-sandbox](<H:/LFAA/packages/shell/bash-sandbox>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/pwsh-local](<H:/LFAA/packages/shell/pwsh-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/pwsh-sandbox](<H:/LFAA/packages/shell/pwsh-sandbox>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/shell](<H:/LFAA/packages/shell/shell>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/shell-env](<H:/LFAA/packages/shell/shell-env>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/tool-bash](<H:/LFAA/packages/shell/tool-bash>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/tool-bash-persistent](<H:/LFAA/packages/shell/tool-bash-persistent>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/tool-pwsh](<H:/LFAA/packages/shell/tool-pwsh>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/shell/tool-pwsh-persistent](<H:/LFAA/packages/shell/tool-pwsh-persistent>) | — | 占位 | DSH 同名目录 |

## skill

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/skill/skill](<H:/LFAA/packages/skill/skill>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/skill/skill-badge](<H:/LFAA/packages/skill/skill-badge>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/skill/skill-filesystem](<H:/LFAA/packages/skill/skill-filesystem>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/skill/skill-office](<H:/LFAA/packages/skill/skill-office>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/skill/tool-skill](<H:/LFAA/packages/skill/tool-skill>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/skill/tool-workspace-dependencies](<H:/LFAA/packages/skill/tool-workspace-dependencies>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/skill/writing](<H:/LFAA/packages/skill/writing>) | lfaa-skill-writing | 实际实现 | LFAA 扩展 |

## spill

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/spill/spill](<H:/LFAA/packages/spill/spill>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/spill/spill-local](<H:/LFAA/packages/spill/spill-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/spill/spill-policy](<H:/LFAA/packages/spill/spill-policy>) | — | 占位 | DSH 同名目录 |

## ssh

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/ssh/fs-ssh](<H:/LFAA/packages/ssh/fs-ssh>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/ssh/sandbox-ssh](<H:/LFAA/packages/ssh/sandbox-ssh>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/ssh/ssh](<H:/LFAA/packages/ssh/ssh>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/ssh/subprocess-ssh](<H:/LFAA/packages/ssh/subprocess-ssh>) | — | 占位 | DSH 同名目录 |

## storage

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA1/packages/storage/storage](<H:/LFAA1/packages/storage/storage>) | lfaa-storage-hub | 实际实现 | 具名后端/数据形式注册与插件生命周期；不持有领域数据 |
| [H:/LFAA1/packages/storage/storage-domain](<H:/LFAA1/packages/storage/storage-domain>) | lfaa-storage-domain | 实际实现 | DSH 同名目录 |
| [H:/LFAA1/packages/storage/storage-json](<H:/LFAA1/packages/storage/storage-json>) | lfaa-storage-json | 实际实现 | DSH 同名目录 |
| [H:/LFAA1/packages/storage/storage-sqlite](<H:/LFAA1/packages/storage/storage-sqlite>) | lfaa-storage-sqlite | 实际实现 | DSH 同名目录 |

## subagent

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/subagent/subagent](<H:/LFAA/packages/subagent/subagent>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/subagent-acp](<H:/LFAA/packages/subagent/subagent-acp>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/subagent-claude-code](<H:/LFAA/packages/subagent/subagent-claude-code>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/subagent-codex](<H:/LFAA/packages/subagent/subagent-codex>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/subagent-dsh-sdk](<H:/LFAA/packages/subagent/subagent-dsh-sdk>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/subagent-fork-in-process](<H:/LFAA/packages/subagent/subagent-fork-in-process>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/subagent-in-process-driver](<H:/LFAA/packages/subagent/subagent-in-process-driver>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/subagent-spawn-in-process](<H:/LFAA/packages/subagent/subagent-spawn-in-process>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/tool-subagent](<H:/LFAA/packages/subagent/tool-subagent>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subagent/tool-subagent-control](<H:/LFAA/packages/subagent/tool-subagent-control>) | — | 占位 | DSH 同名目录 |

## subprocess

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/subprocess/subprocess](<H:/LFAA/packages/subprocess/subprocess>) | lfaa-subprocess | 实际实现 | P0 受管子进程/伪终端服务合同；本机及 Daemon 提供方待 P2 |
| [H:/LFAA/packages/subprocess/subprocess-local](<H:/LFAA/packages/subprocess/subprocess-local>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/subprocess/win32-process](<H:/LFAA/packages/subprocess/win32-process>) | — | 占位 | DSH 同名目录 |

## telemetry

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/telemetry/otel](<H:/LFAA/packages/telemetry/otel>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/telemetry/logger](<H:/LFAA/packages/telemetry/logger>) | lfaa-telemetry-logger | 实际实现 | LFAA 扩展 |

## terminal

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/terminal/terminal](<H:/LFAA/packages/terminal/terminal>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/terminal/terminal-bash](<H:/LFAA/packages/terminal/terminal-bash>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/terminal/tool-terminal](<H:/LFAA/packages/terminal/tool-terminal>) | — | 占位 | DSH 同名目录 |

## test-support

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/test-support/agent-loop-testkit](<H:/LFAA/packages/test-support/agent-loop-testkit>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/test-support/client-runtime](<H:/LFAA/packages/test-support/client-runtime>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/test-support/llm-mock-server](<H:/LFAA/packages/test-support/llm-mock-server>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/test-support/llm-replay](<H:/LFAA/packages/test-support/llm-replay>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/test-support/loader-smoke](<H:/LFAA/packages/test-support/loader-smoke>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/test-support/remote-mock](<H:/LFAA/packages/test-support/remote-mock>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/test-support/session-snapshot](<H:/LFAA/packages/test-support/session-snapshot>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/test-support/api](<H:/LFAA/packages/test-support/api>) | lfaa-test-support-api | 实际实现 | LFAA 扩展 |

## todo

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/todo/tool-todo](<H:/LFAA/packages/todo/tool-todo>) | — | 占位 | DSH 同名目录 |

## typert

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA1/packages/typert/generator](<H:/LFAA1/packages/typert/generator>) | `lfaa-typert-generator` | 部分实现（账户 `auth/me` 源合同生成双端描述与 JSON Schema；工程期包，不进入产品运行树） | DSH 同名目录 |
| [H:/LFAA1/packages/typert/loader](<H:/LFAA1/packages/typert/loader>) | `lfaa-typert-loader` | 部分实现（插件生命周期登记；生成工件自动发现待做） | DSH 同名目录 |
| [H:/LFAA1/packages/typert/protocol](<H:/LFAA1/packages/typert/protocol>) | `lfaa-typert-protocol` | 部分实现（一元协议与逐方法授权；流式协议、生成器待做） | DSH 同名目录 |
| [H:/LFAA1/packages/typert/registry](<H:/LFAA1/packages/typert/registry>) | `lfaa-typert-registry` | 部分实现（Host 路由已接；仅账户自身读取迁移，其他 API/Socket 待接） | DSH 同名目录 |

## util

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/util/atomic-write](<H:/LFAA/packages/util/atomic-write>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/brand](<H:/LFAA/packages/util/brand>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/chunked-list](<H:/LFAA/packages/util/chunked-list>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/code-language](<H:/LFAA/packages/util/code-language>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/crypto](<H:/LFAA/packages/util/crypto>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/deque](<H:/LFAA/packages/util/deque>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/home-paths](<H:/LFAA/packages/util/home-paths>) | lfaa-home-paths | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/util/http-proxy](<H:/LFAA/packages/util/http-proxy>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/launch-environment](<H:/LFAA/packages/util/launch-environment>) | lfaa-launch-environment | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/util/lazy-require](<H:/LFAA/packages/util/lazy-require>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/native-command](<H:/LFAA/packages/util/native-command>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/output-retention](<H:/LFAA/packages/util/output-retention>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/package-manifest](<H:/LFAA/packages/util/package-manifest>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/time](<H:/LFAA/packages/util/time>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/timeout](<H:/LFAA/packages/util/timeout>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/util/values](<H:/LFAA/packages/util/values>) | lfaa-util-values | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/util/workspace-path](<H:/LFAA/packages/util/workspace-path>) | — | 占位 | DSH 同名目录 |

## web

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/web/tool-web](<H:/LFAA/packages/web/tool-web>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/web/web](<H:/LFAA/packages/web/web>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/web/web-fetch-http](<H:/LFAA/packages/web/web-fetch-http>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/web/web-search-deepseek](<H:/LFAA/packages/web/web-search-deepseek>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/web/web-search-exa](<H:/LFAA/packages/web/web-search-exa>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/web/web-search-perplexity](<H:/LFAA/packages/web/web-search-perplexity>) | — | 占位 | DSH 同名目录 |

## webhook

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/webhook/webhook](<H:/LFAA/packages/webhook/webhook>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/webhook/webhook-github](<H:/LFAA/packages/webhook/webhook-github>) | — | 占位 | DSH 同名目录 |

## workflow

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/workflow/tool-ralph](<H:/LFAA/packages/workflow/tool-ralph>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/workflow/tool-workflow](<H:/LFAA/packages/workflow/tool-workflow>) | — | 占位 | DSH 同名目录 |
| [H:/LFAA/packages/workflow/workflow](<H:/LFAA/packages/workflow/workflow>) | `lfaa-workflow` | 部分实现（Minecraft Agent 工作流定义与运行 Owner；通用 DSH 工作流待做） | DSH 同名目录 / LFAA 扩展 |
| [H:/LFAA/packages/workflow/workflow-ptc](<H:/LFAA/packages/workflow/workflow-ptc>) | — | 占位 | DSH 同名目录 |

## workspace

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/workspace/workspace](<H:/LFAA/packages/workspace/workspace>) | lfaa-workspace-workspace | 实际实现 | DSH 同名目录 |
| [H:/LFAA/packages/workspace/data-directory](<H:/LFAA/packages/workspace/data-directory>) | lfaa-workspace-data-directory | 实际实现 | LFAA 扩展 |

## games

| 绝对目录 | 包名 | 状态 | 来源 |
|---|---|---|---|
| [H:/LFAA/packages/games/minecraft](<H:/LFAA/packages/games/minecraft>) | lfaa-games-minecraft | 实际实现 | LFAA 扩展 |
| [H:/LFAA/packages/games/steamcmd](<H:/LFAA/packages/games/steamcmd>) | lfaa-games-steamcmd | 实际实现 | LFAA 扩展 |
