# LFAA Terminal Shell Resolver

`lfaa-terminal-bash` 是交互式终端的 Shell 启动解析 Owner。`resolveDefaultShell()` 保持平台既有 `system` 默认行为；`resolveTerminalShell()` 将账户设置 `general.integratedShell` 中显式选择的 Shell 解析为实际可启动程序，缺少所选程序时交给执行端报错，不静默改用另一种 Shell。

Windows 显式选择 `powershell` 启动 `powershell.exe -NoProfile`，保留 Windows PowerShell 自身欢迎行且不加载用户启动脚本；显式选择 `cmd` 启动 `cmd.exe`，显示系统原生版本行。两种交互 Shell 均不伪造输出。PowerShell 的无交互一次性命令由 Daemon Shell 执行路径单独处理，不复用交互启动参数。

新增会话的创建者负责读取 Settings 偏好，并调用本包解析；运行中的 PTY 不因账户设置更新而切换。构建输出只进入仓库根目录 `dist/packages/terminal/terminal-bash/`。
