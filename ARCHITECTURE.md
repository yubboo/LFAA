# LFAA 当前架构

> 本文件只描述当前有效架构。
> 本文件只描述当前有效架构；历史变化统一通过 `docs/DEVELOPMENT_LOG.md` 追溯。

## 当前架构版本

```text
architecture-version: 2
status: active
product: Little Fish AI Agent
short-name: LFAA
```

详细架构已合并在本文件下方。

人类代码导航：`docs/项目结构与代码地图.md`

## 产品交互：两个 Surface，一个智能核心

```text
Chat Surface ─┐
              ├─ AgentRunRequest ──> Agent Runtime ──> Harness / Capabilities / Policy / Execution
Work Surface ─┘
     │
     └─ Infinite Canvas = Runtime Event / Entity 的 UI Projection，不是第二套 Agent
```

- **Chat**：用一句话 / 多轮对话描述目标；
- **Work**：用无限画布查看和组织 Goal、Main Agent、Subagent、Tool/Skill、App、Artifact；
- 两者必须共享同一模型绑定、Session/Run、权限快照、能力目录和执行后端；不得分别实现“聊天智能”和“画布智能”。
- Config System 只拥有账号、认证、当前模型选择；Agent Runtime 才拥有执行事实。UI 未连接真实 Runtime 时必须明确显示未连接，禁止生成本地假模型回复。

## Agent Harness Bridge

LFAA 采用 Adapter/Bridge 方式接官方 Harness，不复制成熟 Harness 的内部 Agent Loop：

```text
Agent Runtime
├─ Official Harness Registry
│  ├─ OpenAI Codex -> codex app-server
│  └─ DeepSeek Harness -> ACP / SDK
├─ Capability Registry
│  ├─ Tools / Commands / Browser / Computer / Filesystem / Process
│  ├─ Skills / Experts / MCP / Plugins
│  └─ Main Agent / Subagents
└─ Permission Snapshot -> Policy / Permission -> Rust Execution Re-validation
```

Harness 是否真正可用必须由宿主 Probe / Adapter 证明；只登记名称不等于已连接。模型本身负责推理，Harness/Skills/Tools/Subagents 为模型提供行动能力，禁止用壳层重新实现低配“伪智能”。

## 三档权限与 Trust Core

用户只看到三档权限，Runtime 内部仍保持审批、Reviewer、Sandbox 为独立事实，并在每个 Run 开始时固化成不可变快照：

| 用户模式 | LFAA 前置审批 | Reviewer | Sandbox / 执行范围 |
|---|---|---|---|
| 请求审批 | 每次 capability 调用 / 执行步骤先请求用户 Yes / No | user | workspace |
| 替我审批 | Reviewer 自动判断；需要升级时再请求用户 | model reviewer / official auto-review | workspace |
| 完全权限 | 不逐次弹审批 | disabled / native non-interactive | 当前 OS 用户权限内 unrestricted |

`完全权限` 只扩大任务执行范围，不赋予普通 Run 修改 Permission Policy、Secret Broker、审计、Trust Core 的能力。“自主进化”允许在可审计范围内修改代码、Skills、工作流和 Agent 配置，但改变信任根必须进入明确的开发/更新流程。

## 核心架构

```text
React UI
↓
Feature / Application
↓
Agent Client
↓
Agent Protocol
↓
TypeScript Agent Runtime
├── Context Engine
├── Event Store
├── Job Engine
├── Model Platform
├── Tool Runtime
├── Skills
├── MCP
├── Plugins
├── DSH Compatibility
├── Subagents
└── Verifier
        ↓
Typed Capability / Tool Runtime
        ↓
Policy Engine
        ↓
Permission Engine
        ↓
Rust Native Core
├── Filesystem Broker
├── Process Broker
├── PTY Broker
├── Sandbox
├── Secret Store
└── Workspace Security
        ↓
OS
```

## UI / Desktop / Web

```text
React + TypeScript + Vite
        │
  ┌─────┴─────┐
  ▼           ▼
Web        Electron Desktop
  │           │
HTTP/SSE   Electron IPC
  └─────┬─────┘
        ▼
   Agent Client
```

## Repository / 目录分层

目录必须表达长期架构职责，而不是当前先开发哪个客户端。

```text
apps/*                    宿主入口 / 平台 Adapter
        ↓
packages/app-shell        Feature 编排
      ↙          ↘
packages/ui        业务公开 API
                   ↓
          packages/config-system 等业务域
```

其中：

```text
packages/ui/src/features/settings/ai
→ AI 设置的可复用图形界面

packages/config-system/src/settings/ai
→ AI 设置业务、Account/Auth、Provider 配置插件
```

Web-first 只是验证顺序。Desktop / Linux 图形宿主后续复用 `packages/ui`；CLI 复用业务 Core，不复制 React UI。Config System 不依赖 React / DOM；UI 不直连 Provider 外部 API；App 不拥有共享业务真值。

## 数据

```text
Application Data:
SQLite + Drizzle

Knowledge:
SQLite FTS + LanceDB + Hybrid Retrieval + Reranker

Secrets:
OS Credential Store via Rust Secret Broker
```

## 插件生态

```text
Plugin Manager
├── Native Plugin SDK
├── MCP
└── DeepSeek Harness / Cordis Compatibility
```

所有插件最终必须通过：

```text
Capability
→ Tool Runtime
→ Policy
→ Permission
→ Execution Broker
```

Skills、Experts、Plugins、Extensions、MCP 配置全部安装在当前项目 `.lfaa/`，不得从用户级目录隐式继承。

## 权限

用户只看到：

```text
Ask       请求审批
Auto      自动审批
Full      完全权限
```

