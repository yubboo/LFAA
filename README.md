# LFAA v0.1.16 — Smart Home / Identity Visual System

**Little Fish AI Agent（小鱼 AI 智能体）**，简称 **LFAA**。作者：二鱼。

当前包：**LFAA-v0.1.16**。本版在不改 Identity Host、Agent Runtime、Session、Provider 与 Plugin 生命周期的前提下，重做登录 / First Run 注册 / 登录后第一屏：新增统一 Smart Home、自然语言主入口、手动工作区入口与统一 Motion 视觉系统。Smart Home 输入只负责把原始任务带入现有 Workbench，不用关键词规则冒充 AI Intent Router；真正的 App Pack 智能路由继续由下一阶段 Registry + Router 接管。

> 当前真相以本 README、`docs/ARCHITECTURE.md`、`docs/DEVELOPMENT.md`、`AGENTS.md` 与 `docs/项目结构与代码地图.md` 为准。CHANGELOG、DEVELOPMENT_LOG、PROMPTS 中出现的旧路径只代表当时版本的历史事实。




## v0.1.16 Smart Home / Identity Visual System

- 登录后第一屏从静态 App Hub 升级为 **Smart Home**：自然语言主入口 + 手动入口同时存在；
- Smart Home 的自然语言任务原样带入现有 Workbench Composer，不自动启动第二套 Runtime；
- AI 写作 / AI 漫剧 / Minecraft / Steam Server 在真实 App Pack 接入前继续 disabled，用户界面只显示“即将开放”，不暴露开发术语；
- 登录页与 First Run 注册页共用新的 LFAA neutral visual language、柔和进入/悬停动效与 `prefers-reduced-motion` 降级；
- “注册”仍只对应未初始化实例的 First Run 超级管理员创建；实例初始化后匿名注册永久关闭。

## v0.1.15 Development Standard / Root Layout Governance

- `docs/ARCHITECTURE.md`：当前架构真相；
- `docs/DEVELOPMENT.md`：开发规范与强制工作流；
- `docs/PROJECT_PLAN.md`：当前里程碑与下一阶段；
- 根目录 Markdown 只保留 `README.md / AGENTS.md / CHANGELOG.md / NOTICE.md`；
- `scripts/root-layout-check.mjs` 同时进入 governance 与 workspace preflight，防止长期文档、临时 Markdown、ZIP/LOG/TMP 再次堆回根目录。

## v0.1.14 Release Governance Hotfix

修复 v0.1.13 候选包中 `docs/PROMPTS.md` 未登记当前版本/任务导致 `workspace-preflight` 阻断的问题。修复只涉及发布治理、版本元数据与长期文档，不改变 Runtime/UI/业务行为。

## v0.1.13 Repository Baseline → App Pack → AI Writing

当前目录与内核协议保持稳定；下一阶段先完成 App Pack Runtime，再进入 AI Writing V1。

## v0.1.12 Identity → Smart Home / App Entry → Workspace

```text
App Boot
  ↓
Identity Gate
  ├─ First Run → create Super Admin
  └─ Login → AuthSession
  ↓
Smart Home
  ├─ 自然语言入口 → Core Workspace（当前）
  └─ 手动入口 → App Pack / Core Workspace
  ↓
Project → Session → Chat | Work | Manual
```

- **Identity 是实例级钥匙**：本地账号只用于进入和使用当前 LFAA 实例，不等同于模型 Provider 账号。
- **API 第二层门禁**：UI 登录之外，Host HTTP API 仍校验 AuthSession；用户/角色管理再校验 Permission。
- **角色不是授权真值**：Role 只是 Permission 集合，后续 Tool/MCP/Agent 执行还必须与 App Pack / Project / Capability / Host Policy 相交。
- **Smart Home 是日常入口层**：Chat / Work / Manual / Infinite Canvas 仍是 LFAA Core 能力；未来 App Hub 专注 App Pack 发现/安装/管理，Smart Home 消费 Registry/Intent Router。

## v0.1.11 项目 / 会话状态模型

