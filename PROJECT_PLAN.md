# LFAA Project Plan — current after v0.1.5

## 当前里程碑

**v0.1.5 / Codex Windows Host 启动与诊断修复（pending-user-acceptance）**

目标：修复 v0.1.4 实机出现的 `DEP0190` 与 `Codex App Server 已退出（code=1）`，恢复 ChatGPT/Codex 套餐配置入口，并让启动失败能返回受限、脱敏后的真实 CLI 诊断。

本版：

- Windows Codex Host 不再使用 Node `shell:true + args`；
- 使用显式 `cmd.exe` 包装固定 `codex app-server` 命令，并先验证 `where.exe codex`；
- 捕获有限 stderr 尾部并脱敏后写入错误消息，避免只有 `code=1` 无原因；
- v0.1.4 Usage / Chat-Work 逻辑保持不变；
- 账户元数据仍只归 `LFAA_HOME/state/ai-accounts.json`，Codex 进程失败不能删除账户。

**AI 验证：** pass。219/219 Node 合同测试、Codex Host/Runtime 聚焦回归与 workspace-preflight 通过；真实 Windows Codex CLI + ChatGPT 登录仍由用户实机验收。

**上一里程碑：v0.1.4 / 官方余额额度与 Chat/Work 模式边界**

该版本新增官方 Usage Snapshot 与 Chat/Work 左侧导航分流；其历史验证结果见 `CHANGELOG.md` / `docs/RELEASES.md`。

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
