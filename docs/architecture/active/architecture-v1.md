# LFAA Architecture v1

- 状态：active
- 生效：2026-09-17
- 产品版本：v0.0.1

## 1. Control Plane / Execution Plane

### TypeScript Control Plane

负责：Agent Loop、Context、Model Router、Tool Runtime、Skills、MCP、Plugins、DSH Compatibility、Subagents、Verifier、Event/Job、Project Resource Registry。

### Rust Execution Plane

负责：FS Broker、Process Broker、PTY、Sandbox、Secret Store、Workspace Security、File Watcher。

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

`Full` 不改变硬拒绝、项目边界、Secret 隔离和 Broker 最终校验。

## 4. Durable Agent

Event Store 是事实源。

## 5. 当前/历史架构隔离

当前：`/ARCHITECTURE.md`、`/docs/architecture/active/`  
历史：`/docs/architecture/archive/`

## 6. Import Path Boundary

```text
同目录     → ./
workspace  → @/
跨 package → @lfaa/*
```

## 7. Project Resource Boundary

```text
<project>/.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
└── mcp/
```

项目资源默认不可信；Secret 明文禁止进入项目资源目录。

## 8. Remote / Web Boundary

Remote 模式必须在 Agent Client 之前增加身份认证、逐资源授权、用户/项目隔离、请求限制和审计。

## 9. Identity / Attribution Boundary

LFAA 自有公开组件使用 `lfaa-*` 或 `@lfaa/*`，作者署名为二鱼。第三方成果保留原作者、来源和许可证。
