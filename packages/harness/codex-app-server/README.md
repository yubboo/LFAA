# @lfaa/codex-app-server

官方 Codex App Server 的 stdio JSONL Adapter。LFAA 只通过官方 App Server RPC 对接 ChatGPT/Codex 套餐，不读取或复制 Codex 私有认证文件。

## 当前职责

- `initialize` / `initialized` 连接握手；
- ChatGPT 托管登录、账户状态与 `model/list`；
- `thread/start` 创建并按 LFAA Session 复用 Codex Thread；
- `turn/start` 发起文本 Turn，并把模型设置映射到官方 `effort` 字段；
- `item/agentMessage/delta` 流式文本；
- `item/completed` 最终 Agent Message；
- `turn/completed` 收敛 Turn 状态；
- Browser cancel 通过 `turn/interrupt` 取消正在运行的 Turn；
- `turn/start` 响应前取消也安全处理 Promise 拒绝，待 Turn ID 到达后再发出 `turn/interrupt`；
- Web Bundle 内共享一个 `CodexAppServerHost`，认证与 Text Runtime 不重复启动子进程。

## 当前安全边界

v0.1.2 只开放 **read-only Text Runtime**。在 LFAA 尚未接入 Codex 审批 UI 前，Turn 强制使用 `approvalPolicy: never` + `sandboxPolicy: readOnly`；任何 App Server 主动发起的命令执行、文件修改、权限申请或 MCP elicitation 都必须安全拒绝，不允许静默写入项目。

## 不负责

- 不读取 `~/.codex/auth.json`；
- 不保存 OAuth Token；
- 不拥有 LFAA Tool / Skill / MCP Registry；
- 不把 Codex 内部 Agent Loop 复制进 LFAA；
- 不在 Adapter 内实现产品 UI。
