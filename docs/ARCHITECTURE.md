# LFAA Architecture — v0.1.16 Current Truth

## 0.0 v0.1.16 Smart Home / Identity Surface Boundary

登录后第一屏现在是 **Smart Home**，不是静态业务目录。Smart Home 同时提供“描述目标”和“手动进入”两条路径，但它仍属于 Client Composition，不拥有 Agent/Session/App Pack 真值。

```text
Identity Gate
  ├─ First Run → initializeSuperAdmin（仅未初始化实例）
  └─ Login → AuthSession
        ↓
     Smart Home
       ├─ Natural-language draft → existing AgentWorkbench Composer
       └─ Manual entry → available Workspace / future App Pack
        ↓
Project → Session → Chat | Work | Manual
```

当前没有真实 Intent Router 时，Smart Home 禁止通过关键词 `if/else` 猜目标 App；自然语言 draft 只经 `AgentWorkbench → CenterWorkspaceRegion → ComposerRegion` 最小 Props 链进入同一 Workbench。未来 `Plugin Registry → App Pack Catalog → Intent Router` 完成后，由 Smart Home 消费其决策，不创建第二套 Router/Runtime。

Login / First Run / Smart Home 的视觉与 Motion token 归 `packages/client/app-shell/src/product-surface.css`；Identity 认证事实仍完全归 `packages/identity/*` 与 `packages/api/identity-controller`。

## 0.0.1 v0.1.15 Repository Documentation Boundary

当前仓库把长期文档集中到 `docs/`，根目录只保留项目入口、发布历史、法律说明、Windows 稳定入口和工具链配置。`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`、`docs/PROJECT_PLAN.md` 是长期当前事实，不再在根目录保留镜像副本。

```text
LFAA/
├─ README.md / AGENTS.md / CHANGELOG.md / NOTICE.md
├─ LFAA-*.bat + build/toolchain config
├─ apps/ packages/ native/ scripts/ test/ evals/
└─ docs/
   ├─ ARCHITECTURE.md
   ├─ DEVELOPMENT.md
   ├─ PROJECT_PLAN.md
   └─ 其他固定长期文档与历史账本
```

该边界由 `docs-check` + `root-layout-check` + `current-fact-check` 共同约束；它只整理文档 Owner，不改变 Runtime、package ownership 或产品行为。

## 0.1 v0.1.14 Release Integrity Boundary

发布包只有在当前版本 Prompt 合同、任务索引、版本元数据和 fresh-extract preflight 一致通过时才是有效候选。v0.1.14 不改变 Runtime 或 package ownership；它只修复 v0.1.13 的发布治理遗漏。

## 0.1 v0.1.12 Instance Identity / App Entry Boundary

LFAA 最外层先经过本地实例 Identity Gate，再进入 Smart Home / App Entry。Identity 不绑定云端账户：第一次启动创建唯一 First Run `super_admin`，后续只有有效 `AuthSession` 才能进入工作台或访问本地 Host HTTP API。

```text
LFAA Instance
  └─ Identity Gate
       ├─ User → Role → Permission
       └─ AuthSession
            ↓
        Smart Home
          ├─ Core Workspace
          └─ future App Pack
            ↓
        Project → Session
            ↓
       Chat | Work | Manual
```

当前真实 Owner：`packages/identity/identity` 定义领域契约，`packages/identity/identity-host-node` 保存 `LFAA_HOME/state/identity`，`packages/api/identity-controller` 提供 First Run/Login/User/Role API 并作为其他本地 Host HTTP API 的统一登录门禁。Client 的 Identity Gate / Smart Home（组件名 `LfaaAppHub` 暂保 API 兼容）属于 `packages/client/app-shell`，`packages/client/web` 只做组合。

Smart Home 当前只允许真正进入已有的通用工作台；AI 写作、AI 漫剧、Minecraft、Steam Server 作为未来 App Pack 入口可见但 disabled，直到真实 Capability/Consumer 接入。未来 App Hub 专注 App Pack Catalog/安装管理；后续 App Pack Runtime 必须基于现有 `@lfaa/plugin-sdk` `app-pack` / Capability 组合，不另建 Domain Runtime。

## 0.1 v0.1.11 Project + Session Persistence / Interaction Surfaces

