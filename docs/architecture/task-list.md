# 任务清单（计划 → 执行 → 交付）现状、实测与差距

状态：**调研结论 + 待评审方案**。本文档记录 2026-11-21 夜对「小鱼 Agent 是否像 DSH 一样先列计划任务、再按清单推进并交付」的实测证据、与 DeepSeek Harness（下称 DSH）的实现对照、以及准备补齐时的实施建议。**代码未改动，方案待负责人确认后再开工。**

## 1. 结论摘要

- 小鱼**已经能**把复杂任务拆成多步并交付：实测 19 步完成一个 Node CLI（代码 + README + 冒烟测试 + 真实命令验证 + 变更清单）。
- 小鱼**不保证**会建任务清单：同一晚 4 个真实会话里，2 个调用了 `todo_write` 并最终把条目标记为完成；1 个完整跑完并交付却**一次都没调用**；另一外 1 个中途被我中断、也没调用。是否规划取决于模型当时的选择，而不是工程约束。
- 即使调用了，用户界面**只显示一行「已完成：更新任务清单」**，展开后是原始 JSON 参数与结果，没有条目列表、没有进行中/待处理计数、刷新后丢失。这与图一中 DSH 的常驻任务卡是两回事。
- 结论：**工具层有（会写不会读、无 UI、无持久化、无提示词约束）；产品层没有。**

## 2. 现状实现（本仓库）

| 位置 | 事实 |
| --- | --- |
| `packages/core/tool-todo/src/index.ts` | 注册 `todo_write` / `todo_read` 两个工具；待办存在插件内的 `Map<sessionId, TodoItem[]>`；`mergeTodos` 按 `id` 合并（同 id 覆盖、新 id 追加、未提及项保留）；无「最多一个进行中」等校验；`todo_write` 的 `permissionLevel` 标为 `read`。 |
| `packages/core/tool-todo/src/index.ts` 的工具描述 | 只说明「创建或更新当前会话的任务清单。传入完整列表，同 id 覆盖、新 id 追加。」——没有任何「多步任务先建清单 / 保持进行中 / 完成即勾掉」的行为指令。 |
| `packages/bundle/web/src/presets.ts` | `@lfaa/tool-todo` 属于 `CORE_MODULES`，标准模式与创造模式装配；极简模式不装配。 |
| `packages/core/chat/client/**` | 全仓库 `.tsx` 中搜不到任何 `todo` 相关组件：没有任务面板、没有进度统计、没有投影订阅。 |
| `packages/core/agent/src/agent-context.ts` | `buildProgressHint` 只要求「多步任务的进度写入用户可见的正文」，从未提及 `todo_write`。 |
| 会话持久化 | `~/.lfaa/sessions/*.json` 只保存消息与步骤（`toolName`、`argsPreview`、结果预览），不保存当前清单状态；Host 重启后 `todo_read` 只能读到空。 |
| `packages/plan/plan-mode/src/index.ts` | 计划模式只拦截写/执行工具并记录一条目标字符串；`plan_mode_exit(plan)` 的文本不会转成任务清单，两套能力互不通。 |

## 3. 实测记录（隔离实例，deepseek-flash，完全访问）

环境：隔离 `USERPROFILE` + 独立端口，复用真实模型档案；先 Vite 实例（5174），后因并行构建导致静态资源 404，改为「dist 快照 + 静态托管」（5176）。全程用本机 Edge（headless，`playwright-core`）驱动，控制台 0 报错。

| 会话 | 任务 | 结果 | `todo_write` |
| --- | --- | --- | --- |
| `e159ba96…` | 纯静态读书笔记小站（首页 + 3 笔记页 + 关于页 + 样式 + 命令验证） | 完成并交付 | 第 2 轮建 3 条，第 20 轮全部标记完成 |
| `9a3e3d9a…` | Node 单文件待办 CLI（add/list/done + README + 演示） | 完成并交付（1 分 32 秒，20 步） | 第 1 轮建 5 条，第 12 轮 4/5 完成 |
| `2a846c30…` | 同一类 CLI 任务（Vite 实例中断） | 中断 | 0 次 |
| `ade12c2e…` | Node 待办 CLI（更完整：冒烟测试、退出码、原子写盘） | 完成并交付（19 步，3 文件变更，+459/−10） | **0 次** |

