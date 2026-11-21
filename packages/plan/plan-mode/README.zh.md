---
description: "计划模式：按会话拦截写与执行工具，先出计划再退出执行；分步计划会自动转成任务清单。"
kind: "package"
---

# @lfaa/plan-mode

基于 `@lfaa/tools` 中间件 seam 实现的按会话计划模式。

## 行为

- `plan_mode_enter`（只读）：把会话切到计划模式，写与执行类工具会被拦截，并在返回里告诉模型如何退出。
- `plan_mode_exit`（只读）：恢复写/执行工具并回显计划；计划有两步及以上时，自动转成会话的任务清单（会话记录的 `todos`），任务卡会直接显示出来。
- `plan_mode_status`（只读）：查看当前是否在计划模式、进入时记录的目标。
- 只读工具照常可用，所以规划期间仍能查看工作区。
- 状态按会话隔离，插件卸载时清空。

## 用法

```ts
ctx.plugin(planModePlugin);
```

包默认导出 Cordis 插件（带 `inject: ["tools", "memory"]`）。