# Pi Agent Runtime 接入 LFAA 核心循环（2026-10-25）

## 用户目标与当前表现

- 用户要求把 Pi Agent Runtime 作为 LFAA Agent Loop 的底层，选择了“Pi Agent Runtime 承载或替代 Agent Loop”。
- 当前 Agent Loop 位于 `packages/core/agent-loop`，多个 API、工作流与 App Profile 都通过同一套 `startAiRun`/`executeAiTurn` 接入；模型请求、循环、工具执行、运行事件与 Session 证据由 LFAA 组合。
- 目标是在保留 LFAA 产品合同的前提下，使用 Pi Agent Core 提供底层模型/工具回合运行机制，不形成双循环或 Pi Coding Agent 平行入口。

## Owner、运行入口与设置

- 唯一运行 Owner：`packages/core/agent-loop`；公开的 `startAiRun`、`executeAiTurn` 与 API/工作流/菜单入口保持原合同。
- Pi 执行器：使用 Pi 官方 `@earendil-works/pi-agent-core` 嵌入式 Agent API；不引入 Pi CLI、`pi-coding-agent`、Pi RPC 子进程或第二个产品入口。
- Provider/凭据 Owner：LFAA `settings`、`credentials` 与 `llm`；Pi `streamFn` 适配到当前 LFAA Provider 解析与 `streamAiCompletion`，不使用 Pi 自有模型选择、AuthStorage 或密钥目录。
- Tool/权限 Owner：LFAA `tools`、领域 Tool、`permissions.mode` 与 Permission Owner；Pi 执行工具时只能调用 LFAA 已登记并在当前 Run 可见的 Tool，审批仍经原权限执行链。
- Session/数据 Owner：LFAA `session` 的 JSONL、Run 状态和持久证据；Pi Runtime 只持有单次 Run 需要的临时 Agent 状态，不创建 Pi Session 文件或第二份长期历史。
- 设置：沿用系统级共享 Provider/模型配置，以及账户级 `aiRuntime`（上下文、输出、超时、重试与速度等）、`autoCompaction`、`permissions.mode` 及相关能力设置；不新增 Pi 专属设置，不重置用户偏好。模型凭据不与 LFAA 登录账号绑定，数据归属和迁移见[系统模型配置分离合同](system-model-config-scope-20261025.md)。

## 允许与禁止

- 允许：在 `packages/core/agent-loop` 内增加 Pi Agent Core Runtime 适配；将 LFAA 当前 stream、消息、工具和运行事件映射到 Pi Agent Core；更新该包依赖/README、直接回归、装配与事实文档。
- 允许：按实施结果分阶段迁移，但每个已切换运行入口必须始终只有一个有效 Agent Loop。
- 禁止：装配 Pi CLI/RPC 作为平行执行入口；启用 Pi 内置本机工具、独立 Skills/Extensions 自动发现、Pi 自有设置/凭据/Session 持久化或 Provider 静默回退。
- 禁止：绕开 LFAA 的认证、参数校验、账户/App/节点范围、三种权限模式、操作授权、请求/工具预算、取消/暂停、未知结果与副作用防重合同。
- 禁止：触碰本轮开始前已有的画布、附件、设置和其他未提交工作；不得重置、暂存或清理这些改动。

## 可观察验收条件

- 默认装配中的 LFAA AI Run 由 Pi Agent Core 承载模型回合和工具调用；旧手写回合不再作为可选备用循环或静默降级路径。
- 同一 LFAA Provider 解析与凭据、设置、Tool 目录与执行 Owner、Session JSONL、审批/提问、额度/预算、取消/暂停和结束状态均保持单一权威实现。
- 定向回归覆盖普通回答、流式输出、多轮工具往返、并发工具批、未知/未提供工具、参数拒绝/审批/用户提问、失败/未知副作用、上下文管理与附件、请求/工具预算、取消/暂停、Session 证据。
- 运行 `pnpm run typecheck`、受影响包构建、`pnpm run check:workspace` 与直接相关回归；同步/清单仅在包、装配或依赖变化时执行。全部真实 Provider、Daemon、桌面与浏览器验收范围需如实记录。
- 报告新运行时相对原循环的请求/工具事件开销、订阅/清理路径和当前回归规模；不把源码/构建结果描述为真实 Provider 或帧时间验收。

## 实施记录

