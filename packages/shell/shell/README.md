# LFAA Shell 协议与本机进程

本包定义 ShellExecutor、请求/规格、执行句柄与真实结果；`local-process.ts` 为 pwsh-local/bash-local 提供一次性非交互进程收集，不注册第二个运行服务。Tool、权限与命令设置分别仍由 tool-shell、Permission 和 Settings Owner 管理。

stdout 使用规格中的 stdoutMaxBytes，stderr 保留 8 KiB 尾部；两者均按 UTF-8 字节裁剪，包括单个超大块，裁剪点不保留汉字残片。增量 readOutput 的 lossy 只表示自上次读取后确实丢失过未读字节。进程完成撤销超时与取消监听器；无 stdin 发送 EOF，已取消信号拒绝启动。非零、超时、取消和未知退出分别保留实际事实，工具决定 failed/unconfirmed，不冒充完成。

本机进程停止回调支持同步或异步结果，并把直接子进程 PID 交给平台 Owner；失败或拒绝停止时回退终止直接子进程。pwsh-local 使用现有 `lfaa-win32-process` Owner 终止 Windows 进程树，超时或取消后仍等待真实进程关闭再回报结果。不提供持久终端、后台 Job Registry 或跨调用 cwd/env；它们需要独立真实 Owner，不能根据 DSH 目录存在就声称支持。构建只输出根 `dist/packages/shell/shell/`。
