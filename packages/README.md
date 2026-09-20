# packages

LFAA 采用“只保留真实模块”的 workspace。v0.0.80 删除无 Consumer 的 `export {}` 占位包，当前真实职责如下：

| Package | Layer | Owner |
|---|---|---|
| `@lfaa/plugin-sdk` | foundation | Plugin / Capability / App Pack 公共契约 |
| `@lfaa/credentials` | foundation | credentialRef 与 Secret Store Port |
| `@lfaa/plugin-runtime` | runtime | generation Registry 与 PluginManager 生命周期 |
| `@lfaa/agent-runtime` | runtime | Chat / Work 共用 Agent Run 契约 |
| `@lfaa/config-system` | domain | AI Provider / Account / Model 配置业务 |
| `@lfaa/ui` | presentation | UI Kit / Design System / Shared Interaction Engine |
| `@lfaa/workspace` | composition | Workspace 父领域：Chat / Work 两种产品投影 + 共用 Session |
| `@lfaa/app-shell` | composition | 产品 Shell / Chrome / Composer / Settings 与 Workspace 装配 |
| `@lfaa/plugin-host-node` | host-adapter | 独立 Plugin Profile、pnpm 事务与回滚 |

新包必须同时满足：有真实实现、有当前 Consumer、有明确 `package.json#lfaa.layer/role`；规划占位只写文档。`scripts/package-architecture-check.mjs` 强制依赖方向与循环门禁。


## 拆包原则（v0.0.96）

同一领域内部职责优先放在一个父 package 内，例如 `workspace/chat + workspace/work + workspace/shared`。只有独立生命周期/发布、部署边界、跨领域复用或多个真实 Consumer 成立时才拆成新的平级 package；禁止为了目录“看起来模块化”创建无 Consumer 占位包。
