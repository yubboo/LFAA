## v0.0.92 Runtime Reasoning Projection / Slider Geometry / Star Effect 边界

- Config System 继续保存 Provider 原始 `reasoningEffort.options`，包括厂商真实存在的 `none/off/disabled`；UI 不修改 Catalog。`packages/app-shell/src/reasoning-control.ts` 只为 Runtime“思考强度”投影过滤关闭 sentinel，剩余有效 option 保持 Provider 原数量、顺序、label、value。
- `DiscreteSlider` 的外层只处理 Pointer Capture；`__geometry` 是 rail / fill / mark / thumb / effect 的唯一坐标系。Pointer ratio 直接读取 `geometry.getBoundingClientRect()`，首末档固定落在 rail 的 0% / 100%。
- `__effect-clip` 与 rail 同几何且 `overflow:hidden + border-radius:999px`；`ParticleStreamCanvas` 只在该 host 内绘制，业务层不能通过 margin/transform 修补粒子越界。
- Canvas 粒子形态改为圆点、微光点与少量四向星芒，运动采用水平漂移 + 独立 twinkle 相位；禁止绘制 tail/arrow line。standard 为粉色，最高有效 reasoning 档 extreme 为淡粉→粉→紫→深紫。
- Runtime Card 顶部 icon-only button 必须显式覆盖通用 Popover button 的双列 grid 为单格 grid；布局问题优先修共享选择器冲突，不写截图分辨率补丁。

## v0.0.91 Canvas Effect / Reasoning Commit / Release Archive 边界

- `packages/ui/src/ui-effects/ParticleStreamCanvas.tsx` 是强力推理连续粒子效果的 Renderer Owner：单 `<canvas>`、Canvas 2D、`requestAnimationFrame`、`ResizeObserver`、DPR 与 reduced-motion；不得逐帧写 React State，也不得退回多个 DOM 粒子 + CSS 帧动画。
- `UiEffectHost` 只做 Registry → Renderer 分派；App Shell 只传 `active={boostActive}` 与 standard/extreme variant。Palette 仍由可继承 CSS Token 提供，Canvas 在绘制时解析 Token，后续 Settings 改色不需要改动画算法。
- Reasoning Provider setting 采用 App Shell 乐观选择 + 串行 Promise 队列。它与 `modelControlBusy` 分离：模型切换仍可锁控件，但 reasoning 保存不得让 Slider 进入 disabled opacity，从而避免 PointerUp 闪烁。模型切换前必须等待既有 reasoning 队列落盘。
- `scripts/release-archive.mjs` 是发布 ZIP 字节格式 Owner：entry 名统一 UTF-8，Local Header / Central Directory 均设置 General Purpose Bit 11；`scripts/windows/lfaa-sync.ps1` 只验证来源目录 canonical Unicode 路径和 preflight，绝不修复坏包或放宽 governance。

## v0.0.90 Reasoning Control / Execution Hint 边界

```text
Current model official Capability
reasoningEffort.options (0 / 1 / N)
        ↓ exact count / order / label / value
reasoning-control.ts: Provider options → Runtime Slider steps 1:1
        ↓
AgentModelBinding.settings = selected official Provider value only

Strong Reasoning toggle
        ↓ orthogonal
AgentRunRequest.executionHints.reasoningBoost
        ↓
Host/Harness-specific interpretation
```

LFAA 不再拥有固定六档 reasoning taxonomy。当前模型 Capability 返回几档，Runtime Control 就显示几档；没有 `reasoningEffort` 就没有 Slider。`none/off` 是否存在也由 Provider Capability 决定，UI 不全局过滤。最高官方 option 只用于 extreme 视觉/默认 Hint 位置，不重命名、不改写 Provider value。强力推理始终与 Provider reasoning option 正交。

# LFAA 当前架构

> 本文件只描述当前有效架构；历史变化统一通过 `docs/DEVELOPMENT_LOG.md` 追溯。

## v0.0.88 交互运行时补充

- Web 开发态 Chat 通过 `apps/web/dev/bridges/agent` 注入 `AgentRuntimeHost`，API Provider 文本回复通过 Runtime Event 投影到 Chat Timeline；该 bridge 是开发态 smoke runtime，不替代正式 Harness Adapter。
- UI 共享运动学继续归 `packages/ui/src/ui-xxx`：`ui-motion` 管展开/收起，`ui-shortcuts` 管全局快捷键，`ui-resize` 管帧率无关阻尼，`ui-overlay` 管统一层级。
- Workbench Resize 的产品阈值与视觉运动分离：业务规则仍由 captureRatio 等配置决定，视觉跟随由通用阻尼 Primitive 决定，避免每个 Surface 重写手感。

