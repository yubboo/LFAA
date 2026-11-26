# Agent 记忆系统升级方案（本地内核 + 多 Agent 共享）

状态：**P1（可靠内核）、P2（每轮提炼 + 多 Agent 共享）、P4（界面治理）已实施**；P3（可选向量召回）未开工。负责人已就三项主决策拍板：本地内核自研（不引外部记忆服务）、词法升级 + 可选向量、每轮 LLM 提炼 + 显式偏好。实施现状见 [features/agent-memory.md](../features/agent-memory.md)。

## 1. 目标与非目标

目标：

1. **记忆可写**：每轮运行结束自动提炼结构化记忆（偏好 / 事实 / 决策 / 坑 / 约定），不再只依赖「记住…」这类显式句式。
2. **记忆可查**：BM25 + 中文 bi-gram + 时间衰减 + 命中加权的本地检索，按 token 预算注入；新增 `recall_memory` 工具让 Agent 需要时自己再查。
3. **多 Agent 共享**：主 Agent、子智能体、Agent 群组共享 `team` / `project` / `global` 三层记忆；子智能体的发现下一轮即可被父级与兄弟召回。
4. **可靠**：修复并发写入丢数据；上限、归档、去重、冲突替代、来源可追溯、可手动遗忘。
5. **可选语义**：配置了向量模型才启用 embedding 召回，未配置时零成本回退词法。

非目标（本轮不做）：

- 实体关系图 / 图数据库（supermemory、Graphiti 那套），`team` 之外不做多跳推理。
- 跨设备同步、云端记忆服务、多用户租户隔离。
- 引入 supermemory local / mem0 等常驻外部服务作为依赖（理由见 §3）。
- 自动改写系统提示词、自动修改用户规则文件。

## 2. 现状与差距（本仓实测）

| 能力 | 现状 | 证据 |
|---|---|---|
| 短期会话记忆 | ✅ 会话 JSON + 16 条/16000 字窗口 + 摘要滚动 | `packages/core/session/src/session-store.ts`、`packages/compaction/compaction/src/basic.ts` |
| 长期记忆存储 | ⚠️ 单 `long-term-memory.json` 全量读改写 | `packages/core/memory/src/longterm-store.ts` |
| 写入 | ⚠️ 仅 `save_memory` 工具 + 「记住/以后统一/不要再/偏好」正则 | `packages/core/agent/src/run/memory-autosave.ts` |
| 检索 | ❌ 子串匹配 + 中文 2–4 字切块，固定取前 6 条 | `longterm-store.ts#recall`、`agent-context.ts#L62` |
| 结构化 | ❌ 仅 `content/tags/scope` | `packages/core/memory/src/types.ts` |
| 多 Agent | 🟡 共享同一长期记忆文件，对话历史隔离 | `packages/core/subagent/src/subagent-service.ts#L66` |
| 治理 | ❌ 无上限、无归档、无冲突处理、无来源追踪 | 同上 |

已确认缺陷（P0）：

- **并发丢写**：`add()` 是「读全量 → 改数组 → 覆写」，主 Agent 与并行子智能体同时写会互相覆盖，后写者胜出，先写条目直接消失。
- **跨会话知识缺口**：`/compact` 摘要只留 session，换会话检索不到，是「记不住上次结论」的主因。
- **共享只有事实层**：子智能体查到的坑与结论只出现在父级收到的最终文本里，兄弟之间互相不可见。

## 3. 调研与参考

