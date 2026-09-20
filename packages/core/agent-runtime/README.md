# Agent Runtime

`packages/core/agent-runtime` 是 Chat 与 Work 共用的智能核心公共协议层。

## 负责

- Session / Run 公共请求契约；
- 模型 Runtime Binding；
- Tool / Skill / Expert / Command / Sandbox / Subagent 等 Capability 描述；
- Ask / Approve for me / Full access 三档权限的单一语义；
- 官方 Harness Bridge 元数据与 Registry。

## 不负责

- 不实现 React UI；
- 不保存 Provider Account / Secret；
- 不复制 Codex / DeepSeek Harness 的内部 Agent Loop；
- 不直接访问 OS；执行必须继续进入 Tool Runtime → Policy → Permission → Rust Broker。

## 核心原则

Chat 与 Work 只在 `AgentRunRequest.workspaceMode` 上区分入口，模型、能力、权限、Session/Run 必须共用同一 Runtime。Infinite Canvas 是 Work Mode 的 Renderer/Interaction 层，不是 Runtime 或 Event Store 的第二事实源。

`Full access` 只放宽执行 Profile，不允许普通 Run 修改 Trust Core、Secret 边界或关闭审计。

## v0.1.2 流式消息契约

`AgentRuntimeEvent` 新增 `assistant.delta`，用于把 Harness/Provider 的增量文本投影到同一条 Chat assistant message；`assistant.completed` 仍是最终权威文本。Runtime 契约不包含 Codex 私有 thread/turn 细节。
