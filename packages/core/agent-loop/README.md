# LFAA Agent Loop

## Pi Agent Core 回合执行器（2026-10-25）

AI 员工办公室从本包读取按账户过滤的活动 Run 摘要。Run 保留真实员工 ID、标签、父 Run、排队/运行/暂停状态及最近三条公开活动标题；不会返回活动详情、原始工具参数或 Provider 隐藏推理。专家子 Run 的名称来自已加载的登记专家，通用子 Run 的短标签由已校验的委派工具提供。构建写入仓库根 `dist/packages/core/agent-loop/`。

Pi `@earendil-works/pi-agent-core` 是默认 AI Run 的唯一回合调度器，负责模型响应和工具调用之间的单次运行状态机；本包通过 `pi-runtime.ts` 把它嵌入既有 Owner 边界。Pi 只接收本次 Run 的临时消息与工具对象，工具执行设为串行；没有 Pi CLI/RPC、默认本机工具、独立 Provider 选择或 Pi Session 持久化。

Pi 的自定义 `streamFn` 每次都调用 LFAA 注入的 `lfaaLlm` Service。LFAA Settings/凭据继续决定账户、Provider、模型、超时/重试、上下文/输出预算与压缩；LFAA Tools 继续校验参数、范围与 Permission Owner 授权；审批、用户提问、暂停/取消、运行事件和 Session JSONL 仍由原 LFAA Owner 处理。Pi 工具回调只转入现有 LFAA Tool 执行函数，Pi 生成的会话状态在 Run 结束时释放。

Claude SDK 子 Agent 的 MCP handler 通过 `AiBusinessToolContext.dispatchExternalAgentTool` 回到同一个工具执行闭包，不直接调用 Registry executor。Agent Loop 按父 Run 继承目录公布原 JSON Schema；SDK 内层 action 重新检查工具合同、参数 parser、权限风险、预算、防重、取消与真实结果记录。MCP 的 action/observation 配对属于 SDK 子对话；内部调用写入 LFAA 工具审计，但不向父 Session 追加缺少 assistant tool_calls 的 tool 消息。权限审批仍由同一个 Permission Owner 等待和决定。

Claude SDK result 的 `modelUsage` 由 Subagent Tool 桥按 Provider/模型记入现有 Session `usage/record`，标记 `purpose=subagent`。Session 累计用量包含这些 token，普通消息仍只展示父助手本轮 Provider 用量；SDK 的估算费用不作为实际成本记录。

图片原文和 Provider 私有 `providerReplay` 只沿 LFAA 当前请求适配在内存中转交，不复制进 Pi 长期状态、普通活动或 Session 明文；上下文压缩和溢出仍在 LFAA 发起 Provider 请求前执行。成本、用量和模型错误只采用 LFAA Provider 实际回报，Pi 的必填成本字段仅用于其内部模型描述，不用于计费或产品展示。

2026-10-16：第一方子 Agent 工具通过原 delegateSubagent 桥增加进程内后台执行，继承主/子模型、数量/深度、项目、工具范围、写操作拒绝状态和取消。父回复正常完成时子 Run 继续；取消/超时不计为成功。驱动及持久化归原 Subagent/Session Owner，不增加第二套循环；外部 CLI 后台尚未接入。

领域工具经共享目录在本 Run 按需选择完整合同，App 不自动展开 Minecraft/SteamCMD/Writing/Runtime 工具；Prompt、Skill、Expert 正文由各自内容 Owner 提供，主请求不随 App 注入领域全文。模型明确传 expertId 后，原委派链才把该专家方法传给对应子 Run；继承工具范围与三种权限不扩大。设置/卸载刷新会撤销失效能力，目录不伪称已加载。

工具结果同时检查任务内和外层的未知副作用标记，取消/中断不记成成功。领域 Owner 明确确认事务前未开始且允许恢复的准备失败，只在有新的成功检查结果后允许同参数再试；失败/未知副作用与已成功写入仍受原防重和预算约束。失败和停止也保存主模型汇总用量，缺少 Provider usage 的分量保持未知，不记作零费用。浏览器真实轨迹及统计边界见 `docs/development/agent-execution-validation-20261014.md`。

