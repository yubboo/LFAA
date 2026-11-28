# 开发方案：托管官方 CLI 代理与本地订阅账户管理

> 状态：待负责人评审确认后开工（A1 新功能 / 跨包契约）。

## 1. 目标与范围

在 LFAA 现有「自研 Agent 引擎 + HTTP API / 本地模型」能力之外，新增**托管官方 CLI 代理 + 本地订阅账户管理**能力，让用户直接复用本机已登录的 ChatGPT Plus/Pro（`codex`）、Claude Pro/Max（`claude`）、Google AI（`agy`）等官方 CLI 订阅额度，无需单独购买按量 API Key。

### 核心交付
1. **设置中心新增「CLI 代理」Tab**（位于 `设置中心 → 模型与规则` 中 `LLM 大脑配置` 旁边）：
   - **本机自动探测**：检测本机已安装与可安装的官方 CLI（首批一等支持 `codex`、`claude`、`agy`，目录同时展示 `opencode`、`grok`、`cursor-agent`、`copilot`、`zcode`、`aider` 等常见 CLI 的安装状态与官网/安装指引）。
   - **单代理配置**：启用/停用开关、自定义启动命令/权限参数、打开方式（「聊天」/「终端」）、设为默认、一键刷新检测。
   - **本地订阅账户隔离与切换**（对齐 Orca 模式）：
     - 默认直接复用**系统默认登录**（例如 `~/.codex`、`~/.claude`、默认 `agy` 账户），零配置可用。
     - 支持**添加隔离账户**（每账户独立本地目录，存于 `~/.lfaa/cli-accounts/<agentId>/<accountId>/`），运行子进程时通过官方环境变量注入（`CODEX_HOME`、`CLAUDE_CONFIG_DIR`、`AGY_ACCOUNT` 等），凭证仅保留在本机，支持一键切换当前激活账户与移除。
     - 支持一键在集成终端打开官方登录命令（如 `codex login`、`claude login`、`agy auth login`），严禁抓取/窃取 OAuth token 直发 HTTP。
2. **外部 CLI 后端适配层（两阶段交付）**：
   - **阶段 1（本次优先落地）**：
     - 宿主服务与注册表（本机探测、配置持久化、账户目录隔离、登录引导、在集成终端启动对应 CLI 并自动注入当前账户环境变量）。
     - 设置中心 `CLI 代理` Tab 完整 UI（遵循 `docs/standards/settings-ui.md`：无外框卡片、分组留白、双主题语义变量）。
     - 聊天主界面「模型选择器」中将已启用且本机已安装的 CLI（首批 `codex`、`claude`、`agy`）作为可选执行后端，通过官方非交互流式协议运行并返回流式文本与工具事件：
       - `codex`: `codex exec --json`（JSONL 流 + `thread_id` 续聊 `codex exec resume`）+ `CODEX_HOME`
       - `claude`: `claude -p --output-format stream-json --verbose --include-partial-messages`（NDJSON 流 + `--resume` 续聊）+ `CLAUDE_CONFIG_DIR`
       - `agy`: 通过 `agy` 官方 CLI 入口与 `AGY_ACCOUNT` / 默认登录上下文执行。
   - **阶段 2（后续按需扩展）**：
     - 订阅套餐余量/状态栏展示（如 Claude / Codex / Cursor / GLM Coding Plan 用量查询）。
     - 项目级账户绑定（不同项目绑定不同个人/工作账户）与 ACP（Agent Client Protocol）通用协议适配，一次接入全部 ACP 生态代理。

---

## 2. 调研与参考（强制 §0）

- **问题与关键词**：`codex exec --json CODEX_HOME`、`claude -p --output-format stream-json CLAUDE_CONFIG_DIR`、`Agent Client Protocol ACP codex-acp claude-agent-acp`、`stablyai/orca codex claude local login context`。
- **独立来源（查阅日期：2026-11-28）**：
  1. OpenAI Codex CLI 官方文档（`codex exec --json` JSONL 事件流、`thread.started` / `resume`、`CODEX_HOME` 环境变量隔离 `config.toml` / `auth.json`）：https://github.com/openai/codex
  2. Anthropic Claude Code 官方 CLI 文档（`claude -p --output-format stream-json --verbose --include-partial-messages` NDJSON 流、`CLAUDE_CONFIG_DIR` 隔离目录）：https://docs.anthropic.com/en/docs/claude-code/cli-reference
  3. Agent Client Protocol（ACP）开放规范与官方适配器（`codex-acp`、`claude-agent-acp`，JSON-RPC over stdio）：https://github.com/agentclientprotocol/agent-client-protocol
  4. Orca（`stablyai/orca`）多账户隔离实现模式（默认复用系统登录 + 按账户隔离独立 home 目录并注入 CLI 环境变量）：https://github.com/stablyai/orca

