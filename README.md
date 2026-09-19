# Little Fish AI Agent

**中文名称：小鱼 AI 智能体**  
**简称：LFAA**  
**作者：二鱼**  
**当前包：LFAA-v0.0.53**

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
- Permission：请求审批 / 自动审批 / 完全权限
- Knowledge：本地知识库与 Hybrid Retrieval
- Desktop + Web：共用 React UI 与 Agent Protocol

## 当前阶段

`v0.0.23` 开始 #21 Web 工作台 UI：三栏布局、水墨主题、Vite 本地热插拔验证。

当前主业务模块：

```text
config-system
```

当前治理修复任务：

```text
#20.7 Setup 菜单与发布门禁解耦
status: pending-user-acceptance
```

配置系统最近业务任务：

```text
#2.2 config-schema
status: pending-user-acceptance
```

#20.7 验收完成后回到配置系统；#2.2 仍需用户明确验收，不能由本治理版本代替。

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

菜单 1 不是每次开发的必经步骤。Node/pnpm/Rust/Cargo 和项目依赖已经可用时可以直接启动、构建或检查；只有首次配置、依赖变化或环境损坏时再使用。Node 24.x 仍是项目要求；pnpm 缺失或版本不匹配时 Setup 可通过 Corepack 准备项目锁定的 pnpm 11.17.0。


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
