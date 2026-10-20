# LFAA Agent

本包当前的运行时职责是提供 `AiExtensionRegistry`：登记并按 App 查询 Agent、Provider、Skill、Prompt、Expert 与 Tool 的扩展元数据。Preset 只登记主/子 Agent；Prompt、Expert 与 Skill 由各独立内容插件持有。内置领域元数据不绑定界面 App，用户内容保留原账户/App 范围。目录不返回正文，loadInstructions 按精确 ID 异步读取并在返回前重验卸载；只有主 Agent 核心指引可自动进入系统消息。

Skill 扩展登记可以携带 `skillId`，它必须是 Skill Registry 的规范名称。插件工作区和设置中心使用同一扩展目录展示技能；设置中心把此 ID 交给 `plugins.disabledSkillNames`，由 Skill Tool Owner 对目录和正文加载执行同一停用状态，不从展示名称推导运行时 ID。

实际对话回合、模型请求、工具派发、审批等待和取消由 `packages/core/agent-loop` 协调；会话事件与恢复由 `packages/core/session` 和 `packages/session/session-persistence-jsonl` 持有；工具参数、执行与风险描述由 `packages/core/tools` 持有。此包不创建第二套 Agent、Session、权限或执行器。

本包内独立的 DSH 对齐类型/纯函数尚未接入上述生产流程；它们不构成可执行 Agent 能力，也不能据其存在声称已实现相应运行时。新增能力须先确定现有 Owner 和真实消费者，再决定是否保留在本包。
