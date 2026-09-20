# @lfaa/workspace

LFAA 的 Workspace Feature Composition。Workspace 是父领域，`chat/` 与 `work/` 是同一个 Agent/Project 核心的两种 **Workspace Mode（工作模式）**，不拆成两个平级 package。

```text
src/
├─ chat/      # Chat Mode：线性对话工作模式
├─ work/      # Work Mode：无限画布工作模式与产品布局状态
└─ shared/    # Chat/Work 共用 Session Controller 与最小契约
```

边界：本包可以组合 `@lfaa/agent-runtime`、`@lfaa/config-system`、`@lfaa/ui`，但不得拥有 Shell/Settings/Host Bridge，也不得复制 InfiniteCanvas Pointer/Effect/Resize 通用算法。