`@lfaa/session` 是 Chat / Work / Manual 共用的长期 Session Domain；`@lfaa/session-host-node` 把它持久化到 `LFAA_HOME/state/sessions/`，`@lfaa/session-controller` 只负责 Web Host transport。Chat/Work/Manual 不拥有各自数据库。

```text
Session Core
├─ projects / active project / pinned / expanded
├─ messages / Run Timeline
├─ active session / recent sessions
├─ mode: chat | work | manual
└─ work context
       ↓
Chat UI | Work Canvas | Manual Workspace
```

左栏是稳定产品导航，不随 mode 重建。左上角模式菜单与中央 segmented switch 共享同一个 `workspaceMode`；切换 mode 只改变中央表现层。

`AgentRunRequest.sessionId` 是 Runtime Event 的路由键，`workspaceId` 是项目键；二者禁止混用。Client 只把事件投影到当前 Session，OpenAI-compatible conversation cache 也按 Project + Session 隔离。


> 本文件描述 **当前** LFAA 架构。旧版本的平铺 `packages/*`、`apps/web/dev/bridges/*`、`crates/` 与仓库级 `.lfaa/` 只允许出现在历史记录中，不再是当前设计。

## 0.2 Repository / Plugin Boundary（v0.1.13）

LFAA 对 DeepSeek Harness 采用“**复用思想与稳定协议，避免复制全部包数量**”的策略。当前 DeepSeek Harness 源码规模远大于 LFAA；LFAA 不以包数量对齐上游，而只在出现真实 Consumer 与独立生命周期时升格 package。

“一切皆插件”的准确边界是：**一切业务能力皆插件，内核不是插件**。

稳定内核包括：Agent Runtime 契约、Session 真值、Plugin Loader/Registry/Lifecycle、Identity/Permission、Credential Broker、Config 协议、Runtime Home 与 Host transport 基础边界。

可插件化业务包括：App Pack、Skill、Expert、Tool、MCP、Workflow、Model Provider、Harness Adapter、Workbench Node、Artifact Renderer、UI Extension 等。

因此当前 `packages/` 两层拓扑保持稳定，不新增 `packages/lfaa/` 或另一套 `features/modules/extensions` 平行树；AI Writing 作为第一个真实 App Pack 直接验证现有 Capability/Plugin 架构。

发布源码包不得携带本机运行日志、Runtime Home、缓存或构建产物。`docs/logs/runtime/*` 仅可作为本机运行目录存在，`*.log` 不属于发布内容。

## 1. 架构目标

LFAA 采用 **Harness-oriented modular monorepo**：

```text
Capability Family
    ↓
Package
    ↓
Bundle / Composition
    ↓
App Entry
```

设计参考 DeepSeek Harness 的 packages-first 思路，但以 LFAA 已有业务和测试为边界，不为了目录好看创建空包。

核心原则：

1. **业务进入 `packages/`**；
2. **`apps/` 必须薄**，不能拥有 Provider、Plugin、Terminal、Agent Runtime 等业务；
3. **`bundle/` 负责 Host 能力组合**，App 不直接认识每个 Adapter；
4. **`native/` 只承载真正需要 Rust/OS 的 primitive**；
5. **Service Definition / Provider / Consumer / Composition 单向依赖**；
6. 新 package 必须有真实实现、真实 Consumer 和清晰 Owner；
7. 迁移优先保持公开 package name 与业务行为稳定。

## 1.1 Agent Run Timeline / Event Projection

DeepSeek Harness 源码用于本版事件组织参考：Session/Runtime 先产生 reasoning/text/tool 等真实增量，再由 Client 投影成对话中的 Turn Status、Reasoning disclosure 与 Tool activity。LFAA 保留自己的视觉与单一 Agent Core，但采用同样的“**Runtime Event → Client Projection → UI**”单向结构。

```text
Provider / Harness Runtime
       ↓
@lfaa/agent-runtime AgentRuntimeEvent
       ├─ run.started / run.phase.changed
       ├─ reasoning.summary.delta
       ├─ plan.updated
       ├─ activity.started / output.delta / completed
       ├─ assistant.delta / completed
       └─ run.completed / failed / cancelled
       ↓
@lfaa/workspace shared Session Controller
       ↓
RunProcessViewModel + Assistant Message
       ↓
Chat / Work presentation
```

约束：

