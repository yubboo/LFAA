# LFAA Development Standard — v0.1.17

## v0.1.17 Rust Lock / Windows Setup 开发规范

- 产品版本递增时，Rust workspace member 的 `Cargo.toml` 与 `Cargo.lock` 必须在同一变更内同步；禁止把 Cargo.lock 留给用户机器修复。
- `LFAA-Setup.bat` 菜单 1 是依赖缓存同步入口，不是 lockfile 生成器：合法锁文件使用 `cargo fetch --locked`，无外部 crate 直接跳过 fetch。
- `scripts/cargo-lock-consistency-check.mjs` 提供无需 Rust/Cargo 的来源静态门禁；真实发布 Rust check/test 继续用 Cargo 且必须加 `--locked`。
- Cargo 锁文件不一致属于来源包/同步问题，必须在发布或 Sync 来源预检阶段失败，不应等到用户确认写操作后才出现 Cargo 101。

## v0.1.16 Smart Home / Identity Surface 开发规范

- Smart Home 属于 `@lfaa/app-shell` 产品入口层；它可以持有临时输入与导航状态，但不得拥有 Project/Session/Agent Run 长期真值。
- 自然语言入口在真实 Intent Router 接入前只做 **lossless handoff**：`Smart Home draft → AgentWorkbench initialComposerDraft → Composer draft`，不得自动调用 `startRun`，不得按关键词猜业务 App。
- 手动入口永远保留；真实可用入口可直接打开，未接入 App Pack 的入口保持 disabled。
- Login / First Run 只改表现层，不改 Identity Host 安全语义；First Run 初始化后仍永久关闭匿名注册。
- 产品入口动效统一使用共享 token，普通 hover/press/enter 有柔和阻尼感，且必须尊重 `prefers-reduced-motion`。
- 不为“最近工作”等视觉模块伪造数据；只有接入真实 Session/Project consumer 后才能展示。

## v0.1.15 强制开发工作流

任何人或 AI Agent 修改 LFAA，都按以下顺序执行；顺序本身属于开发规范：

```text
读取当前规范/Owner
→ 在 docs/PROMPTS.md 先登记当前合同
→ 明确允许/禁止修改 + 验收 + 必须测试
→ 只修改合同范围内代码/文档
→ 同步当前事实文档与 package README
→ 执行 governance / contract tests / type/build（环境允许时）
→ 更新 CHANGELOG + DEVELOPMENT_LOG + RELEASES
→ 生成候选 ZIP
→ fresh extract → workspace-preflight
→ 才允许交付用户验收
```

禁止：先写代码后补 Prompt、只更新版本号不更新当前事实、把历史账本当当前规范、通过关闭 Gate 获得绿色结果。

### 根目录职责

仓库根目录只承载“打开仓库就必须看见”的入口与工具链配置。Markdown 固定为：

- `README.md`：产品/仓库入口；
- `AGENTS.md`：Agent/Contributor 最短约束；
- `CHANGELOG.md`：追加式发布历史；
- `NOTICE.md`：法律/署名说明。

长期架构、开发规范和项目计划统一在：`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`、`docs/PROJECT_PLAN.md`。根目录布局由 `scripts/root-layout-check.mjs` 锁定；不得为了单次任务新增根级 Markdown、ZIP、LOG 或 TMP。

## v0.1.14 Release / Prompt 生命周期规范

- 发布前必须先把当前版本写入 `docs/PROMPTS.md` 的 Prompt 条目、任务索引和“当前任务 / 当前合同”区。
- 必须在最终 ZIP 的 fresh extract 上运行 `workspace-preflight` 等价治理链；源工作树通过不能替代候选 ZIP 通过。
- 已经对外给出的无效候选包只能用新补丁版本修复，禁止用同版本不同内容覆盖。
- 本版只修发布治理，不借机改 Runtime、UI、Session、Provider、Plugin 或 Identity。

## v0.1.13 Repository / Product Track 开发规范

- 当前 capability-family/package 拓扑是基线，不以外部 Harness 包数量为目标。
- 新业务优先以 Plugin Capability / App Pack 组合进入；内核协议保持稳定。
- 新 package 必须有真实 Consumer，禁止为规划提前建空包。
- AI Writing 是第一个完整业务纵向能力；其 V1 未完成前，不启动第二个大型 App Pack。
- `release-archive` 必须排除本机 `*.log`；空运行日志目录可以保留，日志文件不属于发布源码。

## v0.1.12 Identity / Access 开发规范