- 状态：Pi Agent Core 已成为 `executeAiTurn` 的唯一模型/工具回合执行器；LFAA 现有工具校验与派发函数、Provider、Settings、Permission 和 Session Owner 继续执行原合同。
- 初步边界：采用 `pi-agent-core` 而不是 `pi-coding-agent`，避免把 Pi 自己的文件工具、Provider 注册、权限提示策略、Session Manager 与 Skill/Extension 自动发现带入 LFAA 产品运行树。
- 依赖：`packages/core/agent-loop/package.json` 与锁文件固定 `@earendil-works/pi-agent-core`、`@earendil-works/pi-ai` `1.4.0` 和 `typebox` `1.3.27`；Pi AI 作为嵌入式消息/流类型及 Agent Core 依赖使用，不直接调用其 Provider SDK、凭据或模型注册表。安装脚本保持禁用；工作区显式将本次依赖解析提示的 `@google/genai` 与 `protobufjs` build scripts 标为 `false`。
- Pi 接缝：Provider 请求通过 LFAA `streamCompletion` 与自定义 Pi `StreamFn`；运行中工具由 Pi 串行派发，但每一调用仍进入 LFAA 现有的参数/Joi校验、权限/审批、领域 Tool 执行、Session 配对结果与取消控制。未提供工具整批拒绝；请求/工具预算在派发边界闭合证据后停止。
- 图片正文在 Pi 临时消息里只留占位文本，LFAA `AiCompletionMessage` 原始对象沿请求适配以维持 Provider 图片合同，并由 LFAA 图片裁剪逻辑管理生命周期；`providerReplay` 也只通过临时映射回到当前 LFAA 请求。
- 回归：Pi 适配器与既有 `agent-runtime.test.mjs` 合计 9/9 通过，覆盖串行工具交接、未提供工具批次拒绝、原始 Provider 错误、流式循环与取消。Agent 溢出、Session JSONL 持久化、审批、提问和 LLM Provider 组合回归 29 项通过。另一个完整 Harness 组合测试 85 秒超时：失败点为 Windows `local_execute_command` 启动沙箱内 `node --check`；复现时 Sandbox Host 在目标子进程启动前持续占用 CPU，故该项不计通过。
- 构建/静态检查：`pnpm run typecheck` 通过；全量构建通过，218 个能力包进入根 `dist/packages`，正式 Web 构建 3865 modules、Control Plane 与 CLI 构建成功；重建 Web 后 `node scripts/runtime-build-state.mjs web` 为 `[]`。`pnpm run check:workspace` 失败于既有 `docs/PROMPTS.md` Compact 任务链接 `#lfaa-compact-application-center-anchor-20261025` 缺少本文件目标路径；本轮未改无关合同链接。
- 内置浏览器：正式 `http://127.0.0.1:3000/work`，视口 1280×720。首屏控制端连接正常，当前账户模型可见；首个点击只完成默认工作区初始化（HTTP 200）。随后一条只读 `lfaa_tools_list` 验证提交到 `/api/ai/chat/stream` 后返回 HTTP 409，界面提示 `Failed to fetch`；同步 submit/startAiRun 失败，未进入 SSE、Pi 或真实 Provider 回合，也未收到会话/Run 事件或工具轨迹。该轮没有更改模型、Provider 凭据、权限、AI Runtime 或其他用户偏好。CUA 截图记录了 1280×720 的 `/work` 空白输入页、控制端连接和当前模型；失败提示在页面重新显示前短暂可见。
- 资源/性能：每轮只创建一个 Pi Agent；工具执行设为 sequential；结束 `finally` 移除 AbortSignal 监听、清空 Agent queues 并 unsubscribe。适配器内部不启动额外轮询/订阅；未测旧循环与 Pi 的真实延迟差值、浏览器帧时间、Daemon 或桌面。
- 完成边界：Pi Core 已是唯一模型/工具回合执行器，未提供第二套回退循环。真实 Provider/Agent Run 端到端仍未验（提交在 `startAiRun` 前置阶段返回 409），需先定位当前账户的 Run 提交失败后再用 `/work` 复测。

## 后续故障排查（2026-10-25）

- 用户反馈 `/work` 连对话也无法使用，怀疑核心代码被删除；当前 Git 工作树未发现已跟踪文件删除，`runs.ts`、`session-controller` 与 `AiWorkChat.tsx` 也没有用户侧删除记录。
- 运行入口仍为内置浏览器 `http://127.0.0.1:3000/work`，服务端由当前 checkout 的 CLI `web --no-local-daemon` 启动；本轮观察到 API 监听与认证只读路由可用，当前 Provider/模型状态为 DeepSeek `deepseek-flash`，用户当前项目登记显示存在。没有改动 Provider、凭据、`aiRuntime`、权限或项目设置。
- 新的 `/api/ai/chat/stream` 实际提交仍在 3–6ms 内返回 HTTP 409、`ai_run_submission_failed`，没有创建 Session、SSE、Pi Run 或触发 Provider 用量；`control-plane.log` 不记录 409 的具体 message。设置中心显示运行时宿主已就绪、160/160 模块已加载、当前 Provider 可推理，SQLite schema 版本 69 且会话表列齐全，仍需依据可见错误继续定位同步提交拒绝原因。
- 已确认一个客户端错误提示回归：`AiWorkChat.tsx` 的会话加载 effect 在 `busy` 由 `true` 变为 `false` 后无条件清空 `error`，会把发送失败 `catch` 设置的服务端原因立即隐藏。先修正此错误清理时机，再在真实 `/work` 复测以取得具体错误。Owner 是 `packages/client/ui-chat`；沿用设置中心的 Provider/模型、`aiRuntime` 与 `permissions.mode`，无新增配置。

