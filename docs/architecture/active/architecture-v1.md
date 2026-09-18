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
- Project Resource Registry

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

`Full` 只减少预授权范围内的逐次询问，不改变硬拒绝、项目边界、Secret 隔离和 Broker 最终校验。

审批必须绑定规范化后的 capability、参数、canonical path、网络目标、资源上限、有效期和 Run。

Policy Engine 负责硬规则和 `Deny / Ask / AllowByPolicy`；Permission Engine 负责预设与审批生命周期，不能升级 Policy 的 `Deny`。

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

## 7. Project Resource Boundary

```text
<project>/.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
└── mcp/
```

- 项目资源不得从用户级目录隐式继承；
- 嵌套项目使用最近的项目根；
- 项目移动后解析必须继续有效；
- 所有资源默认不可信，声明 capability 后仍走 Tool Runtime → Policy → Permission → Rust Broker；
- Secret 明文禁止进入项目资源目录。

## 8. Remote / Web Boundary

Web Transport 不能直接等价于本地可信调用。

Remote 模式必须在 Agent Client 之前增加身份认证、逐资源授权、用户/项目隔离、请求限制和审计。

## 9. Identity / Attribution Boundary

LFAA 自有公开组件使用 `lfaa-*` 或 `@lfaa/*`，作者署名为二鱼。

第三方成果保留原作者、来源和许可证，不得通过改名进入 LFAA 官方命名空间后抹除归属。
