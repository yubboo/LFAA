# packages

LFAA 采用“只保留真实模块”的 workspace。v0.0.80 删除无 Consumer 的 `export {}` 占位包，当前职责如下：

| Package | Layer | Owner |
|---|---|---|
| `@lfaa/plugin-sdk` | foundation | Plugin / Capability / App Pack 公共契约 |
| `@lfaa/credentials` | foundation | credentialRef 与 Secret Store Port |
| `@lfaa/plugin-runtime` | runtime | generation Registry 与 PluginManager 生命周期 |
| `@lfaa/agent-runtime` | runtime | Chat / Work 共用 Agent Run 契约 |
| `@lfaa/config-system` | domain | AI Provider / Account / Model 配置业务 |
| `@lfaa/ui` | presentation | 纯 React UI / Workbench / Settings |
| `@lfaa/app-shell` | composition | 产品壳与 ViewModel/Host 组合 |
| `@lfaa/plugin-host-node` | host-adapter | 独立 Plugin Profile、pnpm 事务与回滚 |

新包必须同时满足：有真实实现、有当前 Consumer、有明确 `package.json#lfaa.layer/role`；规划占位只写文档。`scripts/package-architecture-check.mjs` 强制依赖方向与循环门禁。
