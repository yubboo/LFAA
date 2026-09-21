# Agent Runtime

`packages/core/agent-runtime` 是 Chat Agent 与 Work Agent 共用的唯一智能核心公共协议层。

## 负责

- Session / Run 公共请求契约；
- 模型 Runtime Binding；
- 同一 Run 的 `interveneRun` 人工干预契约；
- Tool / Skill / Expert / Command / Sandbox / Subagent 等 Capability 描述；
- Ask / Approve for me / Full access 三档权限的单一语义。

## 核心原则

`AgentWorkspaceMode` 只有 `chat | work`。两者必须共享模型、工具、权限、Session/Run、性能与交付质量；`workspaceMode` 仅描述表现层。Work 可附带 `workspaceContext`，Chat 可直接插话，但都进入同一个 Agent Core。

Manual 不属于 Agent Runtime：它是 Client Workbench 的无模型手动模式，复用 Canvas/Tool 基础设施，不创建 `AgentRunRequest`。

`AgentRuntimeEvent` 的执行结果是 UI 唯一真值；UI 禁止自行伪造模型或工具结果。
