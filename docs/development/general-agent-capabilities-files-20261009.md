# 通用 Agent 能力：本次变更文件

当前物理仓库为 `H:/LFAA1`。下列只记录本轮增改/迁移；仓库原有未提交变更保留，上游 `H:/deepseek-harness` 只读。删除文件记录绝对路径及替代位置，不能作为仍存在文件的链接。

## 任务与架构文档

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/docs/PROMPTS.md](../../docs/PROMPTS.md) | 登记本轮任务索引 |
| [H:/LFAA1/docs/development/general-agent-capabilities-20261009.md](../../docs/development/general-agent-capabilities-20261009.md) | 目标、Owner、设置、上游对照和验证 |
| [H:/LFAA1/docs/development/general-agent-capabilities-files-20261009.md](../../docs/development/general-agent-capabilities-files-20261009.md) | 本次逐文件交付清单 |
| [H:/LFAA1/docs/development/workspace-audit-files-20261008.md](../../docs/development/workspace-audit-files-20261008.md) | 只把历史 MCP 链接映射到迁移后的当前文件 |
| [H:/LFAA1/docs/系统总体架构.md](../../docs/系统总体架构.md) | 登记当前运行事实和未实现边界 |
| [H:/LFAA1/docs/开发计划.md](../../docs/开发计划.md) | 更新已实现能力与实机验收项 |

## Core 工具与执行循环

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/packages/core/tools/src/capability-settings.ts](../../packages/core/tools/src/capability-settings.ts) | 能力状态与权限内有限开关 |
| [H:/LFAA1/packages/core/tools/src/business-tools.ts](../../packages/core/tools/src/business-tools.ts) | 登记开关工具、共享合同辅助方法、移出 hostTools |
| [H:/LFAA1/packages/core/agent-loop/src/execute-turn.ts](../../packages/core/agent-loop/src/execute-turn.ts) | 动态目录、派发复核、配置事件与请求恢复 |
| [H:/LFAA1/packages/core/agent-loop/src/runs.ts](../../packages/core/agent-loop/src/runs.ts) | 重连同步配置失效通知 |
| [H:/LFAA1/packages/core/agent-loop/src/index.ts](../../packages/core/agent-loop/src/index.ts) | 消费唯一 LLM Owner |
| [H:/LFAA1/packages/core/agent-loop/package.json](../../packages/core/agent-loop/package.json) | LLM/MCP 依赖 |
| [H:/LFAA1/packages/core/agent-loop/README.md](../../packages/core/agent-loop/README.md) | 循环、撤销、重试合同 |
| [H:/LFAA1/packages/core/system-prompt/src/index.ts](../../packages/core/system-prompt/src/index.ts) | 迁移后的关联文件注释 |
| `H:/LFAA1/packages/core/agent-loop/src/runtime.ts` | 删除：Provider 实现迁至 llm/llm/src/completion.ts |

## LLM

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/packages/llm/llm/package.json](../../packages/llm/llm/package.json) | 独立 Provider 包与根 dist 构建 |
| [H:/LFAA1/packages/llm/llm/src/index.ts](../../packages/llm/llm/src/index.ts) | 登记 LLM 服务 |
| [H:/LFAA1/packages/llm/llm/src/completion.ts](../../packages/llm/llm/src/completion.ts) | 唯一 SSE/JSON Provider 请求、流清理与失败诊断 |
| [H:/LFAA1/packages/llm/llm/README.md](../../packages/llm/llm/README.md) | 协议、配置及验收边界 |
| `H:/LFAA1/packages/llm/llm/.gitkeep` | 删除已实现目录占位 |

## MCP

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/packages/mcp/mcp-client/package.json](../../packages/mcp/mcp-client/package.json) | 独立 MCP 包与根 dist 构建 |
| [H:/LFAA1/packages/mcp/mcp-client/src/index.ts](../../packages/mcp/mcp-client/src/index.ts) | 协议服务登记与卸载清理 |
| [H:/LFAA1/packages/mcp/mcp-client/src/runtime.ts](../../packages/mcp/mcp-client/src/runtime.ts) | HTTP/stdio 工具与资源共用连接和授权校验 |
| [H:/LFAA1/packages/mcp/mcp-client/src/network.ts](../../packages/mcp/mcp-client/src/network.ts) | 迁移唯一出站/DNS 校验 |
| [H:/LFAA1/packages/mcp/mcp-client/README.md](../../packages/mcp/mcp-client/README.md) | 协议、资源及租约合同 |
| `H:/LFAA1/packages/mcp/mcp-client/.gitkeep` | 删除已实现目录占位 |
| `H:/LFAA1/packages/core/tools/src/mcp-tools.ts` | 删除：迁至 MCP Runtime |
| `H:/LFAA1/packages/core/tools/src/mcp-network.ts` | 迁出此前工作树文件：由 MCP network.ts 唯一持有 |
| [H:/LFAA1/packages/boot/capability-mcp/src/index.ts](../../packages/boot/capability-mcp/src/index.ts) | 安装检查消费唯一 MCP Owner |
| [H:/LFAA1/packages/boot/capability-mcp/package.json](../../packages/boot/capability-mcp/package.json) | MCP 依赖 |
| [H:/LFAA1/packages/boot/capability-mcp/README.md](../../packages/boot/capability-mcp/README.md) | 更新 Runtime 归属及独立开关工具说明 |