- First Run 只允许在未初始化实例创建第一个 `super_admin`；初始化后不提供匿名注册。
- Password 只能在 Host 使用强 KDF 保存散列；Auth Token 明文只能存在于 HttpOnly Cookie / 短生命周期内存，禁止 localStorage/sessionStorage/URL/log。
- `AuthSession` 与 Workspace `Session` 必须分离；前者回答“谁在使用实例”，后者回答“在哪个 Project 里进行哪次工作会话”。
- 所有本地 Host HTTP API 默认要求有效 AuthSession；细粒度 Tool/Agent/Plugin 权限仍必须在对应 Owner 再校验。
- User / Role / Permission 归 Identity Owner；Role 只是权限集合，业务模块不得硬编码角色名作为最终授权。
- Smart Home 在登录后挂载；无真实实现的 App Pack 入口必须 disabled；未来 App Hub 负责应用发现/管理。
- Identity 不拥有 Provider Credential；OpenAI/DeepSeek API Key/OAuth 继续归 Credentials/Provider Owner。

## v0.1.11 Project / Session / Navigation 开发规范

- Chat / Work / Manual 必须共用 `@lfaa/session`；禁止重新出现 `chatSessions` / `workSessions` 两套持久层。
- Conversation、Run Timeline、最近会话不得只存在 React `useState` 或 localStorage；长期真值写入 `LFAA_HOME` Session Host。
- localStorage 只允许保存轻量 UI preference；不得作为聊天记录、Run history 的数据库。
- 左侧导航跨 mode 保持稳定；mode 变化只改变中央 Interaction Surface。
- 左上角 mode menu 与中央 mode switch 必须绑定同一个 mode state。
- Timeline 展开内容只能来自真实 Runtime Event；最终答案继续使用真实 `assistant.delta`。
- 项目创建、切换、展开与置顶必须通过 Session Host 持久化；不得用静态 `lfaa` 项目占位。
- Runtime Event 必须按 `sessionId` 过滤；Project ID 只负责项目归属和工作区上下文。
- Host transport 返回 HTML/非 JSON 时必须显示明确连接错误，禁止降级成空历史。


本文件是当前开发规范。历史版本的设计过程请看 `CHANGELOG.md`、`docs/DEVELOPMENT_LOG.md` 和 `docs/PROMPTS.md`；历史内容不得覆盖本文件。

## ChatGPT 套餐登录状态规则

- 浏览器窗口生命周期不得作为认证成功/失败的事实源；Hosted Success Page 可被用户正常关闭。
- 成功必须由官方 App Server `account/login/completed`、`account/updated(authMode=chatgpt)` 或 `account/read` 确认。
- 关闭成功页后应继续短期轮询；只有官方 failed、明确取消或超时才能进入失败终态。
- LFAA 不读取或保存 ChatGPT OAuth Token。


## 1. 开发目标

LFAA 不是“一个 React App 加若干工具函数”，而是一个 packages-first Agent Harness 产品。新增代码必须有明确 Owner，并保持 App、能力、Host、Native 之间的边界。

## 2. 环境

- Node.js：24.x
- pnpm：11.17.0
- Rust：`rust-toolchain.toml`
- Package manager：仅 pnpm

Windows 优先使用 `LFAA-Setup.bat`。Setup 依赖检测以 `pnpm-workspace.yaml` 声明的全部 workspace importer 为范围，以真实安装/解析 + importer 级 lockfile 覆盖为准；dependency-state 只用于显示依赖声明差异和加速基线，不能决定“已就绪”。菜单 1 被用户选择后，如检测到真实缺依赖，会自动同步当前声明的 Node 依赖。

## 2.1 Agent Run Timeline / Streaming 开发规范

- `AgentRuntimeEvent` 是运行过程唯一事实源；Client 不得通过 `setTimeout`、静态步骤列表或猜测 Provider 行为伪造“正在思考/正在运行工具”。
- Run 启动必须带稳定 `startedAt`；计时只负责表现 elapsed，不得反过来创造 Runtime 状态。
- Provider 有官方 reasoning summary 时映射 `reasoning.summary.delta`；原始隐藏 reasoning / chain-of-thought 不映射、不记录、不持久化。
- 计划进入 `plan.updated`；命令/文件/搜索/MCP/Tool 等进入 `activity.started → activity.output.delta → activity.completed`。
- 最终回答使用 `assistant.delta` 实时追加，再由 `assistant.completed` 收敛。支持流式的 Provider 禁止为了实现方便退回完整 JSON 一次性输出。
- Chat / Work 的 Timeline 数据来自同一 Session Controller；Work 可选择画布式投影，不能复制第二套 Agent Runtime。
- Provider 不提供某种事件时允许缺省，UI 必须忠实显示已有事件，不得补造。