```text
Project Index (active / pinned / expanded)
  └─ Session Index (active / pinned / recent)
       └─ Session Record (mode / messages / Run Timeline / workContext)
            └─ AgentRuntimeEvent(sessionId) → Chat Timeline | Work Canvas
```

浏览器只保存主题、布局等轻量偏好；项目、会话和对话历史的真值在 Node Session Host。Session Host 返回非 JSON 或不可用时，左栏会显示明确错误，不再伪装成“还没有会话”。

## v0.1.10 Session Persistence / Stable Navigation

本版把会话从 React 临时内存升级为正式 Session capability：Chat / Work / Manual 共用 `@lfaa/session`，Node Host 持久化到 `LFAA_HOME/state/sessions/`。刷新页面会恢复最近会话、当前会话、对话、Run Timeline、mode 与 Work Context；运行中的旧 Run 则明确标记为“上次运行已中断”。

左侧导航现在跨模式稳定，不再因为 Chat / Work / Manual 重建菜单；“最近”来自真实 Session Index。左上角品牌菜单与中央 Header segmented switch 同步控制同一个 mode，中间区域才切换对话、无限画布或手动工作区。Run Timeline 采用紧凑 `思考了 X 秒 ⌄` 布局，展开后查看真实 activity，最终回答保持真实 streaming。

## v0.1.10 当前产品模型

```text
                     LFAA Agent Core
                           │
          ┌────────────────┼────────────────┐
          │                │                │
     Chat Agent        Work Agent        Manual
     对话式干预         无限画布干预         无模型手动
          │                │                │
          └──────── 同一 Tool / MCP / Skill / Canvas 基础能力 ────────┘
```

- **Chat Agent**：全自动 Agent。用户通过对话、插话、继续指令进行人工干预；不因界面是聊天就降低能力。
- **Work Agent**：与 Chat 完全同核；AI 和用户通过无限画布协同，用户可直接编辑画布节点再继续对话干预。
- **Manual**：不创建 `AgentRunRequest`，没有模型也可进入；用户直接操作无限画布、Terminal 和已注册真实工具。
- **Provider**：认证方式、免费/订阅/API/Coding Plan、Usage/Quota 均以厂商官方公开能力为准；官方免费或套餐包含的能力在 LFAA 不附加额度。
- **ChatGPT 套餐**：LFAA 按需把 OpenAI 官方 App Server 运行组件准备到 `LFAA_HOME/runtimes/openai-chatgpt`，不要求用户全局安装 Codex CLI；OAuth / Token 仍只由官方组件管理，LFAA 不读取 Secret。



### v0.1.10 实时 Agent Run Timeline

```text
用户提交任务
    ↓
run.started / startedAt
    ↓
run.phase.changed = thinking
    ↓
┌─────────────────────────────────────┐
│ 已处理 9 秒                         │
│ 正在思考                            │
│  ⌄ 思考摘要（仅官方可展示 summary） │
│  ✓ 计划更新                         │
│  ✓ 读取 / 搜索 / MCP / Tool        │
│  … command output                   │
└─────────────────────────────────────┘
    ↓
assistant.delta × N  → 最终回答实时出现
    ↓
assistant.completed + run.completed
```

- **真实事件驱动**：Timeline 只消费 `AgentRuntimeEvent`，禁止 UI 根据定时器虚构“思考/工具执行”。
- **真实计时**：`run.started.startedAt` 是 Run 时钟起点；运行时显示“已处理 X 秒”，终态显示“用时 X 秒”。
- **可展开过程**：`reasoning.summary.delta`、`plan.updated`、`activity.started/output/completed` 分别投影为可展开过程。
- **隐私/能力边界**：只显示 Provider 官方提供、允许客户端展示的 reasoning summary；原始隐藏 chain-of-thought 不进入 Workspace ViewModel。
- **最终答案独立流式**：过程 Timeline 与 Assistant answer 是两块 UI；答案仍使用真实 `assistant.delta`，不是等待完成后一次性替换。

