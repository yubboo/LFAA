# 任务清单功能开发方案（P0–P3 已实施）

状态：**P0（工具语义与提示词）、P1（会话持久化 + todos 事件）、P2（任务卡与活动行进度）、P3（计划模式联动）、B6（活动分组摘要），以及「展开全部」「轨迹视图展示清单」均已于 2026-11-22 04:00 落地**；「手动勾选任务」（`DEV-000349`）已于 2026-11-22 17:40 **收口为只读**——Host 的会话 PATCH 明确拒绝改 `todos`，界面不再提供勾选入口。见 dev-log `DEV-000338` / `DEV-000343` / `DEV-000345` / `DEV-000347` / `DEV-000349` / `DEV-000385`。

> 方案外增量：`DEV-000349` 曾补过「用户手动勾选任务」（PATCH 落库 + 失败回滚）。收口原因：清单是 Agent 的 `todo_write` 写入产物，人工改动会被下一次工具调用整表覆盖，且当时对话视图并没有把 `onToggle` 传给任务卡，勾选入口实际不可达。现在对话视图与轨迹视图统一只读，数据源仍为「会话记录优先、旧会话回落到步骤」。后续如要恢复手动勾选，须先解决 Agent 覆盖问题并另开方案评审。

## 1. 目标与非目标

目标（对齐 DSH 图一）：

1. 复杂任务开始时，模型**稳定地**先建清单（由工具描述 + 系统提示词共同约束，不靠运气）。
2. 清单成为**会话状态**：写进会话记录，刷新/重启/换设备打开同一会话都能看到当前进度。
3. 输入框上方有**常驻任务卡**：`已完成 · 进行中 · 待处理` 计数 + 每行状态标记（完成圆点 / 进行中旋转环 / 中断时暂停图标）+ 折叠；清单为空时不渲染。
4. 活动行里的 `todo_write` 渲染成人能读的清单摘要，不是原始 JSON。

非目标（本轮不做）：

- 清单条目的手动编辑 / 拖拽排序 / 子任务嵌套（DSH 也没有）。
- 跨会话共享清单、按项目聚合的任务看板。
- 计划模式（`plan_mode`）的交互重做；只做「退出计划时把计划落成清单」这一处衔接（P3）。
- PTC 模式（尚未接入）。

## 2. 需要负责人拍板的四个决策

| # | 决策 | 建议 | 影响 |
| --- | --- | --- | --- |
| D1 | `todo_write` 语义 | **改成整表替换**（与 DSH 一致），并校验「内容非空 / 去重 / 同一时刻最多一个 `in_progress`」 | 模型每次必须回传完整清单，不会出现旧条目残留；与现有 `mergeTodos` 的行为不兼容，需同步改单测 |
| D2 | 清单存放在哪 | **会话记录新增 `todos` 字段**（`@lfaa/session`），随会话 JSON 落盘；工具写内存前先写会话 | 刷新/重启可恢复；`todo_read` 不再在 Host 重启后返回空 |
| D3 | UI 形态 | **输入框上方常驻折叠卡**（桌面 + 窄屏都显示），活动行只做摘要 | 与图一一致；`ChatWorkspace` 会增加一个渲染点，需控制文件行数 |
| D4 | 范围 | 先做 P0–P2（工具 + 持久化 + UI），P3（计划模式联动）单独一轮 | P3 依赖 P2 的清单状态，一起做会拉长首轮验收 |

补充的产品取舍（默认值，不单独占决策）：极简模式继续不装配 `tool-todo`（只读问答不需要清单）；清单超过 12 条时只显示前 12 条 + 「还有 N 条」；已完成条目默认折叠到「已完成 N 条」下面。

## 3. 数据契约

新增的唯一真源放在 `@lfaa/session`（叶子包，无循环依赖）：

```ts
// packages/core/session/src/types.ts
export type TodoStatus = "pending" | "in_progress" | "completed";
export interface TodoItem { id: string; content: string; status: TodoStatus }

// ChatSessionRecord / UpdateSessionInput 各加一个可选字段
todos?: TodoItem[];
```

