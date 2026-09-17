# LFAA Architecture v1

- 状态：active
- 生效：2026-09-17
- 产品版本：v0.0.1

## 1. Control Plane / Execution Plane

### TypeScript Control Plane

负责：

- Agent Loop
- Context
- Model Router
- Tool Runtime
- Skills
- MCP
- Plugins
- DSH Compatibility
- Subagents
- Verifier
- Event/Job

### Rust Execution Plane

负责：

- FS Broker
- Process Broker
- PTY
- Sandbox
- Secret Store
- Workspace Security
- File Watcher

## 2. Desktop / Web 复用

```text
React UI
↓
App Shell
↓
Agent Client
├── Electron Transport
└── HTTP/SSE/WS Transport
```

## 3. 安全边界

```text
Untrusted:
React / Model / Web / Docs / Plugins / MCP

↓ typed capability boundary

Tool Runtime
↓
Policy
↓
Permission
↓
Rust Broker
```

## 4. Durable Agent

```text
Session
├── Turn
└── Run
    ├── Step
    └── ChildRun
```

Event Store 是事实源。

## 5. 当前/历史架构隔离

当前：

```text
/ARCHITECTURE.md
/docs/architecture/active/
```

历史：

```text
/docs/architecture/archive/
```

Archive 只读历史，不作为新实现依据。


## 6. Import Path Boundary

TypeScript / React / Node workspace：

```text
同目录     → ./
workspace  → @/
跨 package → @lfaa/*
```

`../../` 及更深相对路径属于架构违规。

跨 package 只能使用公开 Export，不能访问 `src/internal`。
