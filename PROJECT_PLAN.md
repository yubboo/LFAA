# LFAA Project Plan — current after v0.0.100

## 当前里程碑

**v0.0.100 / Harness Architecture Phase 1 Sync Hotfix**

目标：把 v0.0.98 已有产品能力迁入 packages-first Harness 拓扑，在不改变现有主要 UI/模型/插件/Secret/Terminal 行为的前提下，清理 App 业务和仓库运行状态。

已落地：

- `packages/<family>/<package>` capability family 拓扑；
- `apps/web` 薄入口；
- `client-web` / `client-connection` / `ui-terminal` 下沉；
- Agent/Settings/Plugin Controllers 下沉；
- Web Host Bundle；
- OpenAI-compatible LLM Adapter；
- Runtime Home 路径 seam；
- `crates/secret-store` → `native/secret-store`；
- 仓库级 `.lfaa/` 取消，旧状态兼容迁移；
- 路径/架构/同步/文档门禁随新结构更新。

## 当前冻结行为

本阶段不主动重做：

- Workbench 视觉布局；
- Chat/Work 模式；
- Infinite Canvas 行为；
- Composer/Reasoning/模型切换/动画参数；
- Provider/Account 已有设置语义；
- Plugin lifecycle 语义；
- Secret Broker 协议；
- Windows 工具总体交互。

迁移发现真实 bug 时修复，但不能借架构迁移顺手重写产品。

## 下一阶段顺序

### Phase 2 — Agent Runtime 内核化

让 `core/agent-runtime` 从主要契约包逐步长成可复用 Runtime spine；优先在包内形成清晰子模块，而不是提前创建十几个空 package。

候选能力：session、context、event、run loop、tool registry。只有出现独立 Consumer/lifecycle 才升格子 package。

### Phase 3 — Bundle 复用

当第二个 Host（Desktop/CLI/Headless）真实出现后，抽取可复用 base bundle；当前 `bundle/web-app` 保持真实可运行 Owner，不建空 `base/desktop/headless`。

### Phase 4 — Skill / MCP / Tool

以真实 UI + Runtime Consumer 驱动：

- 先定义 service/registry；
- 再接 filesystem/外部生态 provider；
- 再给 Agent Runtime tool surface；
- 不把“目录存在”当作“功能完成”。

### Phase 5 — Desktop

只有 Web Harness 组合稳定后建立 Desktop App。Desktop 复用 packages，不复制 Web 业务。

## 架构决策原则

1. packages-first；
2. App 薄；
3. Bundle 装配；
4. Native 少；
5. 有 Consumer 才拆包；
6. package name 稳定优先于物理路径稳定；
7. contract test 是重构护栏；
8. 新文档描述当前真相，历史日志只用于追溯。
