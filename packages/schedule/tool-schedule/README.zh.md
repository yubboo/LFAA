# @lfaa/tool-schedule

把 Agent 登记的定时任务持久化并提供成工具。

| 工具 | 权限 | 作用 |
| --- | --- | --- |
| `schedule_create` | read | 登记提醒/后续任务；`dueAt` 支持 `+30m`、`+2h`、`+1d` 或 ISO；`repeat` 支持 `{ kind: "interval", minutes }` 或 `{ kind: "daily", at: "09:00" }` |
| `schedule_list` | read | 按到期时间列出 |
| `schedule_cancel` | read | 按 id 取消 |
| `schedule_due` | read | 领取已到期任务；重复任务推进到下一次，一次性任务移除 |

## 边界

存储位于 `~/.lfaa/schedules.json`（写入串行化）。**没有后台定时器**：到期项在调用 `schedule_due` 时浮出（Agent 可在每轮开始时调用，未来 UI 可加轮询）。这是刻意取舍——静默后台起 Agent 运行不在本包范围。

## 用法

```ts
ctx.plugin(toolSchedulePlugin, { storeFilePath: "D:/data/schedules.json" });
```

包默认导出 Cordis 插件。