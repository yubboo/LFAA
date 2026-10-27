# LFAA Session 内核

用户消息的附件引用随 JSONL 消息记录保存，普通历史展示读取保留 `attachments_json`；缩略图内容继续从附件 Owner 认证接口读取，不将图片字节写入消息展示投影。

2026-10-16：`subagent/task` 事件保存子任务不可变来源、前台/后台模式、真实状态及有界结果。`listAiSubagentTasks/saveAiSubagentTask` 校验账户与父 Run/会话归属；每会话增量派生最多 64 项索引并优先保留活动项，终态不可回写为运行中。答案上限 64000 字符、诊断 4096 字符是存储合同，不改变模型输出偏好。不记录凭据或复制子任务工具/隐藏推理。重启后结果沿原 JSONL 读取，未完成任务报告中断且不重放。

公开助手消息可携带 `parts`（稳定 ID、连续正文范围及阶段/最终类型），活动可携带首次正文落点及原审批问题/真实决定。内核校验范围数量、连续性和长度，消息投影白名单输出安全字段；正文仍只保存一份。浏览器工具活动可公开受校验的 `toolId` 与 `browserProviderId`，供 Client 在成功后切换到同一 Browser Owner Dock；工具活动还可携带经边界校验的函数用途、参数字段说明和最多 8 个真实执行阶段，不含调用参数值、原始工具结果、网页正文或 Provider 私有数据。便携导出对公开工具说明和阶段文字脱敏本机路径。JSONL 重新加载、分页和同账户分支恢复这些展示事实，原记录缺失时不制造分段。Provider 私有续接数据仍不进入公开消息或 SSE。

`lfaa-session` 是 LFAA AI Work、Agent Loop 与会话 API 共用的唯一 Session Owner。Session 事件、消息、活动和用量沿用 `lfaa-session-persistence-jsonl` 的账户隔离 JSONL 事务日志；SQLite 继续保存授权查询所需的会话头投影。没有另建服务、数据根或 UI。

进程恢复发现开放 turn 时，Session Owner 在同一 JSONL 事务中将助手消息标记为 `interrupted`，把仍运行、待审批或待回答的活动标记为 `unavailable`，再为开放工具调用记录 `unconfirmed` 或 `not_started` 并结束 turn。未知副作用不标记成功、不盲目重放；重复读取不会重复修复。

若旧恢复已经记录 `turn/end: interrupted`，但消息投影尚未写回，Session Owner 仍会幂等修正助手状态和未结束的活动卡片，不重复创建工具结果或结束事件。Provider/Agent 运行失败则以 `turn/end: error` 结束；开放工具仍按已派发/未派发分别补为 `unconfirmed`/`not_started`，消息状态保持 `error`。

同一 Session 后续开始新 Run 时，`historyForTurn()` 会从受保护事件日志附加有界恢复检查点，逐项列出最近最多 16 个工具名与执行状态，不包含参数、结果正文或隐藏推理，且总文本限制为 6000 字符。它明确作为历史状态背景，不构成新用户请求、操作授权或重放许可；`unconfirmed` 必须先只读核验，`not_started` 只能按当前目标与权限重新决策，已完成调用应核对状态以避免重复副作用。Session 不自动续跑旧 Run。

消息页同时读取会话累计 Provider 用量和最新模型上下文快照；所有数值来自 `usage/record`、`request/context` 与模型响应事件，响应上下文总量使用 Provider prompt Token，文本/工具分项保留估算标记。缓存请求数及有缓存读取计数的请求数按 Provider/模型持久化；当前账户所有权仍由 Session Owner 校验。

## 内核能力

