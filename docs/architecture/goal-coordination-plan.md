# 目标自动续跑与跨会话协调方案

状态：**已实施**（P1–P5 全部完成，每阶段独立提交、独立可回滚；goal 自动续跑与跨会话协调均已接入 Web 运行时）。

本方案补两件事：

1. **LFAA 的 goal 只做了一半**——有目标服务、goal_create/update/list 三个工具和输入框上方的 GoalBar，但**没有自动续跑**：一轮运行结束、目标仍是 active，也不会自己开下一轮，长任务只能停在「等你再说继续」。
2. **跨会话没有协调**——同一项目的两个会话可以同时跑、同时写；没有「另一个会话在干活」的事实来源，没有等待/接手协议。

参考 DSH 的行为：目标保持 active 时每轮结束自动继续，直到 complete / blocked / 轮数上限；跨会话靠共享工作区 + 会话事件可查 + 单写者纪律。LFAA 把这两件事做成产品能力，而不是靠人盯。

## 1. 现状盘点

| 能力 | 现状 | 缺口 |
| --- | --- | --- |
| 目标存储 | `GoalService` 持久化 `~/.lfaa/goals.json`，支持 list/get/create/update/remove | 无 rounds / autoContinue / maxRounds |
| 目标工具 | `goal_create` / `goal_update` / `goal_list`，按 `execCtx.sessionId` 隔离 | 无「继续/暂停」语义 |
| 目标界面 | `GoalBar` 展示 active/blocked，可编辑 objective，complete 自动隐藏 | 无轮次、无自动继续开关 |
| 运行调度 | `AgentService.runs`、`listRunningSessionIds()`、`withIdleSession()`（**会话级**锁） | 无**工作区级**租约；运行结束无回调 |
| 运行结束 | `run-begin` 落盘后 `run_finished`，`finally` 中止子任务 | 没有「结束后可接续」的钩子 |
| 工作树 | `WorktreeService` 可创建/列出/预览合并；会话记录含 `worktree {id, branch, path}` | 冲突时没有一键并行入口 |
| 会话可见性 | 侧栏能显示运行中会话 | Agent 没有工具读取别的会话 |
| 交接 | 无 | 无 handoff 概念 |

## 2. 目标行为

### 2.1 G：目标自动续跑

- 一轮运行**正常结束（done）**后，若该会话仍有 active 目标，且 `autoContinue=true`、`rounds < maxRounds`、无待回答澄清、未被用户中止：
  - 自动开下一轮，模型收到**隐藏续跑指令**（不产生用户气泡）：目标标题与描述 + 「继续推进；完成时调用 goal_update 标 complete，受阻时标 blocked 并说明卡点」；
  - GoalBar 显示「自动继续 3/10」和暂停开关；
  - 每轮开始前 `rounds += 1` 并写一条目标日志，重启后不丢。
- 停止条件（任一命中即不再续跑）：目标 complete / blocked、用户暂停、轮数上限、本轮运行 error/aborted、产生澄清问题、会话被删除。
- 安全约束：默认 `maxRounds=10`；同一会话同时最多一个运行（沿用 `withIdleSession`）；续跑前 re-check 运行态，避免与用户新消息抢跑。

### 2.2 C：跨会话协调

**C1 工作区租约（workspace lease）**

- 运行开始时按 scope 获取租约，scope 取：绑定工作树的路径 → 否则 `project:<projectId>` → 否则 `root:<第一个授权目录>`。
- 同一 scope 的第二个运行直接拒绝，返回 `409 { code: "workspace_busy", holder: { sessionId, title } }`，文案给出两条出路：等它结束，或给当前会话绑定工作树并行。
- 运行结束/失败/中止释放；只在 Host 进程内存中维护，不落盘（进程退出即清空，避免僵尸租约）。

**C2 工作树并行**

- 409 时提供「用工作树并行」入口：复用 `WorktreeService.create()` 创建分支工作树并把当前会话绑定上去，租约 scope 自动切到工作树路径，两个会话互不覆盖。
- 不自动创建、不自动合并——沿用现有工作树合并预览，用户显式操作。

**C3 会话可见性工具**