## 当前架构版本

```text
architecture-version: 4
status: active
product: Little Fish AI Agent
short-name: LFAA
```

详细架构已合并在本文件下方。

人类代码导航：`docs/项目结构与代码地图.md`


## v0.0.80 当前物理骨架：少而真实，不用占位包假装模块化

LFAA 采用 **Service Definition / Provider / Consumer / Composition** 的角色分离，但只有存在真实实现与当前 Consumer 时才创建 workspace package。规划中的模块只留在文档，不允许用 `export {}` 或 `module_name()` 占位。

当前 Node workspace 只有 9 个真实项目：

```text
foundation
├─ @lfaa/plugin-sdk       Plugin / Capability / App Pack 公共契约
└─ @lfaa/credentials      credentialRef / CredentialStorePort

runtime
├─ @lfaa/plugin-runtime   Registry + PluginManager 生命周期
└─ @lfaa/agent-runtime    Chat / Work 共用 Agent Run 契约

domain
└─ @lfaa/config-system    Provider / Account / Model 配置

presentation
└─ @lfaa/ui               React UI / Settings / Workbench

composition
└─ @lfaa/app-shell        产品 Surface 与 Host/ViewModel 装配

host-adapter
└─ @lfaa/plugin-host-node 独立 Plugin Profile + pnpm 事务宿主

host
└─ @lfaa/web              当前唯一可运行 Web 开发宿主
```

Cargo workspace 当前只保留 `lfaa-secret-store`。Rust 是 Frozen Native Kernel，不提前创建 FS / Process / PTY / Sandbox 空 crate；只有出现真实、不可由现有宿主安全表达的 native primitive 和 Consumer 时才新增。

`scripts/package-architecture-check.mjs` 强制 `package.json#lfaa.layer/role`、依赖方向、无环、真实源码和非占位 Rust 实现。新增模块默认必须证明：**谁拥有它、谁消费它、为什么现有 seam 不能表达它。**

## Plugin Profile：安装依赖与 LFAA 主 workspace 彻底分离

插件包管理不修改根 `package.json` / `pnpm-lock.yaml`，而使用本机状态目录：

```text
.lfaa/state/plugin-profile/
├─ package.json
├─ pnpm-lock.yaml
├─ pnpm-workspace.yaml
└─ node_modules/
```

安装生命周期固定为：

```text
Spec
→ Inspect（registry / absolute path / git / tarball）
→ Manifest + Capability + Permission + Credential Requirement
→ Transactional pnpm install
→ Validate installed identity
→ Commit disabled
→ explicit Enable
→ Registry next generation
```

失败/取消恢复 Profile `package.json + pnpm-lock.yaml`；`pnpm 11` build script 必须按精确包名审批后重试。Web、未来 CLI 和 Agent“一句话安装”只能调用同一个 `PluginManager`，禁止各自实现安装器。已加载的第三方可执行代码不承诺任意 HMR；当前热插拔只对 Manifest / Capability generation 生效，未来 executable plugin 必须进入隔离 Worker/子进程/Sandbox。

## Credentials：插件与模型配置共享同一个 Secret seam

`@lfaa/credentials` 只定义 `credentialRef` 与 `CredentialStorePort`；配置、Plugin Manifest、日志和 Agent Context 默认只接触引用/元数据。Windows 真实 Secret 继续由 Rust Secret Broker → Credential Manager 持久化。插件只声明 `credentials[]`，不得携带 Secret 值；`host-mediated` 是默认推荐方式，只有外部程序技术上必须读取 Secret 时才允许未来通过 `isolated-process` 在受控进程生命周期内临时注入。

## Model Configuration：Account 与 Active Model 是两个事实

模型配置不能把“如何认证 Provider”和“当前 Agent 真正用哪个模型”混在同一字段里。`AiAccountRecord` 拥有认证方式、`credentialRef`、Provider settings、账户默认 `selectedModelId`、模型参数与最近一次官方 `modelCatalog`；`AiActiveModelBinding` 单独拥有全局 `{ accountId, providerId, modelId }`。

