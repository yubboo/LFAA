# 多 Agent 任务流水线（Crew Tasks）

状态：**C1–C4 已实施**（v1 只做 sequential，只读任务）。方案见 [plans/crew-tasks.md](../plans/crew-tasks.md)。

## 1. 定位

Crew 是"干活流水线"，不是讨论：把目标拆成有依赖的任务，按顺序交给多个子智能体接力，上游交付**通过验收后**才作为下游输入。讨论、头脑风暴仍走群聊（`@lfaa/agent-group`）。

与现有子智能体派发的区别：`invoke_subagent` 是父级并行派发、各自回报；`run_crew` 有显式任务图、顺序依赖与交接验收。

## 2. 数据契约（`@lfaa/crew`）

`CrewTaskSpec`：`id`、`title?`、`description`（怎么做）、`expectedOutput`（交付什么）、`dependsOn?`、`maxSteps?`。

`CrewRunSpec`：`goal` + `tasks`（最多 6 个）。

`CrewTaskResult`：`status`（pending/running/done/failed/skipped）、`output`、`validation`（ok/reason/attempts）、`subagentId`、时间戳。

## 3. 执行流程

1. `run_crew` 工具校验任务图：空列表、重复 id、自依赖、缺失依赖、环、超过 6 个任务都在开跑前拒绝。
2. 按依赖拓扑排序，同层保持声明顺序，逐个执行（v1 串行）。
3. 每个任务复用 `@lfaa/subagent` 的隔离子运行：`kind=general`、`mode=read`、独立工作台标签；上游 accepted 输出以 `### taskId` 段落注入提示，不转发对话与思考过程。
4. 交接验收按 `expectedOutput` 做确定性检查：最小长度、JSON 可解析、`必须包含：A、B` 逐项出现。
5. 失败带原因重试一次；仍失败则 `failed`，依赖它的任务 `skipped`。
6. 每个 accepted 交付写入 `run` 作用域记忆；运行结束归纳成一条 `team` 记忆，run 条目移入归档文件。

## 4. 记忆

- 新增 `MemoryScope = "run"`，`ownerId = runId`；`list` 默认不返回 run 条目，`recall` 只有显式传 `runId` 才可见。
- `MemoryService.archiveRunMemories(runId, sessionId)`：把 run 条目拼成一条 `[任务流水线] …` 的 team 记忆（≤200 字），随后删除 run 条目并归档，运行细节不进入长期召回。

## 5. 工具参数

```text
run_crew(goal, tasks[])
  tasks[]: { id, title?, description, expectedOutput, dependsOn?, maxSteps? }
```

- 权限：`read`（任务只读，不修改文件、不递归派发）。
- 返回：逐任务状态 + 最终交付；`metadata` 带 `crewRunId` 与每个任务的 `subagentId`，便于工作台定位。
- 未装配子智能体服务时返回可读错误，不让 Host 启动失败。

## 6. 装配

- `@lfaa/crew` 在 `OPTIONAL_MODULES`，标准模式 `sessionModules` 同时带 `@lfaa/subagent` 与 `@lfaa/crew`；插件页目录登记为「任务流水线」。
- bundle 在子智能体之后挂载 crew；`run_crew` 工具随插件卸载清理。

## 7. 验收

- `@lfaa/crew` 15 条测试：任务图校验/排序、guardrail 三类规则与合并原因、顺序执行与上下文注入、重试后成功、两次失败后依赖跳过、中止跳过、插件注册与缺子智能体时的可读错误。
- `@lfaa/memory` 新增 run 作用域用例：默认不可见、同 run 可见、归档后收敛为 team 记忆。
- `pnpm build` 通过；`probe:boot` 3/3（crew 插件注入声明补齐后）；`probe:loader` 13/13。
- 全量 `pnpm test` 883/885：两项失败均在并发会话改动的 `ui/layout` 与 `HoverTip`，与本功能无关。

## 8. 未做

- `hierarchical` 过程与 manager Agent。
- 任务级工具覆盖（`toolsOverride` 契约已预留，执行器尚未消费）。
- 写类任务：v1 任务一律只读，产物由父 Agent 或用户落盘。
- per-agent 知识源与向量检索（P6/P3）。
- 任务级 UI：复用子智能体标签，未加流水线专用视图。