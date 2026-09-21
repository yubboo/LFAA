# LFAA Modules — v0.1.14 Current Ownership

## v0.1.14 Ownership Freeze

v0.1.14 不新增或迁移 Owner，只修发布治理。

## v0.1.13 Repository Ownership 基线

当前 14 个 capability family / 29 个 package 保持为真实 Owner 基线；下一步不新增空 Writing family，而先用现有 Plugin/App Pack 协议完成 Runtime 闭环。

## v0.1.12 Identity capability family

- `packages/identity/identity`：User / Role / Permission / AuthSession / First Run Domain Contract；
- `packages/identity/identity-host-node`：`LFAA_HOME/state/identity` 本地 Provider，scrypt + token hash；
- `packages/api/identity-controller`：同源 Identity API + `/__lfaa/dev/*` AuthSession Gate；
- `packages/client/connection/identity-client.ts`：浏览器 Adapter，不持久化 Token；
- `packages/client/app-shell/src/identity`：First Run / Login UI；
- `packages/client/app-shell/src/app-hub`：登录后的应用展台。

## v0.1.11 Project / Session capability family

- `packages/session/session`：Project + Session Domain / Host Contract；
- `packages/session/session-host-node`：`LFAA_HOME/state/sessions` JSON Provider、v1→v2 迁移与原子串行写；
- `packages/api/session-controller`：同源 Web Host Controller；
- `packages/client/connection/session-client.ts`：浏览器 Adapter；
- `packages/client/workspace/shared`：把 Session + AgentRuntimeEvent 投影到 Chat/Work/Manual。


本文件只描述当前模块 Owner。旧版本细节请到 DEVELOPMENT_LOG/CHANGELOG 查历史。

## Package families

| Family | Package | 当前职责 |
|---|---|---|
| identity | `@lfaa/identity` | 实例 User / Role / Permission / AuthSession 领域契约 |
| identity | `@lfaa/identity-host-node` | 本地身份状态、密码散列、AuthSession Provider |
| api | `@lfaa/identity-controller` | First Run/Login/User/Role HTTP + 全局 Host API Auth Gate |
| core | `@lfaa/agent-runtime` | Agent Run/Permission/Harness 公共契约；Run Timeline 统一事件定义 |
| client | `@lfaa/client-web` | Web Client Composition / mount |
| client | `@lfaa/client-connection` | Browser ↔ Local Host clients |
| client | `@lfaa/app-shell` | Workbench / Composer / Settings / Shell |
| client | `@lfaa/workspace` | Chat Agent + Work Agent + Manual Workspace 产品域；Chat/Work 同核；统一 Run Event → Timeline/Answer 投影；Manual 无模型 |
| client | `@lfaa/ui` | Shared UI Kit / Interaction primitives |
| client | `@lfaa/ui-terminal` | Terminal UI |
| settings | `@lfaa/config-system` | AI Config Domain + 官方 Usage/Quota 规范化 |
| settings | `@lfaa/config-host-node` | Node persistence / HTTP host ports |
| llm | `@lfaa/llm-openai-compatible` | Provider Runtime HTTP/SSE Adapter；真实增量归一为 `assistant.delta` |
| credentials | `@lfaa/credentials` | Credential Service Definition |
| credentials | `@lfaa/credentials-native` | Native Secret Broker Adapter |
| plugin | `@lfaa/plugin-sdk` | Plugin/capability contracts |
| plugin | `@lfaa/plugin-runtime` | Registry generation / lifecycle |
| plugin | `@lfaa/plugin-host-node` | Inspect/install/rollback/pnpm host |
| harness | `@lfaa/codex-app-server` | OpenAI 官方 ChatGPT 账户/App Server Adapter：managed auth + usage + read-only thread/turn + 官方 reasoning/plan/activity 增量事件；运行组件归 LFAA_HOME 管理，不要求全局 CLI |
| api | `@lfaa/agent-controller` | Agent Run local Host controller；按 Provider protocol 路由 OpenAI-compatible / Codex Runtime |
| api | `@lfaa/settings-controller` | AI Settings local Host controller |
| api | `@lfaa/plugin-controller` | Plugin Manager local Host controller |
| terminal | `@lfaa/terminal-vite` | PTY + Vite terminal adapter |
| host | `@lfaa/host-vite` | Vite Host config adapter |
| bundle | `@lfaa/bundle-web-app` | Web Host capability assembly |
| util | `@lfaa/home-paths` | Runtime Home resolution |
| app | `@lfaa/web` | Thin Web product entry |


## v0.1.10 Run Timeline Owner

```text
core/agent-runtime           # 统一 phase/reasoning-summary/plan/activity/assistant/run events
harness/codex-app-server    # 官方 Codex/App Server event → runtime event source
api/agent-controller        # Provider event normalization / run lifecycle
client/workspace/shared     # Event → RunProcessViewModel + AssistantMessage
client/workspace/chat       # elapsed/disclosure/activity/final answer rendering
```

Timeline 数据必须从 Runtime 向 Client 单向投影；UI 不能反向猜测 Provider 正在做什么。

## Core dependency intent

```text
foundation contracts
   ↓
runtime/domain/presentation
   ↓
composition + host-adapter
   ↓
host
   ↓
bundle
   ↓
app
```

Capability family 是 Owner，`lfaa.layer` 是机器检查的依赖方向；不要混为一谈。

## Workspace module

```text
workspace/
├─ shared/contracts
├─ shared/logic       # Chat/Work 共用 Agent Session/干预
├─ chat/view + styles
├─ work/contracts + logic + view + styles
└─ manual/view + styles  # 无模型，复用 Work Canvas/Tool
```

`shared/logic` 拥有 Chat/Work 共用 Session/Run controller 与 `interveneRun`；Work Canvas x/y/viewport/用户编辑内容属于 Work 产品状态，并可投影为 `workspaceContext` 给同一 Agent Core。Manual 复用同一 Canvas controller，但不启动 Agent Run；高频 pointer/zoom/drag renderer 归 UI Kit。

## App Shell

`@lfaa/app-shell` 的 Workbench 按职责局部拆：

```text
workbench/
├─ left/
├─ center/
│  ├─ header/
│  └─ composer/
├─ right/
├─ settings/
├─ shell/
├─ terminal/
└─ shared/
```

`AgentWorkbench.tsx` 是薄产品 Composition Root，不应该重新吸收 Host/Provider 业务。

## Config / LLM separation

```text
config-system
  = 配置、账户、Provider metadata、Model capability

llm-openai-compatible
  = 真正 Provider runtime call

agent-controller
  = Run 生命周期 + 协议 + 开发态会话
```

三个模块不能回到一个巨大 `ai bridge`。

## Plugin separation

```text
plugin-sdk → plugin-runtime
     └────→ plugin-host-node
```

Web UI/Controller 消费 Runtime/Host，不允许 Plugin Runtime 自己执行 pnpm/Node filesystem。

## Runtime Home

运行状态属于用户 Home，而不是 repo package。统一路径 Owner 为 `@lfaa/home-paths`。任何新持久化模块都应该消费这个 seam，而不是自行拼 `~/.lfaa`、项目 `.lfaa` 或随机 AppData 路径。


## Codex Runtime 归属（v0.1.2）

```text
config-system
  └─ resolveConnection().protocol
         ├─ openai-compatible → llm/openai-compatible
         └─ codex-app-server  → harness/codex-app-server
                                  ├─ managedAuth
                                  └─ textRuntime
```

`agent-controller` 只做协议路由和 Run/Event 映射；Codex threadId/turnId、JSONL、流式 delta、interrupt 归 Harness Adapter。
