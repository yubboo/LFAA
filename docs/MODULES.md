# LFAA Modules — v0.1.6 Current Ownership

本文件只描述当前模块 Owner。旧版本细节请到 DEVELOPMENT_LOG/CHANGELOG 查历史。

## Package families

| Family | Package | 当前职责 |
|---|---|---|
| core | `@lfaa/agent-runtime` | Agent Run/Permission/Harness 公共契约 |
| client | `@lfaa/client-web` | Web Client Composition / mount |
| client | `@lfaa/client-connection` | Browser ↔ Local Host clients |
| client | `@lfaa/app-shell` | Workbench / Composer / Settings / Shell |
| client | `@lfaa/workspace` | Chat Agent + Work Agent + Manual Workspace 产品域；Chat/Work 同核，Manual 无模型 |
| client | `@lfaa/ui` | Shared UI Kit / Interaction primitives |
| client | `@lfaa/ui-terminal` | Terminal UI |
| settings | `@lfaa/config-system` | AI Config Domain + 官方 Usage/Quota 规范化 |
| settings | `@lfaa/config-host-node` | Node persistence / HTTP host ports |
| llm | `@lfaa/llm-openai-compatible` | Provider runtime HTTP adapter |
| credentials | `@lfaa/credentials` | Credential Service Definition |
| credentials | `@lfaa/credentials-native` | Native Secret Broker Adapter |
| plugin | `@lfaa/plugin-sdk` | Plugin/capability contracts |
| plugin | `@lfaa/plugin-runtime` | Registry generation / lifecycle |
| plugin | `@lfaa/plugin-host-node` | Inspect/install/rollback/pnpm host |
| harness | `@lfaa/codex-app-server` | Official Codex App Server managed auth + read-only thread/turn text runtime |
| api | `@lfaa/agent-controller` | Agent Run local Host controller；按 Provider protocol 路由 OpenAI-compatible / Codex Runtime |
| api | `@lfaa/settings-controller` | AI Settings local Host controller |
| api | `@lfaa/plugin-controller` | Plugin Manager local Host controller |
| terminal | `@lfaa/terminal-vite` | PTY + Vite terminal adapter |
| host | `@lfaa/host-vite` | Vite Host config adapter |
| bundle | `@lfaa/bundle-web-app` | Web Host capability assembly |
| util | `@lfaa/home-paths` | Runtime Home resolution |
| app | `@lfaa/web` | Thin Web product entry |

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
