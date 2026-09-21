# LFAA Agent / Contributor Guide — v0.1.17

## v0.1.17 Cargo Lock / Setup 不可破坏原则

1. `Cargo.lock` 是正式发布事实，必须与 root Cargo workspace member 的 package name/version 一致；版本升级不得只改 `Cargo.toml`。
2. Windows 菜单 1 只负责获取已锁定的 Rust 外部依赖；禁止通过去掉 `--locked` 静默改写正式锁文件。
3. 当前 Rust workspace 没有外部 crate 时，菜单 1 必须跳过 `cargo fetch`，但仍需验证 Cargo.lock 一致性并记录本机同步指纹。
4. `release-rust-check` 的 check/test 必须使用 `--locked`；`workspace-preflight` 必须包含无需 Cargo 的静态 Cargo lock Gate。

本文件给 AI Agent 和开发者提供最短路径的当前约束。**先遵守当前代码与本文件，再参考历史记录。**

## v0.1.16 Smart Home / Identity UI 不可破坏原则

1. 登录后的第一屏是 Smart Home：必须同时保留自然语言主入口与手动入口；不得强迫所有用户先经过 AI 判断。
2. 没有真实 Intent Router / App Pack Registry 时，禁止用关键词 `if/else` 冒充“智能路由”；自然语言任务只允许无损 handoff 到现有通用 Workbench。
3. First Run 是唯一匿名注册入口；实例初始化后不得为了 UI 方便重新开放注册。
4. 未接入真实 Capability/Consumer 的 App Pack 必须 disabled；用户界面不得把 `App Pack 待接入`、Registry generation 等开发术语当产品文案。
5. Login / First Run / Smart Home 共用 `packages/client/app-shell/src/product-surface.css` Motion/视觉 token，并支持 `prefers-reduced-motion`。
6. Smart Home 不是第二套 Session/Agent Runtime；长期 Project/Session/Run 真值仍归现有 Owner。

## v0.1.15 开发规范 / 根目录不可破坏原则

1. **任何开发任务开始前**必须先读：`AGENTS.md` → `docs/DEVELOPMENT.md` → `docs/ARCHITECTURE.md` → `docs/PROJECT_PLAN.md` → 当前 `docs/PROMPTS.md` 合同 → 目标 package README；禁止先改代码再补合同。
2. 当前任务必须先在 `docs/PROMPTS.md` 登记 Prompt 条目、当前任务索引与允许/禁止修改边界；没有当前合同不得进入实现阶段。
3. 修改 Owner / 路径 / 架构时，必须在同一版本同步当前事实文档、对应 package/group README、contract/path Gate 和历史账本；不得只改代码。
4. 根目录 Markdown 只允许 `README.md`、`AGENTS.md`、`CHANGELOG.md`、`NOTICE.md`。架构、开发规范、项目计划统一属于 `docs/`。
5. 根目录不得出现候选 ZIP、`.log`、`.tmp` 或一次性任务 Markdown；发布 ZIP 输出必须位于仓库外。
6. 交付前至少执行 `workspace-preflight`；标准 Node 24 + pnpm 11.17.0 环境还必须执行规定的 quality/release Gate。最终 ZIP 必须 fresh extract 后再次 preflight。
7. Gate 失败时修实现/文档，禁止通过删除断言、放宽规则或伪造版本字符串让结果“变绿”。

## v0.1.14 发布治理不可破坏原则

1. 每个候选版本必须先在 `docs/PROMPTS.md` 同时登记当前 Prompt 条目、任务索引与当前合同，再生成发布 ZIP。
2. `workspace-preflight` / `governance:check` / `prompt-lifecycle:check` 任一失败都表示候选包不可交付，禁止用“本地测试通过”替代发布包 fresh-extract 验证。
3. 已交付但预检失败的候选包不得原地覆盖同版本；必须递增补丁版本，保留可追溯性。

## v0.1.13 不可破坏的 Repository / Plugin 原则

1. 保留 `packages/<capability-family>/<package>` 两层拓扑；禁止为了模仿外部 Harness 创建空包或第二套 `packages/lfaa|features|modules` 总目录。
2. 一切业务能力皆插件，但 Agent/Session/Plugin lifecycle/Identity/Credential/Config 等稳定内核不是可随意替换的业务插件。
3. 新 package 必须同时具备真实实现、真实 Consumer、独立生命周期和清晰 Owner。
4. 第一个真实 App Pack 固定为 AI Writing；AI Writing V1 未 delivered 前禁止并行开启第二个大型业务域。
5. 发布源码包不得包含本机 `.log`、Runtime Home、缓存、构建产物。


## v0.1.12 不可破坏的 Identity / App Hub 原则