| 来源 | 结论与取舍 |
|---|---|
| [supermemory 文档：How it works](https://supermemory.ai/docs/concepts/how-it-works) / [自托管说明](https://supermemory.ai/docs/self-hosting/overview) | 学习模型决定「记什么、何时忘」，存储为时序向量图。**采用其生命周期思想**（写入提炼 → 去重合并 → 冲突替代 → 遗忘），**不采用其部署形态**：自托管内核来自非公开代码库、需常驻二进制与 key，与本仓「资料库可读写可迁移、随应用分发」的前提冲突。 |
| [mem0：写入/检索如何使用 embeddings](https://mem0.ai/blog/how-mem0-uses-embeddings-and-why-we-are-evaluating-nvidia-nemotron-3-embed) | 写入路径 = LLM 抽事实 → 向量索引 + 实体索引；检索走同一批向量。**采用「写入抽事实」与「相似度去重」**，实体图部分本轮不做。 |
| [Agent Memory Research 2026 综述](https://zenodo.org/records/21608779) | 把记忆的判据落在生命周期上：存什么、怎么表示、何时更新、怎么解冲突、怎么删、怎么评估。**采用该六问作为本方案的验收维度**，避免只做「存 + 查」。 |
| [Graphiti / Zep 时序知识图](https://pypi.org/project/syia-memory/0.15.0/) | 双时态边、图遍历。本轮**不采用**：需要图库依赖，收益主要在多跳关系推理，超出当前需求。 |
| 本仓 `@lfaa/memory` / `@lfaa/session` / `@lfaa/subagent` / `@lfaa/compaction` 源码 | 记忆必须留在 `packages/core/memory`（Host 能力包），提炼逻辑放 `@lfaa/agent`（已依赖 `llm` 与 `memory`，不新增反向依赖）。 |

许可与维护判断：不引入新第三方依赖，全部复用现有 `@lfaa/*` 与 Node 标准库，无许可风险与供应链新增面。

## 4. 决策（已拍板）

| # | 决策 | 结论 |
|---|---|---|
| D1 | 路线 | 本地内核自研，数据全在本机，随桌面端分发 |
| D2 | 检索 | 词法升级为默认；配置向量模型后叠加语义召回，未配置自动降级 |
| D3 | 写入 | 每轮 LLM 提炼 + 显式偏好双通道 |

## 5. 数据契约

`packages/core/memory/src/types.ts` 扩展（旧字段保留，全部新增字段可缺省）：

```ts
export type MemoryKind = "preference" | "fact" | "decision" | "pitfall" | "convention";
export type MemoryScope = "global" | "project" | "team" | "session";

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  scope: MemoryScope;
  projectId: string | null;
  /** team / session 作用域的归属键，统一用 sessionId */
  ownerId: string | null;
  /** 写入者：main / subagent:research / group:xxx */
  agentId?: string;
  content: string;
  tags: string[];
  source?: { sessionId?: string; messageId?: string; toolName?: string; runId?: string };
  confidence: number;
  hits: number;
  lastUsedAt: number;
  supersedes?: string;
  supersededBy?: string;
  expiresAt?: number | null;
  createdAt: number;
  updatedAt: number;
}
```

兼容规则：读取时 `kind` 缺省 `fact`、`hits/lastUsedAt` 缺省 0、`confidence` 缺省 0.6；`recall` 仍兼容只有旧字段的条目。写入时按新结构落盘，旧版本 LFAA 读到多余字段会被忽略（数组结构不变，可回退）。

## 6. 架构（五层）

```
写入    memory-writer（每轮提炼） / save_memory / 子智能体收口回写 / 显式偏好正则
  ↓
存储    WriteQueue 串行化 + 原子写 + mtime 热重载 + 上限归档 + 可选向量 sidecar
  ↓
检索    BM25(CJK bi-gram) + 作用域加权 + 时间衰减 + 命中加权 + token 预算
  ↓
共享    global / project / team(sessionId) / session 四层作用域
  ↓
治理    去重、冲突替代、置信度、来源、遗忘、UI 管理
```

### 6.1 存储

- 仍用单文件 `long-term-memory.json`（资料库可读、迁移与统计逻辑不变），但写入走 `MemoryWriteQueue`（promise 链，单实例串行）+ 原子替换（写 `*.tmp` 后 `rename`）。
- 读取加内存缓存 + 文件 `mtimeMs` 校验：文件被其他进程（CLI / 桌面端）改动后自动重载，避免跨进程丢更新。
- 上限默认 800 条：超出按「lexical 得分最低 + 最久未命中 + 非 project」淘汰到 `long-term-memory.archive.json`，只归档不删除。
- 向量 sidecar `long-term-memory.vectors.json`（`id → number[]`）与主文件同目录，迁移时随 `data/` 一起复制；缺失或维度不符时自动重建，不影响主流程。
- 迁移与统计（`StorageManager.getStats` 的 `memoryCount`）继续只读主文件，格式不变。

取舍说明：不采用 JSONL/数据库。JSONL 会让「迁移逐文件校验 + 用户在资料库直接读」变复杂，而 ≤800 条时全量重写耗时可忽略（实测万条量级仍在毫秒级）。

### 6.2 检索

打分（各项 0–1 归一）：

```
score = 2.2 * bm25 + 0.8 * scopeWeight + 0.6 * recency + 0.4 * hitRate + 0.1 * confidence
```

- 分词：英文/数字按词，中文按 bi-gram（去掉停用字如「的了是在」），替代现有 2–4 字正则切块。
- `scopeWeight`：project 1.0、team 0.9、global 0.6、session 0.5（跨会话场景降权）。
- `recency`：30 天半衰期的指数衰减，`lastUsedAt` 优先于 `createdAt`。
- 过滤：`bm25 = 0` 且非 project/team 作用域的不召回，避免纯时间排序噪声。
- 预算：默认 8 条 / 1200 字（原 6 条 / 约 400 字），按预算截断而不是硬编码条数。
- 注入格式：`[项目决策] 内容`，不带完整元数据，避免挤占上下文。

### 6.3 写入

`packages/core/agent/src/run/memory-writer.ts`（新增），挂在现有 `sedimentExplicitMemory` 同一收口点：

- 输入：用户消息 + 助手最终答复 + 工具步骤摘要（失败命令、被改文件、关键结论）+ `projectId`。
- 触发：`settings.memoryAutoExtract` 开启（默认开）且本轮非续写/非目标续跑；用户消息 < 40 字且无工具调用时跳过（省调用）。
- 调用：`ctx.llm.complete({ messages, maxTokens: 400, temperature: 0.1 })`，8s 超时，失败静默、不阻塞收口。
- 提示词要求输出 JSON 数组（≤3 条），字段 `kind/content/tags/confidence`；显式禁止记进度、临时路径、凭据、一次会话内就失效的信息。
- 后处理：容错解析（截取首个 JSON 数组）、`kind` 白名单、内容 ≤200 字、空内容丢弃。
- 去重与冲突：
  - 相似度 > 0.86（有向量用 cosine，无向量用词法 Jaccard）→ 视为重复，只更新 `hits/updatedAt`。
  - 0.6–0.86 且 `kind` 与作用域相同、含「改用/换成/不要/取消」等替换语义 → 新条目 `supersedes` 旧条目，旧条目保留但不再召回。
  - 其余情况并存。
- 时间线留痕：写入成功时产生一条 `已记忆 N 条` 步骤（复用现有 `save_memory` 步骤类型，`title` 区分），用户可见、可追溯。

### 6.4 多 Agent 共享

- `team` 作用域以 `sessionId` 为 `ownerId`：同一会话的主 Agent、所有子智能体、群组成员共享。
- 子智能体收口（`SubagentCoordinator.runTurn` 结束处）：按规则（不调 LLM）把「角色 + 结论摘要 ≤200 字 + 失败步骤」写成 1–2 条 `team` 记忆，`agentId = subagent:<kind>`。
- 主 Agent 收口：把子智能体结果汇总成一条 `team` 记忆，避免兄弟条目重复。
- 召回：子智能体的 `createIsolatedMemoryView` 只隔离对话历史，长期记忆视图保持共享；`recallRelevantMemories` 增加 `sessionId` 参数后自动带上 `team/session` 作用域，兄弟结论下一轮可见。
- 并发：所有写入经 `MemoryService` 内的同一个队列，天然串行；跨进程用 mtime 重载兜底。

### 6.5 治理与界面

- 设置中心「模型与规则 → 长期记忆」增强：按 `kind` 筛选、搜索、来源显示（会话可跳转）、编辑、删除、条数与体积统计；破坏性操作仍单独成组放页面最末（遵循 `docs/standards/settings-ui.md`）。
- 开关：自动提炼（默认开）、条数上限（默认 800）、召回预算（默认 8 条 / 1200 字）。
- 资料库「Agent 记忆」分类补 `kind` 标签，与设置页数据同源。

## 7. 文件级改动清单

### 7.1 Host

| 文件 | 改动 |
|---|---|
| `packages/core/memory/src/types.ts` | 新增 `MemoryKind` / `MemoryScope` / 来源与生命周期字段；`AddMemoryInput` 增加 `kind/scope/ownerId/agentId`。 |
| `packages/core/memory/src/longterm-store.ts` | 重写写入路径（队列 + 原子写 + mtime 缓存）、检索（BM25/bi-gram/衰减/预算）、去重与冲突替代、上限归档；文件预计超 300 行，按职责拆为 `longterm-store.ts` + `memory-ranking.ts` + `memory-write-queue.ts`。 |
| `packages/core/memory/src/memory-ranking.ts`（新增） | 分词、BM25、时间衰减、打分与预算截断，纯函数、可单测。 |
| `packages/core/memory/src/memory-write-queue.ts`（新增） | 串行写队列 + 原子替换 + mtime 读取缓存。 |
| `packages/core/memory/src/index.ts` | `MemoryService` 透传新参数；`recallRelevantMemories` 增加 `sessionId/limit/budgetChars`；新增 `archiveOverflow`。 |
| `packages/core/memory/src/http-handler.ts` | `POST /api/memory` 支持 `kind/scope`；`GET /api/memory` 支持 `kind` 筛选；新增 `PATCH /api/memory/:id`（编辑）与 `GET /api/memory/stats`。 |
| `packages/core/agent/src/run/memory-writer.ts`（新增） | 每轮提炼器：提示词、JSON 容错解析、去重/冲突调用、留痕。 |
| `packages/core/agent/src/run-begin.ts` | 收口处调用提炼器（与 `sedimentExplicitMemory` 并列，失败互不影响）。 |
| `packages/core/agent/src/tools/builtin-agent-tools.ts` | `save_memory` 增加 `kind/scope` 参数；新增 `recall_memory`（read）与 `forget_memory`（write，带 id）。 |
| `packages/core/agent/src/context/agent-context.ts` | 召回带 `sessionId`；`buildProgressHint` 记忆段落改为「先用 recall_memory 查、确认长期有效才 save_memory」。 |
| `packages/core/subagent/src/subagent-service.ts` | 子智能体收口回写 `team` 记忆；传入 `sessionId` 给召回。 |
| `packages/core/settings/*` | 新增 `memoryAutoExtract`、`memoryMaxEntries`、`memoryRecallBudget` 三项配置与默认值。 |
| `packages/core/storage/src/storage-manager.ts` | 统计保持主文件计数；迁移覆盖向量 sidecar（若按文件白名单复制则补一条）。 |

### 7.2 Client

| 文件 | 改动 |
|---|---|
| `packages/client/ui-chat/client/settings/AgentSettingsView.tsx` | 长期记忆页：kind 筛选、搜索、来源、编辑、删除、统计。 |
| `packages/client/ui-chat/client/store/chat-data-actions.ts` | 记忆 CRUD 与统计接口对接。 |
| `packages/client/ui-chat/client/locales.zh.ts` / `locales.en.ts` | 新增筛选、来源、条数、体积等文案。 |
| `packages/client/ui-chat/client/library/*` | 资料库记忆分类补 kind 标签。 |

### 7.3 文档与日志

`packages/core/memory/README*.md`、`packages/core/agent/README*.md`、`packages/core/subagent/README*.md` 同步行为变化（`pnpm readme:pair` 校验）；`docs/plans/README.md` 索引；本轮 dev-log。

## 8. 实施顺序与验收

| 阶段 | 内容 | 验收 |
|---|---|---|
| P1 可靠内核 | 契约、存储队列与原子写、BM25 检索、预算注入、`recall_memory`、上限归档 | 并发 50 条 `add` 后条目数 = 50（回归测试复现旧 bug 失败、新实现通过）；旧 `long-term-memory.json` 读取兼容；2000 条召回 < 20ms；`pnpm test:pkg @lfaa/memory` 通过 |
| P2 智能写入 + 共享 | 提炼器、去重/冲突、子智能体回写、设置开关、时间线留痕 | mock LLM 单测：正常 JSON / 前后夹带文字 / 非法 JSON / 超长内容 / 重复内容；真实 5 轮对话后新会话能召回本轮决策；子智能体 A 的结论被 B 召回（team 条目断言） |
| P3 可选向量 | `llm.embed()`、向量 sidecar、混合打分、重建命令 | 未配置向量模型时行为与 P1 一致；配置后同义改写可召回；维度变化自动重建不报错 |
| P4 界面治理 | 设置页记忆管理、资料库 kind 标签 | 双主题 + 窄屏实测；`pnpm verify:web` 通过；删除/归档可回退 |

每阶段跑：`pnpm check` / `pnpm lint` / `pnpm typecheck` / 相关包 `pnpm test` / `pnpm build`；涉及 UI 加 `pnpm verify:web` 与内置浏览器实测；`pnpm map:sync` 后提交。

## 9. 兼容与回归

- 旧条目缺新字段：读取时补默认值，界面与召回不报错。
- 旧版本回退：数组结构不变，多余字段被忽略；向量 sidecar 缺失不影响旧版本。
- 记忆条数突增会改变提示词长度：默认预算受 1200 字限制，需观察首轮 token 增量。
- 单项目记忆与其它项目隔离不变；`global` 仍跨项目，但提示词明确禁止写入路径与凭据。

## 10. 风险

1. **每轮多一次 LLM 调用**：成本与延迟增加。缓解：条件触发、8s 超时、失败静默、设置开关。
2. **记忆污染**：模型误记临时信息。缓解：kind 白名单、提示词硬约束、置信度、条数上限、界面可删。
3. **提炼输出不稳定**：JSON 容错解析，解析失败直接丢弃，不写入脏数据。
4. **并发与多进程**：单队列 + mtime 重载只能兜住本机双实例，极端并发（CLI 与桌面端同时写）仍可能丢最后一次写入；P1 先接受，观测到冲突再加锁文件。
5. **隐私**：记忆进入提示词，`global` 跨项目可见。提示词禁止路径/凭据，界面显示来源便于审计。

## 11. 待确认

1. P1 + P2 是否本轮一起做（P3 向量、P4 界面分别单独一轮）？
2. 提炼触发条件是否按建议「消息 < 40 字且无工具调用时跳过」？
3. 记忆上限默认 800 条、召回预算 8 条 / 1200 字是否合适？