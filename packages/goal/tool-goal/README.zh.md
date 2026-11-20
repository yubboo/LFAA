# @lfaa/tool-goal

LFAA 智能体的目标工具，底层是 `@lfaa/goal`。

| 工具 | 权限 | 作用 |
| --- | --- | --- |
| `goal_create` | read | 登记目标与可验收的完成条件 |
| `goal_update` | read | 记录进展、标记 `complete`，或标记 `blocked` 并写清原因 |
| `goal_list` | read | 列出当前会话的目标（默认隐藏已完成） |

输出只回一行摘要加最多五条最近进展，避免多步任务把上下文塞满。

## 安装

```bash
pnpm add @lfaa/tool-goal
```

先挂 `@lfaa/goal`；本插件注入 `goal` 与 `tools`。包默认导出 Cordis 插件。