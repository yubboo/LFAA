# 两个巨型循环的拆分方案（Agent Loop / Chat Run Actions）

状态：**已实施**（A1–A4、B1、A5、B2 全部完成，每阶段独立提交）。本方案描述拆分边界、迁移顺序与验收方式；最终 `agent-loop.ts` 121 行、`chat-run-actions.ts` 313 行，满足 §7 的行数验收。

## 1. 背景

`core/agent/src/run/agent-loop.ts` 与 `chat/chat/client/store/chat-run-actions.ts` 都停在 500 行硬上限（`pnpm check` 的 `file-size` 上限），且已经多次接近或触线。它们不是"文件长"这么简单：

- 两者都是**单个巨型循环/闭包工厂**，状态由十几个局部变量共享；
- 直接"抽一段函数"会把共享状态切碎，产生隐式耦合与陈旧读取；
- 两者都在关键路径上（Agent 执行、会话流式渲染），回归代价高。

因此先定边界与顺序，再动手。

## 2. 现状盘点

### 2.1 `agent-loop.ts`（500 行）

`executeAgentTaskLoop(deps, params)` 是一个 while 循环，职责与共享状态如下：

| 关注点 | 共享状态 |
| --- | --- |
| 步骤轨迹 | `steps`、`pushOrUpdateStep` |
| 上下文装配 | `systemPrompt`、`workspaceHint`、`skillsSection`、`systemMessage`、`conversation`、`updateSystemMessage`、`contextBudgetChars` |
| 预算与轮次 | `budget`、`extensionSteps`、`hardBudget`、`iteration`、`lastRoundExecutedTools`、`overflowRetried` |
| 用量与成本 | `tracker`（`RunUsageTracker`）、`mediaPreviews`、`accumulatedReasoning`、`progressText` |
| 重复调用提醒 | `repeatTracker`、`pendingRepeatReminders` |
| 完成前自检 | `lastCodeEditIteration`、`lastVerificationIteration`、`verificationNudged` |

已经拆出去的协作模块：`act-runner`（工具执行）、`model-round`（单轮调用）、`run-compaction`（上下文压缩）、`agent-completion` / `agent-fallback`（收口）、`run-system`（系统提示渲染）、`agent-context`（装配素材）、`agent-usage`（用量统计）。**剩下的正是编排本身**——所以不需要拆"功能"，需要把编排状态显式化。

### 2.2 `chat-run-actions.ts`（500 行）

`ChatRunActions` 类职责：排队消息、媒体生成、权限、发送与启动、**SSE 事件归并**、重试/继续/审批/中止/恢复。

其中 `subscribeRunEvents`（约 139 行）是一个闭包工厂：创建 `AgentStreamClient`，把 `onSnapshot / onDeltaBatch / onStepUpdate / onTodos / onUsage / onApprovalRequired / onApprovalResolved / onStatusNotice / onFinished / onDegraded` 十个回调直接写进 store。它是整个文件里**唯一的大块**，也是把状态更新逻辑散进回调的地方。

## 3. `agent-loop.ts` 拆分方案

目标结构：`executeAgentTaskLoop` 退化为"装配一次 + 循环驱动"，约 120 行；具体阶段各归其位。

### A1. 显式化循环状态（`run/loop-state.ts`）

把上表的可变状态收进一个对象：

```ts
export interface LoopState {
  readonly steps: AgentStepTrace[];      // 轨迹累积
  readonly tracker: RunUsageTracker;
  readonly repeat: RepeatCallTracker | null;
  budget: { used: number; limit: number; hardLimit: number; extension: number };
  iteration: number;
  lastRoundExecutedTools: boolean;
  overflowRetried: boolean;
  reasoning: string;
  progressText: string;
  pendingReminders: string[];
  verification: { lastCodeEdit: number; lastVerified: number; nudged: boolean };
}
export function createLoopState(params: RunExecutionParams, tracker: RunUsageTracker): LoopState;
export function stepRecorder(state: LoopState, params: RunExecutionParams): (update: AgentStepTrace) => void;
export function extendBudget(state: LoopState): number | null;   // 返回追加步数；不可延长返回 null
export function noteToolOutcome(state: LoopState, outcome: ActOutcome): void; // 记录代码修改/验证/重复调用
```

要点：

- 纯状态容器 + 小函数，**不含 IO**，可单测；
- `pushOrUpdateStep` 从闭包变成 `stepRecorder(state, params)`，语义完全一致；
- 循环体只读写 `state.x`，不再有 15 个散落变量。

预期：`agent-loop.ts` 约 500 → 400。

### A2. 抽出「一轮思考」（`run/think-round.ts`）

把"准备系统提示 → 压缩 → 注入 steering → 快照 token → 调模型（含 onActivity/onDelta 回调与超限重试）"整段搬到：

```ts
export async function runThinkRound(input: {
  deps: RunLoopDeps; params: RunExecutionParams; state: LoopState;
  conversation: LlmMessage[]; systemMessage: LlmMessage; llmTools: LlmToolSchema[];
  contextBudgetChars: number; systemContext: SystemContextParts;
}): Promise<{ output: LlmGenerateOutput; roundText: string; firstTokenAt?: number }>;
```