### v0.1.10 Provider 运行可靠性

- **ChatGPT 登录真值**：官方 OAuth 成功与否只依据 App Server `account/login/completed`、`account/updated` 与 `account/read`；浏览器成功页被用户关闭不再被当成登录失败，并保留 30 秒官方确认宽限期。

- **ChatGPT 套餐登录**：产品层只显示 OpenAI 官方 ChatGPT 套餐登录；Windows 由 LFAA 在 `LFAA_HOME` 按需准备并校验 OpenAI 官方 App Server 独立组件，不要求全局 `codex` / Codex CLI。
- **API 保存**：显式“测试连接 / 获取模型”成功后，保存复用短期 Host Probe，不再重复请求同一官方模型目录；未测试时保存仍会做真实官方校验。
- **官方 Usage**：余额/额度是附加状态，不阻塞账户配置；读取必须在 ready / error / timeout 中收敛，官方没有接口时显示“官方未提供”。
- **流式回复**：支持 SSE 的 OpenAI-compatible Provider 使用 `assistant.delta` 边到边输出，最终再以 `assistant.completed` 收敛；Chat/Work 消费同一 Runtime Event。
- **模式菜单**：左侧 Mode Popover 允许跨 Pane 显示，不再被父容器 `overflow` 裁切。

## 产品定位

LFAA 是面向个人的 AI Agent 工作平台。Chat 与 Work 是同一个 Workspace 父领域的两种工作模式，共享 Agent Runtime、模型配置、权限、Session/Run 与扩展能力。

长期技术边界：

- **TypeScript**：产品、Agent Harness、业务能力和 Web Client 主平面；
- **Rust**：少量稳定 Native primitive，目前只保留 Secret Store；
- **外部 Harness/协议**：优先通过官方 Adapter/协议接入，而不是复制低配 Agent Loop；
- **packages-first**：业务归能力包，App 只负责选择并启动产品组合。

## 当前仓库主骨架

```text
LFAA/
├─ apps/
│  └─ web/                       # 薄 Web 产品入口
│
├─ packages/                     # 业务与 Harness 主体
│  ├─ api/                       # Host Controller
│  ├─ bundle/                    # 产品能力组合
│  ├─ client/                    # Web Client / App Shell / Workspace / UI
│  ├─ core/                      # Agent Runtime 核心契约
│  ├─ credentials/               # Credential seam + Native Adapter
│  ├─ harness/                   # 官方外部 Harness Adapter
│  ├─ host/                      # Host 技术适配
│  ├─ identity/                  # Local Identity / RBAC
│  ├─ llm/                       # 模型协议 Adapter
│  ├─ plugin/                    # Plugin SDK / Runtime / Host
│  ├─ session/                   # Project / Session Domain + Host
│  ├─ settings/                  # Config Domain / Node Host
│  ├─ terminal/                  # Terminal Host 能力
│  └─ util/                      # 跨能力基础工具
│
├─ native/                       # Rust Native Kernel
│  └─ secret-store/
├─ scripts/                      # 开发、同步、发布、治理脚本
├─ test/                         # 仓库级契约与架构测试
├─ evals/
└─ docs/
```

完整文件地图见：**`docs/项目结构与代码地图.md`**。

## 为什么这样组织

LFAA 参考 DeepSeek Harness 的 **capability family → package → bundle → app** 思路，但不复制它的规模。现有稳定模块不重写，只改变 Owner 和物理边界：

```text
packages = 能力与业务
bundle   = 能力组合
apps     = 产品启动入口
native   = OS / Secret 等原生 primitive
```

例如 Web 产品链路：

```text
apps/web
   ↓
@lfaa/client-web              浏览器产品组合
   ↓
@lfaa/app-shell / workspace / ui

apps/web/vite.config.ts
   ↓
@lfaa/bundle-web-app          Host Bundle
   ↓
api controllers
   ↓
agent/config/plugin/terminal/llm adapters
```

`apps/web` 不再拥有 Agent、AI、Plugin、Resource、Terminal 的业务实现。

