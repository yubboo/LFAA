# LFAA Project Plan — current v0.1.9

## 当前里程碑

**v0.1.9 / #22.15 实时 Agent Run Timeline / Streaming Activity（pending-user-acceptance）**

目标：以用户上传的 DeepSeek Harness 源码为实现参考，完成 LFAA 自己的真实运行过程投影。Chat/Work 继续共用同一 Agent Core；用户提交任务后不能静默等待最终答案，而应立即看到真实 Run 状态、已处理时间、可展开 reasoning summary/plan/tool/command/file/search/MCP activity，并让最终 Assistant answer 继续真实流式输出。

本版：

- `@lfaa/agent-runtime` 扩展统一 Run Timeline 事件：phase、官方 reasoning summary、plan、activity lifecycle、assistant streaming、run terminal state；
- `@lfaa/codex-app-server` 映射官方 `turn/started`、`item/reasoning/summaryTextDelta`、`item/plan/delta`、`item/started/completed`、`item/commandExecution/outputDelta` 等事件；明确不映射原始隐藏 reasoning text；
- `@lfaa/agent-controller` 把 Codex 原生事件和 OpenAI-compatible streaming 统一成 Agent Runtime Event；
- `@lfaa/workspace` 新增 Run Process ViewModel 与可展开 Timeline；运行中显示“已处理 X 秒”，完成后显示“用时 X 秒”；
- Assistant 最终文本与过程 Timeline 分离；`assistant.delta` 持续更新同一条答案，禁止等待完成后一次性输出；
- Chat / Work 继续消费同一 Runtime Event；Manual 不启动 Agent，不受本次事件协议影响；
- UI 只展示真实 Runtime activity 和官方可展示 reasoning summary，不伪造思考步骤，不泄露隐藏 chain-of-thought。

**AI 验证：** pass。源码树 Node 合同测试 190/190 PASS；Config System 42/42 PASS；Timeline/Codex/SSE 聚焦回归 16/16 PASS；10/10 workspace tsconfig 通过 `tsc --showConfig`；静态治理 Gate 全 PASS；759-entry Unicode ZIP fresh extract 静态 preflight 全 PASS。真实 Provider 端到端视觉/节奏仍由用户验收。

**后续：** 把同一 `AgentRuntimeEvent` 更深地投影到 Work 无限画布节点/边和审批 UI；Session 持久化仍是独立后续能力，不能用 localStorage 临时替代。

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