AI Work 每次 Provider 请求的公开正文以稳定 ID 和起止范围标记为阶段说明或最终答案，活动首次发布时记录正文落点；不复制正文或泄露隐藏推理。`presentation` 事件、Run 实时快照及 Session 最终持久化沿用同一范围协议，使前端按实际顺序展示、重连与恢复。问题与审批沿既有 Owner 等待，原问题和实际决定随活动保存；没有实际决定时不伪造批准或拒绝。分段不决定工具调用、不替换当前模型/思考力度。

电脑操控活动在“用时”展开区分别标出观察、点击、输入、快捷键和滚动，并记录目标/坐标与有界驱动回执。桌面截图只临时交给当前 Provider、不保存在会话；输入正文不进入活动记录。截图摘要只证明图片已交给本轮模型，不证明模型正确识别画面；点击、输入、快捷键和滚动的驱动回执也不等于界面效果，必须以后续观察确认。

网页活动显示经过校验和有界遮蔽的实际搜索查询、读取/导航 URL 或工作区相对 HTML 路径；URL 移除身份凭据、查询串与片段，不显示网页正文或原始结果。MCP 活动按有界服务名和远端工具名显示具体调用，并说明回执已交回 Agent；活动摘要不复制远端原始结果正文。能力目录、来源检查、Skill 安装、清单核对与移除分别显示对应动作。Client 仅对已验证的内置 Browser Provider 提供重新打开入口；个人 Tabbit 页面不镜像到 LFAA Dock。工具类型只控制展示摘要，不决定调用或权限。

持久终端活动按真实 `create/send/read/close` 阶段显示标题；`send` 保留经过凭据遮蔽和长度限制的命令预览，`read` 只记输出字符数并将原始回执交给 Agent，不把输出正文写入活动日志。命令写入后明确标为“需读取终端回执核验”，未提交的输入不会被记成命令已运行。项目文件活动按真实操作（列表、读取、搜索、新建、修改、删除、差异、Skill 发现）显示标题和校验过的项目相对路径；工作区绝对根目录、文件正文仍不进入活动摘要。

Browser Use 只在设置中心 `browserUse.enabled` 开启后暴露 Agent 工具。模型按用户目标、Settings Owner 保存的位置偏好、当前对话/页面与真实工具状态选路：`webUrlOpenLocation` 与 `localUrlOpenLocation` 默认均为 `lfaa`，分别控制公开网页和 localhost/loopback URL；`current-browser` 只在本 Run 实际提供的个人 Browser Adapter 或 Windows CUA、且满足现有能力开关和权限时执行。所选通道不可用时 Agent 不静默改道。LFAA 内置页面的相关 `activeInWorkspace` 状态优先复用；若 Browser Owner 返回 `lfaa-native-browser` 可用且 `activeInWorkspace=true`，沿用 Electron 同一原生标签，使 Dock 由 `WebContentsView` 直接呈现；该 Provider 不可用或未绑定时，按 Host 真实能力选择隔离 Edge/Chrome。普通 Web Host 使用 LFAA Browser Owner 的连续页面流。CUA 操作不镜像到 LFAA Dock；个人 Edge/Chrome Profile 未接入时仍不可冒充 Browser Provider。当前会话绑定本机工作区时，Agent Loop 只把 Project Files Owner 的相对路径 HTML 打开回调提供给 Browser Tools；该文件预览固定使用受限 LFAA Browser Owner 页面，不把本机路径交给用户浏览器。公开活动保留浏览器工具稳定 ID 和已校验 Provider ID；Client 仅在内置浏览器工具成功后切换并展开对应 Dock，不重复导航，也不把个人 Tabbit 页面切入内置 Dock。模型还须区分打开网站与执行站内搜索：没有查询词时打开主页，不得落到任意内容详情；有查询词时核对真实结果页后再报告完成。
Browser Tools 还按 Browser Settings Owner 检查 WebMCP 网站工具默认值/来源例外，以及开发者模式和完整 CDP 开关；网站提供的定义与结果按不可信网页内容处理，网站工具执行和 CDP 均沿用危险操作及统一 Permission Owner。完整 CDP 只附着当前 LFAA 内置页面，不访问个人 Profile；页面源和用户设置必须再次在 Browser Owner 执行时校验。

