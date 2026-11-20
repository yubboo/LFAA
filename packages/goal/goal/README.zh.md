# @lfaa/goal

LFAA 的会话目标服务。目标、进度与受阻原因持久化在 `~/.lfaa/goals.json`，让 Agent 能跨多次运行记住一个长期目标。

## 接口

| 导出 | 作用 |
| --- | --- |
| `GoalService` | `ctx.goal`：新建 / 更新 / 列表 / 单条读取 / 删除 |
| `normalizeGoalStatus` | 非法状态字符串不改变原状态 |
| `normalizeProgress` | 把 `done`/`total` 归一到非负且不超过总数 |
| `summarizeGoal` | 工具与日志共用的一行摘要 |

进程内的写入串行化，并发工具调用不会丢条目；每个目标保留最近 50 条进展记录。

## 安装

```bash
pnpm add @lfaa/goal
```

包默认导出 Cordis 插件，Loader 可按包名装载；搭配 `@lfaa/tool-goal` 把目标工具暴露给模型。