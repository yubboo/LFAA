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