界面证据（临时目录，未入仓）：

- `%TEMP%\lfaa-plan-test\shots\99-final.png`：任务进行中，正文左侧只有一行「已完成：更新任务清单」。
- `%TEMP%\lfaa-plan-test\shots6\02-todo-expanded.png`：展开后显示「已完成：更新任务清单 ⌄」，下面嵌着一条命令活动行——分组层级是错的。
- `%TEMP%\lfaa-plan-test\shots7\row-*.png`：点开该行只能看到截断的 `{"todos": [...]}` 原始 JSON 与「查看」链接。

## 4. DSH 是怎么做的（`E:\lfaa1\deepseek-harness`）

| 层 | DSH 实现 | 作用 |
| --- | --- | --- |
| 工具 | `packages/todo/tool-todo/src/index.ts` | 描述即指令：`Record and update a task list to plan multi-step work and show progress; skip it for trivial single-step tasks. Add one todo per concrete step before you start. While work remains, keep exactly one todo in_progress. Mark each todo completed as soon as it is done.` 参数是**整表替换**（`The COMPLETE task list, replacing any previous list.`），并校验内容非空、去重、同一时刻最多一个 `in_progress`（可用配置放宽）。 |
| 状态持久化 | 同一个文件 | 不复用插件内 Map：`exec.agent.session.append('todo/write', { todos })` 把清单写进**会话事件流**；`ctx.sessionProjections.register({ key: 'todos', … })` 定义投影，`turn/start` 时清空（保留上一轮结束时的可见清单）。 |
| 客户端面板 | `packages/client/ui-conversation/src/client/skeleton/TodoPanel.tsx` + `todoDockEntry` | 注册到 `conversation.input.dock` 槽位：标题「任务」、`已完成 · 进行中 · 待处理` 计数、每行一个状态点（done / ongoing / idle）、可折叠；`useProjection('todos')` 订阅 Host 投影，刷新/重连后由会话事件重放恢复。 |
| 工具行 | `packages/client/ui-tool/src/client/tool/toolviews/todo-row.tsx`、`models/todo-history.ts`、`models/todo-diff-model.ts` | 工具调用行本身也渲染清单摘要与「相对上一次的增删」，而不是裸 JSON。 |
| 归组 | `packages/client/ui-chat/src/client/conversation-nodes/process-activity.ts` | `todo_write`、`create_goal`、`update_goal`、`get_goal` 统一归入 `plan` 分组，和「思考/行动/检查」分开。 |
| 计划模式 | `packages/plan/plan-mode` | 与本清单并列存在；计划阶段的产出可以直接落成清单条目。 |

一句话：DSH 把「任务清单」当成**会话状态 + 投影 + 常驻 dock UI + 工具描述里的硬性流程**四件套；我们只做了第一件的一半。

## 5. 差距与 Bug 清单

> 2026-11-22 02:46 更新：B1–B4、B6 均已修复。输入框上方有任务卡、清单随步骤与会话落盘、提示词与工具描述为硬约束并补「工具排序 + 多步提醒」、`todo_write` 改为整表替换、活动分组摘要在多步轮次标注「N 项操作 ·」。详见 dev-log `DEV-000338` / `DEV-000343` / `DEV-000345`。

按「要做这个功能时先修什么」排序。证据均可按上文复现。

