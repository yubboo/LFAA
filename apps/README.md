# apps — Product Entries Only

`apps/` 只承载最终产品启动入口，不是业务目录。

当前只有 `apps/web`：浏览器入口使用 `@lfaa/client-web`，Vite Host 配置使用 `@lfaa/bundle-web-app`。Agent/AI/Plugin/Terminal/Secret/Provider 业务必须位于 `packages/`。