## 2.1 官方状态数据

所有 Provider 余额/额度/速率限制必须可追溯到官方 API 或官方 Runtime。无官方稳定接口时应返回“不可用/官方未提供”，不得生成百分比、余额或“无限”标签。OpenAI ChatGPT 标准 Chat 与 Codex/Work 的额度语义必须分开；仅 `account/rateLimits/read` / `account/usage/read` 得到的数据只能标记为 Codex/Work。

ChatGPT 套餐接入必须保持产品层无外部 CLI 前置：允许使用 OpenAI 官方 App Server 作为嵌入协议，但运行组件必须由 LFAA 按需管理在 `LFAA_HOME`；禁止要求用户自行执行 `npm install -g @openai/codex` 或把 `codex` 加入 PATH。LFAA 不能读取官方组件的 OAuth/Token 文件。

## 2.2 Agent 交互模式开发规范

- Chat Agent 与 Work Agent 必须共享同一 `AgentRunRequest` / `AgentRuntimeHost` / Session Controller；禁止复制 Runtime、工具集、权限或模型路由。
- `workspaceMode = chat|work` 只能改变 View/人工干预呈现，不得改变模型智力、性能等级、工具能力或交付质量。
- Chat 干预使用 `interveneRun` 对话/插话；Work 干预通过同一 `interveneRun` 并附加用户编辑后的 `workspaceContext`。
- Manual 只属于 Client Workspace Mode，不得加入 `AgentWorkspaceMode`；Manual 无模型也必须可进入，并复用 InfiniteCanvas/Terminal/Tool Registry 的真实实现。
- 未注册的工具必须 disabled/明确“待接入”，禁止 UI 假装可执行。


## 2.3 Provider Runtime / Streaming / Usage 规范

- “测试连接 / 获取模型”是远端 Probe；用户随后保存时，如果 Provider/认证/连接设置/Secret 未变化，允许复用短期 Host Probe，禁止无意义重复访问同一官方模型目录。
- Provider Runtime 支持官方流式协议时必须真实流式；OpenAI Responses / Chat Completions SSE 都归一成 `assistant.delta`，最终用 `assistant.completed` 收敛。
- Usage/Quota 不参与账户保存事务。官方额度读取必须可超时、可失败、可重试，并把错误显示为终态；禁止 spinner 永久等待。
- ChatGPT 套餐的用户体验只能描述为 OpenAI 官方账户/套餐登录；禁止要求全局安装 Codex CLI。若内部使用官方 App Server 组件，必须放入 `LFAA_HOME`、固定来源/版本并校验官方资产。
- 内部 Adapter 名称可以保留协议事实（例如 codex-app-server），但产品文案不得把实现组件当作用户必须理解或安装的客户端。

## 3. 仓库规则

```text
apps/        只启动产品
packages/    所有 TS 业务/Harness 能力
native/      Rust Native primitive
scripts/     开发与发布工具
test/        跨包契约与架构测试
docs/        长期文档/历史记录
```

### 3.1 `apps/`

App 不拥有业务。`apps/web` 当前只保留：

- `src/main.ts`
- `vite.config.ts`
- build/type config
- HTML/README/tests（如有）

禁止重新添加 `apps/web/dev/bridges`、`host-clients`、Terminal implementation、Provider implementation。

### 3.2 `packages/`

物理结构使用：

```text
packages/<capability-family>/<package>/
```

新增 family 需要长期独立领域，不是为了分类一个文件。新增 package 必须同时满足：

1. 有真实实现；
2. 有当前 Consumer；
3. 有清晰 Owner/生命周期；
4. 拆包能减少错误依赖或提供独立替换点。

否则先作为现有 package 内子模块成长。

### 3.3 `native/`

普通业务默认 TypeScript。Rust 只用于 Secret/OS/Security/性能上确实需要的 native primitive。禁止复制 Agent、Provider、Session、Workspace 业务到 Rust。

## 4. Capability family 当前职责

- `api`：本地 Host controller / protocol boundary；
- `bundle`：把一组 Host capability 装成产品；
- `client`：浏览器/产品 Client；
- `core`：Agent Runtime 核心稳定契约；
- `credentials`：Secret service seam；
- `harness`：官方外部 Harness adapter；
- `host`：Vite 等 Host technology adapter；
- `llm`：实际模型协议 adapter；
- `plugin`：Plugin contracts/runtime/host；
- `settings`：配置 Domain 与 Host provider；
- `terminal`：本地 PTY/Terminal host；
- `util`：真正跨能力的基础 seam。