- `@lfaa/memory`、`@lfaa/chat`、`@lfaa/agent` 继续按现有方式 re-export，不复制类型。
- `@lfaa/tool-todo` 从 `@lfaa/session` 导入 `TodoItem`，删掉包内重复定义。
- Host → Client 的事件：`AgentRunEvent` 增加 `{ type: "todos"; runId: string; todos: TodoItem[] }`；`StreamRunSnapshotPayload` 带 `todos`，断线重连可补。
- HTTP 不需要新路由：`GET /api/chat/sessions/:id` 返回的会话记录已经带 `todos`。

## 4. 文件级改动清单

### 4.1 Host（P0 + P1）

| 文件 | 改动 |
| --- | --- |
| `packages/core/session/src/types.ts` | 新增 `TodoStatus` / `TodoItem`；`ChatSessionRecord` 与 `UpdateSessionInput` 增加 `todos?`。 |
| `packages/core/session/src/session-store.ts` | `writeSession`/读取路径保留 `todos`；`forkSession` 复制清单；`updateSession` 支持 `todos`（缺省不改）。 |
| `packages/core/memory/src/index.ts` | 透传 `todos`（一般无需改，确认 `updateSession` 泛化即可）。 |
| `packages/core/tool-todo/src/index.ts` | 整表替换 + 校验（非空、去重、≤1 个 `in_progress`，后续可配 `allowParallelInProgress`）；描述改成行为指令；`inject: ["tools", "memory"]`；`execute` 成功后 `ctx.memory.updateSession(sessionId, { todos })`；返回 `metadata.todos` 与 `counts`；`todo_read` 优先读会话字段。 |
| `packages/core/tool-todo/src/types.ts`（新增，可选） | 若 `index.ts` 超过 300 行，把校验函数与描述常量抽出。 |
| `packages/core/agent/src/types.ts` | `AgentRunEvent` 增加 `todos` 事件。 |
| `packages/core/agent/src/agent-loop.ts`（或 `act-runner.ts`） | 工具结果带 `metadata.todos` 时：更新运行记录、`emit({ type: "todos", … })`；`run_finished` 时保留最后一次清单。 |
| `packages/core/agent/src/run-begin.ts` / `run-records.ts` | 快照包含 `todos`；重连补发。 |
| `packages/core/agent/src/agent-context.ts` | `buildProgressHint` 增加一段：多步任务先用 `todo_write` 列清单，开始一项标 `in_progress`，完成即标 `completed`，一次只保留一个进行中。 |
| `packages/core/tool-todo/README*.md`、`packages/core/agent/README*.md` | 同步行为变化（`pnpm readme:pair` 会校验）。 |

### 4.2 Client（P2）

| 文件 | 改动 |
| --- | --- |
| `packages/core/chat/client/chat-types.ts` | `ChatMessageItem` 之外新增 `todos?: TodoItem[]`（会话级），或放进 store 的 `sessionTodos`。 |
| `packages/core/chat/client/stream-client.ts` | 处理 `data.type === "todos"`：调用新回调 `onTodos`；快照里也读 `run.todos`。 |
| `packages/core/chat/client/chat-run-actions.ts` | 把 `onTodos` 接到 store；打开会话时用 `GET /api/chat/sessions/:id` 的 `todos` 初始化。 |
| `packages/core/chat/client/components/TodoDock.tsx`（新增） | 任务卡：标题「任务」、`已完成 · 进行中 · 待处理` 计数、状态点 + 文本、折叠、超 12 条折叠余项；空清单 `return null`。 |
| `packages/core/chat/client/components/TodoDock.module.css`（新增） | 只用 `@lfaa/ui-theme` 语义变量，深浅双主题；≤ 250 行。 |
| `packages/core/chat/client/components/ChatWorkspace.tsx` | 在 `ChatComposer` 之前插入 `<TodoDock todos={…} />`；若文件超 400 行，先把 composer 区块抽出去（当前 327 行，预计新增 20 行仍在上限内）。 |
| `packages/core/chat/client/activity-label.ts` / `StepTraceList.tsx` | `todo_write` 行显示「任务清单 · 已完成 1 / 共 3」而不是裸 JSON；行内展开渲染条目（复用 `TodoDock` 的列表子组件）。 |
| `packages/core/chat/client/locales.zh.ts` / `locales.en.ts` / `locales.data.ts` | 新增「任务」「已完成/进行中/待处理」「还有 N 条」等文案与工具标题。 |
| `packages/core/chat/client/trace-groups.ts` | 修正 B6 的分组：`todo_write` 不吞并后续命令行，独立成行（先补一条回归测试）。 |