- `list_sessions`：标题、项目、工作树、是否运行、更新时间、目标状态（只读）。
- `read_session_events`：最近 N 条消息与步骤摘要（工具名/状态/时间），只读、按会话隔离。
- `wait_for_session`：有界轮询（默认 30 秒，最长 120 秒）直到目标会话不再运行，返回最后状态与是否有待处理问题。
- 目的：让 Agent 能像 DSH 一样「先看另一个会话在干什么，再决定等还是换路」。

**C4 交接协议（handoff）**

- 新增 `handoff` 服务，持久化 `~/.lfaa/handoffs.json`。
- `handoff_create`：标题、摘要、下一步列表、可选目标会话；来源会话自动记录。
- `handoff_list`：查看收件/发件；`handoff_accept`：由目标会话（或未指定时任意空闲会话）接受，接受后在新会话创建同目标 goal，自动进入 G 的续跑；`handoff_cancel`：取消。
- UI：输入框上方交接条（接受/忽略），接受后 GoalBar 出现；浅色/深色与窄屏一并验收。

## 3. 数据与接口

### 3.1 GoalItem 扩展

```ts
interface GoalItem {
  // …现有字段
  rounds: number;          // 已自动续跑轮次
  maxRounds: number;       // 默认 10
  autoContinue: boolean;   // 默认 true
  lastContinuedAt?: number;
}
```

`goal_create` 增加可选 `maxRounds`；`goal_update` 增加可选 `autoContinue` / `maxRounds`；`PATCH /api/goals/:id` 允许 `autoContinue`（暂停/恢复），完成状态仍只由 Agent 的 `goal_update` 改变。

### 3.2 运行输入扩展

```ts
interface StartAgentRunInput {
  // …现有字段
  /** 目标续跑：不写用户消息，只把目标指令放进模型上下文。 */
  goalContinuation?: { goalId: string };
}
```

`run-begin` 对 `goalContinuation` 使用隐藏指令（与现有 `continuation` 同机制），新建一条 assistant 消息，因此每轮在消息区各自成段，不产生用户气泡。

### 3.3 运行结束回调

`beginAgentRun` 增加 `onRunFinished(record)`：AgentService 用它释放租约并调度续跑判断；不改现有 `run_finished` 事件与 SSE 协议。

## 4. 分阶段实施

| 阶段 | 内容 | 主要落点 | 验收 |
| --- | --- | --- | --- |
| **P1（G）** | Goal 字段 + 续跑器 + 隐藏指令 + GoalBar 轮次/暂停 + 单测 | `@lfaa/goal`、`@lfaa/agent`、chat 客户端 | 停止条件矩阵、真实会话续跑到 complete |
| **P2（C1）** | 工作区租约 + 409 + 释放 + 单测 | `@lfaa/agent`、HTTP 处理器 | 双会话同项目第二个 409；结束后可再跑 |
| **P3（C2）** | 冲突→工作树并行（创建+绑定）+ UI 入口 | `@lfaa/worktree`、chat 客户端 | 两会话并行互不覆盖；浏览器验收 |
| **P4（C3）** | list_sessions / read_session_events / wait_for_session | `@lfaa/agent` 工具 | 工具单测 + 真实会话互看 |
| **P5（C4）** | handoff 服务/工具/UI | 新 `@lfaa/handoff`、chat 客户端 | 生命周期单测 + 浏览器验收 |

每阶段结束跑全量门禁：`typecheck`、`lint`、`check`、`test`、`probe:boot`、`build`、`verify:web`，并 `map:sync` + dev-log 后独立提交。

## 5. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 自动续跑死循环 | 轮数上限、暂停开关、出错/中止/澄清即停、每轮写日志 |
| 续跑与用户新消息抢跑 | 开始前 re-check 运行态；`withIdleSession` 兜底 |
| 租约过严导致无法并行 | 工作树路径是明确出口；409 文案直接给操作 |
| 交接产生孤儿 goal | 接受是唯一入口；取消/超时清理；来源会话保留原目标 |
| UI 与主题回归 | 复用现有 GoalBar/交接条组件模式，浅色/深色/窄屏实测 |

## 6. 非目标

- 不做跨进程/跨机器租约（单 Host 进程内存态）；
- 不改 SSE 协议、工具执行并发与现有 goal 工具语义；
- 不自动合并工作树，不自动替用户接受交接；
- 不做「多 Agent 团队」编排——先解决单机内两个会话的协调。