`SystemContextParts` 是 A1 顺带抽出的只读上下文（systemPrompt/workspaceHint/…），避免把 12 个字符串参数来回传。

预期：`agent-loop.ts` 约 400 → 250。

### A3. 抽出「无工具收口」（`run/finish-round.ts`）

没有工具调用时的分支：完成前自检（verification gate）、空响应判定、最终 check 步骤、返回结果对象。搬到 `finishWithoutTools({ state, params, output, roundContent })`，返回 `AgentRunResult`。预期 250 → 200。

### A4. 抽出「工具轮」（`run/act-round.ts`）

有工具调用时的分支：assistant + toolCalls 回填、调用 `runActPhase`、记录工具结果与重复提醒、写 check 步骤。搬到 `runToolRound(...)`，返回下一次循环需要的最小结果。预期 200 → **约 120**。

> 说明：A2/A3/A4 的入参必须是显式对象，禁止把整个 `deps/params` 和 15 个状态再平铺成参数表——那只是把耦合换个地方。

## 4. `chat-run-actions.ts` 拆分方案

### B1. SSE 回调独立（`store/run-stream-handler.ts`）

`subscribeRunEvents` 拆成**纯回调工厂** + 类内薄封装：

```ts
export interface RunStreamContext {
  port: ChatStorePort;
  runId: string;
  sessionId: string;
  assistantMessageId: string;
  /** 客户端实例的归属由调用方管理，处理器只回传"该清理了"。 */
  onStreamClosed: (client: AgentStreamClient) => void;
}
export function createRunStreamHandlers(ctx: RunStreamContext): AgentStreamClientHandlers;
```

类里变成：

```ts
private subscribeRunEvents(runId, sessionId, assistantMessageId): void {
  this.streamClient?.dispose();
  const client = new AgentStreamClient(runId, createRunStreamHandlers({
    port: this.port, runId, sessionId, assistantMessageId,
    onStreamClosed: (target) => { if (this.streamClient === target) this.streamClient = null; },
  }));
  this.streamClient = client;
  client.start();
}
```

收益：回调可直接单测（构造假 `ChatStorePort`，手动触发 `onDeltaBatch` / `onStepUpdate` / `onFinished` / `onDegraded` 断言 patch）；文件约 500 → 365。

### B2. 媒体生成流程（可选，`store/run-media-actions.ts`）

`generateMediaFromPrompt` + 占位插入/移除（约 75 行）只依赖 `port` 与固定接口。B1 完成后如仍接近上限，再抽这一段，目标 ≤ 330。

## 5. 迁移顺序与回滚

1. **A1 → A2 → A3 → A4**，每阶段一个提交、独立可回滚；每阶段结束跑全量门禁。
2. **B1 →（按需）B2**，同样一阶段一提交。
3. 每阶段结束：`pnpm check`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm verify:web`、`pnpm map:sync` 全绿才算完成；`git revert` 单个提交即可回退，不影响其它阶段。

## 6. 风险与缓解

| 风险 | 缓解 |
| --- | --- |
| 闭包状态迁移后读到陈旧值 | A1 先做"只搬运不改逻辑"，用一个提交只把变量搬进对象；后续阶段才动流程 |
| 事件回调顺序变化导致 UI 闪烁 | B1 保持回调**逐个原样搬运**，不合并、不重排；补单测锁定 patch 顺序 |
| 预算/自检语义被改 | A1/A3 以 `agent-loop.core.test.ts`、`agent-loop.verify.test.ts` 为准，测试先跑通再改实现 |
| 真实流式链路回归 | 每阶段跑 `verify:web`；B1 完成后用真实会话发一条消息做一次人工验收 |
| 拆分后仍超上限 | 每阶段目标行数写死在方案里（A4 后 ≤ 120、B1 后 ≤ 365），不达标就继续拆而不是收手 |

## 7. 验收标准

- `agent-loop.ts` ≤ 150 行；`chat-run-actions.ts` ≤ 330 行；新增模块均在软阈值内（`.ts` ≤ 300 行）。
- `pnpm check` 的 `file-size` 不再把它们列为提示区间文件。
- 全量门禁与 `verify:web` 通过；Agent 相关用例（`agent-loop.*`、`model-round`、`act-runner`）零改动通过——**测试不应因拆分而修改**，若必须改，说明行为变了，需要额外说明。
- B1 新增 ≥ 4 条回调单测（delta 追加、步骤 upsert、完成时排队消息接续、断流降级）。
- 每阶段 dev-log 记录「原文件 → 新模块」映射，`repository-map.md` 同步。

## 8. 非目标

- 不重写 Agent 执行语义（预算、自检、压缩、审批）——只搬家与显式化；
- 不改 SSE 协议、事件类型与 store 公共字段；
- 不顺手优化性能或改提示词；
- 不动 `act-runner` / `model-round` 的现有边界。