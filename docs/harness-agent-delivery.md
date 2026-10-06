# LFAA 通用 Agent 第一轮修复与开发交付

日期：2026-09-30。此记录只描述本轮改动，不把工作区既有的大量迁移改动归入本轮；没有重置、暂存或提交用户已有改动，也未发布产品版本。

> 历史构建快照：下文记录的 dist/frontend 与 dist/server 是 2026-09-30 当次构建输出。当前构建与运行入口以 [2026-10-01 全仓审计](workspace-audit.md) 和 [系统总体架构](系统总体架构.md) 为准。

## 已交付

通用 `/tasks` 入口；与 HTTP 连接解耦的后台 Run；结构化工具证据恢复；设置驱动的执行预算；排队与引导输入；独立模型与工具循环的顺序子 Agent；真实项目文件和 Markdown Skills 发现/读取；可执行插件工具；设置中心配置的 HTTP MCP 工具接入；账户隔离的节点输出面板；浏览器语音输入与播报适配。

服务端重启会把运行中/排队的任务标为中断，保留证据，不自动重放写操作。完全权限直接执行；另外两种模式复用现有逐项审批与精确记忆授权。同一任务树发生拒绝/过期后不再写入。取消 Agent 等待不能把已经派发的节点副作用说成撤销成功。

## 设置中心接入

| 配置 | 默认值 / 本轮消费 |
|---|---|
| aiRuntime.maxModelRequests | 12；每个 Agent 的模型请求上限，范围 1–100 |
| aiRuntime.maxToolCalls | 24；每个 Agent 的工具调用上限，范围 1–200 |
| aiRuntime.subagentAccountId | 空字符串；继承主模型。指定账户不可用时明确失败，不降级 |
| aiRuntime.maxSubagents | 4；整个任务树最多委派数量，范围 0–16 |
| aiRuntime.maxDelegationDepth | 2；任务树深度，范围 0–4 |
| aiRuntime.voiceInputEnabled | false；会话麦克风能力开关，识别后由用户发送 |
| aiRuntime.readResponsesAloud | false；新完成回复播报开关 |
| plugins.enabled | 既有 false；控制扩展提示、插件执行工具和 MCP 的接入 |
| plugins.mcpServers | []；账户级 id/name/url/enabled 列表，最多 16 项；Joi 拒绝重复 ID、带凭据/查询串/片段的地址 |
| general.taskFolder / integratedShell | 既有路径及 system；项目根目录和主机命令默认目录/Shell |
| general.followupBehavior | 既有 queue；运行中输入按 queue/steer 行为处理 |
| general.terminalPosition / showBottomPanelControl | 既有 bottom/true；真实输出面板位置与入口可见性 |
| general.defaultStandaloneChat | 既有 false；记录时用于登录/恢复直达 `/tasks`，2026-10-04 后在应用中心标记通用任务默认入口，登录或恢复仍先显示 `/` |
| general.language / sendShortcut / 通知及快捷键设置 | 既有偏好；语音语言、发送、输出入口快捷键与任务通知 |
| aiRuntime.speed / requestTimeoutSeconds / maxOutputTokens / promptSuggestions / showContextUsage | 既有偏好；保留模型请求、MCP 超时和聊天展示配置 |
| permissions.mode | 既有 ask；写入、高风险和外部 MCP 调用沿用三种权限合同 |
| appearance 全部适用项 | 复用既有主题、强调色、字体/字号、对比度、背景、遮罩、模糊和减少动态效果令牌；workspace 使用 appCenter 背景，不重置用户偏好 |

新增配置已贯通服务端类型/默认值/读取、API 校验与持久化、前端类型/默认值和设置控件。完整装配回归实际保存并读回预算与语音开关；运行回归验证预算、子模型、深度、数量合同、跟进设置生效，MCP 校验拒绝带凭据地址。主题与面板改动通过类型检查和生产构建，尚未进行浏览器目视与真实麦克风验收。

## 实际验证