当一个产品/品牌名可能同时指本机客户端与官网网页时，Agent 先用本轮文字和对话消歧；仍不明确时必须先独立调用 `lfaa_ask_user`，等用户选择“本机已安装的客户端”或“浏览器里的官网网页”后才搜索、启动或导航。权限审批不承担意图澄清。

`lfaa-agent-loop` 负责 AI Work 的模型与工具循环。对话记忆仍由 `lfaa-conversation-memory` 持有；循环只检查账户设置，把符合条件的根轮次输入发送给已选 Provider，并通过记忆 Owner 保存已校验结果。

外部 SDK 子 Agent 顶层助手文本可沿 `subagent-delta` Run 事件临时传到订阅 Client；它不进入 Session JSONL、模型 messages 或工具 observation，重新订阅只收到持久化快照和后续新事件。工具调用与最终 SDK result 仍按原 Agent Loop action/observation 合同处理。

所有文本补全通过注入的 `lfaaLlm` Service；Adapter 选择由 `lfaa-llm` 唯一拥有，分支记忆、回复后记忆及压缩摘要使用相同合同。Agent Loop 不直接导入传输函数或另建 Provider 选择表。插件卸载时由其 Cordis Fiber 撤销 Provider Adapter；仍不存在安全的任意外部插件 Client/Host 运行时。

助手消息、主 Provider 用量和 `done` 事件提交后，才开始记忆提取。提取作为有界后台后处理运行：最多同时处理 4 个账户，每个账户最多 1 个任务；请求不带工具，输出上限为 512 token，超时为 30 秒。同账户已有新轮次或本地并发上限已满时跳过提取，并在活动记录中说明原因。成功提取记为触发该流程的助手消息上的独立 Provider 用量记录。提取错误不会改变已经完成的回答。

主 Agent 回合累计这一轮全部模型请求的 prompt/output/cache-read usage，并以一个主回合 SSE 与 Session 记录发布；同时记录请求总数和 Provider 实际返回缓存读取计数的请求数，以便 UI 显示覆盖率。任一请求未上报的分量保持未知，不当成零；回复后的账户记忆提取仍保留独立用量事件，但标记为 `purpose=memory`，消息输入区的本轮统计不会将它混入主回答。

每个主 Provider 请求在 LLM Owner 组合最终 system prompt、消息/附件和工具 schema 后、网络发送前执行上下文管理；压力、compaction 和 `request/context` 观测共用 `lfaa-token-meter` 的同一估算口径，包含工具往返、每张图片的保守预留与 LLM Owner 按账户/Provider/模型计算的一次数值型 reasoning replay 字符数。无效来源的 replay 不进入预算，安全请求快照不保存隐藏 replay 正文。压缩后会同步更新本 Run 的 Pi/Agent Loop 消息和工具集；spill 执行器先登记给 Pi，读取工具只有在本 Run 产生引用后才放进 Provider 请求，system prompt 与本次临时附件不进入持久对话历史。估算与当前账户模型目录容量（缺失时读取设置中心 `aiRuntime.contextWindowTokens`）及容量来源随 `request/context` 保存；响应后以 Provider 实际 prompt Token 更新上下文总量。SSE 发送前估算、响应后实际值及会话累计用量可见；缓存读取字段始终只采用 Provider usage。模型上下文统计由共享 UI 的 `aiRuntime.showContextUsage` 控制显示。

发送前，循环会对当前用户消息和最终回答中的常见凭据、个人标识模式做本地启发式过滤；该过滤无法识别所有敏感表达，不处理工具参数、工具结果或较早的 Session 历史。Session Owner 会从持久化的模型快照中移除注入的记忆区块。

