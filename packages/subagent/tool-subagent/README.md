# lfaa-tool-subagent

Control Plane 第一方委派与模型目录工具，复用 Tools 注册表、Subagent Manager 与父 Run 的 delegateSubagent 桥。`lfaa_delegate_subagent` 的 prompt 描述目标、必要上下文和验收；foreground 等终态，background 先限进程内驱动并返回真实任务/父会话 ID。父回复正常结束不取消后台任务；显式取消、数量/深度和工具范围仍归原 Run Owner。

coreManaged 第一方能力不依赖第三方插件开关，不因此授予写入/危险操作权限。模型目录只返回当前账户元数据；模型默认使用 aiRuntime.subagentAccountId 或继承主模型，数量/深度和请求/工具预算沿原 Settings。外部驱动继续沿原本机/权限合同，后台协议未支持，不静默回退。

来源与有界结果由 Session 的 subagent/task 事件保存，不另建数据库。初始保存失败取消任务，后台保存失败报告诊断。新增 Session 公开依赖和装配服务，其他依赖见 package.json；base Bundle 可撤销装配，Agent Loop 消费工具。构建只写根 `dist/packages/subagent/tool-subagent/`。直接回归见 `apps/cli/tests/subagent-background.test.mjs`，真实 Provider/CLI 另记。
