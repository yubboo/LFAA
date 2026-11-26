# Agent 记忆系统（P1–P2 已实施）

状态：**P1（可靠内核）、P2（每轮提炼 + 多 Agent 共享）、P4（记忆管理界面）已实施**；P3（可选向量召回）未开工。方案见 [plans/agent-memory.md](../plans/agent-memory.md)。

## 1. 能力边界

- **短期记忆**：由 `@lfaa/session` 负责会话 JSON 持久化与 16 条 / 16000 字窗口裁剪，`@lfaa/compaction` 负责摘要滚动；本功能不改这部分。
- **长期记忆**：结构化条目，落在资料库根目录 `long-term-memory.json`，支持写入、召回、编辑、删除、去重、冲突替代与上限归档。
- **团队记忆**：同一会话内的主 Agent、子智能体、Agent 群组共享 `team` 作用域记忆，子智能体收口自动回写。

## 2. 数据契约

`MemoryEntry` 由 `@lfaa/memory` 定义：`kind`（preference / fact / decision / pitfall / convention）、`scope`（global / project / team / session）、`projectId`、`ownerId`、`agentId`、`content`、`tags`、`source`、`confidence`、`hits`、`lastUsedAt`、`supersedes` / `supersededBy`、`expiresAt`、`createdAt`、`updatedAt`。

旧条目缺新字段时在读取阶段补齐（`kind=fact`、`confidence=0.6`、`ownerId` 由来源会话推导），文件仍是数组结构，旧版本可回退读取。

## 3. 写入路径

| 来源 | 触发 | 作用域 |
|---|---|---|
| 模型主动 `save_memory` | 用户明确要求记住、或模型判断值得跨会话保留 | global / project（按会话是否绑定项目） |
| 显式偏好正则（`memory-autosave.ts`） | 用户消息命中「记住 / 以后统一 / 不要再 / 偏好 / 约定」 | global / project |
| 每轮提炼（`memory-writer.ts`） | 运行收口、`autoExtract` 开启、非续写非澄清、消息 ≥40 字或有工具调用 | global / project |
| 子智能体收口（`persistSubagentMemory`） | 子任务结束 | team（归属会话），失败步骤另记 pitfall |

写入门槛：每轮最多 3 条、单条 ≤200 字、`kind` 白名单、失败与超时（8s）静默跳过，不阻塞答复。

## 4. 去重、冲突与归档

- 归一化内容完全相同（忽略大小写与标点）→ 合并标签与置信度，不新增。
- 词法相似度 ≥0.86 → 视为同一条记忆合并。
- 新内容含「改用 / 不再 / 换成 / 取消 / 废弃 / 替代」等修正词，且与旧条目同类型同作用域、共享 ≥3 个检索词或相似度 ≥0.55 → 新条目 `supersedes` 旧条目，旧条目保留但不再召回。
- 活跃条目超过 `maxEntries`（默认 800）→ 按「时效 + 命中 + 作用域 + 类型」最弱优先移入 `long-term-memory.archive.json`，只归档不删除。

## 5. 召回

打分：`2.2 × BM25 + 0.8 × 作用域权重 + 0.6 × 时间衰减 + 0.4 × 命中率 + 0.1 × 置信度`。

- 分词：中文 bi-gram（剔除停用字）+ 英文/数字词（含单字符数字）。
- 作用域权重：project 1.0、team 0.9、global 0.6、session 0.5。
- 时间衰减：30 天半衰期，命中后按 `lastUsedAt` 续期。
- 无词法命中时，只补最多 2 条 project / team 记忆作为工作上下文，全局记忆不参与。
- 预算：默认 8 条 / 1200 字，按 `recallBudgetChars` 截断；每次召回回写 `hits` 与 `lastUsedAt`。
- 注入格式：`- [项目决策] 内容`，不带完整元数据。

## 6. 多 Agent 共享

- 子智能体不再只拿到父级转述：召回会带上 `sessionId`，同会话的 `team` 记忆（含兄弟子智能体的结论与踩坑）下一轮可见。
- 子智能体的对话历史仍隔离（`createIsolatedMemoryView` 只覆盖 `buildContextMessages`），共享的是长期记忆视图。
- 写入经 `MemoryService` 的单写队列串行化，主 Agent 与并行子智能体同时写不会丢条目；跨进程按文件 mtime 热重载。

## 7. 设置与接口

- `~/.lfaa/memory-settings.json`：`autoExtract`（默认开）、`maxEntries`（800）、`recallLimit`（8）、`recallBudgetChars`（1200）。
- HTTP：`GET /api/memory`（kind / sessionId / includeSuperseded 过滤，返回 stats）、`POST /api/memory`、`PATCH /api/memory/:id`、`DELETE /api/memory/:id`、`GET|PATCH /api/memory/settings`、`GET /api/memory/stats`。
- 工具：`save_memory`（扩展 kind）、`recall_memory`（read）、`forget_memory`（write，需审批）。\r\n- 设置中心「模型与规则 → 长期记忆库」：新增（内容 / 类型 / 作用域）、按类型与关键词筛选、行内编辑正文与类型、生效/已替代/已归档统计；删除放在页面最末的危险分组，用「选择记忆 + 删除」避免与列表重复。每次操作后经 `/api/memory` 刷新快照。

## 8. 验收

- `@lfaa/memory`：并发 50 条写入不丢、旧格式兼容、去重合并、替代生效、上限归档、命中回写、编辑删除。
- `@lfaa/agent`：提炼 JSON 容错（裸 JSON / 代码块 / 夹带说明 / 非法 / 超长 / 超条数）、开关关闭不调模型、短消息跳过、模型异常静默。
- `@lfaa/subagent`：结论写 team 记忆（作用域 / 归属 / 写入者 / 来源），失败步骤写 pitfall，过短结论不写。
- 回归：记忆相关测试全绿（`@lfaa/memory` 30 条、`@lfaa/agent` 提炼用例、`@lfaa/subagent` 团队记忆用例、`@lfaa/client-ui-chat` 筛选纯函数 5 条）；`agent-loop.context` 的系统提示断言随标签改为「项目事实」。\r\n- 浏览器：`pnpm verify:web` 23/23 通过，含记忆写入、搜索、空态、编辑、删除五步；`pnpm ui:shot --only=settings-memory` 覆盖浅色 / 深色 / 760 窄屏。

## 9. 未实施

- P3 可选向量召回：`@lfaa/llm` 尚无 `embed()`，未接 `/embeddings`；当前检索完全本地词法。
- 记忆来源跳转：列表展示来源会话 ID 与子智能体名，但未做点击跳回会话。
- 跨进程硬锁：CLI 与桌面端同时写仍可能丢最后一次写入，目前只靠 mtime 重载兜底。