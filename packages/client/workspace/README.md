# @lfaa/workspace

LFAA 的 Workspace 产品域与 Workspace Mode Owner。**Chat Agent / Work Agent 共用一套 Agent Core；Manual 是无模型手动表现层。**

```text
src/
├─ chat/      # conversation-first Agent；通过对话/插话人工干预
├─ work/      # canvas-first Agent；无限画布、人工编辑与 workspaceContext
├─ manual/    # 无模型手动；复用 Work Canvas 与真实工具
└─ shared/    # Chat/Work 唯一 Session Controller / Run / intervention
```

边界：本包可以组合 `@lfaa/agent-runtime`、`@lfaa/config-system`、`@lfaa/ui`，但不得拥有 Shell/Settings/Host Bridge，也不得复制 Agent Runtime。

## v0.1.6 人工干预

Chat/Work 都通过 `AgentRuntimeHost.interveneRun` 干预当前 Run。Chat 只提交对话输入；Work 还把用户编辑后的 Canvas 内容投影为 `workspaceContext`。支持原生 steer 的 Runtime 直接注入；不支持时由 Host 统一续跑。Manual 不调用模型。
