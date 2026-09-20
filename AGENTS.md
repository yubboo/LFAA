# AGENTS.md

> LFAA 仓库的 AI 开发入口。
> 用户说“按照开发要求做 / 按照开发规范开发 / 严格按照开发规范”时，必须按本文件和 `DEVELOPMENT.md` 执行，禁止只口头承诺。

## 0. 一眼先看到的唯一流程

```text
用户需求
→ 分配 #NN.x 编号 + 功能名称 + 新版本
→ 先写 docs/PROMPTS.md
→ 更新 docs/DEVELOPMENT_LOG.md / PROJECT_PLAN.md
→ 冻结边界、验收条件、必须测试
→ 才开始改 Code
→ AI 自测 + 自动门禁 + 能做的实际运行验证
→ 更新 CHANGELOG.md / docs/RELEASES.md
→ 状态 = pending-user-acceptance
→ 打包给用户验收
→ 用户明确通过后才允许 delivered
```

用户验收不通过：必须新建子编号、新 Prompt、新递增版本；旧包只读保留，禁止覆盖。

## 1. 强制阅读顺序

1. `DEVELOPMENT.md`
2. `docs/README.md`
3. `docs/PROMPTS.md` 中当前任务
4. `docs/DEVELOPMENT_LOG.md` 中对应编号
5. `ARCHITECTURE.md`
6. `PROJECT_PLAN.md`
7. `docs/MODULES.md`
8. 任务相关的 `docs/UI.md` / `docs/TESTING.md` / `docs/RUNTIME.md`
9. 对目录或源码关系不熟悉时读 `docs/项目结构与代码地图.md`
10. Code

未完成必要阅读和 Prompt 合同前，禁止修改业务代码。

## 2. 文档不再“一任务一个文件”

v0.0.50 起，历史通过固定长期文档中的编号时间线记录：

```text
docs/PROMPTS.md          # 所有 Prompt
docs/DEVELOPMENT_LOG.md  # 所有开发日志
CHANGELOG.md              # 所有版本变更
docs/RELEASES.md         # 所有发布记录
```

禁止重新创建 `active/archive/version-folder` 的 Markdown 碎片体系。

## 3. 当前事实源

```text
DEVELOPMENT.md
ARCHITECTURE.md
PROJECT_PLAN.md
docs/MODULES.md
docs/UI.md
docs/TESTING.md
docs/RUNTIME.md
docs/项目结构与代码地图.md
```

历史记录不能覆盖当前事实；当前事实变化时，同时在 Development Log / Changelog 留痕。

## 4. 代码可读性

关键实现文件必须写清：作用、负责、不负责、状态归属、对外接口、关联文件、修改注意事项。

复杂算法解释原因和不变量；CSS 写明盒子 / 区域结构；重要目录必须有 README 或项目地图入口。

Windows `scripts/windows/*.ps1` 必须保持 UTF-8 with BOM。

## 5. AI 四条硬规则

1. Prompt 先行；
2. 边界优先；
3. AI 自测不等于用户验收；
4. 全程可追溯。

## 6. 目录职责与依赖方向硬规则

任何新功能在写 Code 前，Prompt 必须先写清“归属目录 / 允许依赖 / 禁止依赖”。禁止以“先能跑”为理由把业务逻辑临时塞进 App、UI、Vite Config 或其他最近的目录。

长期职责：

```text
apps/                     可运行宿主入口；只做启动、宿主 Adapter、平台桥
packages/ui/              UI Kit / Design System / Shared Interaction Engine；通用控件、布局、Motion、Effect、Canvas Projection，不拥有产品业务真值
packages/workspace/       Workspace 产品领域；Chat / Work 是同一父领域下的两种投影，共用 Session/Run 核心
packages/app-shell/       LFAA 产品 Shell / Chrome / Composition；负责 Shell、导航、Composer、Settings 等外壳装配，不重复拥有 Workspace 内部实现
packages/config-system/   配置设置业务唯一归属；Schema / Settings / Account / Auth / Provider 配置
crates/                   Rust 原生能力与安全 Broker
scripts/                  开发/治理工具；不得承载产品业务
```

AI 配置固定父子级：

```text
packages/config-system/src/settings/ai/
├── core/
└── providers/<provider>/

packages/ui/src/features/settings/ai/
```

硬边界：

