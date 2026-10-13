# lfaa-api-terminal-controller

通过既有 API Gateway 提供管理员账户隔离的交互式节点终端。浏览器使用 HttpOnly Cookie；Daemon 的 POST SSE 命令连接及输出回报复用节点 Bearer 身份、目标绑定和远程 HTTPS 校验，派发与保活时重新验证凭据。控制端不创建 Shell，不把本机环境或密钥传到远程节点。

创建读取 Settings 的 `general.integratedShell` 和 `taskFolder`，空目录使用目标节点数据根。统一 Permission Owner 授权节点、App、Shell、目录及本次会话中的所有交互命令；请求审批等待批准，替我审批沿用两次明确批准的记忆规则，完全访问直接创建。审批需要真实会话时经 Session Owner 创建空会话，不调用模型或伪造回复。输入绑定原登录会话，权限模式变化、记忆授权撤销或身份失效结束对应会话。

协议在 `src/protocol.ts`，中继 Owner 在 `registry.ts`。全局 64、账户 8、节点 8 个会话；命令应答最长 15 秒、全局 128 条在途命令；回放每会话 256 KiB，慢 SSE 接收端超过 1 MiB 断开，前端断开 30 秒后收尾。控制端/Daemon 断线关闭目标节点 PTY，不自动重放输入或恢复 Shell。原生 PTY 及进程清理由 subprocess-local/Daemon 负责。构建输出根 `dist/packages/api/terminal-controller/`。
