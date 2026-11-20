# @lfaa/compaction-basic

把上下文压缩暴露成 `ctx.compaction` 服务，运行时可以替换压缩策略而不动 Agent 循环。

## 行为

- 包装 `@lfaa/context` 的 `compactConversation`：压缩早期工具结果，仍超预算时从最早处整组丢弃，并始终保留 system、最近轮次与最后一条用户请求。
- 部署级默认值（`budgetChars`、`toolCapChars`、`keepRecentRounds`）可配置，单次运行可由调用方覆盖。
- 非法或过小的预算回落到库默认值（16 万字符），不会产生退化结果。
- `isOverflow(error)` 判断一次失败是否属于上下文长度超限，运行器据此强制压缩后重试。

## 用法

```ts
ctx.plugin(compactionBasicPlugin, { budgetChars: 120_000, toolCapChars: 800 });
```

Agent 循环挂了本服务就用它，没挂则回落到内置函数。包默认导出 Cordis 插件。