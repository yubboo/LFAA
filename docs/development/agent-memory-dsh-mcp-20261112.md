# LFAA Agent 账户记忆与 DSH MCP 共享（2026-11-12）

<a id="lfaa-agent-memory-dsh-mcp-20261112"></a>

## 用户目标

让 DSH Super Agent 在用户明确启用后读取并更新 LFAA 本机保存的账户记忆；继续使用设置中心管理记忆生成和外部 Agent 共享，不让 DSH 直接访问 LFAA 数据库。

## Owner 与设置

- 记忆正文继续由 `packages/core/conversation-memory` 唯一持有，按账户写入当前 LFAA Control Plane SQLite；Workspace 项目专属记忆继续隔离在当前项目，不通过账户记忆连接器跨项目暴露。
- `packages/settings/settings` 持有个性化设置。复用 `personalization.memoryEnabled`、`personalization.memoryFromToolChats`，新增 `personalization.memorySharedWithAgents` 与 `personalization.memoryAgentWritesEnabled`，均默认关闭；归一化、校验、持久化和前端映射保持同一合同，不覆盖旧账户偏好。
- 外部凭据只允许调用专属记忆 MCP 路由，不获得普通账户 API 能力；明文令牌只在创建时返回，存储使用单向摘要，并支持撤销/轮换。MCP 读取要求记忆总开关与外部读取开关均开启；写入还要求独立的外部写入开关，并复用记忆内容校验、账户归属和 revision 冲突保护。
- DSH 复用现有通用 Streamable HTTP MCP Client，按用户配置连接 LFAA 记忆端点；本轮只改 LFAA checkout，不直接读写 DSH 或 LFAA SQLite 文件。
- 本机保存指数据落在 LFAA Control Plane SQLite。DSH 读取的记忆会进入 DSH 当前模型请求；LFAA 自动整理仍使用用户在设置中心选定的 Provider。本合同不承诺本地推理。

## 运行入口与验收

- 入口：Control Plane API 中的专用 MCP 路由；Settings 中的“个性化”页面负责总开关、工具聊天记忆开关、外部 Agent 读取/写入开关、连接令牌创建/撤销和配置说明。
- 记忆读写调用唯一 Conversation Memory Owner；连接凭据由现有 Credentials/Authorization Owner 承担。写入只更新账户记忆，受数量、长度、敏感内容过滤、revision 和关闭开关检查保护。
- 验收：旧设置迁移读回默认 false 且保留已有偏好；令牌不可读取明文、仅能访问专属 MCP 记忆工具、撤销立即失效；成功读取/更新后从原设置 API 回读一致；关闭外部读取或总开关后 MCP 读写失败关闭，关闭写入开关后 MCP 写入失败关闭；MCP Server 完成真实 initialize/list/call 协议往返，并确认 DSH 通用 MCP Client 可配置对应传输与请求头；设置页在桌面与窄视口可操作。
- 性能、安全与维护：单请求内创建/关闭无会话 MCP Transport，不增加轮询或持久订阅；MCP 输入/输出有界；令牌比较使用恒定时间摘要比较；路由不暴露其他账户、设置、会话、工具或知识库。界面沿用已有 Appearance 和减少动态效果设置。

## 允许范围

允许修改 Conversation Memory、Settings 类型/默认值/校验、Credentials/Authorization 凭据 Owner、专用 MCP API Controller、Web App 装配、Settings UI、相关 README、SQLite 单调迁移、直接回归和本合同/架构事实。可只读核对 DSH 通用 MCP Client 的兼容性，不修改 DSH checkout；不改变记忆总开关与旧账户偏好，不重置现有项目记忆，不把记忆内容写入应用日志或模型历史，不新增第二套工具审批策略，不提交或发布。

## 实施记录

实现已完成，设置、记忆正文、账户凭据和 MCP 路由由各自 Owner 持有。账户记忆默认关闭；外部 Agent 读取、外部 Agent 写入以及工具对话整理分别受独立设置控制。DSH 不访问 SQLite 文件，只能通过专用 Streamable HTTP MCP 读取或更新账户记忆。

### 2026-11-12 Control Plane 构建错误修复