1. LFAA 第一次启动必须通过 First Run 创建唯一超级管理员；初始化完成后禁止重新开放匿名注册。
2. Identity 账号是本地实例访问控制，不得和 OpenAI/DeepSeek 等 Provider Credential、套餐、Billing 混为一体。
3. Workbench 只能在有效 AuthSession 后挂载；所有 `/__lfaa/dev/*` Host HTTP API 默认先经过 Identity Gate。
4. User → Role → Permission；Role 只是 Permission 集合，禁止在业务代码中用 `if (role === ...)` 代替最终授权。
5. `AuthSession` 与 Workspace `Session` 是两类对象，命名、持久化和生命周期不得混用。
6. 登录后的第一屏现为 Smart Home；未有真实 App Pack / Consumer 的业务入口必须 disabled，禁止用通用 Workbench 冒充某个已实现业务 App。
7. Chat / Work / Manual / Infinite Canvas 仍是系统能力；未来 App Pack 只组合能力并建立边界，不复制第二套 Runtime。

## v0.1.11 不可破坏的模式 / Provider 原则

- ChatGPT 套餐 OAuth 的窗口不是认证 Owner；禁止因 popup.closed 直接判失败，必须以官方 App Server 登录/account 状态为准。

1. Chat Agent 与 Work Agent **只能有一套 Agent Core / AgentRunRequest / Session Controller / Runtime Host**。
2. 二者能力、智力、性能、工具、权限、自动化与最终交付质量必须同构；`workspaceMode` 只描述交互表现层。
3. Chat 的人工干预是对话/插话；Work 的人工干预是无限画布编辑 + 对话继续。
4. Manual 是无模型手动模式：不得进入 Agent Runtime，但必须复用 Work Canvas 和真实 Tool/Terminal 基础设施。
5. Provider 官方免费、套餐包含、按量 API、Coding Plan 等 entitlement 原样映射；禁止 LFAA 自造余额、免费/收费规则。
6. ChatGPT 套餐属于 OpenAI Provider 的官方订阅认证方式；产品不得要求用户安装全局 Codex CLI。内部可使用由 LFAA 管理的官方 App Server 组件，但不得把实现细节冒充用户依赖。
7. 支持流式的 Provider 必须通过统一 `assistant.delta` 实时投影；禁止为了省实现而退回“等待完整 JSON 后一次性回答”。
8. Usage/Quota 是附加状态：失败或超时必须进入明确终态，不能阻塞账户保存，也不能永久显示“正在读取”。
9. `AgentRuntimeEvent` 是 Chat/Work 运行过程的唯一 UI 真值：Run Timeline 只能渲染 Runtime 真正发出的 phase/reasoning-summary/plan/activity/assistant 事件，禁止用定时器或静态文案伪造执行过程。
10. 只允许展示 Provider 官方可展示的 reasoning summary；原始隐藏 reasoning / chain-of-thought 禁止进入 Client ViewModel、日志和持久化。
11. 支持 streaming 的 Provider 必须保持真正 delta 路径；Run Timeline 与最终回答必须同时可增量更新，禁止回退到完成后一次性替换。
12. 项目 / active project / expanded / pinned 与 Session / messages / mode / Run Timeline 都属于 `@lfaa/session` 长期真值；左栏不得硬编码项目或静默吞掉 Host 错误。
13. 每个 `AgentRunRequest` 必须携带正式 `sessionId`；Client 只消费当前 Session 的 Runtime Event，禁止跨 Session/Project 串流。

## 先读

1. `docs/ARCHITECTURE.md`
2. `docs/DEVELOPMENT.md`
3. `docs/项目结构与代码地图.md`
4. 你要修改的 capability family / package README

## 当前仓库地图

```text
apps/                    薄产品入口；禁止承载业务
  web/

packages/                TypeScript 业务 / Harness 主体
  api/                    本地 Host Controllers
  bundle/                 产品 Host Bundle
  client/                 Web Client / Shell / Workspace / UI
  core/                   Agent Runtime 核心契约
  credentials/            Credential seam / Native Adapter
  harness/                官方外部 Harness Adapter
  host/                   Vite 等 Host 技术适配
  identity/               Local Identity / RBAC
  llm/                    模型协议 Adapter
  plugin/                 Plugin SDK / Runtime / Host
  session/                Project / Session Domain + Host
  settings/               Config Domain / Host
  terminal/               Terminal Host 能力
  util/                   基础工具

native/                  Rust Native Kernel
scripts/                 开发/治理/发布工具
test/                    仓库级契约测试
docs/                    长期文档与历史日志
```

仓库根**不得重新创建 `.lfaa/`**。运行状态使用 `@lfaa/home-paths` 解析的用户 Runtime Home。

## Owner 规则