- Agent Controller / Harness Adapter 负责把 Provider 原生事件归一化，UI 不认识 Codex/DeepSeek/OpenAI 私有事件名；
- `reasoning.summary.delta` 只承载官方可展示摘要，不承载原始隐藏 reasoning；
- `activity.*` 表示模型、命令、文件、搜索、MCP、Tool 等真实运行活动；
- `assistant.delta` 始终独立于 Timeline，最终交付文本边生成边显示；
- Chat / Work 消费同一事件契约，不允许为了不同表现层复制 Runtime。

## 1.1 Provider 与交互模式边界

Provider 配置、Runtime 可用性、官方 Usage/Quota 是三个独立事实维度。认证方式可能是 API Key、OAuth/订阅、Workspace 或 Coding Plan；是否免费、套餐包含、按量计费、限额与重置时间只接受官方公开接口/Runtime 返回值，LFAA 不推算、不新增自己的模型额度。

Chat Agent 与 Work Agent **不是能力等级**。它们共享同一个 `AgentRunRequest`、Agent Runtime、Provider、Tool/MCP/Skill、Permission、Session/Run 与交付标准：

- Chat Agent：conversation-first；用户用对话/插话干预同一个运行。
- Work Agent：canvas-first；用户通过无限画布直接编辑执行上下文，也可继续对话/插话。
- Manual：Workbench 第三种模式，不进入 `AgentRunRequest`，不要求模型；复用 Work Canvas 与真实工具基础设施，由用户完全手动操作。

禁止建立 `ChatRuntime` / `WorkRuntime` 两套核心，禁止把复杂任务从“弱 Chat”升级到“强 Work”；复杂任务在 Chat 中同样由同一个 Agent Core 全自动完成。

ChatGPT 套餐是 Provider 认证/Runtime 能力，不是外部客户端依赖：LFAA 通过 OpenAI 官方 App Server RPC 使用 `account/login/start`、`account/read`、`model/list`、thread/turn 等能力，并按需把官方 daemon runtime 隔离在 `LFAA_HOME/runtimes/openai-chatgpt`。用户不需要把 `codex` 安装到全局 PATH；LFAA 也不读取官方 runtime 的认证文件。

## 1.2 v0.1.10 Provider Runtime / Settings 状态边界

ChatGPT OAuth 的浏览器窗口不是状态 Owner：`packages/client/connection` 只编排窗口与轮询；`packages/harness/codex-app-server` 以官方 `account/login/completed` / `account/updated` / `account/read` 作为认证事实源。

Provider 接入固定拆成四个独立事实：`Authentication`、`Model Discovery`、`Runtime`、`Usage/Entitlement`。设置页“连接成功”只代表认证/模型目录 Probe 成功，不得冒充 Runtime 或 Usage 已可用。

- API Key Provider：`probe → save` 可复用 Host 内短期验证结果，避免保存时再次访问同一官方模型目录；Secret 不进入缓存 key 明文。
- ChatGPT 套餐：通过 OpenAI 官方账户/App Server 协议完成 OAuth、model/account/usage 与 thread/turn；LFAA 自行在 Runtime Home 管理固定官方组件，用户无需全局 Codex CLI。
- Usage：独立异步加载并拥有 `idle/loading/ready/error`；Provider 网络和 Browser Host 都有超时边界。
- Text Runtime：OpenAI-compatible Provider 优先 SSE；所有增量转换为统一 `AgentRuntimeEvent.assistant.delta`，Chat/Work 不分叉流式协议。
- UI 层级：Popover/Mode menu 的显示属于 Client UI 责任，不能被 Pane 的裁剪规则破坏。

## 2. 仓库层级

物理 package 统一使用 `packages/<capability-family>/<package>/`。

当前关键物理 Owner 包括：`packages/bundle/web-app`、`packages/llm/openai-compatible`、`packages/client/workspace`、`packages/client/app-shell`、`native/secret-store`。

```text
apps/       产品启动入口
packages/   TypeScript 产品、Agent、Harness、Host 与 Client 能力
native/     Rust Native Kernel
scripts/    开发/治理/同步/发布工具
formats: test/, evals/, docs/
```

源码仓库没有项目级 `.lfaa/`。运行状态属于用户 Runtime Home。

## 3. Capability families

### `packages/core/`

当前：`@lfaa/agent-runtime`。

负责 Agent Runtime 公共契约、Run/Permission/Harness metadata 等稳定核心语义。当前不为了模仿外部项目提前拆 `agent-loop/session/tool/context` 空包；这些能力出现真实实现和多个 Consumer 后再升格。

### `packages/client/`