## Shell、Skill 与 Session

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/packages/shell/tool-shell/package.json](../../packages/shell/tool-shell/package.json) | Daemon Shell 工具包 |
| [H:/LFAA1/packages/shell/tool-shell/src/index.ts](../../packages/shell/tool-shell/src/index.ts) | 迁移四项 hostTools，生命周期注册/撤销 |
| [H:/LFAA1/packages/shell/tool-shell/README.md](../../packages/shell/tool-shell/README.md) | 节点、设置、审批及 PTY 边界 |
| [H:/LFAA1/packages/skill/tool-skill/package.json](../../packages/skill/tool-skill/package.json) | Skill 工具包 |
| [H:/LFAA1/packages/skill/tool-skill/src/index.ts](../../packages/skill/tool-skill/src/index.ts) | 目录/正文按需加载，复用项目与写作 Owner |
| [H:/LFAA1/packages/skill/tool-skill/README.md](../../packages/skill/tool-skill/README.md) | 路径、风险及真实节点边界 |
| `H:/LFAA1/packages/skill/tool-skill/.gitkeep` | 删除已实现目录占位 |
| [H:/LFAA1/packages/core/session/src/sessions.ts](../../packages/core/session/src/sessions.ts) | 当前运行会话范围、标题与结构事件投影 |
| [H:/LFAA1/packages/core/session/README.md](../../packages/core/session/README.md) | Session Query 权威校验合同 |
| [H:/LFAA1/packages/session/session-persistence-jsonl/src/persistence.ts](../../packages/session/session-persistence-jsonl/src/persistence.ts) | 共用单次异步扫描与有界事件页 |
| [H:/LFAA1/packages/session/session-persistence-jsonl/src/repository.ts](../../packages/session/session-persistence-jsonl/src/repository.ts) | 事件页仓库接口 |
| [H:/LFAA1/packages/session/session-persistence-jsonl/README.md](../../packages/session/session-persistence-jsonl/README.md) | 单次扫描与性能边界 |
| [H:/LFAA1/packages/session-query/tool-session-query/package.json](../../packages/session-query/tool-session-query/package.json) | 会话查询工具包 |
| [H:/LFAA1/packages/session-query/tool-session-query/src/index.ts](../../packages/session-query/tool-session-query/src/index.ts) | 五项受限查询工具 |
| [H:/LFAA1/packages/session-query/tool-session-query/README.md](../../packages/session-query/tool-session-query/README.md) | 账户/App/项目及事件白名单 |
| `H:/LFAA1/packages/session-query/tool-session-query/.gitkeep` | 删除已实现目录占位 |

## SDK

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/packages/sdk/sdk-protocol/package.json](../../packages/sdk/sdk-protocol/package.json) | 公开协议类型包 |
| [H:/LFAA1/packages/sdk/sdk-protocol/src/index.ts](../../packages/sdk/sdk-protocol/src/index.ts) | 权威协议类型导出 |
| [H:/LFAA1/packages/sdk/sdk-protocol/README.md](../../packages/sdk/sdk-protocol/README.md) | 类型边界 |
| [H:/LFAA1/packages/sdk/sdk-client/package.json](../../packages/sdk/sdk-client/package.json) | 认证 API 客户端包 |
| [H:/LFAA1/packages/sdk/sdk-client/src/index.ts](../../packages/sdk/sdk-client/src/index.ts) | REST/SSE 客户端、分页/取消/流清理 |
| [H:/LFAA1/packages/sdk/sdk-client/README.md](../../packages/sdk/sdk-client/README.md) | 用法、认证及不重放合同 |

