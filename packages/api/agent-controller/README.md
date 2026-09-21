# @lfaa/agent-controller

本地 Agent Run Host Controller。Chat/Work 共用同一个 Run Controller；Manual 不进入这里。

## Runtime 路由

```text
Provider connection.protocol
├─ openai-compatible → @lfaa/llm-openai-compatible
└─ codex-app-server  → @lfaa/codex-app-server Text Runtime
```

## v0.1.6 Intervention

`POST /runs/:runId/interventions` 是 Chat/Work 共用人工干预入口。支持原生 steer 的 Runtime 在当前 Run 注入（Codex 使用 `turn/steer`）；其他 Provider 由 Host 中断旧请求并以同一 Session/模型/权限续跑。Work 可把 Canvas 编辑内容作为 `workspaceContext` 一起传入。

Controller 只拥有 Run HTTP 生命周期、AbortController、协议路由和开发态会话；Provider HTTP、Harness thread/turn、Secret、UI 都属于各自 capability package。