`Full` 不绕过硬拒绝、项目边界、Secret 隔离或 Rust Broker 校验。

## 不可破坏的架构约束

1. React 不直接访问 OS。
2. UI 不直接访问数据库。
3. Model 不直接执行系统操作。
4. Plugin/MCP/DSH 不绕过 Tool Runtime。
5. Secret 不进入模型上下文。
6. Event Store 是 Durable Run 的事实源。
7. Parent/Child Agent 只通过协议通信。
8. 当前架构与历史架构物理隔离。
9. TypeScript 深层相对导入 `../../` 及以上禁止；App 跨目录可使用经宿主运行时验证的 alias；可复用 Package 跨 Feature 使用 package Export/Subpath Export；跨 Package 使用 `@lfaa/*`。
10. Rust Broker 必须重新校验 canonical path、capability 和资源范围。
11. Skills、Experts、Plugins、Extensions、MCP 全部是项目级不可信资源。
12. Remote/Web 必须经过身份认证、逐资源授权和用户/项目隔离后才能访问 Runtime。
13. LFAA 自有组件使用官方命名空间；第三方成果必须保留原作者、来源和许可证。
14. `apps/*` 只做宿主入口 / Adapter；可复用业务 UI 必须归 `packages/ui`。
15. Config / Account / Auth / AI Provider 配置业务必须归 `packages/config-system`，不得散落在 App / UI / Vite Config。
16. `packages/ui` 不直连厂商 API、不持有 Secret / Config 真值；`packages/config-system` 不依赖 React / DOM / App。
17. 新目录必须有唯一职责和明确依赖方向；目录边界由自动治理门禁保护。

Policy Engine 拥有硬规则与 `Deny / Ask / AllowByPolicy` 决策；Permission Engine 拥有预设与审批生命周期。Permission 不得把 Policy 的 `Deny` 升级为 `Allow`。

## 项目级资源

```text
<project>/.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
└── mcp/
```

Secret 不进入 `.lfaa/`，只保存 `credential_ref`。


## 项目资源热插拔

项目级 Skills、Experts、Plugins、Extensions、MCP 的唯一事实源是：

```text
<project>/.lfaa/
```

根目录 `/skills`、`/plugins` 不再作为 LFAA 资源目录。

Desktop / Runtime 后续通过 File Watcher 监听 `.lfaa` 资源子目录，采用“校验 → 新 Registry Generation → 原子发布”的热插拔模型。运行中的 Run 固定使用启动时的资源 generation，避免中途替换造成状态破坏。


---

## 架构详细说明（原 architecture-v1 合并）

### LFAA Architecture v1

- 状态：active
- 生效：2026-09-17
- 产品版本：v0.0.1

#### 1. Control Plane / Execution Plane

##### TypeScript Control Plane

负责：Agent Loop、Context、Model Router、Tool Runtime、Skills、MCP、Plugins、DSH Compatibility、Subagents、Verifier、Event/Job、Project Resource Registry。

##### Rust Execution Plane

负责：FS Broker、Process Broker、PTY、Sandbox、Secret Store、Workspace Security、File Watcher。

#### 2. Desktop / Web 复用

```text
React UI
↓
App Shell
↓
Agent Client
├── Electron Transport
└── HTTP/SSE/WS Transport
```

#### 3. 安全边界

```text
Untrusted:
React / Model / Web / Docs / Skills / Experts / Plugins / Extensions / MCP
↓ typed capability boundary
Tool Runtime
↓
Policy
↓
Permission
↓
Rust Broker re-validation
```

`Full` 不改变硬拒绝、项目边界、Secret 隔离和 Broker 最终校验。

#### 4. Durable Agent

Event Store 是事实源。

#### 5. 当前/历史架构隔离

当前：`/ARCHITECTURE.md`  
历史变化：`/docs/DEVELOPMENT_LOG.md`

#### 6. Import Path Boundary

```text
同一小模块          → ./ / 单层 ../
App 跨目录           → 宿主已验证 alias
Package 跨 Feature   → 本 package Export/Subpath Export
跨 package           → @lfaa/* 公共 Export
```

#### 7. Project Resource Boundary

```text
<project>/.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
└── mcp/
```

项目资源默认不可信；Secret 明文禁止进入项目资源目录。

#### 8. Remote / Web Boundary

Remote 模式必须在 Agent Client 之前增加身份认证、逐资源授权、用户/项目隔离、请求限制和审计。

#### 9. Identity / Attribution Boundary

LFAA 自有公开组件使用 `lfaa-*` 或 `@lfaa/*`，作者署名为二鱼。第三方成果保留原作者、来源和许可证。


#### 10. Hot-Pluggable Project Resources

`.lfaa/` is the only project resource namespace.

```text
File Watcher
→ debounce
→ validate
→ Resource Registry generation
→ atomic publish
```

New runs use the latest generation. In-flight runs remain pinned to the generation they started with.

Dot-prefixed directories do not change filesystem API semantics and therefore do not block Electron/Node/Rust hot-plug support.


## 可复用 Package 运行时导入规则

- `packages/*` 属于可复用模块，禁止依赖仅由本 package `tsconfig.paths` 定义、宿主未必认识的 `@/` 等私有 alias。
- 跨 Feature / 子域共享稳定能力时，优先通过 package `exports` / Subpath Export 暴露，例如 `@lfaa/ui/workbench`。
- `apps/*` 可以使用宿主明确配置并由运行时打包器验证过的 alias；不得把 App alias 反向当成 package 公共事实。
- TypeScript 类型检查不能替代真实运行时解析门禁；workspace 公共 import 必须同时通过 `runtime-import-resolution-check.mjs`。