```text
Provider Account / credentialRef
        ↓
modelCatalog + selectedModelId
        ↓ explicit activate
AiActiveModelBinding
        ↓
Chat / Work / AgentRunRequest
```

App Shell / UI 不允许通过账户数组顺序、第一条 `selectedModelId` 或临时 UI state 推断当前模型。模型目录快照只保存公开元数据；Secret 仍停留在 Credential seam。完整多模型 Router / Fallback 属于后续 `model-routing`，不得反向把 Config System 变成执行 Runtime。

## 产品定位：个人 AI 平台，不是单一聊天应用

LFAA 的长期目标是让用户通过一句话或无限画布完成真实任务。游戏一键开服、AI 写作、AI 拆图、Minecraft 插件/模组开发等都应作为可安装/可组合能力进入同一个平台，而不是为每个场景维护第二套应用核心。

```text
User Goal
├─ Chat: 一句话
└─ Work: 无限画布
        ↓
   Agent Runtime
        ↓
Capability Registry
├─ Model / Official Harness
├─ Tools / Skills / Experts
├─ MCP / Commands / Workflows
├─ Subagents / Agents
├─ UI / Workbench Extensions
└─ App Packs
        ↓
Policy / Permission
        ↓
Rust Native Kernel
        ↓
OS / External Apps / Network
```

## Plugin Platform：一切皆能力，App 是组合

### Core 只拥有稳定机制

Core 只允许拥有：

- Agent Run / Session / Event 协议；
- Plugin / Capability Registry；
- Policy / Permission；
- Harness / External Adapter Contract；
- Artifact / Workbench Projection Contract；
- Rust Native Broker Contract。

具体业务默认不得进入 Core。新增功能必须先回答：能否作为 Plugin / Skill / Tool / Expert / Workflow / Adapter / App Pack 实现？只有稳定机制无法表达时才允许修改 Core。

### Capability Contract 是唯一公共词汇

`@lfaa/plugin-sdk` 拥有唯一 Capability / Plugin Manifest 协议；`@lfaa/agent-runtime` 复用该词汇，不允许再维护第二套 Capability Descriptor。

```text
External Ecosystem
      ↓
Adapter / Provider
      ↓
LfaaPluginManifest + LfaaCapabilityDescriptor
      ↓
PluginRegistry (generation snapshot)
      ↓
Agent Runtime / Chat / Work / App Pack
```

统一协议必须采用 **Common Contract + Namespaced Extensions**。公共字段保证 LFAA 能发现、授权、展示和组合能力；Codex / DeepSeek Harness / MCP / 未来平台的高级字段进入命名空间 `extensions`，禁止为了最低共同能力而静默丢失。

### App Pack 不是第二套 Runtime

```text
App Pack = Manifest
         + Capability IDs
         + Skills / Experts
         + Workflows
         + Workbench Nodes
         + UI Extensions
```

“一键开服”“AI 写作”“AI 拆图”“Minecraft 插件开发”等最终都应该是 App Pack。App Pack 只能组合能力，不能复制 Agent Loop、Permission、Session、Tool Runtime。

### Registry 使用 generation 快照

Plugin/Capability 热插拔遵循：

```text
Discover → Validate → Build Next Generation → Atomic Publish
```

每个运行中的 Run 固定使用启动时的 Registry generation；资源更新只影响后续 Run，避免任务中途能力集合变化。

### 描述协议与执行协议必须分离

Manifest / Capability Descriptor 只回答“有什么、需要什么权限、支持哪些 Surface”，不得在注册阶段产生系统副作用。真正执行必须走独立 Invocation Pipeline：

```text
Capability Descriptor
      ↓ discover/select
Invocation Request
      ↓
Tool / Skill / Harness Runtime Adapter
      ↓
Policy → Permission → Rust Native re-validation（存在 OS 副作用时）
      ↓
Stream/Event/Artifact Result
```

这样未来能接入新的平台协议，而不必改变 Registry；也避免 Plugin Manager 自己演化成第二个 Tool Runtime。

### 外部生态兼容不是“全部 in-process”

- 协议天然兼容（如 MCP）：直接协议 Adapter；
- 官方 Harness/SDK（如 Codex App Server、DeepSeek Harness ACP/SDK）：优先 out-of-process / official client bridge；
- 外部平台专有插件：通过 Compatibility Adapter 转为 LFAA Manifest/Capability；
- 未提供稳定接口的第三方实现不得通过私有文件格式猜测或复制源码伪装兼容。