- `@lfaa/ui`：共享 UI Kit / Interaction Engine；
- `@lfaa/workspace`：Chat/Work Workspace 产品域；
- `@lfaa/app-shell`：Workbench、Composer、Settings、Shell；
- `@lfaa/client-connection`：Browser ↔ Local Host 协议客户端；
- `@lfaa/ui-terminal`：Terminal 浏览器 UI；
- `@lfaa/client-web`：Web Client Composition 与 React mount。

UI 依赖方向保持：

```text
client-web
   ↓
app-shell ──→ workspace
   ↓            ↓
  ui ←──────────┘
```

`@lfaa/ui` 不拥有 Workspace/Provider/Plugin 产品真值。

### `packages/settings/`

- `@lfaa/config-system`：Config Domain、Provider metadata、Account/Model Settings；
- `@lfaa/config-host-node`：Node 文件系统/HTTP 等 Host Provider。

Config Provider 与 Runtime Model Provider 是两件事：前者描述/管理账户和模型，后者实际执行模型调用。

### `packages/llm/`

- `@lfaa/llm-openai-compatible`：一次 OpenAI-compatible 文本模型调用的 Host Adapter。

它不读取用户状态、不读取 Secret、不持有 Session、不发 Runtime Event。Agent Controller 提供账户/Secret/历史与 AbortSignal。

### `packages/plugin/`

```text
plugin-sdk       = canonical contracts / capability vocabulary
plugin-runtime   = registry / generation / lifecycle
plugin-host-node = inspect/install/rollback/Node package host
```

插件安装不得写根 `package.json` / 根 lockfile；用户插件 Profile 属于 Runtime Home。

### `packages/credentials/`

- `@lfaa/credentials`：Credential Service Definition；
- `@lfaa/credentials-native`：Rust Secret Broker Adapter。

Secret 明文禁止进入 JSON 状态、插件 Manifest、Git、日志、argv、普通 env 或模型上下文。

### `packages/harness/`

- `@lfaa/codex-app-server`：OpenAI 官方 App Server JSONL/RPC Adapter；运行组件由 LFAA 按需管理在 Runtime Home。

外部 Harness 以 Adapter 接入，不复制上游内部 Agent Loop。


#### Codex App Server Runtime（v0.1.2）

`@lfaa/codex-app-server` 现在同时提供 Managed Auth 与 read-only Text Runtime。Web Bundle 为两条链共享一个 `CodexAppServerHost`；Agent Controller 根据 Config System 的 `connection.protocol` 在 `codex-app-server` 与 `openai-compatible` 之间路由，不再通过是否存在 `credentialRef` 猜 Runtime。Codex thread/turn、流式 delta 与 interrupt 都归 Harness Adapter；OAuth Token 仍完全归官方 App Server。

### `packages/api/`

Host Controllers：

- `agent-controller`：Run HTTP/HMR 生命周期；
- `settings-controller`：AI Settings 本地 API；
- `plugin-controller`：Plugin Manager 本地 API。

Controller 负责协议边界，不应重新拥有底层 Provider 业务。

### `packages/terminal/`

- `@lfaa/terminal-vite`：当前本地开发 Host 的 PTY 生命周期与 Vite event Adapter。

未来只有出现第二个 Host/Consumer 后，才把 Terminal Service Definition、node-pty Provider、Vite transport 继续拆包。

### `packages/host/`

- `@lfaa/host-vite`：Vite Host 技术装配能力。

Host 包不拥有产品域。

### `packages/bundle/`

- `@lfaa/bundle-web-app`：Web Host Bundle。

负责把 agent/settings/plugin/terminal Controller 与 Vite Host 装起来。`apps/web/vite.config.ts` 只调用 Bundle，不直接 import 各 Controller。

### `packages/util/`

- `@lfaa/home-paths`：Runtime Home 唯一路径解析 seam。

它是基础路径能力，不承载业务状态。

## 4. App 边界

### `apps/web`

当前允许的职责：

- HTML/启动入口；
- Vite 产品级 build 参数；
- 选择 `@lfaa/client-web`；
- 选择 `@lfaa/bundle-web-app`。

禁止：

- `dev/bridges`；
- `host-clients`；
- Agent/AI/Plugin/Terminal 业务实现；
- Node filesystem/PTY/Secret 业务；
- Provider HTTP 细节。

浏览器启动链：