- **B1（P0）没有任务面板。** 调用 `todo_write` 后界面只有一行工具活动；用户看不到条目、状态与进度，必须点开读 JSON。与图一体验差距的主体。
- **B2（P0）清单不持久化、不可回放。** 存在插件内存 Map，不进会话文件；刷新页面或重启 Host 即丢。历史会话只能看到当时的 `argsPreview` 片段（截断，且没有后续状态）。
- **B3（P0）提示词没有流程约束。** 系统提示词与工具描述都没要求「多步任务先列清单 / 一次只保持一个进行中 / 完成即标记」。实测直接后果：4 个会话里有 2 个完全没用清单，其中 1 个照样把 19 步的 CLI 任务做完并交付——说明清单不是流程的一部分，只是偶发行为。
- **B4（P1）语义与 DSH 不同，容易漂移。** 我们是「按 id 合并」，模型可以只传新增项，旧条目与状态就会残留，无法表达删除与重排；DSH 是「整表替换 + 校验」。且我们缺少唯一性、并行进行中、空内容的强校验（只在入口过滤空 id/content）。
- **B5（P1）计划模式与清单脱节。** `plan_mode_exit` 只接受一段自由文本计划，没有结构化成任务条目，退出后无法对照跟踪。
- **B6（P1）活动行分组异常。** 展开「更新任务清单」时，后续命令行被嵌进它的展开区（见 `shots6/02-todo-expanded.png`），层级与语义不符；`trace-groups` 对 `todo_write` 没有专门规则。
- **B7（P2）工具权限级别语义不准。** `todo_write` 会改变会话状态却标 `permissionLevel: "read"`；当前表现为「不触发审批」——是否要在「请求批准」模式下提示，需要产品确认。
- **B8（P2）极简模式无清单。** 属预设取舍，需与「极简 = 只读问答」的定位一起确认，不是 bug。
- **B9（P2，运维）静态托管实例与构建产物不同步会白屏。** 复现：Host 以 dist 启动后，另一次 `vite build` 替换了 `assets/`，而 `index.html` 仍是启动时缓存的旧引用 → 资源 404、页面空白，需重启 Host。桌面端同样走静态托管，构建后需重启窗口。

## 6. 建议方案（待评审，未开工）

施工级细节（数据契约、文件清单、阶段验收）见 [任务清单开发方案](task-list-plan.md)；下面只保留方向。

分四阶段，每阶段可独立验收；建议至少做完 1–3 才算「对齐图一」。

1. **工具语义对齐 DSH**（`packages/core/tool-todo`）
   - `todo_write` 改为整表替换；校验：内容非空、去重、最多一个 `in_progress`（预留并行开关）；返回各状态计数。
   - 描述改为行为指令（多步才用、开始前列、进行中标记、完成即勾掉），并保留中文。
   - 保留 `todo_read` 供会话中途自检。
2. **会话内持久化与投影**（Host）
   - 把清单写入会话记录（新增 `todos` 字段或事件），提供 `GET /api/chat/sessions/:id` 摘要字段或独立 `GET /api/session/:id/todos`；SSE 推送 `todos` 更新。
   - 重启/刷新后从会话记录重建；`turn/start` 保留上一轮清单可见、新一轮开始时可选择清空。
3. **UI dock**（`packages/core/chat/client`）
   - 输入框上方新增任务卡：标题、`已完成 · 进行中 · 待处理` 计数、状态点列表、折叠；空清单不渲染。
   - 活动行内的 `todo_write` 改为渲染清单与「相对上次变化」，不再显示原始 JSON。
   - 遵守主题变量规范，深浅双主题验收。
4. **与计划模式打通**（可选）
   - `plan_mode_exit` 同时写入清单；计划文本 → 条目的人工确认入口。

验收建议：同一提示词连续跑 3 次，3/3 都在首个工具调用前建清单；中途至少一次状态更新；刷新页面清单仍在；完成后全部标记完成；深/浅主题与 390×844 窄屏不溢出。

## 7. 本轮未做 / 未验证

- 未改任何代码、未提交、未跑仓库门禁（`pnpm check` / `lint` / `test`）；本轮只是实测与文档。
- 未验证极简模式、PTC 模式（后者尚未接入）下的清单表现。
- 未覆盖子智能体、后台任务并行时的多进行中场景（对应 DSH 的 `allowParallelInProgress` 决策）。
- 测试产生的隔离实例配置、截图与临时脚本都在 `%TEMP%`，未写入仓库；实测期间另一个会话在同一仓库并行构建，故本轮未追加 dev-log/updata-log，避免并发写同一份日志。