### 复测结果与凭据恢复保护

- 当前 `C:\Users\yu\.lfaa\credentials\settings.key` 是 2026-10-25 17:11:15（本地时间）生成的 32-byte 密钥；现存 DeepSeek 账户元数据记录于 2026-10-20，密文比该密钥早五天。该文件生成时间与首次 HTTP 409 对话提交时间相差不到一秒，说明读取旧账户时本地旧密钥已缺失，旧代码在解密路径静默生成了替代密钥。当前 credentials 目录无该文件的备份；只凭密文无法还原旧 API Key。未读取或输出密钥、密文内容。
- 复测实际错误为 Node AES-GCM 完整性校验失败 `Unsupported state or unable to authenticate data`；提交在 Provider 请求之前同步失败，没有创建 Session/Run、没有连接 DeepSeek，也没有发生 Provider 用量。源码没有被删除。当前浏览器里的登录账户仍显示 `admin / 超级管理员`；本轮没有修改用户密码、账户、权限或设置。
- 修正 `packages/settings/settings/src/service.ts`：凭据解密发现 `credentials/settings.key` 缺失时拒绝自动创建替代密钥；显式保存新凭据仍可创建密钥。Provider 旧密文认证失败时，返回重新录入 API Key、测试后设为当前账户的可操作提示，并保留旧账户记录。
- 修正 `packages/client/ui-chat/src/AiWorkChat.tsx` 的错误清除时机：失败提示仅在切换应用/会话或新会话时清空，不再随发送状态结束消失。
- 回归扩展 `apps/cli/tests/ai-model-catalog-refresh.test.mjs`，在临时 LFAA Home 覆盖密钥缺失时不自动重建、密钥错配提示、显式录入新账户后新凭据可解密且旧账户记录保留；`node --test apps/cli/tests/ai-model-catalog-refresh.test.mjs` 通过 1/1。`pnpm run typecheck`、`pnpm run build:control-plane`、`pnpm run build:web` 与 `git diff --check` 通过；`node scripts/runtime-build-state.mjs web` 和 `control-plane` 均为 `[]`。本次没有新增配置，沿用当前 DeepSeek `deepseek-flash`、默认工作区与现存 `permissions.mode=完全权限`，未改写这些值。
- ChatGPT 内置浏览器验收（初次）：正式 `http://127.0.0.1:3000/work`，1355×925；重启当前 checkout 的 CLI Web 后控制端已连接。发送“请只回复数字 2，不调用任何工具，用于验证对话。”后，页面如实显示中文恢复提示；当时没有进入 Provider 推理/Pi Run。该轮证据和错误提示记录为历史状态，后续复验见下文。
- 登录边界：`admin / 123456` 是 LFAA 用户登录账户，不是 DeepSeek Provider 凭据。当前内置浏览器会话显示 `admin` 已认证；本轮未登出或改动该账户，也未单独对新会话重新验证默认密码。此前对话失败源自 Provider 加密密钥；当前运行状态另见复测记录。

### 真实 Agent Loop 与 Skill 复验（2026-10-25）

- 以当前源码重新构建并通过正式 CLI 启动 Web 后，内置浏览器 `/work` 主聊天通过现存的系统级 DeepSeek `deepseek-flash` 配置成功完成普通模型回合：发送“请只回复：LFAA 主聊天测试成功。”，约 1 秒后原文返回，页面记录 `deepseek / deepseek-flash`。此前 409 本轮没有复现；本轮没有替换 API Key，因此不能断言此前到现在的环境状态变化来自哪项配置。
- 主聊天随后根据 Minecraft 相关目标自主调用“发现可用 Skill”和“按需加载 Skill”两类工具，找到并读取已随包登记的 `minecraft-server-setup`，再基于其正文回答部署前检查清单。模型的实际 Tool 结果显示当前 Run 没有 `minecraft_*`/`runtime_*` 工具，因此只读说明而没有操作服务器。
- `minecraft-server-setup` 是包内置 Skill，本轮无需也未从外部安装。内置浏览器 `/settings?section=ai` 1355×925 与 390×740 均已核对系统共享说明、当前模型和窄屏布局；`/work` 的主聊天和 Skill 加载结果已目视核验。没有修改 API Key、权限、aiRuntime 或外观设置；未实测 Desktop WebView、真实 Minecraft 节点操作及帧时间。
