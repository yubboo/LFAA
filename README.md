# LFAA v0.0.96 — Workspace 父领域聚合 / Chat-Work 双投影

**当前包：LFAA-v0.0.96**

v0.0.96 在 v0.0.95 的模块化与 Infinite Canvas 修复基础上，把产品语义进一步收敛：`Workspace` 是父领域，`Chat` 与 `Work` 是同一 Agent/Project 核心之上的两种投影，不再把二者规划成两个平级 package。新增真实 `@lfaa/workspace`，内部按 `chat / work / shared` 组织；`@lfaa/app-shell` 收敛为产品 Shell/Chrome/Composer/Settings 装配；`@lfaa/ui` 继续只提供通用 UI Kit 与 InfiniteCanvas/Slider/Effect/Resize 等 Primitive。

本版同时把“防过度拆包”写入架构规范：同一领域优先在一个父 package 内分层，只有独立生命周期/部署、跨领域复用或多个真实 Consumer 成立时才拆独立 package；不为未来功能提前建立空壳。

# Little Fish AI Agent

**中文名称：小鱼 AI 智能体**  
**简称：LFAA**  
**作者：二鱼**  
**当前包：LFAA-v0.0.96**

## 当前产品定位（v0.0.96）

LFAA 是面向个人的 AI 任务平台，而不是只会对话的聊天壳。用户可以通过 **Chat 一句话** 或 **Work 无限画布** 驱动同一个 Agent Runtime；一键开服、AI 写作、AI 拆图、Minecraft 插件/模组开发等场景最终都应作为 Plugin / Capability / App Pack 进入。

长期技术边界：**TypeScript 主产品/Agent 平面 + 稳定 Rust Native Kernel + 极少量按需 Python Runtime**。外部 Codex、DeepSeek Harness、MCP 等成熟生态优先通过官方 Runtime/协议 Adapter 接入；LFAA 统一发现、权限、事件和 UI，但不复制低配 Agent Loop，也不削掉上游高级能力。


> 一个属于用户、与大模型厂商解耦的 AI Agent 平台，通过工作区、技能、工具、记忆和插件构建不同领域的专业智能体。


## 第一次打开项目先看这里

如果你不熟悉这些目录和源码文件，先看：

```text
docs/项目结构与代码地图.md
```

它逐项解释根目录、`apps/`、`packages/`、`crates/`、`scripts/`、`docs/`，并画出当前 Web UI 的 TSX / CSS / Terminal 文件关联。

开发前请先读：

```text
AGENTS.md
→ DEVELOPMENT.md
→ docs/README.md
```

v0.0.50 起，Prompt、开发日志、版本记录不再“一次任务一个 Markdown”，统一维护在固定长期文档中。

## 产品原则

- Workspace：工作区与项目上下文
- Agent Runtime：持续执行任务的 Agent Harness
- Tools：受控工具执行
- Skills：按需加载的专业技能
- Memory：可控、可追溯的记忆与知识
- Plugins：原生插件、MCP、DeepSeek Harness/Cordis 兼容
- Model Platform：多模型、多账号、本地模型、官方允许的认证方式
- Permission：请求审批 / 替我审批 / 完全权限
- Knowledge：本地知识库与 Hybrid Retrieval
- Desktop + Web：共用 React UI 与 Agent Protocol

## 当前阶段

`v0.0.23` 开始 #21 Web 工作台 UI：三栏布局、水墨主题、Vite 本地热插拔验证。

当前主业务模块：

```text
plugin-platform + agent-runtime + workbench
```

当前版本总任务：

```text
#21.25 Workspace 领域聚合 / Chat-Work 双投影父子架构
version: v0.0.96
status: pending-user-acceptance

Workspace 是父领域：Chat 与 Work 在 @lfaa/workspace 内共享 Session/Run 核心；App Shell 只装配公开 API。v0.0.95 的 Infinite Canvas 持久化/选中置顶、Reasoning/Resize/Provider/Agent Runtime 行为保持冻结，不在架构重构中顺手改动。
```

v0.0.87 把 v0.0.86 已验证方向进一步抽成共享 UI 架构：`packages/ui/src/ui-overlay / ui-controls / ui-effects / ui-extension` 统一承载可复用交互与扩展 seam。Composer 的 Slider 与强力推理特效改为调用共享模块；未来 Effect Pack / Renderer / Panel 等可通过 Registry 贡献并按 owner 卸载，UI Kernel 基础件保持稳定。

`#2.16` 的 ChatGPT / Codex App Server 登录闭环继续保留为 `pending-user-acceptance`，没有因为架构升级被覆盖。

配置系统最近业务任务：

```text
#2.2 config-schema
status: pending-user-acceptance
```

