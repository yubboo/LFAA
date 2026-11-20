# @lfaa/web-fetch-http

`@lfaa/web` seam 的默认 HTTP 抓取实现。

## 行为

- 只接受 `http/https` 目标（`file://` 与自定义协议在发请求前就拒绝）。
- 跟随重定向，并在结果里给出最终地址。
- 响应体按字节上限读取（`maxBytes`，默认 2 MB），超出时截断并标记 `truncated`，而不是整体失败。
- 请求带超时（`timeoutMs`，默认 20 秒），调用方 `AbortSignal` 触发时立即中止。

## 用法

先挂 `@lfaa/web`，再挂本插件；它把 `http` 实现（优先级 `0`）注册到 `ctx.web`。

```ts
ctx.plugin(webPlugin);
ctx.plugin(httpFetchPlugin, { timeoutMs: 15_000, maxBytes: 1_000_000 });
```

包默认导出 Cordis 插件，Loader 可按包名装载。