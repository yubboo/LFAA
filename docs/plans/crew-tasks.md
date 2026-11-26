# 多 Agent 任务编排（Crew Tasks）方案

状态：**C1–C4 已实施**（v1 sequential、只读任务）；`hierarchical`、任务级工具覆盖与知识源仍未做。目标是把 CrewAI 图里的「Agent → Task → Process」三层原语落到 LFAA，让子智能体从「并行干活」升级为「按任务接力干活」。实施现状见 [features/crew-tasks.md](../features/crew-tasks.md)。

## 1. 目标与非目标

目标：

1. 新增 **Task 契约**：`description`（怎么做）、`expectedOutput`（交付什么）、`dependsOn`（依赖哪些上游任务）、`context`（允许读取的上游输出）。
2. 新增 **Process**：v1 只做 `sequential`，按依赖拓扑序逐个执行；独立任务允许并行，后续再做 `hierarchical`（manager 选人）。
3. **交接有验收**：上游 task 的输出先过 guardrail，通过后才写入下游 `context`；不通过重试一次，仍失败则该 task 标记失败并终止后续依赖。
4. **run 级记忆**：一次 crew 执行内共享的工作记忆（`scope=run`，`ownerId=runId`），结束归档为 `team`/`session` 记忆后失效，不污染长期库。
5. **能力绑定到 Agent**：`AgentDefinition` 增加 `knowledgeSources`、`memoryScope`、`maxSteps`、`delegation`；v1 先落地 `maxSteps` 与 `delegation`。

非目标（本轮不做）：

- `hierarchical` 过程与 manager Agent。
- 声明式 Flow 引擎（CrewAI Flows 那套 start/listen/router、持久化恢复）；我们的 goal 续跑 + 定时任务已覆盖部分场景，先不造第二套流程引擎。
- per-agent 知识检索（P6）：v1 只预留 `knowledgeSources` 字段，不做 RAG。
- entity 记忆与向量召回（P3 未做）。
- 新的人设字段（role/goal/backstory）：沿用 `AgentDefinition.name/description/instructions`，不引入长 backstory。

## 2. 调研与参考