用户提问能力由 `lfaa-user-questions` 插件提供。Agent Loop 注册 `agent-run` 回答者，将问题限定到当前账户、App 与 Run，再复用 Run 已有的等待、取消和 Session 活动/工具结果记录；回答作为原 `lfaa_ask_user` 工具结果继续，不创建普通用户消息。Client 将问题卡片嵌在提出问题的助手消息下，答案留在原卡片中。回答服务不另建问题持久化或交互界面。插件卸载时撤销回答者并取消其未完成请求。

带 `session/side-chat` 来源标记的侧边聊天由 `startAiRun` 统一识别，强制空工具范围、关闭用户澄清、关闭账户记忆写入，并跳过 MCP 发现；这些限制同样覆盖 `appendAiRunInput` 创建的排队续问。侧聊 Session 的来源验证由 `lfaa-session` 提供，HTTP 路由校验由 Session Controller 执行。

普通聊天分支沿用 Agent Loop 当前账户已配置的 Provider 与 AI Runtime 设置，按所选完整回答之前的 Session JSONL 生成有界压缩记忆。摘要请求不注册或发送工具；Provider 失败、返回工具调用或空摘要时不创建子会话。真实 token 用量记在子会话的记忆事件上。后续轮次从 `lfaa-session` 恢复该检查点；账户长期记忆与普通 Run 自动压缩仍归各自原 Owner。

计划协作模式复用同一 Session 和 Agent Loop。模型可根据自然语言判断是否进入 `/plan` 计划讨论；讨论阶段只允许实际风险为 `read` 的普通工具，电脑操控与领域子 Agent 也在派发边界拒绝。模式转换优先于同一 Provider 响应里的其他工具调用，未执行调用记为 `not_started`。用户明确批准后退出计划模式，后续工具仍通过原权限模式和审批流程。

可选 AI Runtime Hook 注册表在推理前或请求路由阶段不可用时，记录对应的 `unavailable` 活动后继续当前用户已选模型账户；不会静默换账户，也不会改变工具范围、权限模式或凭据。请求路由可建议该用户账户目录中的模型 ID 与思考档位；每个提议都由 Settings/Credential Owner 按用户归属、账户的已保存 Provider 模型目录和模型能力重新解析，跨到同一账户的另一模型时默认使用 Provider 思考默认值，不改写账户偏好。未配置账户/模型或不支持的思考档位会被忽略。Hook 注册表恢复后，后续 Run 可再次使用其真实建议。

## Run 安全暂停与继续

AI Work 运行按钮通过认证 Run API 请求暂停或继续同一 Run，旁边的显式停止控件仍调用 cancel 终止当前任务。`AiRunPauseGate` 在队列开始前、Provider 响应前后和每个工具派发前/结果后提供检查点；待审批和 `lfaa_ask_user` 等待不派发副作用，可立即确认暂停，交互结果到达后仍须继续才越过检查点。暂停请求本身不 abort Provider 请求、已派发工具或节点任务，当前不可撤销操作会真实结束后再挂起执行栈。暂停期间保留原 Run ID 与模型/工具上下文；继续只唤醒原执行栈，已返回的工具结果不会重放。状态由 Run SSE 的 `pause-state` 事件发送，不使用轮询。暂停门闩只在 Control Plane 当前进程内，服务重启后的未完成 Run 仍按现有规则转为中断。

## 通用能力与请求恢复

Provider 协议归 `lfaa-llm`，MCP 协议归 `lfaa-mcp-client`。每次模型请求、工具派发及审批返回重新对账工具目录、插件说明和当前账户开关；相同 MCP 配置复用租约，变化关闭旧租约。新增能力同一 Run 的下一次请求即可使用；关闭、卸载或合同变化拒绝旧调用，保留计划工具和子 Agent 的继承范围。异步发现结束后再读最新设置，权限模式变更或记忆授权撤销时拒绝未派发操作。

