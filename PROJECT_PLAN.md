# LFAA Project Plan — current v0.1.8

## 当前里程碑

**v0.1.8 / ChatGPT 套餐 OAuth 完成态与关闭窗口竞态修复（pending-user-acceptance）**

目标：保持 v0.1.7 的 Provider/Streaming/Usage 行为不变，修复 OpenAI 官方 ChatGPT OAuth 已成功但用户关闭成功页后被 LFAA 误判为取消的竞态。认证真值必须来自官方账户事件 / account 状态，而不是浏览器窗口生命周期。

本版：

- ChatGPT 套餐继续使用 OpenAI 官方账户/App Server 协议，但产品层不要求用户安装 Codex CLI；Windows 由 LFAA 在 `LFAA_HOME` 按需下载固定 OpenAI 官方 App Server 独立资产并校验 SHA-256；
- ChatGPT 浏览器成功页允许关闭；Client 先轮询官方登录状态，窗口关闭只开启 30 秒确认宽限期；Host 在 pending 时用 `account/read` 兜底，`account/updated(authMode=chatgpt)` 也可确认成功；
- API Key 的“测试连接→保存”复用短期 Host Verified Probe，避免保存时重复 `/models`；
- Usage UI 改为 `idle / loading / ready / error`，API Provider 后端 15 秒网络超时，Browser 端再提供 22 秒终止线；失败不阻塞账户/模型配置；
- OpenAI Responses SSE 与 OpenAI-compatible Chat Completions SSE 都实时产生 `assistant.delta`；新增行为测试防止退回一次性 JSON；
- 左侧模式弹层修复 stacking/overflow 裁切；Chat/Work/Manual 的核心能力边界不变；
- Provider entitlement 继续执行“官方是什么，LFAA 就是什么”；无官方余额接口明确 unavailable，不估算。

**AI 验证：** pass。仓库级 Node 合同测试 188/188 PASS；Config System 42/42 PASS；SSE 行为测试 2/2 PASS；10/10 workspace tsconfig 通过 `tsc --showConfig`；统一 workspace preflight 全 Gate PASS；759-entry Unicode ZIP fresh extract preflight PASS。真实 Windows Provider / ChatGPT 套餐登录仍由用户验收。

**后续：** 在同一 `AgentRuntimeEvent` 上继续建设 Run Timeline、reasoning summary、tool/file/command activity；不为 Chat/Work 分叉事件系统。

**上一里程碑：v0.1.3 / 全量质量门禁与 Codex 取消竞态修复**

该版本修复 TypeScript 可选端口、旧 Node source importer 与 Codex 提前取消竞态；其历史验证结果见 `CHANGELOG.md` / `docs/RELEASES.md`。

**再上一里程碑：v0.1.2 / Codex App Server Chat Runtime**

目标：让已经通过 ChatGPT/Codex 套餐完成登录与 `model/list` 的模型真正进入聊天执行链；保持 v0.1.1 Harness、TSConfig、依赖健康与 Sync 治理不回退。

本版新增：

- `@lfaa/codex-app-server` 从 Managed Auth / Model Catalog Adapter 升级为共享 `CodexAppServerHost`，同时提供 Managed Auth 与 Text Runtime；
- Text Runtime 使用官方 App Server `thread/start` / `turn/start`，按 Workspace + Account + Model 复用多轮 Thread；
- 接收 `item/agentMessage/delta` 流式文本，并以 `item/completed` / `turn/completed` 收敛最终消息；
- Browser Run 取消映射为 `turn/interrupt`，并保留 timeout / process failure 收敛；
- `agent-controller` 改为依据 Config System 的 `connection.protocol` 路由 `codex-app-server` 与 `openai-compatible`，不再用 `credentialRef` 猜 Runtime；
- `bundle/web-app` 统一持有一个 Codex App Server Host，Settings 与 Chat 共用进程；
- Workspace 支持 `assistant.delta`，流式 delta 与最终 `assistant.completed` 写入同一 assistant message；
- LFAA 不读取或复制 Codex OAuth Token；审批 UI 尚未接入前，Codex Text Runtime 强制 read-only，并拒绝命令、文件写入、权限提升与 MCP elicitation 请求；
- 新增 Codex Runtime 行为回归，锁定 Thread 复用、Turn、delta、最终消息、reasoning effort 与 interrupt。

**AI 验证：** pass。仓库级 Node 合同测试 175/175 PASS；Config System 39/39 PASS；Codex Runtime 行为测试 2/2 PASS；所有 workspace tsconfig 均通过真实 `tsc --showConfig`；统一静态治理与 workspace preflight 通过。真实 Windows Codex CLI + ChatGPT 账户端到端仍由用户验收。

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
