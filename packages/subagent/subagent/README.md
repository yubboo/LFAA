# lfaa-subagent

Control Plane 的子 Agent 驱动注册与活动任务 Owner。Manager 持有实际驱动和有界运行句柄，提供 start/listRuns/getRun/cancelRun；不实现模型循环、领域业务或第二套账户/权限。预取消不派发驱动，取消后的返回不得记成成功，驱动失败转换为真实结果。

句柄按账户隔离，最多追踪 64 项，槽位满时只淘汰终态记录；Driver 随 Cordis 生命周期登记/撤销，close 请求停止活动任务并清空句柄。模型/工具/数量/深度预算由原 Agent Loop 委派入口决定。进程内与外部驱动的可用性分别验收，登记不等于 CLI 已安装。

委派上下文可携带由工具侧提供的父 Agent Run ID；Manager 的账户活动列表随实际任务返回父 Run、应用与驱动标签，供认证的 AI 员工办公室展示外部驱动协作。进程内驱动在 Agent Loop 已有子 Run 列表中显示，办公室合并时会去重。列表不含 prompt、返回正文或诊断详情。

外部驱动的工作目录只能由 `tool-subagent` 从当前 Session 的 AgentGit Owner 绑定注入；driver 在启动前重新确认该绝对路径存在且为目录，绝不回退 `process.cwd()`。Claude Agent SDK 每个工具动作通过 Agent Loop 的 Permission Owner callback；Anthropic Console API Key 由现有 Settings/Credentials Owner 按账户加密保存，工具准备阶段检查缺失状态，不读取本机 Claude Code/claude.ai 登录。当前仍要求本机 Host、`aiRuntime.executionSandboxMode=danger-full-access` 和 AgentGit 目标；LFAA OS Sandbox 是未完成的独立缺口，`danger-full-access` 与目录绑定都不代表操作系统隔离。没有完整执行合同的驱动在能力目录返回 `available: false`，Manager 拒绝派发；登记本身不代表能力可运行。

外部 Driver Context 可选携带精确继承的 `tools` JSON Schema 目录及 `executeTool` 回调。Claude SDK 用它建立进程内 MCP server，回调仍由父 Agent Loop 完成参数、风险、预算、审批与执行；Subagent Manager 只传播合同，不决定工具权限，也不把父 Session transcript 伪装成 SDK 子会话。终态可携带经校验的 `modelUsage` 分模型 token 汇总，供工具桥记入父 Session；不保存 SDK 估算费用。

依赖与入口见 package.json，默认 base Bundle 装配；tool-subagent/control 消费此服务。Manager 从 `lfaaWin32Process` 接收进程树停止能力并传给直接 spawn 的外部驱动；Claude SDK 通过其公开 Query.close() 生命周期终止自有 CLI 子进程。子 Agent 取消不自建进程管理器。持久化来源/结果归 Session Owner，Manager 句柄不冒充重启恢复。没有新增设置。构建只写根 `dist/packages/subagent/subagent/`。直接回归见 `apps/cli/tests/subagent-background.test.mjs`、`apps/cli/tests/subagent-process-control.test.mjs`、`apps/cli/tests/subagent-external-workspace.test.mjs`、`apps/cli/tests/subagent-claude-sdk-permissions.test.mjs` 与 `apps/cli/tests/subagent-agent-loop-permission-bridge.test.mjs`；真实模型、CLI、桌面及性能证据见任务合同。
