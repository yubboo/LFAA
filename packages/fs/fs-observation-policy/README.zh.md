# @lfaa/fs-observation-policy

防止盲改：对**已存在**的文件执行 `write_file` / `edit_file` 之前，同一会话必须先读过它。

## 行为

- 基于 `@lfaa/tools` 的中间件 seam：`read_file` 成功后把解析出的真实路径标记为「已读」，受保护工具执行前检查标记。
- 新建文件始终放行（还没有内容可读）。
- 工作区之外的路径交给工具自身的沙箱规则，本策略不重复判定。
- 写入/编辑成功后会重新标记为已读，避免格式化类连续编辑多跑一轮。
- 状态按会话隔离，插件卸载时清空。

## 用法

```ts
ctx.plugin(fsObservationPolicyPlugin);
```

受保护/记录读取的工具名可用 `guardedTools`、`observeTools` 覆盖。包默认导出 Cordis 插件。