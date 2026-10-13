# LFAA Shell Tools

`lfaa-tool-shell` 登记本机 Shell 与游戏目标节点 Shell 两类真实工具。Provider 模型决定是否调用及选择哪一个；Agent Loop 负责统一权限、派发和结果回传，Daemon 不是 Agent 或通用控制层。

本机 Profile 根据 `general.integratedShell`、`general.taskFolder`、`aiRuntime.commandTimeoutSeconds` 提供 `local_execute_command`；它只在控制端运行。本机应用发现/启动由 computer-use Owner 管理，不能回退到 Daemon 搜索本机程序。`host_execute_command` 只向 Minecraft/SteamCMD App 暴露；只有模型为明确的游戏节点目标选择该工具后，才通过 `agent-shell-v1` 派发到在线 Daemon。节点查询/既有任务状态工具继续遵循各自 App 与账户范围。权限与取消继续沿用现有 Owner；未知退出码不报告成功。

构建输出为根 `dist/packages/shell/tool-shell/`。当前是一次性命令任务，交互式持久 PTY 尚未接入；不能把本包说成已移植 DSH 全部 Shell 模块。

本机命令输出通过 PowerShell 的进程内 UTF-8 配置与 Shell 收集器对齐，包含 Windows PowerShell 5.1 回退；不修改系统编码或用户环境设置。一次性执行在没有输入时也关闭 stdin，避免等输入至超时；已取消信号拒绝启动，进程结束撤销取消监听器。本机工具返回 `executionState`、`isError`、`aborted` 与真实退出码：正常零退出为 complete，非零退出为 failed，超时/取消/未知退出码为 unconfirmed；部分输出仍保留，不能据此声称成功或重放可能已有副作用的操作。模型查询指引要求有界目录/过滤/结果范围，仍允许当前目标内已授权的通用命令。
