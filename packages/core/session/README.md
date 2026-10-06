# LFAA Session 内核

`lfaa-session` 是 LFAA AI Work、Agent Loop 与会话 API 共用的唯一 Session Owner。Session 事件、消息、活动和用量沿用 `lfaa-session-persistence-jsonl` 的账户隔离 JSONL 事务日志；SQLite 继续保存授权查询所需的会话头投影。没有另建服务、数据根或 UI。

## 内核能力

- `kernel.ts` 提供带连续序号、普通 JSON 快照和深度冻结的类型化追加日志；拒绝循环/稀疏/非有限/非 JSON 值、跳号、非法事件和重入追加。LFAA 沿用现有事件格式，用 1 起始序号、事件 UUID、Session ID 和 ISO 时间；DSH 源格式使用 0 起始序号与数字时间。
- `SessionKernel` 增量维护无损 Surface：支持 append、按当前顺序的闭区间 replace、来源事件引用和首个 system 节点保护；保留活动请求 Header/Context、历史工具 Schema、动态增删 Tool 更新、模型回复流、失败 Attempt、轮次状态与用量。Surface 派生历史在无变化时复用冻结缓存，完整持久事件仍由唯一 JSONL Owner 保存。
- Agent Loop 在网络请求前持久化 Provider 实际可见消息和工具 Schema（剔除 URL、认证头和密钥）；成功/失败的模型尝试、可见输出片段、工具派发/结果、活动、结束状态和 Provider 实际用量都来自真实执行边界。原始协议仅保存在受保护 Host 持久层，不由普通消息展示 API 或 DSH Client 插件读取。
- `forkAiSession()` 按前缀长度建立同账户、同 App 分支；`forkAiSessionFromMessage()` 只接受已完成助手消息，并由 Session Owner 从消息 ID 推导事件边界。`forkAiSessionBeforeUserMessage()` 只接受有独立助手消息配对的用户轮次；源会话存在活动运行时拒绝编辑分支，并在目标轮次 `turn/start` 之前推导边界（排队轮次在目标用户事件前截断）。普通分支继承源项目；Workspace Owner 已验证受管 AI Worktree 后可传入目标项目上下文，新会话在同一事件事务中绑定到该项目。未配对 Tool 调用按“未派发”或“派发后结果未知”闭合，fork/恢复不会自动重放副作用。LFAA 的前缀长度约定是已复制事件数，和 DSH 的闭区间边界参数不同。
- `forkAiSessionForSideChat()` 在主会话仍有活动 Run 时，按最新已记录事件建立独立快照，并以 `session/side-chat` 标记记录来源 Session 与快照序号；不复制内存中的未持久化流内容、不修改源 Session。`getAiSideChatParentSessionId()` 只对当前账户拥有的 Session 返回来源关系，由 Agent Loop 统一 Run Owner 执行无工具、无用户澄清及无账户记忆写入限制。
- 已完成助手消息的反馈以 `message/feedback` 事件保存在同一账户隔离 JSONL 中；每条消息最多一条，理由与补充文本有长度上限，消息投影只向该会话 Owner 返回。反馈事件不进入模型上下文或消息正文 Surface。
- 计划协作模式以 `session/plan-mode` 事件持久化，读取最新事件恢复当前状态并投影到会话列表；账户归属、归档状态、侧聊来源和活动 Run 均在状态变更入口校验。分支沿用其事件前缀中的计划状态，不另建计划存储。
- `SessionStore` 提供 create/restore/prepare/publish/get/list/fork/flush/drop 生命周期，默认 LRU 最多保留 32 个实时对象；`flush()` 等待持久层屏障。LFAA JSONL 每笔事务在返回前 `fsync`，提交失败后拒绝继续写入，须重启并重放。
- 旧会话首次由 Session Owner 读取时，以原消息、活动、内部工具历史、用量和项目元数据幂等生成事件并校验提交；原记录不改写或删除。老记录缺少请求 Header、精确 Provider 输入流和完整工具定义，导入不会推断缺失事实。读取最新消息状态只投影展示字段，不复制整段 `model_history`。

## DSH 来源与适配边界

行为参考 `H:\deepseek-harness\packages\core\session`，基线 commit `639ed015397290b3745d163aafe02ffee4aa3f84`。本实现适配其追加事件、序列/不可变校验、Surface、Header/Context、Tool History、精确前缀 fork、未决 Tool 修复与 flush 语义到 LFAA 的 TypeScript/JSONL/账户/App/Agent Loop Owner；没有复制 DSH 源文件或引入 DSH 私有依赖。

LFAA 适配继续通过既有 `/ai/sessions`、`/ai/runs` 与 AI Work 消息投影工作；不复制 DSH Session UI、组件、布局、CSS 或设置，不把 LFAA 账户 Session 暴露为 DSH `SessionProvider`。Cordis Fiber 发布钩子、DSH Client 专属 SessionProvider 和 plugin-owned message projection 未接入：LFAA 当前没有对应的 Session Event 扩展 Owner，本轮不另建插件事件执行面。业务 UI、权限、审批、项目和 Daemon 任务仍由 LFAA 原有 Owner 管理。

## 性能与安全边界

- Session 事件写入共用 JSONL 事务和已有 SHA-256 链校验；最近 Header、Tool History 和派生消息按增量/代数缓存，实时 SessionStore 有界为 32 个对象。完整事件历史随会话增长且用于精确恢复/fork；本轮未测大型真实会话的时间/内存曲线。
- 事件 Header 不保存 Provider URL、API key 或认证头；Tool 参数/结果、模型输入上下文保存在受保护的 Host JSONL，不返回普通消息 API 或 Client 插件。
- 用户、App、项目归属仍由 LFAA API/Session Owner 校验；Provider、权限模式、AI Runtime 限制与跟进方式继续读取现有设置，不新增设置项。
- Session Owner 的模型请求上下文和失败 Attempt 会移除 LFAA `<conversation-memory>` 注入块，不把已保存记忆正文复制进新的模型历史快照。账户清除记忆时，设置 API 先让 Session Owner 对该账户会话 JSONL 做链校验、脱敏重写与哈希链重算；原始用户/助手消息保留，其他账户的会话文件不处理。重写失败时 API 不清空 Conversation Memory，用户可重试。
- Web 浏览器、认证 Provider、桌面宿主、真实 Daemon 副作用验收由对应运行环境单独完成；包构建或内核单测不代替这些验收。