## 设置与前端

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/packages/util/values/src/settings-contract.ts](../../packages/util/values/src/settings-contract.ts) | 共享请求重试次数/延迟默认值与类型 |
| [H:/LFAA1/packages/settings/settings/src/validation.ts](../../packages/settings/settings/src/validation.ts) | 新配置严格写入校验 |
| [H:/LFAA1/packages/settings/settings/src/service.ts](../../packages/settings/settings/src/service.ts) | 旧数据兼容归一化与持久化 |
| [H:/LFAA1/packages/client/ui-settings/src/SettingsPage.tsx](../../packages/client/ui-settings/src/SettingsPage.tsx) | 设置页重试控制，沿用外观令牌 |
| [H:/LFAA1/packages/client/connection/src/api.ts](../../packages/client/connection/src/api.ts) | 能力设置失效流事件 |
| [H:/LFAA1/packages/client/ui-chat/src/AiWorkChat.tsx](../../packages/client/ui-chat/src/AiWorkChat.tsx) | 合并刷新权威设置、取消与代数隔离 |

## 装配与工作区

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/packages/bundle/base/cordis.patch.yml](../../packages/bundle/base/cordis.patch.yml) | 装配 LLM/MCP/Shell/Skill/Session Query |
| [H:/LFAA1/packages/bundle/base/package.json](../../packages/bundle/base/package.json) | 实际第一方包依赖 |
| [H:/LFAA1/apps/cli/package.json](../../apps/cli/package.json) | 迁移后的 LLM 依赖与产品版本 |
| [H:/LFAA1/apps/web/package.json](../../apps/web/package.json) | Web 产品版本对账 |
| [H:/LFAA1/apps/desktop-electron/package.json](../../apps/desktop-electron/package.json) | Electron 产品版本及隔离构建输出 |
| [H:/LFAA1/update.json](../../update.json) | 桌面更新版本、日期和更新说明清单 |
| [H:/LFAA1/docs/updata-log.md](../../docs/updata-log.md) | 登记 LFAA 0.0.8 Electron 候选包生成状态 |
| [H:/LFAA1/pnpm-lock.yaml](../../pnpm-lock.yaml) | 同步离线工作区依赖 |
| [H:/LFAA1/tsconfig.client.json](../../tsconfig.client.json) | 生成 Client 类型映射 |
| [H:/LFAA1/tsconfig.host.json](../../tsconfig.host.json) | 生成 Host 类型映射 |
| [H:/LFAA1/docs/harness-packages.json](../../docs/harness-packages.json) | 生成实际包元数据 |
| [H:/LFAA1/docs/harness-packages.md](../../docs/harness-packages.md) | 生成实际包职责清单 |

## 长期回归与隔离清理

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/scripts/tests/compiled-web-startup.test.mjs](../../scripts/tests/compiled-web-startup.test.mjs) | 正式编译 CLI 的隔离 Web、认证、配置及正常退出回归 |
| [H:/LFAA1/apps/cli/tests/client-requests.test.mjs](../../apps/cli/tests/client-requests.test.mjs) | 设置对账独立取消，其他组件查询保持可用 |
| [H:/LFAA1/apps/cli/tests/general-agent-capabilities.test.mjs](../../apps/cli/tests/general-agent-capabilities.test.mjs) | 三种权限、拒绝/范围、撤销、请求恢复、Session 与 Skill |
| [H:/LFAA1/apps/cli/tests/agent-runtime.test.mjs](../../apps/cli/tests/agent-runtime.test.mjs) | 真实 Shell 装配与迁移后的 MCP |
| [H:/LFAA1/apps/cli/tests/ai-model-thinking-controls.test.mjs](../../apps/cli/tests/ai-model-thinking-controls.test.mjs) | 消费唯一 LLM |
| [H:/LFAA1/apps/cli/tests/execution-control.test.mjs](../../apps/cli/tests/execution-control.test.mjs) | 真实 Core/Shell 工具装配 |
| [H:/LFAA1/apps/cli/tests/mcp-tools.test.mjs](../../apps/cli/tests/mcp-tools.test.mjs) | 配置校验、工具/资源/stdio/取消协议 |
| [H:/LFAA1/apps/cli/tests/capability-mcp.test.mjs](../../apps/cli/tests/capability-mcp.test.mjs) | 迁移后的协议 Owner |
| [H:/LFAA1/apps/cli/tests/harness-agent-api.test.mjs](../../apps/cli/tests/harness-agent-api.test.mjs) | 实际 Web Bundle 与认证 SDK API |
| [H:/LFAA1/apps/cli/tests/isolated-data.mjs](../../apps/cli/tests/isolated-data.mjs) | 关闭 Session writer 后再删除隔离数据 |

