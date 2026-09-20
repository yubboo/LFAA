# @lfaa/bundle-web-app

Web Host Bundle。集中组合 Vite Host 与 Agent / Settings / Plugin / Terminal capability，让 `apps/web/vite.config.ts` 保持薄入口。

v0.1.2 起 Bundle 同时拥有一个共享 `CodexAppServerHost`：

```text
CodexAppServerHost
├─ managedAuth → settings-controller
└─ textRuntime → agent-controller
```

因此设置页认证、`model/list` 与 Chat Runtime 复用同一 App Server 进程。Bundle 只做 composition，不重新实现 Codex JSONL、Provider、Plugin、Terminal 或 UI 业务。
