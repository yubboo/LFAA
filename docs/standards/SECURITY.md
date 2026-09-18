# LFAA 安全开发规范

## 1. 信任模型

Model 输出、React/Web 输入、文档、Skills、Experts、Plugins、Extensions、MCP、Tool 参数、网络响应和项目内外部可修改文件默认不可信。

## 2. 不可绕过链路

```text
Untrusted Input
→ typed capability
→ Tool Runtime
→ Policy
→ Permission / Approval
→ Rust Broker re-validation
→ OS
```

## 3. Full

`Full` 只减少逐次询问，不绕过硬拒绝、项目边界、Secret 隔离、系统保留路径、capability 范围和 Rust Broker 校验。

## 4. Secret

Secret 不得进入普通 SQLite、模型上下文、Event Store、日志、Trace、错误、崩溃报告、`.lfaa/`、Git 和发行包。

## 5. Remote / Web

交付前必须具备 TLS、身份认证、逐资源授权、隔离、CSRF/CORS/Origin 校验、限流、超时和审计。
