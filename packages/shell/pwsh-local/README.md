# LFAA 本机 PowerShell Provider

本包将 `lfaa-shell` 的一次性命令合同接到控制端 PowerShell，并注册为 `ctx.shell`。工作目录、UTF-8 输出和 Shell 的有界默认超时由 Shell/调用方合同决定；省略超时或传入 0 时使用 Shell Owner 的 120 秒默认值，正数按 600 秒最大值截断。

取消或超时通过 `lfaa-win32-process` Owner 请求终止 PowerShell 进程树。Owner 未确认停止时，`lfaa-shell` 会退回终止直接子进程。设置中心的 `aiRuntime.commandTimeoutSeconds` 只用于节点命令；本机命令由工具参数和 Shell 默认值控制。权限、工作区与沙箱选择仍由各自 Owner 管理。

构建只输出根 `dist/packages/shell/pwsh-local/`。