- 前端 TypeScript 严格检查通过；控制端 TypeScript 随生产构建通过。
- 全量长期回归最终 37/37 通过，包含正常账户初始化与 Cookie 认证、后台断线继续、跨账户拒绝、工具协议历史、排队/引导、立即取消、独立子模型与工具执行、边界拒绝、真实文件执行、MCP HTTP/JSON/SSE、取消不重放、存储迁移、CLI 生产启动/正常停止/同目录重启和发布依赖清单。
- 前端生产构建输出 `H:/LFAA/dist/frontend/`；控制端输出 `H:/LFAA/dist/server/`；64 个能力包输出 `H:/LFAA/dist/packages/`；npm 发布目录组装到 `H:/LFAA/dist/npm/lfaa/`。未执行 npm publish。
- Daemon 与项目文件执行器 Node 语法检查通过；文件执行器通过真实临时文件和 Node 标准输入调用验证。未运行 Rust/桌面安装包构建。
- 依赖安装与锁文件同步成功。首次 pnpm 自动执行曾遇工作区状态文件 EPERM，后续正常安装完成；最后一次新增插件卸载检查曾缺少两个参数类型，已补齐并重新构建。一次发布回归与重建并发导致读取不到正在清理的 dist，改为先完成构建/发布目录组装后运行，全量回归通过。
- 合成 Provider/账户和 MCP 协议夹具仅存在于长期测试的隔离目录或本机测试进程，测试结束清理；没有访问真实模型密钥或用合成结果装配产品。

## 当前限制与后续开发

1. 真实 Provider、真实在线 Daemon 的完整聊天→文件修改→测试执行链，仍需要目标运行环境验收。
2. MCP 仅实现 2025-11-25/2025-06-18 的 Streamable HTTP 工具子集。没有内建 OAuth、stdio、资源/提示词、客户端采样或服务器输入请求；需要认证的服务须在用户控制的代理中完成认证。连接的是实际工具服务，未交付原生浏览器/电脑驱动或截图视觉循环。
3. ChatGPT↔LFAA 的双向身份、任务接管与结果交接未完成。已有认证 Run API 和出站 MCP 工具接口不能替代这项产品验收。
4. 子 Agent 当前顺序执行。并行调度、项目写入冲突处理、专家角色配置、任务依赖和聚合计费仍待实现。指定子账户无法调用时不偷偷换模型。
5. 当前节点输出面板显示真实任务结果；不是交互式 PTY。agentEnvironment 的 WSL/Linux 自动环境切换尚未实现。
6. 语音为宿主 Web Speech API 的适配，尚未真实麦克风验收，也不等于模型 Realtime 全双工语音。多模态文件、自动上下文压缩、跨进程恢复与性能基准继续开发。

