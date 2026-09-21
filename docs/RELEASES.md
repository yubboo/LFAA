# LFAA Releases — current policy v0.1.11

## v0.1.11 — #22.17 Project + Session Persistence / Runtime Event Isolation

- 状态：`pending-user-acceptance`；AI 验证：`pass`；用户验收：`pending`。
- 修复 Session API 返回 HTML 时前端静默恢复默认：非 JSON Host 响应现在显示明确错误。
- 新增持久 Project Index：创建、切换、展开、置顶、重命名、删除与 active project 均为真实状态。
- Session 增加置顶；Project → Session → messages/Run Timeline/mode/workContext 跨刷新恢复。
- `AgentRunRequest.sessionId` 与 Project `workspaceId` 分离；Runtime 事件、模型 conversation cache 按 Session 隔离。
- Run disclosure 记录真实 phase history，并继续展示 reasoning summary / plan / activity / output。
- 新增真实磁盘 Repository 重启/migration 测试，并完成独立浏览器刷新回归。

## v0.1.10 — #22.16 Session Persistence / Stable Navigation / Dual Mode Switch

- 状态：`pending-user-acceptance`；AI 验证：`pass`；用户验收：`pending`。
- 新增统一 `@lfaa/session`、Node Persistence Provider 与 Session HTTP Controller；对话/Run Timeline/最近会话写入 `LFAA_HOME/state/sessions/`。
- F5 恢复 active Session、messages、mode、work context；旧 running Run 恢复为明确中断状态。
- 左栏跨 Chat/Work/Manual 保持稳定；最近记录来自真实 Session，删除硬编码假历史。
- 左上角与中央顶部两个 mode switch 控制同一 `workspaceMode`；切换只改变中央 Interaction Surface。
- Run Timeline 调整为紧凑 `思考了 X 秒 ⌄`；展开查看真实 reasoning/plan/activity；Assistant answer 继续真流式。
- AI 验证：Node 合同 193/193、Config System 42/42、Package Architecture 27 Node workspaces / 1 Native crate、10/10 tsconfig 与当前治理门禁均 PASS；最终 777-entry Unicode ZIP fresh extract 的 current-fact / release / prompt / package / tsconfig / docs / UI contract 均 PASS。

## v0.1.9 — #22.15 实时 Agent Run Timeline / Streaming Activity

- 状态：`pending-user-acceptance`；AI 验证：`pass`；用户验收：`pending`。
- 参考用户提供的 DeepSeek Harness 源码事件组织，把 Run/Reasoning/Tool/Answer 从静默等待改为真实增量 Timeline。
- `@lfaa/agent-runtime` 新增 phase、reasoning summary、plan、activity lifecycle 与 run terminal events；UI 以该事件流为唯一过程真值。
- Codex App Server 官方 reasoning summary / plan / command/file/search/MCP activity 映射到统一事件；原始隐藏 reasoning 不进入 UI。
- Chat Run Process Card 实时计时、可展开过程；Assistant 最终答案继续通过 `assistant.delta` 真流式输出。
- Chat/Work 保持同一 Agent Core；Manual 不启动模型。
- 用户验收前保持 pending-user-acceptance；真实 Provider 视觉/节奏仍需用户实机验证。
- AI 验证：Node 合同 190/190 PASS；Config System 42/42 PASS；Timeline/Codex/SSE 聚焦回归 16/16 PASS；10/10 tsconfig 可加载；759-entry Unicode ZIP fresh extract 静态 preflight PASS。


## v0.1.7 — #22.13 Provider 官方登录 / Usage 终态 / 真流式回复

- 状态：`pending-user-acceptance`；AI 验证：`pass`；用户验收：`pending`。
- ChatGPT 套餐保持 OpenAI 官方账户认证；Windows 由 LFAA 管理固定官方 App Server 独立组件，不要求全局 Codex CLI/PATH。
- API Key Probe 成功后保存复用短期 Verified Probe，避免重复远端模型目录请求。
- Usage 改为独立异步状态并具有 timeout/error 终态，失败不阻塞模型账户使用。
- OpenAI Responses / OpenAI-compatible Chat Completions 改为真实 SSE streaming，通过统一 `assistant.delta` 驱动 Chat/Work。
- 左侧模式弹层修复 overflow/stacking context 裁切。
- 新增真实 SSE 行为测试；源码树验证：Node 188/188 PASS、Config System 42/42 PASS、SSE 行为 2/2 PASS、10/10 tsconfig `tsc --showConfig` PASS；759-entry Unicode ZIP fresh extract `workspace-preflight` PASS。


