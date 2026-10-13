# 架构导读

[English](architecture.md) · [文档目录](../README.zh.md)

完整当前事实以 [系统总体架构](../系统总体架构.md) 为准；本文提供阅读路线，不另建架构权威。

`apps` 提供运行入口，`packages` 提供能力与装配，Cordis 管理生命周期。共享 Web/Electron 客户端消费同一 API；账户授权、设置、会话和领域状态仍由各自 Host Owner 校验。桌面主线为 Electron，Tauri 保留兼容源码；它不构成新桌面产品的验收证据。

Session JSONL 是消息与事件权威，SQLite 只投影查询所需的关系和头信息。正文缓存限制为 8 个会话与 32 MiB 编码预算；标题列表最多 200 个且不恢复完整 Kernel。长会话消息已有 1–100 条游标页，页面仍需两次同步扫描并校验完整哈希链，因此 CPU 工作量仍随日志增长；轻量索引、压缩和沉降未实现。

Daemon 执行目标节点任务，账户设置和领域服务决定时限及操作权限。Shell 与运维分别有一个执行槽，运维内部轮转；长 Shell 不再阻塞 Minecraft 停服，长安装仍可能占用运维槽。Electron 经既有 IPC 请求服务卸载；Tauri 兼容路径也会经 stdin 发起同一幂等卸载，并等待服务退出，异常/超时保持应用打开且不强杀。Tauri 真实桌面关闭仍未验收。

MCP Tools Owner 按账户、App 和服务完整配置复用 Streamable HTTP 会话；池最多 32 条，空闲 30 秒回收。共享握手不绑定某个 Run 的取消信号，各次发现/调用使用独立租约；设置变化或服务停用在下一次权威发现时使旧租约失效。真实用户 MCP 往返仍未验收。

共享 Settings 类型与默认值归 `util/values`，严格写入校验归 Settings，旧数据读归一化仍负责兼容。目录项目只开放给已接入的 Workspace/Minecraft；App 注册不等于项目执行能力接入。详见 [存储](storage.zh.md)、[执行控制](execution-control.zh.md) 和 [审查记录](../development/workspace-audit-20261008.zh.md)。