- `kernel.ts` 提供带连续序号、普通 JSON 快照和深度冻结的类型化追加日志；拒绝循环/稀疏/非有限/非 JSON 值、跳号、非法事件和重入追加。LFAA 沿用现有事件格式，用 1 起始序号、事件 UUID、Session ID 和 ISO 时间；DSH 源格式使用 0 起始序号与数字时间。
- `SessionKernel` 增量维护无损 Surface：支持 append、按当前顺序的闭区间 replace、来源事件引用和首个 system 节点保护；保留活动请求 Header/Context、历史工具 Schema、动态增删 Tool 更新、模型回复流、失败 Attempt、轮次状态与用量。Surface 派生历史在无变化时复用冻结缓存，完整持久事件仍由唯一 JSONL Owner 保存。
- Agent Loop 在网络请求前持久化 Provider 实际可见消息和工具 Schema（剔除 URL、认证头和密钥）；成功/失败的模型尝试、可见输出片段、工具派发/结果、活动、结束状态和 Provider 实际用量都来自真实执行边界。项目文件成功 mutation 的活动只记录操作枚举、Daemon 校验的项目相对路径和可空项目 ID，不保存文件正文或原始结果；消息投影会校验并限制这些路径。原始协议仅保存在受保护 Host 持久层，不由普通消息展示 API 或 DSH Client 插件读取。
- 普通回答分支由 Agent Loop 调用当前 Provider 整理截至目标回答的有界记忆；Session Owner 的 `prepareAiSessionBranchSeed()` 仅构造摘要输入，`createAiSessionBranchWithMemory()` 仅保存版本化记忆事件、真实 Provider 用量及来源关系，子 Session 不复制父用户/助手/工具事件。`historyForTurn()` 每轮从 JSONL 恢复该记忆作为历史背景，嵌套分支可继续整理已有记忆与新对话。记忆摘要失败时不创建子会话。Workspace Owner 验证受管 AI Worktree 后可传入目标项目上下文，并在同一事务中绑定项目。`forkAiSession()` 的精确事件前缀能力仅供编辑问题截断与侧聊快照使用；未配对 Tool 调用按“未派发”或“派发后结果未知”闭合，恢复不会自动重放副作用。
- `forkAiSessionForSideChat()` 在主会话仍有活动 Run 时，按最新已记录事件建立独立快照，并以 `session/side-chat` 标记记录来源 Session 与快照序号；不复制内存中的未持久化流内容、不修改源 Session。`getAiSideChatParentSessionId()` 只对当前账户拥有的 Session 返回来源关系，由 Agent Loop 统一 Run Owner 执行无工具、无用户澄清及无账户记忆写入限制。
- AI Work 首屏消息页优先复用 JSONL 完整校验重放形成的有界展示投影；投影缺失或文件版本变化时回到完整单遍扫描读取 `session/end-seed` 或 `session/branch-memory` 来源。Session Owner 仅在父会话仍属于当前账户且 App 相同时返回父会话投影。归档或已删除的父会话不产生可导航来源，历史记录不回写。
- 设置中心的 AI 用量页通过 `getAiUsageSummary()` 读取 JSONL Owner 在完整重放和受控提交期间维护的账户/Provider/模型汇总，不逐次恢复全部会话或逐条用量记录；总量和 `null` Token 语义保持原样。
- 会话列表的关联引用投影附着于已有的轻量会话头，并随经过校验的 JSONL 重放/事务更新；列表上限 200 条，投影不会因缓存淘汰退化成逐会话完整日志读取。
- 已完成助手消息的反馈以 `message/feedback` 事件保存在同一账户隔离 JSONL 中；每条消息最多一条，理由与补充文本有长度上限，消息投影只向该会话 Owner 返回。反馈事件不进入模型上下文或消息正文 Surface。
- 计划协作模式以 `session/plan-mode` 事件持久化，读取最新事件恢复当前状态并投影到会话列表；账户归属、归档状态、侧聊来源和活动 Run 均在状态变更入口校验。精确前缀派生保留其事件状态；新建记忆分支会单独继承源会话当前计划状态，不复制旧事件。
- `SessionStore` 提供 create/restore/prepare/publish/get/list/fork/flush/drop 生命周期，默认 LRU 最多保留 32 个实时对象；`flush()` 等待持久层屏障。LFAA JSONL 每笔事务在返回前 `fsync`，提交失败后拒绝继续写入，须重启并重放。
- `getAiSessionMessagesPage()` 为消息 API 提供账户归属检查后的 1–100 条游标页，按 `(created_at, _order)` 稳定向前翻页；反馈随消息页投影。UI 主聊与侧聊均可加载更早记录并保持视口。最近 100 条展示投影最多跨 128 个会话且总计不超过 16 MiB；文件指纹不符、缓存缺失或读取更早页面时，异步单遍扫描仍校验该会话完整哈希链，工作集使用 64 KiB 读取块、一条当前事件和至多 101 个候选消息。取消信号可终止扫描。冷页 CPU 与磁盘读取量仍随会话增长，索引/压缩/沉降与真实长会话时间/内存测量未完成。
- 旧会话首次由 Session Owner 读取时，以原消息、活动、内部工具历史、用量和项目元数据幂等生成事件并校验提交；原记录不改写或删除。老记录缺少请求 Header、精确 Provider 输入流和完整工具定义，导入不会推断缺失事实。读取最新消息状态只投影展示字段，不复制整段 `model_history`。
- Agent 澄清答案保存在助手活动和 `lfaa_ask_user` 工具结果中，不产生普通用户消息；后续轮次只把校验通过的 assistant tool-call/tool-result 配对带回模型，不将答案改写为 `role:user`。

## DSH 来源与适配边界