### 候选方案对比与取舍

| 维度 | 方案 A：官方 CLI 原生流式子进程适配（选定，阶段 1） | 方案 B：全量走 ACP（`codex-acp` / `claude-agent-acp`）桥接（阶段 2 扩展） | 方案 C：直接解析本地 OAuth token 发 HTTP（拒绝） |
| :--- | :--- | :--- | :--- |
| **合规与安全** | 完全调用官方 CLI，合规安全 | 合规，但需额外安装第三方/社区 `npx` 适配包 | 违反厂商条款且 token 刷新脆弱，**明确拒绝** |
| **开箱即用度** | 只要用户本机装了 `codex` / `claude` / `agy` 即可直接用 | 需额外拉取并维护 `codex-acp` 等桥接包版本 | 不可靠 |
| **流式与续聊** | 原生 JSONL / NDJSON，结构稳定，映射 LFAA 流事件成本低 | 协议统一，适合后续扩展 10+ 外部代理 | — |
| **许可与依赖** | 零新增第三方运行时依赖，纯 Node `child_process` | 需引入 `@agentclientprotocol/sdk` | — |

**结论**：阶段 1 采用**方案 A（官方 CLI 原生流式子进程 + 环境变量账户隔离）**，零额外依赖、开箱即用；接口层预留统一 `CliAgentAdapter` 契约，阶段 2 可无痛接入方案 B（ACP）扩展更多代理。

---

## 3. 包归属与架构边界

严格遵循 `docs/architecture/package-taxonomy.md` 与 `docs/architecture/dependency-rules.json`：

- **Host 能力层**（放在 `packages/core/` 或 `packages/host/`，待确认是否独立新包 `packages/core/cli-agents`）：
  - `catalog.ts`：内置官方 CLI 目录（`codex`、`claude`、`agy`、`opencode`、`grok`、`cursor-agent`、`copilot`、`zcode`、`aider`），声明可执行名、版本探测命令、登录命令、隔离环境变量名（如 `CODEX_HOME` / `CLAUDE_CONFIG_DIR`）、默认参数。
  - `detector.ts`：跨平台检测本机已安装 CLI（Windows `where` / POSIX `which` + `--version`，带缓存与手动刷新）。
  - `store.ts`：持久化 `~/.lfaa/cli-agents.json`（启用状态、默认打开方式、自定义参数、受管账户列表与当前选中账户；凭证目录落在 `~/.lfaa/cli-accounts/<agentId>/<accountId>/`）。
  - `runner.ts`：流式子进程适配器（首批 `codex` JSONL、`claude` NDJSON、`agy`），支持取消（`AbortSignal`）、工作目录（`cwd`）绑定当前项目/工作树、以及注入选定账户环境变量。
- **HTTP 路由层**：在 `packages/host/web-server` 注册 `/api/cli-agents/*`（列表与探测、刷新、保存配置、新建/切换/删除账户、在终端发起登录）。
- **Client 界面层**（`packages/client/ui-chat/client/settings/` 与 `models/`）：
  - `AgentSettingsView.tsx`：在 `LLM 大脑配置` 旁新增第二个 Tab **`CLI 代理`**（顺序：`LLM 大脑配置` | `CLI 代理` | `系统与用户规则` | `长期记忆库`）。
  - `CliAgentsSettingsPanel.tsx`：已安装 / 可安装分组列表、启用开关、配置与账户管理抽屉/弹窗（「系统默认」+「+ 添加账户」+「在终端登录」）。
  - `ModelReasoningPicker`：模型选择器增加「CLI 代理」分区，列出已启用且本机已安装的 CLI，选中后聊天消息路由到对应 CLI 流式后端。

---

## 4. 验收标准

1. 设置中心 `模型与规则` 中可见 `CLI 代理` Tab，自动扫描本机已安装的 `codex` / `claude` / `agy` 等 CLI 并区分「已安装 / 可安装」。
2. 每个已安装 CLI 支持开关启用、配置命令参数、选择「系统默认」或添加隔离账户，并在集成终端一键发起登录。
3. 在聊天输入栏选择已启用的 `codex` / `claude` / `agy` 后发送消息，能以当前项目目录和选定账户流式返回回答并支持中途停止；未配置任何 API Key 也可正常工作。
4. 浅色与深色双主题目视正常，`pnpm build`、`pnpm check`、`pnpm lint`、`pnpm verify:web` 及新增单元测试全部通过。