- **领域优先于拆包：** 同一领域的模式/core/renderer/runtime 优先先放在一个父 package 内用子目录分层；只有出现独立发布/生命周期、部署边界、跨领域真实复用或多个真实 Consumer 时才拆成独立 package；禁止为了“看起来模块化”提前创建空壳包；
- `packages/workspace` 的父子结构固定为 `chat/ + work/ + shared/`；Chat/Work 不允许重新拆成 `chat-workspace` / `work-workspace` 两个平级 package；
- `packages/ui` 是共享 UI Kit，不是“所有产品界面”的目录；新增通用 UI 基础/交互/特效/扩展进入 `src/ui-xxx/`，既有 `layout/workbench/features` 保持；
- UI Kernel 基础件不可卸载；Effect/Renderer/Panel/Action 等独立生命周期能力才通过 Registry 插件化；
- 普通插件不得直接操作 LFAA DOM，业务组件不得复制 shared outside-dismiss / Slider Pointer / Effect 实现；
- `packages/ui` 不拥有 Config / Provider / Secret 真值，不直连厂商 API；
- `packages/config-system` 不依赖 React、DOM、`packages/ui`、`apps/*`；
- `apps/web/src` 只进入浏览器 bundle；`apps/web/dev` 只允许 Vite dev-server / Node Host bridge；二者不得混用运行时 API；
- `apps/web` 不保存可复用业务 UI，不实现 Provider 厂商逻辑；
- Provider 配置插件只能进入 `config-system/src/settings/ai/providers/<provider>`；
- Runtime 模型推理 Adapter 仍属于模型运行域，不能因为同一家厂商而塞进 Config UI；
- 跨包只走公共 Export，禁止深链内部源码。

目录规则由 `scripts/folder-boundary-check.mjs` 自动门禁；文档约定和机器检查必须同时存在。

## 7. 执行能力唯一链路

```text
Agent / Plugin / MCP / DSH
→ Capability / Tool Adapter
→ Tool Runtime
→ Policy Engine
→ Permission Engine
→ Rust Broker
→ OS
```

禁止绕过。

## 8. 包管理器与开发入口

Node workspace 只允许 `pnpm`。

Windows 开发入口：

```text
LFAA-Setup.bat
LFAA-Sync.bat
LFAA-GitHub.bat
LFAA-Update.bat
```

四者职责不得混用；详细规则看 `docs/RUNTIME.md`。

`LFAA-Setup.bat` 的菜单编号只是 Windows 便捷入口，不是开发协议：环境已就绪可跳过依赖准备；质量能力以根 `quality:*` / `release:*` 命令为长期入口，未来 CLI / GUI 复用能力而不是复用菜单编号。


## 9. Plugin-first 与语言所有权硬规则

新增产品能力默认顺序：

```text
Plugin / Skill / Tool / Expert / Workflow / Adapter / App Pack
→ 只有稳定机制无法表达时才修改 Core
```

- `@lfaa/plugin-sdk` 是 Plugin Manifest / Capability Contract 的唯一协议 Owner；
- `@lfaa/plugin-runtime` 是运行时 Plugin / Capability generation Registry 的唯一状态 Owner；
- Agent Runtime 必须复用 Plugin SDK 的 Capability 词汇，禁止复制第二套；
- 外部 Codex / DeepSeek Harness / MCP / 未来平台通过 Adapter 接入，优先调用官方 Runtime/协议，不仿造低配实现；
- Common Contract 之外的平台高级能力放入 namespaced `extensions`，禁止统一时削平；
- App Pack 只是能力组合，不得自建 Agent Loop / Permission / Session / Tool Runtime；
- TypeScript 是 Product & Agent Plane；Rust 是稳定 Native Kernel；Python 仅 Optional Runtime；
- 新需求默认不得修改 Rust，除非确实新增 OS/native primitive、安全修复或已证明的性能瓶颈。

机器门禁：`scripts/language-ownership-check.mjs` + `scripts/folder-boundary-check.mjs` + `scripts/package-architecture-check.mjs`。

新增 package/crate 默认拒绝；只有“真实实现 + 当前 Consumer + 明确 layer/role”才进入 workspace。Service Definition / Provider / Consumer / Composition 不得反向穿透。用户插件依赖只能进入 `.lfaa/state/plugin-profile`，不得写入 LFAA 根 package/lock。第三方可执行插件不得直接 import 到 Web/Electron 主进程；Secret 只能声明 credential requirement，不得进入 Manifest/日志/argv/env。
