# LFAA 当前架构

> 本文件只描述当前有效架构。
> 历史架构严禁混写在本文件。
> 历史架构统一进入 `docs/architecture/archive/`。

## 当前架构版本

```text
architecture-version: 1
status: active
product: Little Fish AI Agent
short-name: LFAA
```

详细架构：

`docs/architecture/active/architecture-v1.md`

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

## 权限

用户只看到：

```text
Ask       请求审批
Auto      自动审批
Full      完全权限
```

内部拆分：

```text
Permission Preset
├── Approval Policy
├── Sandbox Policy
├── Filesystem Policy
├── Process Policy
├── Network Policy
└── Secret Policy
```

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


## 稳定开发工作区

LFAA 正式采用：

```text
H:\lfaa\lfaa
```

作为唯一持续开发/Git 工作区。

版本目录 `LFAA-vX.Y.Z` 是可独立测试的版本快照，通过受控同步脚本进入稳定工作区。