行为参考 `H:\deepseek-harness\packages\core\session`，基线 commit `639ed015397290b3745d163aafe02ffee4aa3f84`。本实现适配其追加事件、序列/不可变校验、Surface、Header/Context、Tool History、精确前缀 fork、未决 Tool 修复与 flush 语义到 LFAA 的 TypeScript/JSONL/账户/App/Agent Loop Owner；没有复制 DSH 源文件或引入 DSH 私有依赖。

LFAA 适配继续通过既有 `/ai/sessions`、`/ai/runs` 与 AI Work 消息投影工作；不复制 DSH Session UI、组件、布局、CSS 或设置，不把 LFAA 账户 Session 暴露为 DSH `SessionProvider`。Cordis Fiber 发布钩子、DSH Client 专属 SessionProvider 和 plugin-owned message projection 未接入：LFAA 当前没有对应的 Session Event 扩展 Owner，本轮不另建插件事件执行面。业务 UI、权限、审批、项目和 Daemon 任务仍由 LFAA 原有 Owner 管理。

## 性能与安全边界

通用 Session Query 通过本 Owner 校验当前运行会话及目标会话的账户/App/项目范围；无项目时只查自身。最多枚举 200 个活动和 200 个归档头，消息页继续用既有投影，结构事件页采用字段白名单，不提供模型请求、隐藏推理或原始工具参数/结果。当前会话位置查询仅返回调用上下文绑定会话的 JSONL 路径元数据，不返回文件正文或检查文件是否存在。读取共用 JSONL 单次异步扫描，不新增事件存储。

- Session 事件写入共用 JSONL 事务和已有 SHA-256 链校验；最近 Header、Tool History 和派生消息按增量/代数缓存，实时 SessionStore 有界为 32 个对象。消息分页以异步流单次校验完整日志，扫描工作集有界，但 CPU 与磁盘读取仍随历史增长；历史事务去重索引仍常驻，后续索引/压缩和真实长会话时间/内存曲线尚未完成。
- 事件 Header 不保存 Provider URL、API key 或认证头；Tool 参数/结果、模型输入上下文保存在受保护的 Host JSONL，不返回普通消息 API 或 Client 插件。
- 用户、App、项目归属仍由 LFAA API/Session Owner 校验；Provider、权限模式、AI Runtime 限制与跟进方式继续读取现有设置，不新增设置项。
- assistant 的可选 `providerReplay` 在既有模型历史和 response 事件中保存真实 reasoning_content 及账户/Provider/模型来源，内核验证结构，重启可恢复。新轮次保留最终 assistant 的续接字段与完整澄清配对，仍不重送已完成普通工具大结果。消息分页、Run/SSE、Session Query 与日志导出只消费公开投影，不返回私有续接数据。旧记录缺失时不补写或编造隐藏推理。
- 账户迁移用 `exportPortableAiSessions()` 生成公开消息投影；v2 才附带安全活动摘要、回复段落、附件引用和已有分支记忆。恢复使用独立 `session/portable-context` 检查点，在后续轮次作为不可信背景注入；消息按原公开文本恢复，不移植运行中任务、原始工具往返、Provider replay、项目路径或权限。
- Session Owner 的模型请求上下文和失败 Attempt 会移除 LFAA `<conversation-memory>` 注入块，不把已保存记忆正文复制进新的模型历史快照。账户清除记忆时，设置 API 先让 Session Owner 对该账户会话 JSONL 做链校验、脱敏重写与哈希链重算；原始用户/助手消息保留，其他账户的会话文件不处理。重写失败时 API 不清空 Conversation Memory，用户可重试。
- Web 浏览器、认证 Provider、桌面宿主、真实 Daemon 副作用验收由对应运行环境单独完成；包构建或内核单测不代替这些验收。

## 小鱼共享工作入口（2026-10-14）

session/associations 为有界、不可变、可重放的引用事件；视图增量缓存，运行/归档时不改关联。记忆分支继承所选回答时点的关联；旧 App ID/历史不改写，共享项目与账户权限分开。

构建只写仓库根 dist/packages/core/session/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

`usage/record` 保存 Provider 实际返回的 `requestCount`、`cacheReadReportedRequestCount`、`cacheReadTokens` 和 `promptTokens`；分组汇总用报告计数表示真实字段覆盖率。旧事件缺少请求数或缓存读数时保留为未知，不推导命中数。普通消息投影只附加当前回答的主回合 usage，不把 `purpose=memory` 后处理请求或 `purpose=subagent` 子 Agent 用量混为主回复用量；子 Agent Provider token 仍计入 Session/账户汇总，费用不从 SDK 估值推导。一次外部结果最多 32 个模型的记录在单一 Session 事务中提交，避免每个模型单独落盘。字段随已验证的 Session JSONL 分页回读，不另建用量表或客户端存储。