### 4.3 P3（可选，单独一轮）

- `packages/plan/plan-mode/src/index.ts`：`plan_mode_exit` 支持把计划文本按行落成 `todos`（复用 `todo_write` 服务，或直接 `ctx.memory.updateSession`）。

## 5. 实施顺序与验收

| 阶段 | 内容 | 交付验收 |
| --- | --- | --- |
| P0（已完成） | D1 语义与校验、描述改指令、`buildProgressHint` 增加流程约束；额外补「todo_write 排到工具首位 + 多步未建清单时提醒一次」 | 单测覆盖整表替换/重复/双进行中；实测同一提示词改前 19 轮 0 次建清单 → 改后 5 轮、首轮建 3 条并两次推进状态 |
| P1（已完成） | D2 会话字段 + 落盘 + `todos` 事件 + 快照 | 会话读回含 `todos`；mock 运行断言事件与快照；真实运行结束后会话 JSON 三条全 completed |
| P2（已完成） | D3 任务卡 + 活动行进度（B6 分组修正单独一轮） | 组件测试：计数、状态点、空清单不渲染、折叠、12 条上限；浏览器实测：第 1 轮出现卡片「进行中 1 · 待处理 4」→ 完成「已完成 5」→ 刷新仍在 → 深色 / 浅色 / 390×844 无溢出、控制台 0 报错 |
| P3（已完成） | 计划模式联动 | `plan_mode_exit` 的分步计划（≥2 行）转成会话任务清单并带 `metadata.todos`，任务卡直接显示；单行计划不建清单、原清单不变；会话不存在不报错 |

每阶段都跑：`pnpm check` / `pnpm lint` / `pnpm typecheck` / 相关包 `pnpm test` / `pnpm build`；涉及 UI 的阶段加内置浏览器实测；改 README 的跑 `pnpm readme:pair`。日志按规范补 `docs/dev-log/` 与 `docs/updata-log/`。

## 6. 回归与兼容

- 旧会话没有 `todos` 字段：读回为 `undefined`，卡片不渲染，其它逻辑不变。
- 工具名不变（`todo_write` / `todo_read`），历史会话里旧的 `argsPreview` 照常显示；新渲染器对解析失败回落到纯文本。
- 提示词变长：`buildProgressHint` 只加 1 段（约 120 字），需观察首轮 token 增量与是否挤占工具说明。
- 会话文件变大：每次 `todo_write` 落一次 `todos`（<2KB），不做增量日志。
- 并发：清单按 `sessionId` 存，两个会话并行互不影响；同一会话的并行子智能体暂不支持（P3 再谈 `allowParallelInProgress`）。

## 7. 风险

1. **工具描述是模型行为的一部分**：改动后旧会话的模型上下文里仍是旧描述，新会话才生效；需要按「同一提示词连跑 3 次」验收，不能只跑一次。
2. **活动行分组**（B6）在没有单测保护时容易改出新回归，先补测试再动。
3. **并发开发冲突**：另一个会话当前正在改 `packages/core/chat/client/`（store、run-actions、composer）。P2 触碰同一批文件，建议 P0/P1（纯 Host）先做，P2 等那一轮合并后再开工，或明确由我做 P2。
4. **UI 尺寸**：`ChatWorkspace.tsx` 已 327 行，靠近 400 行上限；若增长明显，把 composer 区抽成独立组件（属于最小必要重构，需在方案里说明）。

## 8. 待确认

1. D1–D4 是否都按建议执行？
2. P0–P2 是否本轮就做（P0/P1 可以立刻开工，P2 建议避开另一会话的改动窗口）？
3. 任务卡是否也要在「轨迹」视图和窄屏抽屉里出现，还是只在对话视图？