## v0.1.6 — #22.12 单一 Agent Core / Chat·Work·Manual

- 状态：`pending-user-acceptance`；AI 验证：`pass`；用户验收：`pending`。
- Chat Agent / Work Agent 继续共享同一 Agent Runtime、模型、工具、权限与交付质量；`workspaceMode` 只描述表现层。
- 新增运行中 `interveneRun`：Chat 通过对话插话，Work 通过同一入口附带人工编辑后的 `workspaceContext`；Codex 类 Runtime 可使用原生 steer，其他 Provider 由 Host 统一续跑。
- Work 无限画布节点支持人工编辑，Agent 输出回投同一画布；用户和 AI 围绕同一 Workspace Context 协作。
- 新增 Manual：无模型也可进入，复用 InfiniteCanvas、Terminal 与真实 Tool 基础设施；Manual 不创建 Agent Run。
- Provider entitlement 原则冻结：官方免费/套餐/API/Coding Plan 的可用性和额度原样映射，LFAA 不添加自有模型额度。
- ChatGPT 套餐不再要求用户安装全局 Codex CLI：LFAA 按需使用 OpenAI 官方 installer 的 daemon-only 模式，把固定版本官方 App Server 隔离到 `LFAA_HOME`，并继续通过官方 OAuth / account / model / usage / thread / turn RPC。
- AI 验证：Node 合同测试 183/183 PASS；Config System 41/41 PASS；TypeScript/TSX 语法转译 165/165 PASS；workspace preflight 全 Gate PASS。

## v0.1.4 — #22.11 官方余额额度与 Chat/Work 模式边界

- 新增统一 `AiAccountUsageSnapshot`；Provider 只能接官方余额/额度/usage/rate-limit 数据。
- ChatGPT 套餐使用 Codex App Server `account/rateLimits/read` / `account/usage/read`，只标记为 Codex/Work，不冒充标准 ChatGPT Chat 额度。
- DeepSeek 接官方 `/user/balance`；阿里云在具备 Workspace ID 时接官方 `/api/v1/quotas`。
- 官方未提供稳定普通账户接口的 Provider 明确显示“官方未提供”，禁止估算。
- Chat/Work 左侧导航按模式分流。
- 状态：`pending-user-acceptance`；真实 Provider 端到端额度值仍由用户实机账户验收。


## v0.1.3 — #22.10 全量质量门禁与 Codex 取消竞态修复

- 修复 Web TypeScript 严格可选参数错误、旧 Node source importer 测试与 Codex 提前取消的未处理拒绝。
- 发布验证：`pnpm run quality:full` 全链通过；Rust check/test 通过（2/2）；Web 开发入口 200；Unicode ZIP 745 entries，fresh extract `workspace-preflight` 全 Gate PASS。
- 状态：`pending-user-acceptance`；AI 验证 `pass`；用户验收 `pending`。

## v0.1.2 — Codex App Server Chat Runtime

- ChatGPT/Codex 套餐不再停在登录与 `model/list`，新增官方 `thread/start` / `turn/start` 文本 Runtime；
- 支持 `item/agentMessage/delta` 流式回复、最终 `assistant.completed` 与 `turn/interrupt` 取消；
- `agent-controller` 按 Provider `connection.protocol` 路由，不再通过 `credentialRef` 猜协议；
- 设置页 Managed Auth 与 Chat Runtime 共享一个 `CodexAppServerHost`；
- LFAA 不读取/保存 Codex OAuth Token；审批 UI 未接入前强制 read-only 并拒绝写入/执行类 server request；
- 新增 Codex Runtime 行为回归测试，并更新 Chat streaming contract。
- AI 验证：仓库级 Node 合同测试 175/175 PASS；Config System 39/39 PASS；Codex Runtime 行为测试 2/2 PASS；统一静态治理 / workspace preflight PASS；真实 Windows Codex CLI + ChatGPT 账户端到端保留给用户验收。

