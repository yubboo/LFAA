# LFAA Shell Tools

`lfaa-tool-shell` 登记本机 Shell 与游戏目标节点 Shell 两类真实工具。Provider 模型决定是否调用及选择哪一个；Agent Loop 负责统一权限、派发和结果回传，Daemon 不是 Agent 或通用控制层。

本机 Profile 根据 `general.integratedShell`、`general.taskFolder`、`aiRuntime.commandTimeoutSeconds` 提供 `local_execute_command`；它只在控制端运行。本机应用发现/启动由 computer-use Owner 管理，不能回退到 Daemon 搜索本机程序。`host_execute_command` 面向已登记应用，可供模型对明确选择的在线 Daemon 节点执行命令；受限模式还要求当前任务绑定到目标节点的项目工作区，并由该节点自身的 Windows x64 AppContainer Provider 执行。节点查询/既有任务状态工具继续遵循各自 App 与账户范围。权限与取消继续沿用现有 Owner；未知退出码不报告成功。

构建输出为根 `dist/packages/shell/tool-shell/`。当前是一次性命令任务，交互式持久 PTY 尚未接入；不能把本包说成已移植 DSH 全部 Shell 模块。

目标节点命令可通过 `shell` 为本次调用明确选择受支持的 Shell；省略仍读取 `general.integratedShell`，不修改持久偏好。Windows `system` 为 cmd，PowerShell 脚本应明确选择 powershell，执行结果携带实际 Shell 与工作目录，避免嵌套命令错误转义与重复探测。

本机命令输出通过 PowerShell 的进程内 UTF-8 配置与 Shell 收集器对齐，包含 Windows PowerShell 5.1 回退；不修改系统编码或用户环境设置。一次性执行在没有输入时也关闭 stdin，避免等输入至超时；已取消信号拒绝启动，进程结束撤销取消监听器。本机工具返回 `executionState`、`isError`、`aborted` 与真实退出码：正常零退出为 complete，非零退出为 failed，超时/取消/未知退出码为 unconfirmed；部分输出仍保留，不能据此声称成功或重放可能已有副作用的操作。模型查询指引要求有界目录/过滤/结果范围，仍允许当前目标内已授权的通用命令。

节点命令合同可跨界面发现，目标仍是显式 nodeId 和真实节点任务；移除以 App 分类隐藏通用工具的绑定，不改变 OS 执行身份、风险/审批、节点鉴权和取消合同。

编程验证命令的非零退出由原 Agent Loop 记录为确认失败；模型完成新的成功写入修复后，可以在原权限和预算内重新选择同一命令。没有成功修复不能原样重试，已成功命令仍防重，超时/取消/未知退出结果始终禁止原样重放。该恢复标记不自动重试、不绕过审批，由模型根据真实错误决定下一步。
