# Agent 执行链路审计（2026-10-21）

## 范围与结论

本次按原始 LFAA-Harness 任务书第 3.2 节，对 Agent Loop、系统提示词、工具目录、Provider 流、权限派发、Session 状态和上下文管理进行源码审计，并复跑直接相关隔离回归。结论只覆盖当前源码与合成/隔离测试，不代表真实 Provider、真实账户审批或桌面运行验收。

未发现模型工具选择被固定业务流程取代，也未发现成功状态由 Harness 写死。主要剩余缺口是当前账户真实 Provider 的多轮工具任务、批准/拒绝 UI 与跨账户运行矩阵；宿主重启后会把未完成 Run 标为中断，不会自动重放，之后必须由 Agent 先查询真实状态再继续。

## 按任务书疑点核对

| 疑点 | 源码与当前行为 | 状态与边界 |
|---|---|---|
| 固定工具选择代替模型判断 | `packages/core/agent-loop/src/execute-turn.ts` 的 `executeAiTurn` 按当前 App、账户设置、能力范围和继承工具范围构建 Tool Schema；模型返回工具名后才进入派发。`packages/core/system-prompt/src/index.ts` 明确模型负责理解、规划和选择，Agent Loop 管理请求、权限与执行。 | **源码通过。** App 来源提供范围，不把业务任务预制成固定流程；不能外调本轮未提供的工具。 |
| 系统提示词只允许预设领域 | `composeLfaaSystemPrompt` 将通用核心、当前权限、App 上下文和扩展说明分层组装；核心说明明确允许跨领域发现已登记能力，且将项目/代码/外部 Skill 和工具结果标为不可信数据。 | **源码通过。** 领域工具仍按 App/权限/能力登记范围过滤，这是执行合同，不是第二套业务流程。 |
| 模型目录存在但没有执行器 | `packages/core/tools/src/tool-contract.ts` 的 `AiBusinessTool` 要求 `schema`、`parse`、`risk`、`approval` 和 `execute`；`listAiBusinessTools` 组合已登记实现。派发前再校验当前工具仍存在且 Schema 未变，范围外、已停用或合同变化的调用会拒绝。 | **源码通过。** 对未装载或不兼容 Runtime 的能力应返回 unavailable/unsupported，目录文字本身不算运行证据。 |
| Provider 未正确处理流式工具调用 | `packages/llm/llm/src/completion.ts` 累积 SSE 工具参数片段、正文、用量和结束原因；参数有大小上限。收到 `[DONE]` 或正常 `finish_reason` 才成功；异常结束和只有 EOF 的截断响应不能派发半截工具。 | **协议回归通过。** 真实模型厂商兼容性仍须逐个运行验收。 |
| 多轮之后工具目录不刷新 | 每次模型请求前 `refreshCapabilities` 读取最新设置、MCP 配置和已登记工具；每次派发前再次校验撤销/变更。`lfaa_tools_load` 只让本 Run 在下一次请求看到明确选择的合同；选中集合受父 Run 授权范围约束。 | **源码/隔离回归通过。** 外部安装后同一真实 Run 的运行时刷新尚未全链验收。 |
| 工具结果没有回到下一轮模型输入 | `executeAiTurn` 为每个工具调用追加配对 `role=tool` 结果，保存模型历史并进入下一次循环；安装工具的成功回读会重建下一次请求目录。 | **Agent Loop 隔离回归通过。** 尚缺当前账户真实 Provider 的多轮工具调用证据。 |
| Agent 被固定领域任务限制 | 核心工具 Owner 覆盖通用文件、能力目录、发现和委派；注册表再按 App/权限/设置加入对应能力。App 标识是来源/范围上下文，模型可在当前合法工具中选择。 | **源码通过。** 当前实际可用能力受已接入 Owner 限制；不能把目标包或占位入口写成已接入。 |
| 工具失败被错误标成成功 | `packages/core/agent-loop/src/tool-outcome.ts` 将结果分类为 `not_started`、`unconfirmed`、`failed`、`complete`；未知/取消/超时不等于成功。相同副作用结果未知时不重放；已确认失败只有满足工具声明的恢复条件和新成功证据后才可重试。 | **隔离回归通过。** 目标 Daemon/外部服务仍必须返回可信终态，执行器被接受不代表业务结果成功。 |
| Run 状态丢失或重启后自动重放 | Run、消息、调用/结果和活动写入 Session Owner；重连可以订阅既有 Run。`interruptOrphanedAiRuns` 在宿主启动时把遗留 `queued/streaming` 记录标为 `interrupted`，不恢复旧执行器或重放工具。 | **安全行为已确认；耐久续跑未实现。** 后续会话可先读取历史/Owner 状态，再由模型决定新动作；不能声称原 Run 跨宿主重启自动续跑。 |
| 计划、观察、反思被固定链路中断 | 普通执行由模型根据每轮真实观察和结果决定下一步；Plan Mode 是会话级显式模式，写/危险/电脑控制/委派受只读门禁约束。上下文管理仅在达到压力阈值且提供 Hook 时尝试 spill/compaction，并保留工具调用与结果配对。 | **源码/局部回归通过。** 没有对不同真实 Provider 的长上下文压缩质量做实测。 |
| 子 Agent 被不合理限制或扩权 | `runs.ts` 将父 Run 的工具名作为子 Run 上限，检查设置中的深度和数量预算，阻止同一委派重复启动；子 Agent 复用权限 Owner、取消信号、工作区和写入拒绝门禁，不能向用户提问。 | **源码/隔离回归通过。** 子 Agent 跨真实模型账户、真实审批和长任务的负载矩阵仍未验收。 |
| 批准操作后没有继续原任务 | 写操作创建绑定账户/App/工具版本/风险/目标范围的审批；Agent 等待 Permission Owner 通知。批准后继续当前调用并把结果送回原模型循环；拒绝/过期设置 Run 共享的写入门禁，阻止本任务和子 Agent 后续写入。E2E H 合成回归使模型在拒绝后仍看到另一个独立写工具并尝试调用；Agent Loop 返回 `not_started`，副作用计数不变。取消时已派发操作记为 `unconfirmed`。 | **源码/替代写工具拒绝回归通过。** 真实批准、拒绝和恢复 UI 尚未运行验收。 |
| 无效发现和工具重载循环 | 工具发现/加载有分页、结果和每次 Run 的选择集合；模型请求、工具调用、失败签名、并发子 Agent 与轮询均有界。没有变化的能力不重复重建，工具失败/未知/成功副作用有防重规则。 | **源码/回归通过。** 真实用户任务的发现次数与 Token 基线尚未测量。 |

