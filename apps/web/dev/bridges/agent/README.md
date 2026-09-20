# Web Agent Runtime Bridge

本目录提供开发态最小 Agent Runtime Host：把 Composer Run 发送到当前已配置模型，并把 Runtime Event 通过 Vite custom event 传回 Workspace Session，由 Chat/Work 各自生成 ViewModel/视图状态。

当前仅负责“模型对话闭环”，不声称已经完成 P2 Tool/Skill/MCP Invocation。所有 Secret 仍从 Credential Store 按 `credentialRef` 读取，不返回浏览器、不写日志。
