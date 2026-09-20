# @lfaa/agent-controller

本地 Agent Run Host Controller。它负责把 Browser Run 请求映射到当前账户声明的 Runtime Protocol，但不拥有具体 Provider 实现。

## Runtime 路由

```text
Provider connection.protocol
├─ openai-compatible → @lfaa/llm-openai-compatible
└─ codex-app-server  → @lfaa/codex-app-server Text Runtime
```

API Key 路径继续通过 Credential seam 获取 Secret；ChatGPT/Codex 套餐路径不读取 LFAA Secret，而由 Codex App Server 管理认证。Controller 统一把结果转换成 `AgentRuntimeEvent`，其中 Codex 路径支持 `assistant.delta` 流式事件与最终 `assistant.completed`。

Controller 只拥有 Run HTTP 生命周期、AbortController 和开发态 OpenAI-compatible 会话历史；Provider HTTP、Codex thread/turn、Secret、UI 都属于各自 capability package。