```text
apps/web/src/main.ts
  → @lfaa/client-web
  → AgentWorkbench
```

Host 启动链：

```text
apps/web/vite.config.ts
  → @lfaa/bundle-web-app/vite
  → @lfaa/host-vite
  → Controllers / adapters
```

## 5. Agent Chat runtime current flow

```text
Chat / Composer
  ↓ AgentRunRequest
@lfaa/client-connection
  ↓ local HTTP + HMR event
@lfaa/agent-controller
  ├─ JsonAiAccountRepository
  ├─ Credential Host
  └─ @lfaa/llm-openai-compatible
       ↓ Provider API
  ↓ AgentRuntimeEvent
Workspace Session Controller
  ↓
Chat Timeline
```

当前 Run 历史仍是开发态 Host 内存状态，不冒充正式持久 Session Store。Tool/Skill/MCP 也尚未接入该最小运行链。

## 6. Workspace / UI

正式产品术语：

```text
Workspace
├─ Chat Agent Mode
├─ Work Agent Mode
└─ Manual Mode
```

Chat/Work 两种 Agent Mode 使用同一 Agent Runtime/Model/Permission/Session/Run 语义；Manual 不启动 Agent Run，但复用 Canvas/Tool 基础设施。

- `workspace/shared`：Chat/Work 共同 Session/Run controller 与人工干预入口；
- `workspace/chat`：对话式 Agent 投影与插话入口；
- `workspace/work`：Work/Infinite Canvas 产品布局、用户可编辑上下文与 Agent 输出投影；
- `workspace/manual`：无模型手动画布/工具模式，复用 Work Canvas，不创建 Agent Run；
- `ui`：Pointer/Zoom/Drag/Resize/Overlay/Effect 等通用 primitive；
- `app-shell`：Workbench、Composer、Settings 与产品装配。

## 6.1 Workspace 术语

当前术语必须保持明确：

- **Workspace Mode**：Chat Agent / Work Agent / Manual 三种用户交互方式；其中只有 Chat/Work 进入 Agent Core；
- **Surface**：真实 UI 承载面或插件贡献目标，例如 Settings Surface；
- **ViewModel**：UI 直接消费的派生数据；
- **Renderer / Interaction Primitive**：Canvas、Resize、Effect 等通用渲染/交互能力；
- **Projection**：只用于 Domain/Event State 派生成 Read Model/ViewModel 的真实投影过程，不代称 Workspace Mode。

## 7. Runtime Home

Runtime data 不进入源码树。

`@lfaa/home-paths` 解析：

```text
LFAA_HOME env
  > Windows LOCALAPPDATA/LFAA
  > macOS ~/Library/Application Support/LFAA
  > Linux XDG_DATA_HOME/lfaa or ~/.local/share/lfaa
```

当前逻辑数据包括：

```text
state/dependency-state.json
state/ai-accounts.json
plugins/profile/
cache/
tmp/
logs/
```

这些是机器状态，不是仓库事实。旧 `<project>/.lfaa/state` 只作为迁移来源。

## 8. Native Kernel

```text
native/secret-store/
```

Rust 只处理 Native/Security primitive。普通产品功能默认不得新增 Rust。

禁止 Rust Kernel 认识 OpenAI、Codex、Workbench 等产品/厂商业务名。需要新 crate 时必须满足：真实 native primitive + 当前 Consumer + 无合理 TS 实现。

## 9. Package layer gate

现有 `package.json#lfaa.layer` 仍作为过渡期机器门禁：

```text
foundation
runtime/domain/presentation
composition / host-adapter
host
bundle
app
```

Capability family 是**物理 Owner**；layer 是**依赖方向约束**。二者不是同一个维度。

## 10. Plugin / Service Pattern

长期模式：

```text
Service Definition
    ↓
Provider
    ↓
Consumer
    ↓
Composition / Bundle
```

Consumer 不应直接依赖不必要的具体 Provider。Bundle/App 只做装配。

## 11. 文档与历史

当前架构修改必须同步：

- `docs/ARCHITECTURE.md`
- `docs/DEVELOPMENT.md`
- `AGENTS.md`
- `docs/项目结构与代码地图.md`
- 对应 `packages/<family>/README.md` / package README
- CHANGELOG / DEVELOPMENT_LOG

历史文档中的旧物理路径允许保留为历史事实，但必须有清晰的 current-truth 声明，不能被门禁/新开发当作当前契约。