**当前任务：#22.9 · ChatGPT/Codex 套餐 Text Runtime · v0.1.2 · pending-user-acceptance · AI=pass · 用户验收=pending**

## v0.1.1 — TSConfig 根配置继承 / Vite 启动修复

- 修复 capability-family 迁移后的 tsconfig extends 深度错误；
- 新增 `tsconfig.base.client.json` 作为 Client 工程配置 Owner；
- 移除无运行时共同解析支持的 `@/*` 私有 paths alias；
- 新增 `tsconfig-reference-check` 并接入 governance / workspace preflight；
- 业务源码跨 package 仍只允许 `@lfaa/*` 公共 API。

**当前任务：#21.29 · TSConfig / Vite 启动修复 · v0.1.1 · pending-user-acceptance · AI=pass · 用户验收=pending**

### v0.1.0 — Harness 架构收口 / Sync 与依赖健康修复


- 承接 v0.0.99 的 capability-family / packages-first / thin-app / Runtime Home / native 架构；
- 修复退役 workspace 只剩 `node_modules` / `target` 等缓存时 Sync 无法清理、`current-fact` 误判旧 Owner 回流的问题；
- 修复依赖健康检查仍只扫描旧单层 `packages/*`，导致“workspace 25，但只真实解析 10/10”的假健康；
- 当前扫描以 `pnpm-workspace.yaml` 为唯一 workspace 来源，当前仓库共 25 个 importer；
- lockfile 检查升级为 importer + section + specifier 精确覆盖；
- 菜单 1 在真实缺依赖时自动执行 `pnpm install`，Web 启动复用同一 readiness；
- 新增版本策略 Gate，禁止 `0.0.100` 这类非法显示版本。

**当前任务：#20.20 + #21.28 hotfix · v0.1.0 · pending-user-acceptance · AI=pass · 用户验收=pending**

> **版本纠正：** LFAA 版本每一段都限制为 `0-99`。因此 `v0.0.99` 后必须进入 `v0.1.0`。此前生成的 `v0.0.100` / `v0.0.101` 为误标构建，不属于正式发布序列；对应修复统一纳入 v0.1.0。

## 当前版本

```text
displayVersion: 0.1.11
releaseSequence: 111
architectureVersion: 6
agentProtocolVersion: 3
```

`lfaa.release.json` 是版本元数据 Owner。根 package、workspace packages 和 Native crate 版本必须保持一致。`releaseSequence` 是独立内部发布序号，不等于 displayVersion 的 patch 位。

## 版本进位规范

LFAA 使用三段显示版本 `major.minor.patch`，但项目约定每一段都只允许 `0-99`：

```text
0.0.98 → 0.0.99
0.0.99 → 0.1.0
0.1.99 → 0.2.0
0.99.99 → 1.0.0
```

禁止：

```text
0.0.100
0.100.0
```

`scripts/version-policy.mjs` 与 `release-consistency-check.mjs` 负责机器校验；开发者不得手工绕过该 Gate。

## Release gates

正式发布环境：

```bash
pnpm run release:environment
pnpm install --frozen-lockfile
pnpm run release:verify
```

其中 release verify 包含完整质量与 Rust 检查。

## Archive

使用：

```bash
pnpm run release:archive
```

归档器显式处理 Unicode ZIP entry，并在生成后反向解析 Central Directory 验证 canonical 中文路径的 UTF-8 bit。

源码包不应包含：

- `node_modules`
- `dist`
- `target`
- 本机 Runtime Home
- repo `.lfaa`
- 临时/缓存文件

## Workspace Sync

Sync 原则：

1. 验证来源包版本与结构；
2. source preflight；
3. 生成差异；
4. 用户确认；
5. v0.0.99 前旧 `.lfaa/state` 已知运行数据先迁移到 LFAA_HOME；
6. 镜像源码；
7. 再运行治理/路径检查。

`pnpm-lock.yaml` 的保护只允许在依赖声明指纹证明未变化时发生，不能把旧 lockfile 无条件覆盖新架构。

## 历史

更早版本的详细发布过程保留在根 `CHANGELOG.md` 与 `docs/DEVELOPMENT_LOG.md`。其中关于 `.lfaa` 保留、旧 `crates/`、旧 Web bridge 的内容只属于对应历史版本。