每个 family 根应有 README，说明“负责/不负责/演进条件”。

## 5. Service / Provider / Consumer / Composition

必须优先使用：

```text
Service Definition
      ↓
Provider
      ↓
Consumer
      ↓
Composition / Bundle
```

不要让：

- Domain 认识 Vite；
- UI 认识 node:fs / node-pty；
- Plugin Runtime 认识 pnpm CLI 细节；
- Agent Controller 自己实现所有 Provider 协议；
- App 直接 import 每个 Host Adapter。

## 6. Package layer

`package.json#lfaa.layer` 是机器依赖门禁，不取代 capability family：

- `foundation`
- `runtime`
- `domain`
- `presentation`
- `composition`
- `host-adapter`
- `host`
- `bundle`
- `app`

改 layer 前必须检查 `scripts/package-architecture-check.mjs`，不能为绕过错误依赖随便提高层级。

## 7. Web 架构

浏览器侧：

```text
apps/web/src/main.ts
  → @lfaa/client-web
  → @lfaa/app-shell
  → @lfaa/workspace / @lfaa/ui
```

Host 侧：

```text
apps/web/vite.config.ts
  → @lfaa/bundle-web-app
  → @lfaa/host-vite + Controllers
```

Browser ↔ Host 只通过协议/事件通信。浏览器包不得 import Node Host/Secret/PTy 实现。

## 8. Workspace / UI

正式术语：Workspace → Chat Agent Mode / Work Agent Mode / Manual Mode。Chat/Work 同核，Manual 无模型手动。

- Session/Run 共用逻辑：`packages/client/workspace/src/shared/logic/`
- Chat：`workspace/src/chat/`（对话式干预）
- Work/Canvas 产品布局：`workspace/src/work/`（画布式干预与上下文）
- Manual：`workspace/src/manual/`（复用 Work Canvas/真实工具，不进入 Agent Runtime）
- 通用 Pointer/Zoom/Overlay/Resize/Effect：`client/ui`
- Product Shell/Composer/Settings：`client/app-shell`

UI Kit 不应吸收产品业务，只因“它是 TSX”并不意味着应该放 UI Kit。

模块内部按需要使用：

```text
view/
logic/
styles/
contracts/
index.ts
```

不需要的目录不要建空壳。

## 9. Model / Config / Runtime

`@lfaa/config-system`：账户、Provider metadata、模型能力、设置 schema。

`@lfaa/llm-openai-compatible`：一次 Provider runtime call。

`@lfaa/agent-controller`：开发 Host Run 生命周期/HTTP/HMR/内存多轮会话。

这些 Owner 不可合并成一个“AI bridge”。

Strong reasoning 当前是执行 Hint：由 Agent Request 表达，由 LLM Adapter转为安全的 system instruction；不得伪造 Provider 没声明的 `reasoning_effort` 字段。

## 10. Plugin

- Contract：`plugin-sdk`
- Generation/lifecycle：`plugin-runtime`
- Inspect/install/rollback：`plugin-host-node`
- Web API：`api/plugin-controller`
- UI：App Shell Settings

用户插件依赖安装到 Runtime Home 中的独立 Profile，不进入仓库根 `package.json` / `pnpm-lock.yaml`。新插件默认 disabled，install transaction 必须可回滚，build script 需精确审批。

## 11. Credential / Secret

Secret 统一走 `@lfaa/credentials`；Windows Native 实现经 Rust broker。

禁止明文进入：普通状态文件、Git、日志、错误、argv、普通 env、Plugin Manifest、Agent context。

账户状态只保存 `credentialRef`。

## 12. Runtime Home

仓库不创建 `.lfaa/`。

运行状态路径只通过 `@lfaa/home-paths`：

```text
LFAA_HOME env
Windows: %LOCALAPPDATA%\LFAA
macOS: ~/Library/Application Support/LFAA
Linux: $XDG_DATA_HOME/lfaa or ~/.local/share/lfaa
```

旧 `<project>/.lfaa/state` 允许在同步/首次读取时迁移，但新代码不得继续写入。

## 13. Imports

- 跨 package：使用公开 `@lfaa/*` export；
- package 内：局部相对 import 或经过审核的 `imports` alias；
- 禁止跨 package `../../other-package/src/...`；
- Node/Vite 直接执行链必须遵守现有 runtime import gate。

## 14. 注释与可读性

承载核心交互、桥接、脚本的文件使用结构化中文头：

