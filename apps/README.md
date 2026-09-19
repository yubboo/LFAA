# apps

`apps/` 只放可启动的宿主入口。当前只有 `apps/web` 是真实应用；Desktop / CLI / Server 在拥有真实运行入口前不进入 workspace。

长期规则：App 可以装配 `packages/*` 和宿主 Adapter，但不得拥有第二套可复用业务 Core。未来新增 App 必须先证明它不是 UI/业务占位目录。