| 来源 | 取什么 | 不取什么 |
|---|---|---|
| [Crafting Effective Agents](https://docs.crewai.com.cn/en/guides/agents/crafting-effective-agents)（用户提供，2026-11-26 查阅） | Task 的两段式设计：`description` 讲过程、`expectedOutput` 讲交付；一次只做一个目标；描述与交付必须对齐 | 人设式 role/backstory 长文本 |
| [CrewAI 四原语参考](https://github.com/agentsope/skillalchemy/blob/955562e4416c483da946e9c95a1c3974ac52df3c/skills/agentsop-crewai/references/R1-architecture.md)（2026-11-26 查阅） | `Agent → Task → Crew → Process`；`allow_delegation` 默认关闭、`max_iter` 硬上限 | Python 运行时与 YAML 工程结构 |
| [Context、Guardrails 与重试](https://raw.githubusercontent.com/sandgardenhq/dh-library/refs/heads/main/content/en/crewai/03-context-guardrails-and-retries.md)（2026-11-26 查阅） | 上游输出先收集、校验，**通过后**才作为下游 context；失败重试 | 其 Pydantic 校验栈 |
| [CrewAI 仓库](https://github.com/crewAIInc/crewAI)（2026-11-26 查阅） | 任务级工具覆盖、按 agent 配 memory scope 的思路 | ChromaDB / SQLite / LiteLLM 重依赖；crew `kickoff` 一次性执行模型 |

本仓已有实现（改造而非新建）：`@lfaa/subagent` 的隔离子运行与权限边界、`@lfaa/memory` 的 `team/session` 作用域、`@lfaa/agent-profile` 的 Agent 定义与 `toolPolicy`、`@lfaa/agent` 的 `executeAgentTaskLoop`、右侧工作台的子智能体标签与 SSE 事件。

## 3. 与现状的差距

| 能力 | 现状 | 缺口 |
|---|---|---|
| 任务抽象 | 只有父一次运行 + `todo_write` 清单 | 没有 `Task` 契约、没有依赖与交付定义 |
| 协作 | 父→子并行派发、群聊发言调度 | 没有「上游输出→下游输入」的接力 |
| 交付验收 | 子智能体返回一段文本 | 没有 `expectedOutput`、没有 guardrail 重试 |
| 能力绑定 | `toolPolicy` 已有；工具按 mode 过滤 | 缺 `maxSteps` 按 Agent、缺 task 级工具覆盖 |
| 记忆 | 长期库 + `team`/`session` | 缺 `run` 级工作记忆 |

## 4. 数据契约

```ts
// packages/core/crew/src/types.ts
export type CrewProcess = "sequential";
export type TaskStatus = "pending" | "running" | "done" | "failed" | "skipped";

export interface TaskSpec {
  id: string;
  /** 怎么做：过程说明，允许引用 {{input}} 与上游任务 id。 */
  description: string;
  /** 交付什么：格式、必含字段、长度上限。guardrail 按此校验。 */
  expectedOutput: string;
  /** 执行该任务的 agent；缺省用 crew 默认 agent。 */
  agentId?: string;
  /** 依赖的上游任务；只有这些任务的 accepted 输出会进入 context。 */
  dependsOn?: string[];
  /** 该任务覆盖 Agent 默认工具白名单；缺省沿用 agent 的 toolPolicy。 */
  toolsOverride?: AgentToolPolicy;
  /** 单任务步数上限；缺省取 agent.maxSteps。 */
  maxSteps?: number;
}

export interface CrewRunSpec {
  /** 用户目标，作为第一个任务的 {{input}}。 */
  goal: string;
  process?: CrewProcess;
  tasks: TaskSpec[];
  /** 默认执行 agent；缺省用内置 worker。 */
  agentId?: string;
}

export interface TaskResult {
  taskId: string;
  status: TaskStatus;
  agentId: string;
  /** 子智能体运行 id，工作台标签据此定位。 */
  subagentId?: string;
  output: string;
  /** guardrail 结论；失败时带原因。 */
  validation: { ok: boolean; reason?: string; attempts: number };
  startedAt: number;
  endedAt?: number;
}
```

`AgentDefinition` 扩展字段（`@lfaa/agent-profile`）：

```ts
export interface AgentDefinition {
  // …现有字段不变
  /** 单次子任务步数上限；缺省 40。 */
  maxSteps?: number;
  /** 是否允许该 agent 再派发子智能体；默认 false，与 CrewAI 一致。 */
  delegation?: boolean;
  /** 预留：知识源绑定，P6 落地。 */
  knowledgeSources?: string[];
  /** 预留：记忆作用域偏好，P7 落地。 */
  memoryScope?: "team" | "session" | "run";
}
```

记忆作用域扩展（`@lfaa/memory`）：`MemoryScope` 增加 `"run"`，`ownerId = runId`；召回时 `jobScope` 只对同一 run 可见；run 结束调用 `archiveRunMemories(runId)`：把 run 内条目提炼为 1–2 条 `team` 记忆（`ownerId=sessionId`），其余标记 `expiresAt` 或移入归档文件。

## 5. 执行模型

```
run_crew(goal, tasks[])
  → 校验任务图（id 唯一、dependsOn 存在、无环）
  → 建立 run 记忆作用域（scope=run, ownerId=runId）
  → 按拓扑序取就绪任务
      → 组装任务提示：description + expectedOutput + 上游 accepted 输出
      → ctx.subagent.invokeTask({ taskMeta, prompt, agent, maxSteps, toolsOverride })
      → guardrail 校验输出
           ├─ 通过 → 写 run 记忆 + 记为 accepted
           └─ 失败 → 带失败原因重试一次 → 仍失败则 failed，依赖它的任务 skipped
  → 归档 run 记忆为 team 记忆
  → 返回 CrewRunResult（逐任务结果 + 最终交付）
```

关键约束：

- **只转发 accepted 输出**，不转发上游对话与思考过程，避免上下文膨胀与"说了但没做"的污染。
- **单任务单目标**：任务图由模型生成时，提示词要求每个 task 只做一件事，最多 6 个任务。
- **失败不静默**：failed/skipped 在结果与工作台都可见，父 Agent 必须如实转述。
- **预算**：整次 crew 有总步数上限（默认 `tasks.length × 20`），超过即中止；单任务受 `maxSteps` 限制。

### 5.1 任务来源

v1 由模型在对话中通过 `run_crew` 工具**现场生成**任务图（与现有 `invoke_subagent` 同层），并先回显任务清单再执行——复用 plan-mode 的「先给清单再干」习惯。预置模板（YAML/JSON 任务库）留到 v2，等 run 级记忆与 UI 稳定后再做。

### 5.2 guardrail（v1 确定性，不调模型）

按 `expectedOutput` 做结构校验，先覆盖三类：

1. 非空且长度 ≥ 40 字符。
2. `expectedOutput` 声明 JSON 时，输出必须可 `JSON.parse`。
3. `expectedOutput` 列出必含字段（`必须包含：A、B`）时，逐项检查出现。

失败原因写回重试提示，第二次仍失败即 `failed`。模型评审（第二次调用判断是否达标）留作开关，默认关闭。

## 6. 文件级改动清单

### 6.1 新包 `packages/core/crew`（core 组）

| 文件 | 内容 |
|---|---|
| `package.json` / `tsconfig.json` | 与既有 core 包一致；依赖 `@lfaa/subagent`、`@lfaa/memory`、`@lfaa/agent-profile`、`@lfaa/tools`、`@deepseek-ai/cordis` |
| `src/types.ts` | 上文契约 |
| `src/task-graph.ts` | 校验（唯一 id、依赖存在、无环）与拓扑排序，纯函数 |
| `src/guardrail.ts` | 结构校验与重试提示，纯函数 |
| `src/crew-runner.ts` | 顺序执行、run 记忆写入、结果汇总 |
| `src/index.ts` | Cordis 服务 `crew` + `run_crew` 工具注册与卸载清理 |
| `tests/task-graph.test.ts` / `guardrail.test.ts` / `crew-runner.test.ts` | 单测与假 subagent 集成测试 |
| `README.md` / `README.zh.md` / `README.i18n.yaml` | 三件套 |

### 6.2 既有包

| 文件 | 改动 |
|---|---|
| `packages/core/subagent/src/index.ts` | 暴露 `invokeTask(input)` 公共方法（内部走 `coordinator.invoke`），支持 `taskMeta`（taskId/title/expectedOutput）、`maxSteps`、工具覆盖；不破坏现有 `invoke_subagent` |
| `packages/core/subagent/src/types.ts` | `InvokeSubagentInput` 增加 `taskMeta`、`toolsOverride` |
| `packages/core/memory/src/types.ts` | `MemoryScope` 增加 `"run"`；`RecallMemoriesOptions` 增加 `runId` |
| `packages/core/memory/src/memory-ranking.ts` | 作用域可见性支持 run（仅同 runId 可见） |
| `packages/core/memory/src/index.ts` / `longterm-store.ts` | `archiveRunMemories(runId, sessionId)` |
| `packages/core/agent-profile/src/types.ts` | `AgentDefinition` 增加 `maxSteps`、`delegation`、`knowledgeSources`、`memoryScope` |
| `packages/bundle/web/src/presets.ts` | 标准与深度模式装配 `@lfaa/crew` |
| `packages/client/ui-chat/client/workbench/*` | 任务标签显示 `task.title`；不改标签机制 |

> 说明：`@lfaa/session/handoff` 是「会话交接」，与本方案的「任务交接」不是一回事，不合并、不复用其数据模型。

## 7. 实施顺序与验收

| 阶段 | 内容 | 验收 |
|---|---|---|
| C1 | 契约 + 任务图校验 + guardrail 纯函数 | 单测：重复 id、缺失依赖、环、拓扑序；guardrail 三类规则与重试原因 |
| C2 | subagent 暴露 `invokeTask` + `@lfaa/crew` 顺序执行 | 集成测试：research → write 两任务，断言下游 prompt 只含上游 accepted 输出；guardrail 失败触发一次重试后 failed，后续任务 skipped |
| C3 | run 记忆 + 归档 | 单测：run 内可见、run 外不可见；结束后 team 记忆多 1–2 条，run 条目不再召回 |
| C4 | 装配与可视化 | 工作台出现两个任务标签并按序高亮；`pnpm verify:web` 通过 |

每阶段跑 `pnpm check / lint / typecheck / test / build`；C4 另跑 `pnpm verify:web` 与内置浏览器实测。

## 8. 兼容与回滚

- `invoke_subagent` 行为不变；`@lfaa/crew` 未装配时 `run_crew` 工具不存在，不影响现有会话。
- `MemoryScope` 新增 `run` 对旧条目无影响（旧条目没有该值，读取归一化仍按原逻辑）。
- `AgentDefinition` 新字段全部可选，旧 agents.json 读取不报错。
- 回滚：移除 `@lfaa/crew` 装配即可，run 记忆随归档失效，不残留。

## 9. 风险

1. **Token 成本**：每个 task 都有完整系统提示词；6 个任务 ≈ 6 次运行。缓解：任务数上限 6、单任务步数上限、工具集按 agent 收窄。
2. **任务拆分质量**：模型可能把一个任务写成三个，或把三个塞进一个。缓解：提示词约束 + `expectedOutput` 必填 + 任务清单先回显（用户可见、可打断）。
3. **验收过于宽松**：结构校验拦不住"内容对但质量差"。缓解：v1 明确只保证格式与必含字段，质量仍靠最终人工/父 Agent 复核；模型评审开关后续再加。
4. **与群聊混淆**：群聊是讨论，crew 是干活流水线。缓解：工具描述与文档都明确「要接力交付用 run_crew，要讨论用群聊」。
5. **run 记忆泄漏**：归档不彻底会让 run 条目进入长期召回。缓解：归档时统一标记 `expiresAt=now` 并移入归档文件，单测覆盖。

## 10. 待确认

1. **D1 任务来源**：v1 由模型现场生成任务图（推荐），还是先只支持预置模板？
2. **D2 过程范围**：v1 只做 `sequential`（推荐），还是同时支持无依赖任务的并行组？
3. **D3 验收强度**：结构校验 + 一次重试（推荐，零额外模型调用），还是每个任务加一次模型验收（每任务 +1 次调用）？
4. **D4 包位置**：新建 `@lfaa/crew`（推荐，职责独立），还是并入 `@lfaa/subagent`（少一个包，但会把它做成"子智能体 + 编排"两件事）？
5. **D5 记忆**：run 作用域本轮一起做（推荐），还是先复用 `team` 作用域，run 记忆留到 P7？