```text
文件：
作用：
负责：
不负责：
状态归属：
对外接口：
关联文件：
修改注意事项：
```

复杂 CSS 按现有分区规则维护。新增关键文件要加入 `comment-check` 或定义稳定自动规则。

## 15. 测试与门禁

架构修改不能通过删除测试/关闭 Gate 获得“通过”。至少执行：

```bash
pnpm run governance:check
pnpm run typecheck
pnpm run test
pnpm run build
```

发布使用 `quality:full` + Rust release check。

在缺少 Node24/pnpm/node_modules 的制作容器里，只能声明实际完成的 Node 静态/contract gate，不能声称全量 typecheck/build 已通过。

## 16. 文档规范

架构修改同时更新：

- README / AGENTS / ARCHITECTURE / DEVELOPMENT
- `docs/项目结构与代码地图.md`
- MODULES / RUNTIME / UI / TESTING / RELEASES 中相关事实
- capability family/package README
- CHANGELOG + DEVELOPMENT_LOG

`docs/PROMPTS.md` 记录需求/Prompt 生命周期，不作为当前架构 API。

## 17. 新旧文档原则

新文档事实优先。历史文档允许保留旧路径来说明当时发生了什么，但必须在顶部标注历史属性；不要把历史路径全局替换成新路径，从而伪造过去。

## 18. Release / Sync

### 18.1 版本进位规则

LFAA 显示版本固定为 `major.minor.patch`，每一段只能是 `0-99`。patch 到 99 后必须向 minor 进位；minor 与 patch 同时到 99 后向 major 进位：

```text
0.0.98 → 0.0.99
0.0.99 → 0.1.0
0.1.99 → 0.2.0
0.99.99 → 1.0.0
```

因此 `0.0.100`、`0.100.0` 都是非法版本。`scripts/version-policy.mjs` 与 release consistency Gate 必须阻止此类版本进入发布包。`releaseSequence` 是独立内部序号，不参与显示版本进位。

### 18.2 Release / Sync 规则

- `lfaa.release.json` 是版本元数据 Owner；
- package/Cargo 版本与其保持一致；
- Unicode ZIP 由 `scripts/release-archive.mjs` 产生并反向验证；
- Sync 先 source preflight，再生成 diff；
- v0.0.99 起，Sync 在删除旧项目 `.lfaa` 前只迁移已知本机运行状态，不保留旧目录作为新架构资源根。

## TypeScript 工程配置继承规则

LFAA 区分“业务源码依赖”和“仓库工程配置继承”：

- 跨 package 业务源码必须通过公开 `@lfaa/*` API；禁止 `../../other-package/src`、`../../../other-package/src` 形式的跨包源码引用。
- package 内部允许短距离 `./` / `../` 相对 import。
- `apps/*/tsconfig.json` 允许使用 `../../tsconfig.base*.json` 继承仓库根配置。
- `packages/<family>/<package>/tsconfig.json` 允许使用 `../../../tsconfig.base*.json` 继承仓库根配置；这里的 `../` 只表达 Monorepo 工程配置 Owner，不属于业务依赖。
- Client/React/DOM workspace 统一继承 `tsconfig.base.client.json`；Runtime/Node/Core workspace 继承 `tsconfig.base.json`。
- 禁止恢复仅 TypeScript 可见、但 Vite/Node 未共同解析的私有 `@/*` paths alias。跨 package 的稳定别名只使用真实 workspace package 名 `@lfaa/*`。
- `scripts/tsconfig-reference-check.mjs` 是该规则的机器 Gate；目录迁移后必须先通过它，再允许进入 Vite/TypeScript 启动链。



## Codex Runtime 开发规则（v0.1.2）

1. ChatGPT/Codex 套餐认证只通过官方 App Server RPC；禁止读取/复制 OAuth Token 或 Codex 私有认证文件。
2. Agent Controller 必须按 `AiProviderRegistry.resolveConnection(...).protocol` 路由 Runtime，不能用 `credentialRef` 是否存在来猜协议。
3. `thread/start` / `turn/start` / delta / completed / interrupt 属于 `@lfaa/codex-app-server`；Controller 只转换 LFAA Run/Event。
4. `assistant.delta` 是增量投影，`assistant.completed` 是最终权威文本。
5. 审批 UI 未完成前 Codex Text Runtime 固定 read-only；命令、文件改写、权限提升、MCP elicitation 的 server request 必须安全拒绝。
6. 新增 Codex RPC 生命周期必须补 Fake Client 行为测试；不能只增加静态字符串断言。
