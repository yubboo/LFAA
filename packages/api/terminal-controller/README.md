# lfaa-api-terminal-controller

通过既有 API Gateway 提供按账户隔离的交互式节点终端。所有已登录账户都可打开通用 OS Shell；Minecraft 实例目录 Shell 和受管服务端 PTY 保留 Minecraft 管理权限，并重新读取实例、节点、运行状态和 `minecraft-interactive-console-v1` 能力。浏览器使用 HttpOnly Cookie；Daemon 的 POST SSE 命令连接及输出回报复用节点 Bearer 身份、目标绑定和远程 HTTPS 校验，派发与保活时重新验证凭据。控制端不创建 Shell，不把本机环境或密钥传到远程节点。`target` 默认为通用 OS Shell；`minecraft-shell` 从 Minecraft Service 解析的已登记实例目录启动普通 OS Shell；`minecraft` 可在实例启动中或运行中附着受管服务端 PTY，并始终不派发 OS Shell。

通用 Shell 创建读取 Settings 的 `general.integratedShell` 和 `taskFolder`，空目录使用目标节点数据根；`minecraft-shell` 读取实例登记目录并以其作为 cwd，仍可访问当前 OS 账户权限范围内的其他文件。Minecraft 控制台创建允许实例处于启动中或运行中；Daemon 在启动 PTY 前登记有界待附着订阅，在 PTY 建立后把早期 stdout/stderr 逐段送入终端，服务端未就绪时拒绝游戏命令输入。OS Shell 与 Minecraft 控制台分别用 `lfaa_interactive_terminal`、`lfaa_minecraft_console` 风险身份；Permission Owner 按节点、App、目标与会话输入统一授权，请求审批等待批准，替我审批沿用两次明确批准的记忆规则，完全访问直接创建。审批需要真实会话时经 Session Owner 创建空会话，不调用模型或伪造回复。输入绑定原登录会话，权限模式变化、记忆授权撤销或身份失效结束对应会话。

协议在 `src/protocol.ts`，中继 Owner 在 `registry.ts`。全局 64、账户 8、节点 8 个会话；命令应答最长 15 秒、全局 128 条在途命令；回放每会话 256 KiB，慢 SSE 接收端超过 1 MiB 断开，前端断开 30 秒后收尾。Shell 会话关闭目标节点 PTY；Minecraft 会话只撤销附着与输入，不停止服务端进程；不自动重放输入或恢复 Shell。原生 PTY 及进程清理由 subprocess-local/Daemon 负责。构建输出根 `dist/packages/api/terminal-controller/`。
