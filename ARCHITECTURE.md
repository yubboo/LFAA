# LFAA Architecture — v0.1.1 Current Truth

> 本文件描述 **当前** LFAA 架构。旧版本的平铺 `packages/*`、`apps/web/dev/bridges/*`、`crates/` 与仓库级 `.lfaa/` 只允许出现在历史记录中，不再是当前设计。

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

- `@lfaa/codex-app-server`：官方 Codex App Server JSONL/RPC Adapter。

外部 Harness 以 Adapter 接入，不复制上游内部 Agent Loop。

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
├─ Chat Mode
└─ Work Mode
```

两种 Mode 使用同一 Agent Runtime/Model/Permission/Session/Run 语义。

- `workspace/shared`：共同 Session/Run controller；
- `workspace/chat`：线性消息投影；
- `workspace/work`：Work/Infinite Canvas 产品布局状态；
- `ui`：Pointer/Zoom/Drag/Resize/Overlay/Effect 等通用 primitive；
- `app-shell`：Workbench、Composer、Settings 与产品装配。

## 6.1 Workspace 术语

当前术语必须保持明确：

- **Workspace Mode**：Chat / Work 两种用户工作方式；
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

- `ARCHITECTURE.md`
- `DEVELOPMENT.md`
- `AGENTS.md`
- `docs/项目结构与代码地图.md`
- 对应 `packages/<family>/README.md` / package README
- CHANGELOG / DEVELOPMENT_LOG

历史文档中的旧物理路径允许保留为历史事实，但必须有清晰的 current-truth 声明，不能被门禁/新开发当作当前契约。
