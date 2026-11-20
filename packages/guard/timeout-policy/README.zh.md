# @lfaa/timeout-policy

通过 `@lfaa/tools` 的中间件 seam，给每次工具执行套一层统一超时。

## 行为

- 默认 10 分钟；可整体用 `defaultTimeoutMs` 覆盖，或按工具名用 `byTool` 覆盖。
- 每次执行拿到独立 `AbortSignal`，调用方的取消仍会向内传递。
- 超时返回 `ok: false` 且 `metadata.timedOut`，文案明确告诉模型"是超时"，避免它反复重试同一调用。
- 已知边界：不响应 `signal` 的工具在超时后仍可能在后台继续。

## 用法

```ts
ctx.plugin(timeoutPolicyPlugin, { defaultTimeoutMs: 120_000, byTool: { run_command: 600_000 } });
```

包默认导出 Cordis 插件，Loader 可按包名装载。