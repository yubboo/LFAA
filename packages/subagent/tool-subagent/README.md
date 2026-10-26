# lfaa-tool-subagent

Control Plane 第一方委派与模型目录工具，复用 Tools 注册表、Subagent Manager 与父 Run 的 delegateSubagent 桥。`lfaa_delegate_subagent` 的 prompt 描述目标、必要上下文和验收；foreground 等终态，background 先限进程内驱动并返回真实任务/父会话 ID。父回复正常结束不取消后台任务；显式取消、数量/深度和工具范围仍归原 Run Owner。

coreManaged 第一方能力不依赖第三方插件开关，不因此授予写入/危险操作权限。模型目录只返回当前账户元数据；模型默认使用 aiRuntime.subagentAccountId 或继承主模型，数量/深度和请求/工具预算沿原 Settings。Claude Agent SDK 的 Anthropic Console API Key 现由本包通过既有 Settings/Credentials Owner 按当前账户验证、加密保存和删除；工具准备阶段在密钥缺失时、外层权限审批之前拒绝运行，不复用本机 Claude Code/claude.ai 登录。SDK 使用 `tools: []` 与父 Run 继承工具 Schema 的进程内 MCP；MCP action 回到 Agent Loop 共用 dispatch，内层动作的风险与批准继续读取既有 `permissions.mode` 并由唯一 Permission Owner 决定。SDK 配置目录按次隔离并清理。SDK 尚未接入 LFAA OS Sandbox；`danger-full-access` 是当前执行环境门槛，不代表操作系统隔离，工作目录绑定也不等于沙箱。Codex CLI 标记为不可运行，直到接入同一工具桥；后台协议未支持，不静默回退。

办公室运行标签使用经过 schema 校验的任务 `description`，父 Run ID 只从 Agent Loop 工具上下文透传；调用参数不能伪造层级。工具只提供真实委派信息，不负责办公室 UI。

外部 SDK 文本增量通过 `AiBusinessToolContext.onSubagentTextDelta` 回到父 Agent Loop 的瞬时 Run SSE；进程内子 Agent 不额外复制文本，SDK thinking 和工具参数不会转发，增量不写入子任务结果或 Session。SDK 终态的分模型 token 用量通过 `onSubagentUsage` 交给 Session Owner，使用 `purpose=subagent` 汇总，不覆盖父助手消息的主 Provider 用量；SDK 估算费用不进入产品记账。

来源与有界结果由 Session 的 subagent/task 事件保存，不另建数据库。初始保存失败取消任务，后台保存失败报告诊断。新增 Session 公开依赖和装配服务，其他依赖见 package.json；base Bundle 可撤销装配，Agent Loop 消费工具。构建只写根 `dist/packages/subagent/tool-subagent/`。直接回归见 `apps/cli/tests/subagent-background.test.mjs` 与 `apps/cli/tests/subagent-external-workspace.test.mjs`，真实 Provider/CLI 另记。