若 Provider 同批返回需要用户澄清的工具和其他工具，Agent Loop 不派发该批调用；它为每个 `tool_call_id` 记录 `not_started` 并回传配对结果，让当前模型继续选择单独的澄清请求。在整批拒绝、取消或“重复被拦调用停止”路径中，已派发调用保留真实结果或 `unconfirmed`，同批尚未派发的调用记录 `not_started` 并回传配对结果，每条调用事件都有对应结果（停止前未派发项由 Loop 而非会话修复合成）。

模型臆造或写错本轮未提供的工具名（真实 Provider 已复现：把懒加载工具写成 `capability_status`、`lfaa_browser_open_workspace_file`）时，Loop 不把该调用写进 `tool/call` 证据，也不让会话内核的 request/header 校验把整轮变成致命失败；它只记录本轮正文，向模型回传一条“本轮没有提供这些工具”的可恢复纠正并重新请求。连续 3 轮仍未提供工具时以明确原因停止，避免继续消耗请求预算。`apps/cli/tests/agent-unknown-tool.test.mjs` 用合成 Provider 固化该路径。

能力状态/有限开关工具始终可见，开启仍复用现有三种权限模式。模型不得修改权限模式、凭据或节点范围，开启设置不等于目标已执行。`requestRetries`、`retryDelaySeconds` 控制无输出/无工具调用的可恢复请求；每次尝试计入 maxModelRequests，总 token 用量累计，取消可打断等待。每轮模型请求最多 64 次、工具调用最多 128 次；`aiRuntime.maxModelRequests` 与 `aiRuntime.maxToolCalls` 的 0 使用产品上限，正数可收紧，两项都在 Settings Owner 和共享设置合同中校验。每轮工具响应若整体超出剩余预算，则整批未派发并以预算终态结束。只重复 Provider 请求，不换模型。`tool-outcome.ts` 统一判定顶层与嵌套任务，失败/排队/未知结果不计为成功写入。同参数的失败/未知或成功写调用首次拦截后，将未派发反馈交回模型纠正或交付；继续重复相同被拦调用才停止。仅标明 `retryAfterRecovery` 且实际重验互斥/状态的领域工具，可在另一写工具成功后重试已确认失败；未知结果始终不重放，成功副作用仍不重复。失败签名保存有界，其他签名/修复记录受工具预算约束。工具目录更新活动只在有变化时生成；设置变更事件使 UI 合并刷新权威设置，不按流式 token 发请求。

本机及目标节点 Shell 活动会在 Session 既有活动说明中显示有长度上限、对常见凭据格式脱敏的命令预览；不写入 stdout/stderr 或原始工具结果，也不改变授权和派发路径。

Provider 请求、隐藏推理与正文接收按当前活动 ID 顺序结束；阶段只结束一次，保留真实时长，不在正文开始或整轮完成后遗留“推理中”。本机 Shell 的失败和结果未知状态由 Tool Owner 返回；循环将它们分别记为 `failed`、`unconfirmed`，不当作成功写入。Shell 标记 retryAfterRecovery，仅在确认失败且其后有新的成功写入修复时允许模型再次选择同一命令；没有修复、结果未知及成功副作用仍按原规则防重。受信任 AI Runtime Hook 可为每次请求建议模型账户及思考档位；Agent Loop 逐项通过当前账户 Settings/凭据 Owner 重新解析，只接受该用户现存账户及模型目录声明的思考档位，未配置/不支持的建议会被忽略，权限模式、工具和消息不暴露为可变字段。用量按 Provider/模型分组持久化，UI 显示真实路由结果；关闭 `plugins.enabled` 时恢复本轮起始的用户选择。此接口是 LFAA Agent 的请求路由能力，不代表 DSH bundle 已能在 LFAA 中执行。

项目文件 CRUD 活动只从成功的 Host/Daemon 文件执行结果记录操作类型和经校验的项目相对路径；Session 不保存正文、replace 片段或原始结果。Agent 绑定独立本机 Git 仓库时，文件与 Shell 默认使用该仓库，由 LFAA 本机 Host 执行；模型明确选择 Daemon 节点目标时才走节点任务。Git 上下文、文件目标与可选 Daemon 项目彼此分开，均服从同一 Agent Loop、Tool 和 Permission Owner。