- 问题：`pnpm run build:control-plane` 在 `agent-memory-mcp.ts` 报两项 TS2379；MCP SDK 的精确可选类型不接受显式 `sessionIdGenerator: undefined`，Express 的 `Request.auth`（LFAA 登录会话形状）与 SDK 的 MCP `AuthInfo` 不兼容。
- 修复：`StreamableHTTPServerTransport` 省略可选会话生成器，SDK 在未提供生成器时保持无状态；调用处将请求按其 Node `IncomingMessage` 基础类型传入 SDK，保留请求对象和已解析请求体，不把 Express 的认证扩展类型当作 MCP AuthInfo。专用记忆令牌验证、设置门禁、账户数据 Owner 和写入 revision 校验未改变。
- 设置与权限：未新增或修改设置；继续由 `personalization.memoryEnabled`、`personalization.memorySharedWithAgents` 及写入时的 `personalization.memoryAgentWritesEnabled` 控制。认证仍由记忆连接凭据 Owner 与路由每次请求的校验负责。
- 当时验证：`pnpm run build:control-plane` 通过，产物写入根 `dist/apps/control-plane/`。当时只修复构建阻塞；后续验收见 2026-11-13 记录。
- 本次变更文件：`packages/api/settings-controller/src/agent-memory-mcp.ts`（MCP HTTP 传输/Node 请求类型边界）；本合同（问题、Owner/设置边界和验证证据）；`docs/PROMPTS.md`（任务索引状态）。

### 2026-11-13 实现与验收

- 设置：保留 `personalization.memoryEnabled`、`personalization.memoryFromToolChats`，新增默认关闭的 `personalization.memorySharedWithAgents` 与 `personalization.memoryAgentWritesEnabled`。设置页使用账户 Settings Owner 自动保存；旧设置缺项时回落为关闭，不覆盖已有记忆或设置。
- 本机数据与凭据：Conversation Memory Owner 按账户保存在 Control Plane SQLite；迁移 80 新增账户唯一的专用访问凭据表，只存 SHA-256 摘要。令牌创建只返回一次，支持轮换和撤销；令牌不认证普通 API。
- Agent 接口：`POST /mcp/agent-memory` 采用无会话 Streamable HTTP，一次请求最多 16 KiB；只公开 `memory_read` 和受 `memoryAgentWritesEnabled` 控制的 `memory_replace`，调用原记忆 Owner 的内容校验、账户隔离及 revision compare-and-set。
- DSH 兼容性：只读检查 `E:/lfaa1/deepseek-harness/packages/mcp/mcp-client/README.zh.md` 与 `src/transport.ts`，确认现有通用 MCP Client 支持 `streamable-http`、URL 与 `Authorization` 请求头。本轮未修改 DSH，也未创建 DSH 配置或访问令牌；必须由用户在 LFAA 打开记忆和共享开关、创建一次性凭据，再在 DSH 配置 MCP 服务后才会连接。DSH 读取的记忆会进入 DSH 当前模型请求。
- 设置页验收：ChatGPT 内置浏览器打开隔离 Web 实例 `http://127.0.0.1:3100/settings?section=personalization`，登录临时测试账户并进入“个性化”。桌面视口 1280×720 与手机视口 420×700 均可浏览账户记忆和“连接 DSH Super Agent”；外部开关默认关闭，读取/写入与工具对话子开关禁用，连接状态未连接，按钮禁用，未创建凭据。已恢复浏览器默认视口；未做真实 DSH 账户连接或帧时间测量。
- 回归：`node --test apps/cli/tests/conversation-memory.test.mjs` 通过（1/1）；`node --test apps/cli/tests/workflow-core.test.mjs` 通过（1/1）。`apps/cli/tests/harness-agent-api.test.mjs` 的新增设置状态、共享门禁、令牌创建/轮换/撤销断言均通过，测试随后在 Provider 请求数断言失败（预期 2，实际 3）。
- 构建与检查：Control Plane、相关 Host/Client 包构建以及 `pnpm --dir apps/web exec vite build` 通过；`pnpm exec tsc --noEmit -p tsconfig.host.json` 通过。`tsconfig.client.json` 仍被 `packages/client/ui-chat/src/AiWorkChat.tsx` 的现有错误阻塞，本次相关 Settings/Connection 文件无诊断。Impeccable 检测返回 `[]`；`git diff --check` 通过。`pnpm run check:workspace` 当前报告包目录 JSON/Markdown 清单过期，以及两份既有文档的缺失图片链接和两条缺失合同锚点；本次新增合同锚点未报告错误。编译结果只写入仓库根 `dist/`。
- 运行端配置：设置页沿用账户 Appearance（主题、字体、字号、对比度、遮罩/模糊和减少动态效果映射）；本次未改变这些用户偏好。测试账户和 SQLite 数据位于 `C:/Users/Administrator/AppData/Local/Temp/lfaa-memory-feature-acceptance-20261113`，共 16 个文件、约 3.9 MB；测试服务已停止，清理命令被本机删除策略拒绝，因此目录仍保留。现有 3000 端口 Web/Daemon 未重启。
