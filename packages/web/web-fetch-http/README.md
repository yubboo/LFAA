---
description: "Default HTTP fetch implementation for the @lfaa/web seam with timeouts and byte caps."
kind: "package"
---

# @lfaa/web-fetch-http

Default HTTP fetch implementation for the `@lfaa/web` seam.

## Behaviour

- Only `http/https` targets are accepted (`file://` and custom schemes are rejected before any request).
- Redirects are followed; the final URL is reported.
- Response bodies are read with a byte cap (`maxBytes`, default 2 MB) and flagged as `truncated` instead of failing.
- Requests time out (`timeoutMs`, default 20 s) and are cancelled when the caller's `AbortSignal` fires.

## Usage

Mount `@lfaa/web` first, then this plugin. It registers the `http` provider (priority `0`) on `ctx.web`.

```ts
ctx.plugin(webPlugin);
ctx.plugin(httpFetchPlugin, { timeoutMs: 15_000, maxBytes: 1_000_000 });
```

The package default-exports the Cordis plugin, so the Loader can mount it by package name.