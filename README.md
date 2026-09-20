# LFAA v0.1.0 — Harness 化仓库架构 / Workspace 依赖健康修复

**Little Fish AI Agent（小鱼 AI 智能体）**，简称 **LFAA**。作者：二鱼。

当前包：**LFAA-v0.1.0**。按项目版本规范，`v0.0.99` 之后必须进位到 `v0.1.0`；此前生成的 `v0.0.100` / `v0.0.101` 仅属于误标构建，不进入正式版本序列。本版本承接 v0.0.99 的 Harness 化重构，并合并 Workspace Sync 目录迁移修复与 Workspace 依赖健康检测修复。

> 当前真相以本 README、`ARCHITECTURE.md`、`DEVELOPMENT.md`、`AGENTS.md` 与 `docs/项目结构与代码地图.md` 为准。CHANGELOG、DEVELOPMENT_LOG、PROMPTS 中出现的旧路径只代表当时版本的历史事实。

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
│  ├─ llm/                       # 模型协议 Adapter
│  ├─ plugin/                    # Plugin SDK / Runtime / Host
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

v0.1.0 的目标是在 v0.0.99 Harness 架构上完成 Sync 目录迁移与依赖健康事实源修复，不重做产品、不改变既有业务行为。以下既有能力继续保留：

- Chat / Work 同一 Workspace 双模式；
- Work Infinite Canvas 与已有交互、布局持久化；
- Composer、模型快捷切换、Reasoning Boost、Resize/Snap/动画；
- AI Provider / Account / Model Settings；
- Windows Credential/Secret Broker；
- Plugin SDK、Registry、生命周期与 Node Package Host；
- Codex App Server 官方适配；
- Local Terminal；
- Windows Setup / Sync / GitHub / Update 工具；
- 现有架构门禁和 contract tests。

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
2. `ARCHITECTURE.md` — 当前架构真相；
3. `DEVELOPMENT.md` — 开发规范与门禁；
4. `docs/项目结构与代码地图.md` — 物理路径与 Owner；
5. `docs/MODULES.md` / `docs/RUNTIME.md` — 模块和运行链路。

## 文档真相层级

当前事实优先级：

```text
当前代码 / package.json / 自动门禁
    ↓
ARCHITECTURE.md + DEVELOPMENT.md + AGENTS.md
    ↓
docs/ 当前长期文档
    ↓
CHANGELOG / DEVELOPMENT_LOG / PROMPTS 历史记录
```

历史记录不应被改写成“从来没有发生过”，但不能再作为当前路径或当前架构的依据。
