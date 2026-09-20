# LFAA Project Plan — current after v0.1.1

## 当前里程碑

**v0.1.1 / TSConfig Root Inheritance Hotfix**

目标：修复 capability-family 迁移后 workspace `tsconfig.json` 仍沿用旧单层 package 相对深度的问题，让 Vite/TypeScript 在真正启动前就能验证工程配置继承。业务源码依赖规则保持不变。

本版新增：

- 新增根级 `tsconfig.base.client.json`，集中 React/DOM/JSX 客户端配置；
- `apps/*` 通过 `../../tsconfig.base.client.json` 继承根配置；
- `packages/client/*` 通过 `../../../tsconfig.base.client.json` 继承根配置；
- 其余 `packages/<family>/<package>` 通过 `../../../tsconfig.base.json` 继承根配置；
- 删除没有真实运行时共同解析支持的私有 `@/*` TypeScript-only alias；
- 新增 `tsconfig-reference-check`，并接入 governance / workspace-preflight；
- 新增 TSConfig 回归测试，锁住错误相对深度和 alias 回流。

既有 v0.1.0 Harness / Sync / Workspace 依赖健康修复全部保留，不重做现有业务。

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
