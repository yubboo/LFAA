# LFAA Shell 协议与本机进程

本包定义 ShellExecutor、请求/规格、执行句柄与真实结果；`local-process.ts` 为 pwsh-local/bash-local 提供一次性非交互进程收集，不注册第二个运行服务。Tool、权限与命令设置分别仍由 tool-shell、Permission 和 Settings Owner 管理。

stdout 使用规格中的 stdoutMaxBytes，stderr 保留 8 KiB 尾部；两者均按 UTF-8 字节裁剪，包括单个超大块，裁剪点不保留汉字残片。增量 readOutput 的 lossy 只表示自上次读取后确实丢失过未读字节。进程完成撤销超时与取消监听器；无 stdin 发送 EOF，已取消信号拒绝启动。非零、超时、取消和未知退出分别保留实际事实，工具决定 failed/unconfirmed，不冒充完成。

不提供持久终端、后台 Job Registry 或跨调用 cwd/env；它们需要独立真实 Owner，不能根据 DSH 目录存在就声称支持。构建只输出根 `dist/packages/shell/shell/`。当前 Windows 有界子进程回归未复现后代继承管道导致直接命令等待的问题，本轮没有修改这段生命周期或增加进程树终止。
