# packages — LFAA Harness Capability Workspace

`packages/` 是 LFAA 的业务/Harness 主体，采用 `packages/<capability-family>/<package>/` 两层拓扑。

```text
api/          Host Controllers
bundle/       产品 Host 组合
client/       Browser/Product Client
core/         Agent Runtime 核心
credentials/  Credential seam / adapter
harness/      外部官方 Harness adapter
host/         Host technology adapter
llm/          模型运行协议
plugin/       Plugin platform
settings/     Config domain / host
terminal/     Terminal host
util/         跨能力基础 seam
```

`apps/` 不拥有这些业务；`native/` 只承载真正原生 primitive。新增 family/package 前先看 `DEVELOPMENT.md` 的“真实实现 + 当前 Consumer + 清晰 Owner”规则。
## 当前拓扑策略（v0.1.14）

当前 14 个 capability family / 29 个 package 是真实实现基线，不为了模仿外部 Harness 的包数量继续拆分。新增 family/package 必须同时满足：**真实实现、真实 Consumer、独立生命周期、清晰 Owner**。业务扩展优先通过 `@lfaa/plugin-sdk` Capability/App Pack 进入；禁止再建立 `packages/lfaa`、`features`、`modules` 等平行总目录。

第一个新增业务域锁定为 AI Writing，但在 App Pack Runtime 闭环前不创建空 Writing package。