#20.16 / v0.0.62、#2.5 / v0.0.65、#2.6 / v0.0.66 均已由用户实机验收通过。v0.0.67 的六家 AI Provider Web Account/Auth/Secret 闭环与 v0.0.68 的 Vite Native Config 兼容修复继续保留。v0.0.69 已完成 Settings 与 Workbench 的共享侧栏几何，但实机暴露 tsconfig-only `@/` alias 无法被 Web Vite 运行时解析。当前 v0.0.70 改为 `@lfaa/ui/workbench` 公共 Subpath Export，并新增运行时导入解析门禁；共享 resize / snap / 反向 release / 持久化行为保持不变。 v0.0.70 实机已能正常进入 Settings，但继续暴露工作台与 Settings 仍各自保存 leftWidth 的细节差异；v0.0.71 将 Shell `leftPaneWidth` 升级为两者共享的唯一宽度事实源，进入 Settings 与返回工作台均保持同宽。OpenAI ChatGPT 套餐现已接入官方 Codex App Server 托管登录候选闭环：LFAA 不保存 ChatGPT Token，账户与模型通过 App Server 读取，等待用户 Windows 实机验收。

## Node.js 包管理器

LFAA 只允许使用：

```text
pnpm
```

允许：

```text
pnpm install
pnpm add
pnpm remove
pnpm run
pnpm exec
pnpm --filter
pnpm -r
```

禁止使用 npm、npx、yarn、bun 替代 pnpm 管理本项目依赖或 workspace 命令。

## Git 源码更新

首次 clone 后不需要重复 clone。后续运行：

```text
LFAA-Update.bat
```

## 开发环境与依赖

Windows 下运行：

```text
LFAA-Setup.bat
```

Skills、Experts、Plugins、Extensions、MCP 均跟随项目安装，不使用用户级全局目录。


## 项目资源目录

LFAA 项目级可热插拔资源统一放在：

```text
.lfaa/
├── skills/
├── experts/
├── plugins/
├── extensions/
└── mcp/
```

根目录不再使用 `/skills`、`/plugins` 作为第二套资源目录。


## Web 本地开发

UI 开发预览统一从：

```text
LFAA-Setup.bat
→ 2 启动 Web
```

启动 Vite：

```text
http://127.0.0.1:5173
```

## 当前 UI

Web 工作台采用 Codex / ChatGPT 类黑白灰三栏结构，支持浅色 / 深色、左右拉伸、动态最大宽度与平滑吸附收起。当前框架级按钮属于顶部 Header：左栏按钮与标题位于中间 Header；右栏展开时终端 / 右栏按钮位于右栏 Header，右栏收起时回到中间 Header。左栏收起后可 Hover 临时预览，点击或 `Ctrl+B` 执行正式开合。


## 依赖模型

LFAA 只采用一套简单规则：

```text
电脑只装一次
→ Node / pnpm / Git / Rust / Cargo

项目自己保存
→ node_modules / Cargo.lock / target / .lfaa / rust-toolchain.toml
```

需要准备环境时运行：

```text
LFAA-Setup.bat
→ 1 按需依赖
```

菜单 1 不是每次开发的必经步骤。v0.0.54 起它会先比较本机依赖指纹：依赖声明、lockfile 和实际安装状态都未变化时直接显示“已就绪”，不会再次执行 `pnpm install` / `cargo fetch` / `rustup toolchain install`。只有首次配置、依赖新增/删除/版本变化、lockfile 变化、依赖缺失或工具链损坏时才提示是否同步。纯产品版本递增不会触发依赖重装。v0.0.55 起进一步去掉重复预检/完成提示，并直接显示项目 `node_modules`、pnpm 虚拟仓库、真实 pnpm Store、Node/Rust 锁文件、Cargo 缓存和 Rust toolchains 路径。Node 24.x 仍是项目要求；pnpm 缺失或版本不匹配时 Setup 可通过 Corepack 准备项目锁定的 pnpm 11.17.0。菜单 1 不自动追逐上游最新版本，也不会自动执行依赖升级。 v0.0.57 起，PNPM_HOME、pnpm 可执行位置、全局配置文件、active Store 与 Store 来源每次运行都实时读取；`.lfaa/state` 不保存/回放 Store 路径，仓库也不设置项目级 `storeDir`。


## Setup 菜单行为

```text
1 - 10
→ 完成后返回主菜单

0
→ 退出
```

需要检查时使用：

```text
LFAA-Setup.bat
→ 10 检查中心
   ├─ 快速检查：quality:quick
   ├─ 完整检查：quality:full
   └─ 正式发布：release:full
```

日常开发通常选择快速检查；阶段完成可跑完整检查；只有准备正式发布时才需要最重的 `release:full`。这些命令都可以脱离 Windows 菜单直接调用，未来 CLI / GUI 复用同一能力。

Web 本地开发启动使用快速端口检测，不再逐个等待 5173-5199 网络超时。


## 当前 Web 工作台

```text
三栏拖拽
中间主区左右上角 Shell 控制
左栏 Hover 临时预览
底部终端停靠区
```

分隔条只负责拖拽与自动吸附；顶部按钮负责开合左右栏与终端。


## Web 真实本地终端

v0.0.32 起，Web 开发工作台底部使用真实 PTY：

```text
xterm.js → Vite local bridge → node-pty → PowerShell / Shell
```

首次需要真实终端依赖时，可运行菜单 1【按需依赖】或直接用项目 pnpm 命令安装依赖；已安装则无需重复执行。


## 原生依赖安全策略

LFAA 使用 pnpm 严格依赖构建门禁。真实终端所需 `node-pty@1.1.0` 已在项目配置中精确批准，其他未审核依赖仍然不能执行安装脚本。