目标是 **薄适配、无损能力、Core 零厂商特判**，不是强行让所有第三方插件二进制在 LFAA 进程内运行。

## 语言所有权：TypeScript-first + Frozen Rust Native Kernel

LFAA 不维护“TS 一套业务 + Rust 一套业务”。语言按职责而不是按代码比例分工：

```text
TypeScript Product & Agent Plane（持续迭代）
├─ UI / Electron / Web
├─ Agent orchestration / Session projection
├─ Plugin / Capability / App Pack
├─ Skills / Experts / Tools / MCP
├─ Providers / Harness Adapters
└─ Workbench / Infinite Canvas

Rust Frozen Native Kernel（稳定、少改）
├─ filesystem primitive
├─ process / PTY primitive
├─ secret store
├─ sandbox / workspace security
└─ native OS capability

Python Optional Runtime（极少量、按需）
└─ 数据/科学计算、Python-only Skill、ML/Notebook 类任务
```

硬规则：

1. 新产品功能默认只修改 TypeScript；
2. Rust 不知道 OpenAI、DeepSeek、Minecraft、Writing、Workbench 等业务概念；
3. Rust 只新增长期稳定的 native primitive，成熟后应允许连续多个版本零修改；
4. Python 不作为第三套主业务栈，只能在明确的 Optional Runtime 中按需加载；
5. 同一领域事实只有一个 Owner，禁止三种语言重复实现 Agent Loop / Permission / Session / Tool Registry；
6. TypeScript 可以请求高权限能力，但实际 OS 副作用仍必须经过 Rust Broker 的 canonical path / capability / scope 再校验。

这些边界由 `scripts/language-ownership-check.mjs` 自动治理。

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

当前物理依赖只表达已经存在的实现：

```text
@lfaa/web (Host)
├─ @lfaa/app-shell (Composition)
│  ├─ @lfaa/ui (Presentation)
│  ├─ @lfaa/config-system (Domain) → @lfaa/credentials
│  ├─ @lfaa/agent-runtime (Runtime) → @lfaa/plugin-sdk
│  └─ @lfaa/plugin-runtime (Runtime) → @lfaa/plugin-sdk
├─ @lfaa/plugin-host-node (Host Adapter)
│  ├─ @lfaa/plugin-runtime
│  ├─ @lfaa/plugin-sdk
│  └─ @lfaa/credentials
└─ Rust lfaa-secret-store（只通过 Host Bridge 提供 Secret primitive）
```

规划中的 Tool Runtime、MCP、Subagent、Session、Process/PTY/Sandbox 等，不在拥有真实实现和 Consumer 前创建空 workspace。它们必须沿现有 Capability / Host Port seam 增长，而不是提前占目录。

## UI / Desktop / Web

当前唯一真实宿主是 `apps/web`（React + TypeScript + Vite）。Desktop / CLI / Server 只保留路线图，不在拥有真实启动入口前进入 workspace。未来 Electron/CLI/Server 必须复用同一公开 package/Host Port，不复制产品业务 Core。

```text
React UI → app-shell → public contracts
                    ↘ Web Host adapters / local bridges
```

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

`packages/ui` 内部共享基础统一使用 `ui-xxx` 子域：`ui-overlay`（浮层生命周期）、`ui-controls`（通用交互控件）、`ui-effects`（声明式 Effect Registry）、`ui-extension`（UI Contribution Registry）。UI Primitive/Control 属于稳定 Kernel；Effect/Renderer/Panel/Action 等具有独立生命周期的贡献可由 Plugin/App Pack 注册。Feature 通过公共 API/Registry 消费，不直接 import 可卸载插件，也不允许第三方插件直接修改 document/body。Registry 采用 owner-scoped cleanup + generation，使启用/卸载可以局部演进而不污染 App Shell。

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


## ModelQuickSwitch runtime boundary

模型“配置”和“使用”必须分层：Settings/Config System 拥有 Account、认证、Secret 引用、官方 modelCatalog 与 Active Model；Composer 只做基于这些事实的原地快切。日常切换使用缓存官方目录，不重新探测 Provider；官方目录刷新继续属于 Settings。模型参数经 Config System Capability 校验后通过 `AgentModelBinding.settings` 进入统一 Agent Run，禁止出现 UI 强度变化但 Runtime 不消费的第二状态。