## 本轮验证与设置边界

- `pnpm --filter @yubboo/lfaa test -- tests/llm-completion.test.mjs tests/agent-tool-discovery.test.mjs tests/general-agent-capabilities.test.mjs tests/agent-browser-preview.test.mjs tests/agent-runtime.test.mjs`：28/28 通过。隔离测试输出一条“最终回复前失败”的预期错误日志，对应拒绝/失败路径断言；该测试整体通过。
- `pnpm --filter @yubboo/lfaa test -- tests/workspace-projects.test.mjs`：1/1 通过，覆盖旧默认项目迁移、`nodeId: null`、节点离线时本机默认目录初始化、远程同名项目保留节点身份及 API 回读。
- `pnpm --filter @yubboo/lfaa test -- tests/general-agent-capabilities.test.mjs`：7/7 通过；E2E H 子项在拒绝一次写入审批后保留替代写工具的模型可见性，并验证调用在执行器前以 `not_started` 封锁、零副作用。
- `pnpm --filter @yubboo/lfaa test -- tests/agent-runtime.test.mjs`：6/6 通过；隔离 HTTP MCP 写工具审批拒绝后，模型仍看到普通写工具并请求调用，共享门禁在执行器前拦截，MCP 与替代工具副作用计数均未增加。
- 未修改设置中心配置、模型/权限偏好、真实账户数据库或 Session；未启动/停止/重启 3000 服务。当前同源只读项目 API 返回默认项目 `nodeId: null`，本机 Host 节点另以 `local: true` 返回。
- 本报告是源码与隔离回归审计，不是全仓审计，也不是 P1 真实 Provider、真实审批 UI、桌面或性能验收。P1 继续按总合同追踪。