## 现有能力保持

v0.1.2 的目标是让已经配置好的 ChatGPT/Codex 套餐模型真正进入聊天执行链，同时保持 v0.1.1 的 Harness、TSConfig、依赖与同步治理不回退。以下既有能力继续保留：

- Chat Agent / Work Agent 同一 Agent Core、同能力双表现层；Manual 为无模型手动第三模式；
- Work Infinite Canvas 与已有交互、布局持久化；
- Composer、模型快捷切换、Reasoning Boost、Resize/Snap/动画；
- AI Provider / Account / Model Settings；
- Windows Credential/Secret Broker；
- Plugin SDK、Registry、生命周期与 Node Package Host；
- Codex App Server 官方适配；
- Local Terminal；
- Windows Setup / Sync / GitHub / Update 工具；
- 现有架构门禁和 contract tests。


## v0.1.2 Codex 套餐对话链

```text
Composer
→ AgentRuntimeHost
→ agent-controller
→ Provider connection.protocol = codex-app-server
→ @lfaa/codex-app-server
→ thread/start / turn/start
→ item/agentMessage/delta
→ assistant.delta
→ Workspace Chat
→ assistant.completed
```

ChatGPT 套餐认证仍完全由官方 Codex App Server 管理。LFAA 不要求 `credentialRef`、不读取 `~/.codex/auth.json`，也不复制 OAuth Token。当前版本在审批 UI 完成前固定使用 read-only sandbox，并拒绝 App Server 发起的写入/执行审批请求。

## Runtime Home

源码仓库**不再包含 `.lfaa/`**。机器运行数据进入用户级 LFAA Home：

- `LFAA_HOME` 环境变量优先；
- Windows 默认 `%LOCALAPPDATA%\LFAA`；
- macOS 默认 `~/Library/Application Support/LFAA`；
- Linux 默认 `$XDG_DATA_HOME/lfaa` 或 `~/.local/share/lfaa`。

当前用于账户状态、插件 Profile、依赖状态、日志/缓存等本机数据。Secret 明文仍不得进入普通 JSON、Git、日志或模型上下文。

旧版本工作区若存在 `<project>/.lfaa/state`，Windows Sync/Host 只做兼容性迁移；它不是新架构事实源。

## 开发入口

Windows 用户优先使用：

```text
LFAA-Setup.bat
```

项目要求：

- Node.js **24.x**
- pnpm **11.17.0**
- Rust 版本以 `rust-toolchain.toml` 为准

常用命令：

```bash
pnpm run governance:check
pnpm run typecheck
pnpm run test
pnpm run build
pnpm run quality:full
```

仓库只允许 pnpm。菜单 1【按需依赖】以 `pnpm-workspace.yaml` 的全部 importer 为唯一扫描范围，同时校验 package.json 声明、对应 lockfile importer、直接 node_modules/workspace 链接、外部包真实 resolve 与 node-pty 原生加载；发现新增/变更/缺失后自动执行需要的 `pnpm install`。依赖未变化且真实健康时不得重复安装；机器 pnpm/Store 事实每次实时读取，不从运行状态缓存反推环境。

## 开发前必读

按以下顺序：

1. `AGENTS.md` — AI/开发者快速约束；
2. `docs/ARCHITECTURE.md` — 当前架构真相；
3. `docs/DEVELOPMENT.md` — 开发规范与门禁；
4. `docs/项目结构与代码地图.md` — 物理路径与 Owner；
5. `docs/MODULES.md` / `docs/RUNTIME.md` — 模块和运行链路。

## 文档真相层级

当前事实优先级：

```text
当前代码 / package.json / 自动门禁
    ↓
docs/ARCHITECTURE.md + docs/DEVELOPMENT.md + AGENTS.md
    ↓
docs/ 当前长期文档
    ↓
CHANGELOG / DEVELOPMENT_LOG / PROMPTS 历史记录
```

历史记录不应被改写成“从来没有发生过”，但不能再作为当前路径或当前架构的依据。
