# LFAA 当前架构

> 本文件只描述当前有效架构。
> 本文件只描述当前有效架构；历史变化统一通过 `docs/DEVELOPMENT_LOG.md` 追溯。

## 当前架构版本

```text
architecture-version: 1
status: active
product: Little Fish AI Agent
short-name: LFAA
```

详细架构已合并在本文件下方。

人类代码导航：`docs/项目结构与代码地图.md`

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
9. TypeScript 深层相对导入 `../../` 及以上禁止，跨目录使用 `@/`，跨 Package 使用 `@lfaa/*`。
10. Rust Broker 必须重新校验 canonical path、capability 和资源范围。
11. Skills、Experts、Plugins、Extensions、MCP 全部是项目级不可信资源。
12. Remote/Web 必须经过身份认证、逐资源授权和用户/项目隔离后才能访问 Runtime。
13. LFAA 自有组件使用官方命名空间；第三方成果必须保留原作者、来源和许可证。

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
同目录     → ./
workspace  → @/
跨 package → @lfaa/*
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
