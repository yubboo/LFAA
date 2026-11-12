# LFAA Agent 账户记忆与 DSH MCP 共享（2026-11-12）

<a id="lfaa-agent-memory-dsh-mcp-20261112"></a>

## 用户目标

让 DSH Super Agent 在用户明确启用后读取并更新 LFAA 本机保存的账户记忆；继续使用设置中心管理记忆生成和外部 Agent 共享，不让 DSH 直接访问 LFAA 数据库。

## Owner 与设置

- 记忆正文继续由 `packages/core/conversation-memory` 唯一持有，按账户写入当前 LFAA Control Plane SQLite；Workspace 项目专属记忆继续隔离在当前项目，不通过账户记忆连接器跨项目暴露。
- `packages/settings/settings` 持有个性化设置。复用 `personalization.memoryEnabled`、`personalization.memoryFromToolChats`，新增 `personalization.memorySharedWithAgents`，默认关闭；归一化、校验、持久化和前端映射保持同一合同，不覆盖旧账户偏好。
- 外部凭据只允许调用专属记忆 MCP 路由，不获得普通账户 API 能力；明文令牌只在创建时返回，存储使用单向摘要，并支持撤销/轮换。MCP 写入要求记忆总开关与外部共享开关均开启，并复用记忆内容校验、账户归属和 revision 冲突保护。
- DSH 复用现有通用 Streamable HTTP MCP Client，按用户配置连接 LFAA 记忆端点；本轮只改 LFAA checkout，不直接读写 DSH 或 LFAA SQLite 文件。
- 本机保存指数据落在 LFAA Control Plane SQLite。DSH 读取的记忆会进入 DSH 当前模型请求；LFAA 自动整理仍使用用户在设置中心选定的 Provider。本合同不承诺本地推理。

## 运行入口与验收

- 入口：Control Plane API 中的专用 MCP 路由；Settings 中的“个性化”页面负责总开关、工具聊天记忆开关、外部 Agent 共享开关、连接令牌创建/撤销和配置说明。
- 记忆读写调用唯一 Conversation Memory Owner；连接凭据由现有 Credentials/Authorization Owner 承担。写入只更新账户记忆，受数量、长度、敏感内容过滤、revision 和关闭开关检查保护。
- 验收：旧设置迁移读回默认 false 且保留已有偏好；令牌不可读取明文、仅能访问专属 MCP 记忆工具、撤销立即失效；成功读取/更新后从原设置 API 回读一致；关闭外部共享或总开关后 MCP 读写失败关闭；DSH 通用 MCP Client 完成真实 initialize/list/call 协议往返；设置页在桌面与窄短视口可操作。
- 性能、安全与维护：单请求内创建/关闭无会话 MCP Transport，不增加轮询或持久订阅；MCP 输入/输出有界；令牌比较使用恒定时间摘要比较；路由不暴露其他账户、设置、会话、工具或知识库。界面沿用已有 Appearance 和减少动态效果设置。

## 允许范围

允许修改 Conversation Memory、Settings 类型/默认值/校验、Credentials/Authorization 凭据 Owner、专用 MCP API Controller、Web App 装配、Settings UI、相关 README、SQLite 单调迁移、直接回归和本合同/架构事实。不得读取或修改 DSH checkout，不改变记忆总开关与旧账户偏好，不重置现有项目记忆，不把记忆内容写入应用日志或模型历史，不新增第二套工具审批策略，不提交或发布。

## 实施记录

实现与验收未完成；完成后逐文件列明职责、命令与真实结果，并记录 DSH 外部配置与模型端边界。
