---
description: "Web capability seam: fetch implementations register by priority; tools and the agent depend only on this service."
kind: "package"
---

# @lfaa/web

Web capability seam for LFAA. Fetch implementations register by priority; tools and the agent depend only on this service.

## API

| Export | Purpose |
| --- | --- |
| `WebService` | `ctx.web`: register providers, list them, fetch text by priority |
| `WebProvider` | Contract for one implementation (`id`, `priority`, `fetchText`) |
| `orderProviders` | Pure ordering helper shared by service and tests |

`fetchText` tries providers from highest to lowest priority and only throws after every provider failed, aggregating each error.

## Install

```bash
pnpm add @lfaa/web
```

The package default-exports the Cordis plugin, so the Loader can mount it by package name. Pair it with `@lfaa/web-fetch-http` for the default HTTP implementation.