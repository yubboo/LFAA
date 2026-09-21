# LFAA Project Plan — current v0.1.11

## 当前里程碑

**v0.1.11 / #22.17 Project + Session Persistence / Runtime Event Isolation（pending-user-acceptance）**

目标：修复 v0.1.10 实机暴露的静默空状态、静态项目与 Session/Runtime 路由混用。刷新必须恢复项目、会话、置顶、展开、消息、Run Timeline 与模式；Chat / Work 中央行为按 mode 解耦，同时继续共享一个 Agent Core。

本版新增：

- Project Index：创建、切换、展开、置顶、重命名、删除与 active project 全部持久化；
- Session Index：最近与置顶真实可点击，消息/mode/work context/Run Timeline 跨刷新恢复；
- `AgentRunRequest.sessionId`：事件和模型 conversation 按 Session 隔离，禁止跨项目/会话串流；
- Host 握手错误可见：非 JSON/未接入不再显示为空历史；
- Run Timeline 记录真实 phase history，即使 Provider 没有 reasoning summary 也可展开查看阶段；
- 真实磁盘行为测试与浏览器刷新回归覆盖。

v0.1.10 已完成的基础能力继续保留：

- 新增真实 `@lfaa/session`、`@lfaa/session-host-node` 与 `@lfaa/session-controller`；Session 写入 `LFAA_HOME/state/sessions/`，不使用 repository `.lfaa`，也不以 localStorage 代替对话持久化；
- Chat / Work / Manual 共用一个 Session Domain；消息、Run Timeline、mode、work context、最近记录与 active session 统一持久化；
- 刷新后恢复最后 Session；刷新前仍在 running 的 Run 明确收敛为“上次运行已中断”，禁止假装继续运行；
- 左栏删除硬编码 `recentRuns`，改为真实最近 Session，可新建、点击恢复；左栏结构不再随 mode 改变；未实现入口明确 disabled；
- 左上角品牌菜单继续切换 mode；中央 Header 新增 Chat / Work / Manual segmented switch，两者绑定同一 `workspaceMode`；只有中央表现层随模式变化；
- Chat Run Timeline 改为紧凑“思考了 X 秒 ⌄”布局；点击后展开 reasoning summary、plan、command/file/search/MCP/tool activity；最终回答继续独立真实流式输出；
- Work / Manual Canvas 以当前 Session ID 作为画布持久化 key，切换最近 Session 时恢复对应画布。

**AI 验证：** pass；Node 合同测试 193/193、Config System 42/42、27 个 Node workspace / 1 个 Native crate 架构检查、10/10 workspace tsconfig 真实加载及当前治理门禁均通过。最终 777-entry Unicode ZIP fresh extract 静态门禁也通过；真实浏览器刷新恢复、左栏交互与视觉节奏仍由用户验收。

**后续：** Session Store 当前为 JSON Provider；数据量达到需要数据库时，在 `@lfaa/session-host-node` 后替换 SQLite Provider，不改变上层 Session Contract。

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