`workspace` 与 `minecraft` 会话每轮从 Session Owner 读取当前项目绑定，并把经过文本转义、有界的项目标题/目录作为模型请求上下文；无绑定时也明确告知模型。上下文说明项目目录与聊天历史存储相互独立，且不会透露会话存储物理路径。文件和 Shell 工具仍从 Session 绑定准备节点/根目录，操作继续服从既有权限、路径校验和节点检查；上下文仅用于帮助模型识别当前目标，不授予权限。子 Agent 通过已验证的 Session 项目绑定继承同一上下文。

模型回复的 `providerReplay` 在同一 Run 内随 assistant/tool 配对进入下一次请求，最终回答的私有续接数据由 Session Owner 随后续轮次恢复；上下文压力计算包含实际思考续接文本。此字段不进入活动、正文、SSE 或长期记忆。游戏启动说明与 App Owner 的 query/ID 双入口一致，不再要求已明确命名的游戏先搜索/推荐，也不谎称启动只接受查询 ID；具体工具选择与核验仍由模型根据真实结果决定。

## 小鱼共享工作入口（2026-10-14）

小鱼沿用唯一模型循环与用户主/子模型配置。关联引用进入每次请求，不自动加载正文或扩大工具范围；子 Agent 项目重验当前账户/节点/路径，原暂停/取消/审批/结果未知防重保持。

构建只写仓库根 dist/packages/core/agent-loop/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

Settings Center 操作遵循模型→`lfaa_settings_list`/`lfaa_settings_update` 或已登记领域 Tool→Settings/领域 Owner→Permission Owner 的真实链路。目录只向当前账户返回有界、非秘密偏好；写入按 Settings Owner 叶字段校验回读。权限模式始终由用户掌握，设置更新成功后沿用现有 `capability-settings` 事件通知 Client 合并刷新权威设置。模型不得把设置工具派发当成菜单动作或目标能力已执行。

设置中心 AI Runtime Hook 查询只注入 `aiPluginHost.listHooks()` 的读取闭包；不注入插件回调、源码或生命周期写入能力。目录调用继续沿现有工具发现与 Permission Owner 读取流程运行。

Agent 每轮在首个 Provider 请求前通过 Identity/Auth Owner 预留账户使用时长。策略启用时，当前本地时区窗口和每日剩余额度共同决定本轮最大运行时长；同一账户并行 Run 通过 SQLite 事务预留避免超额。限制在 Provider 与工具执行时沿现有取消信号传播，回合结束按实际持续时间结算；用户主动停止与家长控制到限分别如实展示。没有策略或策略关闭时不改变既有运行行为，也不更改 `permissions.mode`。

当设置中心 `aiRuntime.autoCompaction` 开启且上下文压力达到溢出阈值时，Agent Loop 将符合 spill Policy 的较早大型工具结果写入当前 Run 的本机临时 Store，并只把不透明引用放进本次 Provider 请求视图。模型需要原文时，Loop 才向当前 Run 提供 `agent_context_read_spill`，通过 spill-local 的稀疏 UTF-8 字节索引流式回读，按 Unicode 字符偏移返回有界片段；单次最多 16,384 个字符。读取仍经已有 Tool/Permission Owner，引用绑定账户、App、Session 和 Run。成功、失败或取消进入 `finally` 时回收临时会话目录；引用不进入 Session 持久化或跨进程恢复。该能力不改变原始历史/事件记录，也不构成持久化正文的全量裁剪。压缩或溢出钩子失败、取消时不会伪造“已缩减”结果：记录诊断后继续主循环，原始历史与后续 Provider 请求不受影响；用户附件图片只进入用户可见的主请求视图，不随内部摘要请求重复发送。

新 Run 从 Client 接收 `workspaceView` 后，由 Agent Loop 重新校验面板和布尔字段，仅生成非权威界面提示；Browser URL 再按当前 Settings Owner 的 `browserUse.enabled` 做双重门控并移除凭据、查询和片段。侧边聊天不继承该上下文。工具仍由本轮真实目录、设置和统一 Permission Owner 决定。
