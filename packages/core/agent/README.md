# LFAA Agent

本包当前的运行时职责是提供 `AiExtensionRegistry`：登记并按 App 查询 Agent、Provider、Skill、Prompt、Expert 与 Tool 的扩展元数据。Preset 负责登记内置扩展，`app-boot` 和 Agent Loop 读取目录及指令。

实际对话回合、模型请求、工具派发、审批等待和取消由 `packages/core/agent-loop` 协调；会话事件与恢复由 `packages/core/session` 和 `packages/session/session-persistence-jsonl` 持有；工具参数、执行与风险描述由 `packages/core/tools` 持有。此包不创建第二套 Agent、Session、权限或执行器。

本包内独立的 DSH 对齐类型/纯函数尚未接入上述生产流程；它们不构成可执行 Agent 能力，也不能据其存在声称已实现相应运行时。新增能力须先确定现有 Owner 和真实消费者，再决定是否保留在本包。
