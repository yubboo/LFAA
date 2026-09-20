# Feature UI

这里放通用 Renderer/Interaction 与 AGENTS.md 固定归属的 AI 配置图形界面。Settings 导航、Plugin 管理页和 UserMenu 产品外壳归 `packages/app-shell`。

规则：UI 只负责展示与交互，不拥有业务真值，不直接访问厂商 API / Secret / DB。

当前规划：

```text
settings/
└── ai/
```