- 业务首先找现有 capability family；不要因为一个新文件就新增顶层 family。
- package 只有在有真实实现、当前 Consumer、明确 lifecycle/Owner 时创建。
- `apps/web` 只允许 startup/build composition；Agent、AI、Plugin、Terminal、Secret、Provider 等业务必须属于 `packages/`。
- `native/` 只允许真实 OS/Security primitive。
- 外部 Harness 通过 Adapter 接入，优先官方协议/API。

## 依赖规则

继续遵守：

```text
Service Definition → Provider → Consumer → Composition/Bundle
```

禁止：

- UI 直接读取文件/Secret；
- Domain 反向依赖 Web/Vite；
- Consumer 绕过服务定义直接抓具体 Provider；
- sibling package 深路径 import；
- 创建无 Consumer 的空 package；
- App 重新长出 `dev/bridges`。

公开跨 package import 使用 `@lfaa/*` exports。Package 内部深层模块优先使用 package-private imports 或局部相对路径，不跨包偷读内部文件。

## UI 归属

- `@lfaa/ui`：通用 UI Kit / Interaction primitive；
- `@lfaa/workspace`：Chat / Work 产品 Workspace；
- `@lfaa/app-shell`：Workbench / Composer / Settings / Shell；
- `@lfaa/client-web`：Web Client Composition；
- `@lfaa/ui-terminal`：Terminal Web UI。

Chat/Work 是 **Workspace Mode**，不是两个独立产品核心。

## Runtime / Model

- `@lfaa/config-system` 管配置，不等于模型运行 Provider；
- OpenAI-compatible 一次调用归 `@lfaa/llm-openai-compatible`；
- ChatGPT 套餐通过 OpenAI 官方 App Server 协议接入；官方运行组件由 LFAA 按需隔离在 `LFAA_HOME`，禁止把“用户必须全局安装 Codex CLI”重新作为产品前置条件；
- Run/Session 生命周期归 Agent Runtime/Controller；
- Codex App Server 归 `packages/harness/`；v0.1.2 已承担 ChatGPT 套餐的 managed auth + read-only text runtime；
- Tool/Skill/MCP 未实现前不要建空壳假装完成。
- Codex subscription runtime 必须按 Provider `connection.protocol` 路由，禁止再用 `credentialRef` 猜认证协议；ChatGPT OAuth Token 只能留在官方 Codex App Server。
- 审批 UI 未接入前，Codex Text Runtime 必须保持 read-only，并拒绝命令/文件修改审批请求。

## Secret

Secret 不能进入：

- 普通 JSON；
- Git；
- Plugin Manifest；
- 日志/Trace/Error body；
- argv；
- 普通环境变量；
- 模型上下文。

只通过 `@lfaa/credentials` seam 与 Native Broker Adapter 访问。

## Runtime Home

机器状态：

```text
LFAA_HOME
  state/
  plugins/
  cache/
  tmp/
  logs/
```

路径必须经 `@lfaa/home-paths` 统一解析。旧项目 `.lfaa/state` 只能作为迁移来源，不能成为新代码默认路径。

## 修改必须同步

如果修改架构/Owner/路径：

- 更新当前架构文档；
- 更新对应 package/group README；
- 更新 contract test 与 path gate；
- 更新 CHANGELOG + DEVELOPMENT_LOG；
- 更新 lockfile/workspace；
- 不通过“关闭门禁”让迁移假绿。

## 版本规范

显示版本每一段只允许 `0-99`。`0.0.99` 的下一版必须是 `0.1.0`，禁止创建 `0.0.100`。版本事实以 `lfaa.release.json` 为准，发布前必须通过 `release-consistency-check` / `version-policy` Gate。`releaseSequence` 只是独立内部序号。

## 质量命令

```text
pnpm run governance:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run quality:full
```

项目规定 Node 24.x、pnpm 11.17.0。若执行环境不满足，不得冒充完整质量验证已经通过；可以执行无需 workspace 依赖的静态门禁并明确限制。

## 文档新旧优先级

当前真相：代码 + 自动门禁 + `docs/ARCHITECTURE.md` / `docs/DEVELOPMENT.md` / 本文件。

`CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md`、`docs/PROMPTS.md` 是历史账本。旧条目里出现 `.lfaa`、`crates/`、`apps/web/dev` 等路径时，只解释当时版本，不用于指导 v0.1.4 开发。

## TSConfig 继承边界

业务源码跨 package 仍必须走 `@lfaa/*`。`apps/*` 与 `packages/<family>/<package>` 的 `tsconfig extends` 可以像 DeepSeek Harness 一样相对指向根级 `tsconfig.base*.json`；这种 `../` 仅属于工程配置继承，不得用于业务源码跨包引用。Client 包继承 `tsconfig.base.client.json`，其余包继承 `tsconfig.base.json`。所有迁移必须通过 `scripts/tsconfig-reference-check.mjs`。