实现参考：[MCP HTTP 规范](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)、[MCP 工具规范](https://modelcontextprotocol.io/specification/2025-11-25/server/tools)、[Web Speech 识别说明](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)。

## 本轮全部变更文件

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts](<H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts>) | 纠正主 Agent 权限与真实能力提示，开放通用任务上下文。 |
| [H:/LFAA/packages/settings/settings/src/service.ts](<H:/LFAA/packages/settings/settings/src/service.ts>) | 权威预算、子模型、语音和 MCP 设置与旧偏好读取；显式选择模型账户。 |
| [H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts](<H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts>) | 前端新增设置默认值，与服务端一致。 |
| [H:/LFAA/packages/client/connection/src/api.ts](<H:/LFAA/packages/client/connection/src/api.ts>) | 通用工作区类型、Run 查询/跟随/取消/输入协议及节点任务输出接口。 |
| [H:/LFAA/packages/api/remotes/src/route-contracts.ts](<H:/LFAA/packages/api/remotes/src/route-contracts.ts>) | 通用 appId、执行预算、语音与 MCP 设置的服务端校验。 |
| [H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx](<H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx>) | 预算、子模型、MCP、语音控制与准确的现有设置说明。 |
| [H:/LFAA/packages/core/agent-loop/src/execute-turn.ts](<H:/LFAA/packages/core/agent-loop/src/execute-turn.ts>) | 独立模型/工具执行循环、原始证据检查点、授权、真实委派与 MCP 调用。 |
| [H:/LFAA/packages/core/agent-loop/src/runs.ts](<H:/LFAA/packages/core/agent-loop/src/runs.ts>) | 后台 Run 生命周期、事件订阅、排队/引导/取消与子任务树约束。 |
| [H:/LFAA/packages/core/agent-loop/src/index.ts](<H:/LFAA/packages/core/agent-loop/src/index.ts>) | 服务依赖和卸载回收、重启时中断未完成 Run。 |
| [H:/LFAA/packages/core/agent-loop/src/runtime.ts](<H:/LFAA/packages/core/agent-loop/src/runtime.ts>) | 通用任务系统提示、Skills 使用与权限约束保留。 |
| [H:/LFAA/packages/core/agent-loop/package.json](<H:/LFAA/packages/core/agent-loop/package.json>) | 执行循环所需工作区依赖。 |
| [H:/LFAA/packages/core/session/src/sessions.ts](<H:/LFAA/packages/core/session/src/sessions.ts>) | JSONL 协议历史、Run 投影、排队与跟进输入，避免重复历史。 |
| [H:/LFAA/packages/api/session-controller/src/index.ts](<H:/LFAA/packages/api/session-controller/src/index.ts>) | 认证的提交/查询/跟随/取消/跟进 API 和账户隔离节点输出。 |
| [H:/LFAA/packages/api/session-controller/package.json](<H:/LFAA/packages/api/session-controller/package.json>) | 控制器的身份与节点任务查询依赖。 |
| [H:/LFAA/packages/core/tools/src/business-tools.ts](<H:/LFAA/packages/core/tools/src/business-tools.ts>) | 组合通用项目、已有 App、主机、委派及已启用插件工具。 |
| [H:/LFAA/packages/core/tools/package.json](<H:/LFAA/packages/core/tools/package.json>) | 消除工具对模型循环的类型反向依赖，声明 Ajv 参数校验依赖。 |
| [H:/LFAA/packages/core/tools/src/project-tools.ts](<H:/LFAA/packages/core/tools/src/project-tools.ts>) | 设置驱动的真实节点项目文件工具。 |
| [H:/LFAA/packages/core/tools/src/registry.ts](<H:/LFAA/packages/core/tools/src/registry.ts>) | 可执行插件工具登记、冲突拒绝、撤销与卸载后拒绝执行。 |
| [H:/LFAA/packages/core/tools/src/index.ts](<H:/LFAA/packages/core/tools/src/index.ts>) | 通过 Cordis 工具服务公开可执行插件登记接口。 |
| [H:/LFAA/packages/core/tools/src/mcp-tools.ts](<H:/LFAA/packages/core/tools/src/mcp-tools.ts>) | HTTP MCP 握手、发现、分页、JSON/SSE、输入校验、真实结果与取消。 |
| [H:/LFAA/packages/settings/settings/src/preferences/service.ts](<H:/LFAA/packages/settings/settings/src/preferences/service.ts>) | 账户应用偏好允许 workspace。 |
| [H:/LFAA/packages/core/agent/src/extension-registry.ts](<H:/LFAA/packages/core/agent/src/extension-registry.ts>) | 扩展应用范围类型允许 workspace。 |
| [H:/LFAA/packages/boot/app-boot/src/ai-host.ts](<H:/LFAA/packages/boot/app-boot/src/ai-host.ts>) | 插件宿主应用上下文允许 workspace。 |
| [H:/LFAA/packages/storage/storage-domain/src/configuration.ts](<H:/LFAA/packages/storage/storage-domain/src/configuration.ts>) | 偏好配置白名单允许 workspace。 |
| [H:/LFAA/packages/storage/storage-sqlite/src/database.ts](<H:/LFAA/packages/storage/storage-sqlite/src/database.ts>) | 事务化版本 32 约束迁移，保留索引、记录和外键。 |
| [H:/LFAA/packages/storage/storage-domain/src/migration.ts](<H:/LFAA/packages/storage/storage-domain/src/migration.ts>) | 完成旧文件存储迁移后衔接版本 32。 |
| [H:/LFAA/packages/bundle/base/cordis.patch.yml](<H:/LFAA/packages/bundle/base/cordis.patch.yml>) | 确保 Agent Loop 等待会话和工具服务再初始化。 |
| [H:/LFAA/packages/client/ui-layout/src/Workbench.tsx](<H:/LFAA/packages/client/ui-layout/src/Workbench.tsx>) | 通用任务路由、首页入口、草稿/背景/通知映射。 |
| [H:/LFAA/packages/client/ui-renderer/src/App.tsx](<H:/LFAA/packages/client/ui-renderer/src/App.tsx>) | 独立聊天默认路由和 workspace 的 AI 模式偏好。 |
| [H:/LFAA/packages/client/ui-chat/src/AiWorkChat.tsx](<H:/LFAA/packages/client/ui-chat/src/AiWorkChat.tsx>) | 后台跟随、排队/引导、显式取消、重连入口及语音交互。 |
| [H:/LFAA/packages/client/ui-chat/src/voice.ts](<H:/LFAA/packages/client/ui-chat/src/voice.ts>) | 真实浏览器语音能力适配、语言映射和停止清理。 |
| [H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx](<H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx>) | 通用工作区、真实节点文件入口和设置驱动的输出面板位置。 |
| [H:/LFAA/packages/client/ui-workspace/src/TaskTerminal.tsx](<H:/LFAA/packages/client/ui-workspace/src/TaskTerminal.tsx>) | 当前账户节点任务状态、退出码和真实输出。 |
| [H:/LFAA/packages/client/ui-workspace/src/module-workbench.css](<H:/LFAA/packages/client/ui-workspace/src/module-workbench.css>) | 节点任务输出滚动布局，复用主题与代码字体令牌。 |
| [H:/LFAA/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx](<H:/LFAA/packages/client/ui-sidebar/src/GlobalNavigationRail.tsx>) | 通用工作区全局导航名称映射。 |
| [H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts](<H:/LFAA/packages/jobs/jobs/src/ai-host-tasks.ts>) | 项目文件任务能力校验、可见能力和账户任务摘要。 |
| [H:/LFAA/packages/host/daemon/src/daemon.mjs](<H:/LFAA/packages/host/daemon/src/daemon.mjs>) | 上报项目文件能力，经认证队列用 Node 标准输入执行文件任务。 |
| [H:/LFAA/packages/host/daemon/src/project-files.mjs](<H:/LFAA/packages/host/daemon/src/project-files.mjs>) | 真实文本/摘要/唯一锚点/Git/项目 Skills 执行及路径边界。 |
| [H:/LFAA/apps/cli/tests/agent-runtime.test.mjs](<H:/LFAA/apps/cli/tests/agent-runtime.test.mjs>) | 长期回归断线、账户隔离、证据恢复、预算、跟进、子任务与取消。 |
| [H:/LFAA/apps/cli/tests/project-files.test.mjs](<H:/LFAA/apps/cli/tests/project-files.test.mjs>) | 长期回归真实项目文件、冲突、越界、BOM 与 Skills 发现。 |
| [H:/LFAA/apps/cli/tests/mcp-tools.test.mjs](<H:/LFAA/apps/cli/tests/mcp-tools.test.mjs>) | 长期回归本机真实 HTTP 协议、SSE、输入拒绝、错误及取消不重放。 |
| [H:/LFAA/apps/cli/tests/harness-agent-api.test.mjs](<H:/LFAA/apps/cli/tests/harness-agent-api.test.mjs>) | 长期回归完整装配、真实账户认证、配置接入、断线与输出隔离。 |
| [H:/LFAA/apps/cli/tests/file-storage.test.mjs](<H:/LFAA/apps/cli/tests/file-storage.test.mjs>) | 现有存储回归更新到版本 32 的迁移合同。 |
| [H:/LFAA/pnpm-lock.yaml](<H:/LFAA/pnpm-lock.yaml>) | 同步本轮调整的工作区和 Ajv 依赖。 |
| [H:/LFAA/docs/系统总体架构.md](<H:/LFAA/docs/系统总体架构.md>) | 明确通用智能体定位、新运行链与实际能力边界。 |
| [H:/LFAA/docs/开发计划.md](<H:/LFAA/docs/开发计划.md>) | 六条通用任务开发主线及本轮交付/后续验收。 |
| [H:/LFAA/docs/harness-agent-delivery.md](<H:/LFAA/docs/harness-agent-delivery.md>) | 本轮完整文件、设置、验证与剩余事项清单。 |