## 设置中心配置

沿用 plugins.enabled/mcpServers/prompts、computerControl.enabled、permissions.mode、general.integratedShell/taskFolder、aiRuntime 的模型请求/输出/工具/子 Agent/命令时限预算。新增 requestRetries（默认 1，0–3）与 retryDelaySeconds（默认 1 秒，0–30），接入共享类型、默认值、严格校验、持久化和现有设置页，保存不重置其他偏好。新增设置控件使用现有 Appearance/主题组件，没有新增 CSS 变量。

验证命令、结果、性能证据和实机边界见 [本轮合同](general-agent-capabilities-20261009.md)。

## 本机 Web 电脑操控补充

下列增补已完成，其验收与设置见 [本机 Web CUA 合同](local-web-computer-use-20261009.md)。

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/docs/PROMPTS.md](../PROMPTS.md) | 登记回环 Web CUA 任务合同 |
| [H:/LFAA1/docs/development/local-web-computer-use-20261009.md](local-web-computer-use-20261009.md) | 回环安全边界与验收合同 |
| [H:/LFAA1/docs/development/general-agent-capabilities-20261009.md](general-agent-capabilities-20261009.md) | 说明发现与安全修复的关系 |
| [H:/LFAA1/docs/开发计划.md](../开发计划.md) | 当前能力及边界 |
| [H:/LFAA1/docs/系统总体架构.md](../系统总体架构.md) | Windows Profile 能力真实边界 |
| [H:/LFAA1/apps/cli/config/profiles/web/package.json](../../apps/cli/config/profiles/web/package.json) | 将现有桌面 CUA Bundle 装入 Web Profile |
| [H:/LFAA1/apps/cli/bin/lfaa.mjs](../../apps/cli/bin/lfaa.mjs) | Web 启动显示实际登记的电脑操控工具数 |
| [H:/LFAA1/packages/util/launch-environment/src/config.ts](../../packages/util/launch-environment/src/config.ts) | 唯一 Windows loopback 本机模式判定 |
| [H:/LFAA1/packages/util/launch-environment/README.md](../../packages/util/launch-environment/README.md) | 环境模式的安全边界 |
| [H:/LFAA1/packages/computer-use/computer-use/package.json](../../packages/computer-use/computer-use/package.json) | 增加本机环境 Owner 依赖 |
| [H:/LFAA1/packages/computer-use/computer-use/src/index.ts](../../packages/computer-use/computer-use/src/index.ts) | 仅在 Windows desktop 或 loopback Web 注册工具；驱动 import 失败不阻断 Web 启动 |
| [H:/LFAA1/packages/computer-use/computer-use/README.md](../../packages/computer-use/computer-use/README.md) | 记录工具、风险和适用 Profile |
| [H:/LFAA1/apps/cli/tests/computer-use.test.mjs](../../apps/cli/tests/computer-use.test.mjs) | loopback 解析、8 项工具、账户开关和 CUA 生命周期回归 |
| [H:/LFAA1/apps/cli/tests/harness-agent-api.test.mjs](../../apps/cli/tests/harness-agent-api.test.mjs) | 完整 Web Profile 真实 Cordis 装配登记回归 |
| [H:/LFAA1/scripts/tests/compiled-web-startup.test.mjs](../../scripts/tests/compiled-web-startup.test.mjs) | 编译后 Web 启动输出及 8 项工具目录回归 |

## Web 菜单数据目录解析修复

| 绝对路径 | 职责 |
|---|---|
| [H:/LFAA1/scripts/install-dependencies.ps1](../../scripts/install-dependencies.ps1) | Web 重启锁检查调用 Node 解析器文件，移除 PowerShell 内联 `--eval` 引号依赖 |
| [H:/LFAA1/scripts/resolve-data-directory.mjs](../../scripts/resolve-data-directory.mjs) | 加载项目 `.env`，复用 Home Paths Owner 解析权威 `LFAA_DATA_DIR` |
| [H:/LFAA1/scripts/tests/resolve-data-directory.test.mjs](../../scripts/tests/resolve-data-directory.test.mjs) | 验证环境变量及显式路径的 CLI 解析 |
| [H:/LFAA1/docs/development/general-agent-capabilities-20261009.md](general-agent-capabilities-20261009.md) | 记录菜单 `[eval1]` 启动故障修复及双 PowerShell 验证 |
