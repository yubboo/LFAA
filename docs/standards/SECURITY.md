# LFAA 安全开发规范

## 1. 信任模型

以下输入默认不可信：

- Model 输出；
- React/Web 输入；
- 文档与检索结果；
- Skills、Experts、Plugins、Extensions、MCP；
- Tool 参数；
- 网络响应与第三方配置；
- 项目内可被外部修改的文件。

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

任何兼容层、插件、调试模式或内部工具都不得绕过。

## 3. `Full` 的准确语义

`Full` 只表示允许在用户预先授权的范围内减少逐次询问。

它永远不得绕过：

- 硬拒绝规则；
- 项目/工作区路径边界；
- Secret 隔离；
- 系统保留路径；
- capability 范围；
- Rust Broker 最终校验；
- 平台强制安全限制。

## 4. Policy / Permission 职责

- Policy Engine 根据硬规则、capability、资源范围和上下文产生 `Deny / Ask / AllowByPolicy`；
- Permission Engine 只负责 Ask/Auto/Full 预设与审批生命周期；
- Permission 可以拒绝或完成 `Ask`，但不能把 Policy 的 `Deny` 升级为 `Allow`；
- Rust Broker 对最终请求重新校验，发现范围不一致时拒绝执行。

## 5. 审批绑定

审批必须绑定规范化后的具体操作：

- tool/capability ID；
- 参数摘要；
- canonical path 与工作目录；
- 网络目标；
- 资源上限；
- 有效期、次数和发起 Run。

审批后任何关键字段变化都必须重新决策，禁止“批准 A、执行 B”。

## 6. Rust Broker

Rust Broker 是最终 Reference Monitor，必须重新验证输入，不信任 TypeScript 已经检查。

文件系统实现必须覆盖路径穿越、symlink/junction、UNC、大小写差异和 TOCTOU。

进程实现必须覆盖参数注入、环境变量泄漏、取消、超时、子进程清理和资源上限。

## 7. Secret

Secret 不得进入：

- 普通 SQLite 字段；
- 模型上下文；
- Event Store；
- 日志、Trace、错误信息和崩溃报告；
- `.lfaa/` 资源目录；
- Git 和发行包。

只允许保存 `credential_ref`，并支持轮换、撤销和审计。

## 8. Remote / Web

Remote/Web 模式交付前必须具备：

- TLS；
- 身份认证和逐资源授权；
- 用户/项目/工作区隔离；
- CSRF、CORS、WebSocket Origin 校验；
- 限流、超时和请求大小限制；
- 安全审计日志；
- 默认不暴露本机 Broker。

## 9. 供应链

- 固定工具链和 lockfile；
- 执行依赖漏洞与许可证检查；
- 生成 SBOM；
- 发行物签名并记录 provenance；
- 第三方资源校验来源、哈希、发布者和许可证；
- 禁止安装脚本隐式写入用户级全局目录。

## 10. 安全验证

权限决策、路径处理、协议解析、迁移和资源 manifest 应使用负向测试、属性测试或 fuzz。

发现安全问题时允许跨模块立即修复，但必须补齐 Prompt、Progress、Changelog 和回归用例。
