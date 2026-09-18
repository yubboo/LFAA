# LFAA 开发日志时间线

> 这是唯一 Development Log。需求、设计、架构、行为、规则发生变化时，在对应主编号下追加 `#NN.x + 名称`。
> 不再使用 active/archive 文件夹；当前与历史由条目里的 `状态` 字段区分。

## 状态约定

`active` / `implementing` / `testing` / `pending-user-acceptance` / `delivered` / `superseded` / `cancelled`。

## 当前任务索引

| 任务 | 功能名称 | 版本 | 状态 |
|---|---|---|---|
| #2.2 | Config Schema 基线 | v0.0.51 | pending-user-acceptance |
| #20.5 | 文档体系单文件时间线重构 | v0.0.50 | pending-user-acceptance |

### #20.5 文档体系单文件时间线重构

- **版本：** v0.0.50
- **状态：** pending-user-acceptance
- **AI 验证：** pass
- **用户验收：** pending
- **目标：** 把 docs 从“一任务/一版本一个 Markdown”迁移为少量固定长期文档，在文件内部按编号 / 版本递增。
- **当前结果：** 251 个 Markdown 已收敛为 9 个长期 Markdown；Prompt / Development Log / Changelog / Release 已迁移为单文件时间线。
- **兼容要求：** Runtime Log 目录保留；UI、PTY、Windows 工具业务逻辑不改。
- **验收：** AI 门禁完成后进入 `pending-user-acceptance`，用户明确通过后才允许 `delivered`。

## 当前记录

### #2.2 Config Schema 基线

- **版本：** v0.0.51
- **状态：** pending-user-acceptance
- **AI 验证：** pass
- **用户验收：** pending
- **主模块：** config-system / config-schema
- **结果：** 新增 `@lfaa/config-system`，完成 Schema v1、默认配置、O(n) 运行时校验、credentialRef 安全边界与专项门禁。
- **明确未做：** SQLite / Drizzle / Migration 执行器、Secret Broker、Config UI、Agent/Tool/Permission 执行逻辑。
- **测试：** TypeScript noEmit、8 个 Schema 单元测试、config-schema-check 已通过；`governance:check` 的 10 个实际 Node 门禁已逐项通过；100 Provider + 100 Account + 100 Model 配置校验 1000 次 P95 约 0.61ms。当前环境无法联网取得 pnpm 11.17.0，因此未伪造 pnpm 包装命令结果。
- **下一步：** 用户验收本版本后进入 `config-storage`；如验收不通过，使用新的 #2.x 和递增版本修复，禁止覆盖 v0.0.51。


> 迁移来源：`docs/logs/development/active/0020-开发日志与文档规范.md`

## #20 开发日志与文档规范

- **主编号：** #20
- **名称：** 开发日志与文档规范
- **最新变更：** #20.5
- **状态：** active
- **关键词：** 日志、文档、中文、命名、目录、索引、注释、可读性、项目地图、开发规范、发布闭环、编码门禁
- **当前文件：** `docs/DEVELOPMENT_LOG.md`

### 当前结论

LFAA 的“按照开发规范开发”不是口头承诺，而是固定执行链：

```text
读取当前事实源
→ 明确模块 / 边界 / 允许修改 / 禁止修改
→ Plan / Prompt 先行
→ Code
→ Progress / Development Log
→ Standards（如规则变化）
→ CHANGELOG / Release
→ 治理 / 编码 / 版本 / ZIP 验证
→ 新版本交付
```

旧版本只作为历史快照，任何新修复进入递增版本；当前实现、历史实现、下一步计划必须物理和语义分开。

源码可读性继续执行 #20.3 的规则：

```text
结构化中文文件头
CSS 盒子 / 区域分区
一级目录 README
项目结构与代码地图
comment-check 自动门禁
```

Windows PowerShell 新增硬约束：

```text
scripts/windows/*.ps1
→ UTF-8 with BOM
→ windows-script-encoding-check 自动门禁
```

### 最新变更

#### #20.4 开发规范执行闭环

v0.0.41 暴露出一个重要问题：虽然 #20.3 补齐了中文注释和可读性门禁，但在给 PowerShell 文件加中文文件头时，保存过程把 UTF-8 BOM 去掉，导致“满足注释规范”反而破坏 Windows PowerShell 5.1 的可执行兼容性。

本次把规范执行升级为闭环：

1. 用户说“按照开发要求 / 开发规范”时，必须先按 `DEVELOPMENT.md` / `AGENTS.md` 读取链执行；
2. 变更前先明确主模块、边界、Plan / Prompt；
3. 旧版本不覆盖，新修复进入递增版本；
4. 代码、Active 文档、历史 Archive、Changelog、Release 必须同步；
5. 新增 Windows PowerShell UTF-8 BOM 自动门禁；
6. 新增发布版本一致性门禁，防止代码版本、README、Changelog、Release 混用新旧版本；
7. 发布 ZIP 必须验证根目录、中文路径、内容 Hash 与 PowerShell BOM Round-trip。


#### #20.5 文档体系单文件时间线重构

用户要求把 Prompt、Development Log、Changelog、Release 等时间序列记录从“每次任务 / 每个版本一个 Markdown”改成“固定长期文档内按编号递增追加”。本次目标是减少 docs 文件数量、保留历史可追溯性，并把 Prompt 先行、AI 自测、用户验收状态做成可检查的开发合同。

### 影响范围

- `DEVELOPMENT.md`
- `AGENTS.md`
- `docs/standards/COMMENTS.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/standards/WORKSPACE_SYNC.md`
- `docs/standards/PACKAGING.md`
- `docs/logs/development/**`
- `docs/prompts/**`
- `scripts/windows/*.ps1`
- `scripts/windows-script-encoding-check.mjs`
- `scripts/release-consistency-check.mjs`
- `scripts/governance-check.mjs`
- `package.json`

### 验证结果

v0.0.42 发布时必须满足：

- Windows PowerShell 脚本 BOM 检查通过；
- 发布版本一致性检查通过；
- comment / docs / dev-log / import / governance 全部通过；
- ZIP 解压后 PowerShell BOM 保留；
- v0.0.41 保留为历史缺陷版本，不覆盖。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #20.0 | superseded | `archive/0020-00-开发日志初始分层.md` |
| #20.1 | superseded | `archive/0020-01-历史编号迁移.md` |
| #20.2 | superseded | `archive/0020-02-中文命名与文档整理.md` |
| #20.3 | superseded | `archive/0020-03-代码可读性与项目地图.md` |
| #20.4 | superseded | `active/0020-开发日志与文档规范.md` |
| #20.5 | active | `active/0020-开发日志与文档规范.md` |

> 迁移来源：`docs/logs/development/active/0002-配置系统.md`

## #2 配置系统

- **主编号：** #2
- **名称：** 配置系统
- **最新变更：** #2.2
- **状态：** active
- **关键词：** 配置、Schema、模型、账号、权限、UI
- **当前文件：** `docs/DEVELOPMENT_LOG.md`

### 当前结论

`config-system` 仍然是当前主业务模块。

用户要求在 `config-schema` 前先完成可运行的 Web 工作台壳，用于后续配置 UI 与 `.lfaa` 本地热插拔验证。

当前顺序：

```text
#21 Web 工作台 UI
→ config-schema
→ config-storage
→ settings
→ model-management
→ account-management
→ permission-settings
→ config-ui
```

### 最新变更

#### #2.2 Config Schema 基线

- 配置系统从 planned 进入 implementing；
- 新增 @lfaa/config-system 作为 Config Schema 唯一事实源；
- Schema Version = 1，与产品版本 v0.0.51 分离；
- 只保存 credentialRef，不保存 Secret 明文；
- 本次不进入 Storage / UI。

#### #2.1 UI 前置验证壳

- 不改变配置系统最终职责；
- 只调整近期开发顺序；
- UI 壳实现放在 `packages/ui`、`packages/app-shell`、`apps/web`；
- 配置事实状态仍不由 UI 持有；
- Web Vite 开发桥接只用于本地 `.lfaa` 资源列表验证。

### 影响范围

- `PROJECT_PLAN.md`
- `docs/plans/modules/config-system/PLAN.md`
- `docs/prompts/active/0002-配置系统.md`
- `docs/prompts/active/0021-Web工作台UI.md`
- `packages/ui`
- `packages/app-shell`
- `apps/web`

### 验证结果

- 开发顺序已更新；
- 配置系统业务代码尚未开始；
- UI 壳属于前置验证任务，不拥有 Config 真值。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #2.0 | superseded | `archive/0002-00-配置系统初始合同.md` |
| #2.1 | active | `active/0002-配置系统.md` |

> 迁移来源：`docs/logs/development/active/0010-GitHub推送确认.md`

## #10 GitHub 推送确认交互

- **主编号：** #10
- **名称：** GitHub 推送确认交互
- **最新变更：** #10.2
- **状态：** active
- **关键词：** Git、GitHub、Commit、Push、确认、交互
- **当前文件：** `docs/DEVELOPMENT_LOG.md`

### 当前结论

`LFAA-GitHub.bat → 1 一键推送` 不再进行远程 Push 二次确认。

当前交互：

```text
选择菜单 1
→ 查看变化
→ 输入 Commit 名称
→ 创建 Commit
→ 显示 origin / 分支 / Commit
→ 直接 Push
```

以下确认继续保留：

```text
新增 origin
修改 origin
强制拉取
其他高风险覆盖操作
```

### 最新变更

#### #10.2 远程预检容错与安全推送

35 版的问题是远程阶段先执行 `git ls-remote`，只要该预检测在本机 Git 环境返回非零，就直接终止，真正的 push 根本不会执行。

36 版改为：

```text
fetch origin main
→ 成功：rebase origin/main
→ 预检网络异常：提示警告但继续 safe push
→ push 最终决定成功 / 认证失败 / 网络失败 / non-fast-forward
```

并保留失败原始 Git 输出日志。此前已创建但未推送的本地 commit，在工作区没有新文件变化时也会继续进入同步与 push。

#### #10.1 取消 Push 二次确认

旧行为：

```text
输入 Commit 名称
→ 创建本地 Commit
→ 再询问是否 Push
```

新行为：

```text
输入 Commit 名称
→ 创建本地 Commit
→ 直接 Push
```

用户主动进入“一键推送”并输入 Commit 名称，已经构成完整的本次推送确认。

### 影响范围

- `scripts/windows/lfaa-github.ps1`
- `DEVELOPMENT.md`
- `docs/standards/WORKSPACE_SYNC.md`
- `docs/logs/development/INDEX.md`

### 验证结果

- Push 二次 `Read-Host` 已移除；
- origin 配置确认仍存在；
- Commit 名称输入逻辑保持不变；
- Git Push 失败日志保持不变；
- Governance / Import / Development Log / Docs Structure Check 通过。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #10.0 | delivered | `archive/0010-Commit确认优化.md` |
| #10.1 | delivered | `active/0010-GitHub推送确认.md` |
| #10.2 | active | `active/0010-GitHub推送确认.md` |

> 迁移来源：`docs/logs/development/active/0019-一键准备与依赖检测.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.10
- **状态：** active
- **关键词：** Setup、Rustup、Windows、架构、Target、官方安装器
- **当前文件：** `docs/DEVELOPMENT_LOG.md`

### 当前结论

菜单 `1` 在 Windows 首次安装 Rust 时，必须先根据本机 Windows 架构得到 Rust 官方 `rustup-init.exe` 的 target tuple，再拼接官方下载地址。

当前映射：

```text
AMD64 / x64
→ x86_64-pc-windows-msvc

ARM64
→ aarch64-pc-windows-msvc

32-bit x86
→ i686-pc-windows-msvc
```

下载路径继续使用：

```text
https://static.rust-lang.org/rustup/dist/{target}/rustup-init.exe
```

并继续执行官方 `.sha256` 校验。

### 最新变更

#### #19.10 Rustup Windows Target 缺失修复

Windows 新机器执行菜单 `1` 时出现：

```text
无法将“Get-WindowsRustupTarget”项识别为 cmdlet、函数、脚本文件或可运行程序的名称
```

根因：

```text
Invoke-OfficialRustupInstaller
→ 调用了 Get-WindowsRustupTarget
→ 但此前脚本重构时该 helper 被遗漏
```

修复：

1. 恢复 `Get-WindowsRustupTarget`；
2. 支持 AMD64 / ARM64 / x86 映射；
3. 优先考虑 `PROCESSOR_ARCHITEW6432`，兼容 32 位 PowerShell 运行在 64 位 Windows；
4. 未识别架构时明确中文失败，不猜 target；
5. Rust 官方下载地址与 SHA-256 校验保持不变；
6. Governance 增加关键 helper 与 target tuple 静态门禁，防止再次删漏。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `scripts/governance-check.mjs`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/logs/development/INDEX.md`

### 验证结果

- `Get-WindowsRustupTarget` 已定义且位于调用之前；
- x64 / ARM64 / x86 官方 MSVC target tuple 已写入脚本；
- Rust 官方 URL 与 `.sha256` 校验未移除；
- Governance / Import / Development Log / Docs Structure Check 通过；
- Windows 新机器 Rust 首装仍需用户实机继续验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | superseded | `archive/0019-03-统一开发入口.md` |
| #19.4 | superseded | `archive/0019-04-Rust安装诊断优化.md` |
| #19.5 | superseded | `archive/0019-05-Rust工具链分层.md` |
| #19.6 | superseded | `archive/0019-06-依赖模型简化.md` |
| #19.7 | superseded | `archive/0019-07-Setup主菜单循环.md` |
| #19.8 | superseded | `archive/0019-08-node-pty跨机器安装.md` |
| #19.9 | superseded | `archive/0019-09-node-pty校验引号兼容.md` |
| #19.10 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/active/0021-Web工作台UI.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.17
- **状态：** active
- **关键词：** Web、Composer、底部留白、Safe Area、Responsive、Layout Token
- **当前文件：** `docs/DEVELOPMENT_LOG.md`

### 当前结论

v0.0.49 在 v0.0.48 的响应式 / 三向吸附 / Hover 宽度统一基础上，只调整 Composer 的垂直落点。

Composer 不再使用固定 `.5rem` 底部 padding，而是读取单一设计变量：

```text
--agent-composer-bottom-gap
→ Desktop / Compact / Mobile 分别定义
→ .agent-composer-wrap
→ max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))
```

这样全屏时输入框不会贴近窗口底边，小屏又不会因为过大的固定留白浪费可用高度；安全区设备仍优先尊重 `safe-area-inset-bottom`。

### #21.17 Composer 底部安全间距

#### 问题来源

用户 Windows 实机发现 v0.0.48 输入框距离页面底边过近，下方留白太薄，整体视觉重心偏低。该问题不是 Composer 本体高度错误，而是 `.agent-composer-wrap` 的 bottom padding 仍是固定 `.5rem`，没有跟随布局模式和容器高度变化。

#### 当前实现

- 新增 `--agent-composer-bottom-gap`；
- Desktop：`clamp(1rem, 2.4vh, 1.75rem)`；
- Compact：`clamp(.875rem, 1.8vh, 1.375rem)`；
- Mobile：`.75rem`；
- Composer Wrap 使用 `max(var(--agent-composer-bottom-gap), env(safe-area-inset-bottom))`；
- 不通过 `position:absolute` / `bottom` 强行抬高，仍保持正常 Grid 文档流；
- UI contract 增加 Composer bottom-gap 单一变量检查。

#### 为什么这样做

- 使用 `vh + clamp()`：大屏适当上移，但不会随屏幕高度无限增加；
- Compact 减小间距：避免短窗口浪费主区高度；
- Mobile 使用较小稳定值：触摸屏空间优先；
- `safe-area` 仍是底部最终保护下限。

### 最新变更

#### #21.17 Composer 底部安全间距

- Composer 底部位置改为 `--agent-composer-bottom-gap` 单一变量；
- Desktop / Compact / Mobile 使用不同响应式取值；
- safe-area 作为最终底部保护下限；
- UI contract 增加固定 bottom padding 防回归；
- 不改三向吸附、响应式模式、PTY 和基础设施。

### 影响范围

- `packages/app-shell/src/agent-workbench.css`
- `scripts/ui-contract-check.mjs`
- UI Layout / Web UI Test / Prompt / Plan / Progress / Changelog / Release / Version

### 不影响

- 左 / 右 / Bottom 三向吸附状态机；
- Hover Preview 与 Click 左栏宽度单一事实源；
- Desktop / Compact / Mobile 模式计算；
- Header / Tooltip；
- Sync / GitHub / Setup / Update；
- PTY / node-pty。

### 验证结果

发布前必须通过 governance / imports / dev-log / docs / comments / Windows BOM / release consistency / UI contract / TS syntax / ZIP round-trip。

Windows 实机重点确认：全屏与小窗下 Composer 底部留白自然，不贴底、不悬得过高，终端打开时仍保持合理间距。

### 历史基线

- #21.16 已归档：`archive/0021-16-Hover与点击左栏宽度统一.md`
- #21.15 及更早继续保留在 archive。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.15 | superseded / delivered | `archive/` 对应历史文件 |
| #21.16 | superseded | `archive/0021-16-Hover与点击左栏宽度统一.md` |
| #21.17 | active | `active/0021-Web工作台UI.md` |

## 历史记录

> 以下为旧 archive 日志原文迁移。历史只用于追溯，不覆盖上方当前结论。

> 迁移来源：`docs/logs/development/archive/0001-项目初始化与架构骨架.md`

## #1 项目初始化与架构骨架

- **主编号：** #1
- **名称：** 项目初始化与架构骨架
- **记录版本：** #1.0
- **状态：** delivered
- **交付版本：** v0.0.1
- **关键词：** 项目、架构、骨架、治理

### 当时结论

建立 LFAA 初始项目骨架、架构边界、文档治理、Monorepo 与模块规划。

### 原始来源

- `docs/prompts/archive/v0.0.1/0001-项目基础.md`
- `docs/changelog/v0.0.1.md`
- `docs/progress/modules/project-foundation/PROGRESS.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#1.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0002-00-配置系统初始合同.md`

## #2 配置系统

- **主编号：** #2
- **名称：** 配置系统
- **最新变更：** #2.0
- **状态：** superseded
- **关键词：** 配置、Schema、模型、账号、权限
- **已由：** #2.1 替代
- **当前查看：** `docs/logs/development/active/0002-配置系统.md`

### 当前结论

`config-system` 是当前主业务模块，状态仍为 `planned`。

当前下一步：

```text
config-system
→ config-schema
```

业务开发顺序继续以当前 `PLAN.md` 和 Active Prompt 为准。

### 最新变更

#### #2.0 初始开发合同

已经固定：

1. Config Schema；
2. Config Storage；
3. Settings；
4. Model Management；
5. Account Management；
6. Permission Settings；
7. Config UI；
8. Tests；
9. Optimization；
10. Delivery。

### 影响范围

- `docs/modules/config-system/README.md`
- `docs/plans/modules/config-system/PLAN.md`
- `docs/progress/modules/config-system/PROGRESS.md`
- `docs/prompts/active/0002-配置系统.md`

### 验证结果

- 当前主模块仍为 `config-system`；
- 当前业务代码尚未正式开始；
- 下一步仍为 `config-schema`。

### 历史索引

#2 目前没有被替代的旧 Development Log 快照。

详细历史仍可从：

```text
docs/progress/modules/config-system/PROGRESS.md
docs/prompts/active/0002-配置系统.md
```

继续回溯。

> 迁移来源：`docs/logs/development/archive/0003-导入路径与别名优化.md`

## #3 导入路径与 Alias 优化

- **主编号：** #3
- **名称：** 导入路径与 Alias 优化
- **记录版本：** #3.0
- **状态：** delivered
- **交付版本：** v0.0.2
- **关键词：** 导入、Alias、路径、边界

### 当时结论

固定 ./、@/、@lfaa/* 三层导入规则，并禁止深层相对导入和跨 Package Internal。

### 原始来源

- `docs/prompts/archive/v0.0.2/0003-导入路径规范.md`
- `docs/changelog/v0.0.2.md`
- `docs/standards/IMPORT_PATHS.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#3.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0004-01-版本包中文路径保护.md`

## #4.1 版本包中文路径保护

- **主编号：** #4
- **名称：** 稳定工作区同步与 GitHub 推送
- **记录版本：** #4.1
- **状态：** delivered
- **交付版本：** v0.0.37
- **关键词：** 同步、ZIP、中文文件名、UTF-8、CP437、路径保护

### 变更原因

v0.0.36 发布包在打包过程中错误解释了 UTF-8 中文路径，导致同步预览把正常中文文件识别为删除，同时把乱码文件识别为新增。

用户在确认阶段取消同步，因此稳定工作区未被错误路径修改。

### 当前结论

1. v0.0.36 的功能实现继续作为基线，不回退；
2. 发布包内中文文件名必须保持 Unicode / UTF-8 语义；
3. 同步脚本在计算 ADD / MOD / DEL 前必须校验源版本包路径编码；
4. 若发现可逆的 CP437→UTF-8 乱码路径，必须直接停止同步，不允许用户误确认后写入稳定工作区；
5. 发布 ZIP 生成后必须重新读取清单，验证中文路径没有发生编码转换。

### 修改内容

- 恢复 v0.0.36 中 83 个错误编码文件名；
- `scripts/windows/lfaa-sync.ps1` 增加源路径编码完整性检查；
- 同步保护目录从“仅根目录匹配”修正为“任意路径层级匹配”，避免 `apps/web/node_modules` 被误列为删除；
- `docs/standards/WORKSPACE_SYNC.md` 增加版本包路径完整性规则；
- 发布 v0.0.37。

### 验证结果

- 修复后的目录与 v0.0.35 对比：乱码路径导致的伪新增 / 伪删除归零；
- v0.0.36 的 4 个真实新增文件与 63 个真实修改保持可追溯；
- v0.0.37 ZIP 清单可直接读取正确中文文件名；
- 没有 `Θ` / `τ` / `╜` 等可逆 CP437 乱码路径。

### 原始来源

- `docs/prompts/archive/v0.0.37/0004-01-中文路径打包保护.md`
- `docs/changelog/v0.0.37.md`
- `docs/releases/v0.0.37/RELEASE.md`
- `docs/standards/WORKSPACE_SYNC.md`

### 历史关系

- #4.0：`docs/logs/development/archive/0004-工作区同步与推送.md`
- #4.1：当前文件

> 迁移来源：`docs/logs/development/archive/0004-02-同步目标与ZIP编码.md`

## #4.2 同步目标与 ZIP 编码

- **主编号：** #4
- **名称：** 工作区同步与发布包
- **记录版本：** #4.2
- **状态：** delivered
- **交付版本：** v0.0.40
- **关键词：** 同步、稳定工作区、ZIP、UTF-8、CP936、GBK、目标路径

### 变更原因

v0.0.39 发布包多包一层目录，旧同步逻辑把稳定目标错误推导到版本包内部；同时 Windows 解压还暴露了 CP936/GBK 型中文路径乱码，而旧保护只覆盖 CP437。

### 当前结论

1. 版本包应直接以项目根内容入 ZIP，不额外包 `lfaaXX` 目录；
2. 同步脚本必须识别 `LFAA-vX.Y.Z` 祖先目录，并把默认目标稳定指向其同级 `lfaa`；
3. 中文路径校验同时覆盖 CP437 和 CP936/GBK 可逆乱码；
4. `.git`、本机日志、依赖缓存、本地 `.env` 继续作为保护项；
5. ZIP 打包后必须做清单与解压 Round-trip 校验。

### 验证结果

- v0.0.40 发布 ZIP 项目根内容直接入包；
- UTF-8 中文 ZIP 路径可正确 Round-trip；
- 错误目标 `LFAA-vX.Y.Z\\lfaa` 不再作为默认稳定工作区；
- 双编码路径保护已加入同步脚本。

### 原始来源

- `docs/changelog/v0.0.40.md`
- `docs/releases/v0.0.40/RELEASE.md`
- `docs/standards/WORKSPACE_SYNC.md`

> 迁移来源：`docs/logs/development/archive/0004-03-PowerShell脚本编码保护.md`

## #4.3 PowerShell 脚本编码保护

- **主编号：** #4
- **名称：** 工作区同步与推送
- **记录版本：** #4.3
- **状态：** delivered
- **交付版本：** v0.0.42
- **关键词：** 同步、PowerShell、UTF-8、BOM、Windows PowerShell 5.1、编码、治理

### 变更原因

v0.0.41 为 Windows PowerShell 脚本补结构化中文注释时，文件被重新保存成 UTF-8 without BOM。根 BAT 使用 `powershell.exe -File` 启动这些脚本，而 Windows PowerShell 5.1 对无 BOM UTF-8 脚本的自动识别不可靠，因此 Sync / GitHub / Setup / Update 都产生兼容性回归风险。

### 当前结论

1. `scripts/windows/*.ps1` 必须使用 UTF-8 with BOM；
2. 中文注释规范不能覆盖可执行编码契约；
3. 发布前必须由 `windows-script-encoding-check.mjs` 检查 BOM 与严格 UTF-8；
4. 根 BAT 继续通过 `powershell.exe` 调用对应 `.ps1`；
5. v0.0.42 不改变 v0.0.40 已修复的同步目标推导、路径保护和镜像算法。

### 验证结果

- 4 个 Windows PowerShell 脚本均恢复 `EF BB BF`；
- 编码检查进入治理链路；
- ZIP 解压 Round-trip 后 BOM 必须保持；
- v0.0.41 作为历史缺陷版本保留，不覆盖。

### 原始来源

- `docs/prompts/archive/v0.0.42/0004-03-PowerShell脚本编码保护.md`
- `docs/changelog/v0.0.42.md`
- `docs/releases/v0.0.42/RELEASE.md`
- `docs/standards/WORKSPACE_SYNC.md`

> 迁移来源：`docs/logs/development/archive/0004-工作区同步与推送.md`

## #4 稳定工作区同步与 GitHub 推送

- **主编号：** #4
- **名称：** 稳定工作区同步与 GitHub 推送
- **记录版本：** #4.0
- **状态：** delivered
- **交付版本：** v0.0.3
- **关键词：** 同步、GitHub、工作区、推送

### 当时结论

建立版本快照到稳定工作区的同步机制，以及 GitHub 一键推送基础流程。

### 原始来源

- `docs/prompts/archive/v0.0.3/0004-稳定工作区同步.md`
- `docs/changelog/v0.0.3.md`
- `docs/standards/WORKSPACE_SYNC.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#4.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0005-同步日志目录.md`

## #5 同步日志目录优化

- **主编号：** #5
- **名称：** 同步日志目录优化
- **记录版本：** #5.0
- **状态：** delivered
- **交付版本：** v0.0.4
- **关键词：** 同步、日志、目录

### 当时结论

将稳定工作区同步运行日志统一迁入 docs/logs/workspace-sync/。

### 原始来源

- `docs/prompts/archive/v0.0.4/0005-同步日志目录.md`
- `docs/changelog/v0.0.4.md`
- `docs/logs/workspace-sync/README.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#5.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0006-GitHub推送修复.md`

## #6 GitHub 一键推送修复

- **主编号：** #6
- **名称：** GitHub 一键推送修复
- **记录版本：** #6.0
- **状态：** delivered
- **交付版本：** v0.0.5
- **关键词：** GitHub、推送、Commit、脚本

### 当时结论

修复首次 Git 初始化和一键 Push 流程，保留用户自定义 Commit 名称。

### 原始来源

- `docs/prompts/archive/v0.0.5/0006-GitHub推送修复.md`
- `docs/changelog/v0.0.5.md`
- `docs/logs/github-push/README.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#6.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0007-GitHub远程检测.md`

## #7 GitHub 远程检测与中文输出修复

- **主编号：** #7
- **名称：** GitHub 远程检测与中文输出修复
- **记录版本：** #7.0
- **状态：** delivered
- **交付版本：** v0.0.6
- **关键词：** GitHub、origin、中文、错误

### 当时结论

修复首次无 origin 时的错误处理，并统一中文 Git 输出和技术日志。

### 原始来源

- `docs/prompts/archive/v0.0.6/0007-GitHub远程检测.md`
- `docs/changelog/v0.0.6.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#7.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0008-Git远程配置.md`

## #8 用户首次配置 Git origin

- **主编号：** #8
- **名称：** 用户首次配置 Git origin
- **记录版本：** #8.0
- **状态：** delivered
- **交付版本：** v0.0.7
- **关键词：** Git、origin、远程、配置

### 当时结论

将 origin 改为用户首次配置并持久化到 .git/config，后续自动复用。

### 原始来源

- `docs/prompts/archive/v0.0.7/0008-Git远程配置.md`
- `docs/changelog/v0.0.7.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#8.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0009-终端结束提示.md`

## #9 终端完成状态与关闭提示

- **主编号：** #9
- **名称：** 终端完成状态与关闭提示
- **记录版本：** #9.0
- **状态：** delivered
- **交付版本：** v0.0.8
- **关键词：** 终端、提示、关闭、脚本

### 当时结论

统一 Windows 脚本成功、失败和可关闭终端的中文提示。

### 原始来源

- `docs/prompts/archive/v0.0.8/0009-终端完成状态.md`
- `docs/changelog/v0.0.8.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#9.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0010-Commit确认优化.md`

## #10 移除 Commit 二次确认

- **主编号：** #10
- **名称：** 移除 Commit 二次确认
- **记录版本：** #10.0
- **状态：** delivered
- **交付版本：** v0.0.9
- **关键词：** Git、Commit、确认、交互

### 当时结论

Commit 名称输入即视为确认创建本地 Commit，Push 前确认继续保留。

### 原始来源

- `docs/prompts/archive/v0.0.9/0010-Commit确认优化.md`
- `docs/changelog/v0.0.9.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#10.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。


### 后续变更

当前确认交互已经继续调整：

```text
#10.1
```

当前查看：

```text
docs/logs/development/active/0010-GitHub推送确认.md
```

#10.0 原记录继续保留，用于对比 Commit 确认规则的演进。

> 迁移来源：`docs/logs/development/archive/0011-源码更新工具.md`

## #11 Git Clone 后一键更新源码

- **主编号：** #11
- **名称：** Git Clone 后一键更新源码
- **记录版本：** #11.0
- **状态：** delivered
- **交付版本：** v0.0.10
- **关键词：** Git、更新、拉取、源码

### 当时结论

新增 Clone 后一键更新源码工具，包含 fetch、ahead/behind、fast-forward 和保护逻辑。

### 原始来源

- `docs/prompts/archive/v0.0.10/0011-源码更新脚本.md`
- `docs/changelog/v0.0.10.md`
- `docs/logs/source-update/README.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#11.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0012-脚本菜单与强制更新.md`

## #12 Windows 脚本菜单化与强制拉取

- **主编号：** #12
- **名称：** Windows 脚本菜单化与强制拉取
- **记录版本：** #12.0
- **状态：** delivered
- **交付版本：** v0.0.11
- **关键词：** 脚本、菜单、强制拉取、备份

### 当时结论

Sync、GitHub、Update 统一改为数字菜单，并加入带恢复点的强制拉取。

### 原始来源

- `docs/prompts/archive/v0.0.11/0012-脚本菜单与强制更新.md`
- `docs/changelog/v0.0.11.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#12.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0013-更新路径无关.md`

## #13 Git 更新脚本路径无关化

- **主编号：** #13
- **名称：** Git 更新脚本路径无关化
- **记录版本：** #13.0
- **状态：** delivered
- **交付版本：** v0.0.12
- **关键词：** Git、路径、盘符、更新

### 当时结论

Update 不再依赖固定盘符和固定目录名，通过 Git 根目录识别真实工作区。

### 原始来源

- `docs/prompts/archive/v0.0.12/0013-更新路径无关.md`
- `docs/changelog/v0.0.12.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#13.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0014-同步菜单顺序.md`

## #14 同步菜单顺序优化

- **主编号：** #14
- **名称：** 同步菜单顺序优化
- **记录版本：** #14.0
- **状态：** delivered
- **交付版本：** v0.0.13
- **关键词：** 同步、菜单、交互

### 当时结论

将同步菜单的“执行同步”调整为数字 1，“预览差异”调整为数字 2。

### 原始来源

- `docs/prompts/archive/v0.0.13/0014-同步菜单顺序.md`
- `docs/changelog/v0.0.13.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#14.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0015-更新差异修复.md`

## #15 Update 远程差异读取修复

- **主编号：** #15
- **名称：** Update 远程差异读取修复
- **记录版本：** #15.0
- **状态：** delivered
- **交付版本：** v0.0.14
- **关键词：** Update、diff、拉取、Git

### 当时结论

修复 ahead=0 / behind=0 时仍继续读取远程 diff 并错误失败的问题。

### 原始来源

- `docs/prompts/archive/v0.0.14/0015-更新差异修复.md`
- `docs/changelog/v0.0.14.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#15.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0016-项目治理加固.md`

## #16 项目治理与资源边界加固

- **主编号：** #16
- **名称：** 项目治理与资源边界加固
- **记录版本：** #16.0
- **状态：** delivered
- **交付版本：** v0.0.15
- **关键词：** 治理、归属、资源、安全、质量

### 当时结论

补齐项目身份、第三方归属、项目级资源、安全、性能和质量门禁。

### 原始来源

- `docs/prompts/archive/v0.0.15/0016-项目治理加固.md`
- `docs/changelog/v0.0.15.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#16.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0017-pnpm一致性.md`

## #17 pnpm-only 一致性修复

- **主编号：** #17
- **名称：** pnpm-only 一致性修复
- **记录版本：** #17.0
- **状态：** delivered
- **交付版本：** v0.0.15
- **关键词：** pnpm、包管理、工具链

### 当时结论

固定 pnpm 为唯一 Node.js 包管理器，并增加 preinstall 与治理门禁。

### 原始来源

- `docs/prompts/archive/v0.0.15/0017-pnpm一致性.md`
- `docs/changelog/v0.0.15.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#17.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0018-Setup缺少Cargo修复.md`

## #18 Setup 缺少 Cargo 容错修复

- **主编号：** #18
- **名称：** Setup 缺少 Cargo 容错修复
- **记录版本：** #18.0
- **状态：** delivered
- **交付版本：** v0.0.16
- **关键词：** Setup、Cargo、Rust、依赖

### 当时结论

修复 pnpm 成功但 Cargo 缺失时菜单 1 被整体判定失败的问题。

### 原始来源

- `docs/prompts/archive/v0.0.16/0018-Setup缺少Cargo修复.md`
- `docs/changelog/v0.0.16.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#18.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。

> 迁移来源：`docs/logs/development/archive/0019-01-一键准备真实检测.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.1
- **状态：** superseded
- **关键词：** Setup、Node、pnpm、Rust、Cargo、依赖、检测
- **已由：** #19.2 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

`LFAA-Setup.bat → 1 一键准备` 必须真实区分：

1. Node.js 是否存在、版本是否符合项目要求；
2. pnpm 是否存在、版本是否符合项目要求；
3. workspace 有多少项目；
4. 当前 package.json 实际声明了多少 Node 依赖；
5. Cargo / rustc 是否存在；
6. `winget` 是否存在；
7. `winget` 不存在时，是否可使用 Rust 官方 rustup-init + SHA-256 校验进行回退安装。

`node_modules` 文件夹存在或大小不能作为“依赖是否完整”的判断依据。

真正的 Node 依赖完整性仍由：

```text
pnpm install --frozen-lockfile
```

校验。

### 最新变更

#### #19.1 真实检测与 Rust 官方回退安装

修复：

- 只显示“Node/pnpm 可用”但不显示版本和路径；
- 用户无法知道为什么 `node_modules` 很小；
- Cargo 缺失且 winget 缺失时，一键准备只能停在“待补齐”。

新增：

- Node 版本真实检测；
- pnpm 版本真实检测；
- workspace / Node 依赖声明统计；
- 无外部 Node 依赖时明确提示 `node_modules` 很小是正常；
- winget 不可用时，下载 Rust 官方 `rustup-init.exe`；
- 同时下载官方 `.sha256` 并在执行前校验；
- Rustup 安装后显式安装并设置 stable toolchain；
- 最终再次检查 cargo / rustc。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/logs/development/INDEX.md`

### 验证结果

- 静态检查：Node / pnpm / Cargo / rustc / winget 路径均有真实检测；
- Rust 官方下载 URL 固定到 `static.rust-lang.org`；
- 下载后必须通过官方 SHA-256；
- 无 winget 时不再直接放弃 Rust 安装；
- 当前仓库 Node 依赖声明数为 0 时有明确说明；
- Governance / Import / Development Log / Docs Structure Check 通过。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-02-本地依赖与lockfile.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.2
- **状态：** superseded
- **关键词：** Setup、Node、pnpm、Rust、Cargo、依赖、lockfile
- **已由：** #19.3 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

本地 `LFAA-Setup.bat → 1` 使用标准：

```text
pnpm install
```

原因：开发工作区允许新增依赖后同步 `pnpm-lock.yaml`。

严格的可复现质量/CI 环境仍必须使用：

```text
pnpm install --frozen-lockfile
```

### 最新变更

#### #19.2 本地开发允许同步 lockfile

- UI 正式进入 React/Vite 开发后，package 声明会变化；
- Setup 作为本地开发准备工具，不再强制 frozen lock；
- 已有依赖继续复用；
- 新依赖自动下载；
- `pnpm-lock.yaml` 会按 package 声明同步；
- 依赖统计只读取 `pnpm-workspace.yaml` 声明的 workspace package，不递归扫描 `node_modules`；
- CI/正式质量门禁仍要求 frozen lock。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `docs/standards/QUALITY_GATES.md`
- #21 Web UI 依赖首次安装

### 验证结果

- Setup 命令已切换到 `pnpm install`；
- workspace 统计已排除 `node_modules` 递归误扫；
- root 质量命令没有伪装为已通过；
- 真实 Vite build 等待 Node 24 + pnpm 依赖环境验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-03-统一开发入口.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.3
- **状态：** superseded
- **关键词：** Setup、Node、pnpm、Rust、Cargo、Web、Desktop、构建
- **已由：** #19.4 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

`LFAA-Setup.bat` 是 Windows 本地开发的统一入口。

根目录不再单独保留：

```text
LFAA-Web.bat
```

统一菜单：

```text
1  一键依赖
2  启动 Web
3  启动桌面
4  构建 Web
5  构建桌面
6  构建发布
7  环境检查
8  项目资源
9  治理检查
10 完整检查
```

Web / Desktop 是否可执行必须检查真实 workspace script；未实现时明确失败，不得假成功。

### 最新变更

#### #19.3 统一开发入口

- 删除独立 `LFAA-Web.bat`；
- 删除 `scripts/windows/lfaa-web.ps1`；
- Web Vite 启动并入 Setup 菜单 2；
- Desktop 启动预留为菜单 3，并真实检测 `apps/desktop` 的 `dev` script；
- Web / Desktop 构建分别进入菜单 4 / 5；
- 菜单 6 统一构建两端并生成本地发布产物；
- 正式发布动作不自动上传 GitHub 或其他远程服务；
- Desktop 尚未配置 Electron build/release 时明确阻止；
- 质量检查收敛到菜单 9 / 10。

### 影响范围

- `LFAA-Setup.bat`
- `scripts/windows/lfaa-setup.ps1`
- 删除 `LFAA-Web.bat`
- 删除 `scripts/windows/lfaa-web.ps1`
- `DEVELOPMENT.md`
- `README.md`
- Web UI 测试文档
- #21 Web 工作台启动方式

### 验证结果

- 独立 Web 启动器已删除；
- Governance 禁止重复 Web 启动器重新出现；
- Setup 菜单包含 Web / Desktop / Build / Release 统一入口；
- Web 启动走真实 `@lfaa/web dev`；
- Desktop 未配置脚本时明确失败；
- Governance / Import / Development Log / Docs Structure Check 通过；
- Windows PowerShell 实机运行仍需用户机器验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-04-Rust安装诊断优化.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.4
- **状态：** superseded
- **关键词：** Setup、Node、pnpm、Rust、Cargo、rustup、winget、CARGO_HOME
- **已由：** #19.5 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

Rust 工具链检测与安装必须先识别真实已有环境，再决定是否安装。

检测顺序：

```text
Cargo
→ rustup
→ CARGO_HOME/bin
→ PATH
→ 默认用户 .cargo/bin
```

如果需要安装：

```text
winget
→ 正确解释返回码
→ 刷新并重新检测现有 rustup/Cargo
→ 仍不可用时使用 Rust 官方 rustup-init
→ 官方 SHA-256 校验
→ 安装 stable toolchain
```

Rust 官方 `rustup-init / rustup` 自身输出的英文 `info:` 日志保留原文，不做二次翻译；LFAA 在前后提供中文状态说明。

### 最新变更

#### #19.4 Rust 安装诊断优化

完成：

1. `CARGO_HOME` 优先加入 Cargo/rustup 路径检测；
2. 自定义 Cargo 目录不再只依赖 `%USERPROFILE%\.cargo\bin`；
3. WinGet `-1978335189 / 0x8A15002B` 识别为“没有可用更新”，不再直接标为普通失败；
4. WinGet 返回后先重新检测 rustup/Cargo，再决定是否下载官方安装器；
5. 已有 rustup 但没有 stable 时直接补 stable；
6. Rust 官方安装器输出保留原始英文，并在开始前明确中文说明；
7. 官方下载仍必须通过 `static.rust-lang.org` + 官方 SHA-256。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/logs/development/INDEX.md`

### 验证结果

- CARGO_HOME 路径检测已加入；
- observed WinGet 返回码已加入语义映射；
- Rust 官方英文日志保留；
- SHA-256 校验未移除；
- Governance / Import / Development Log / Docs Structure Check 通过；
- Windows 实机安装行为以用户机器最终验证为准。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | superseded | `archive/0019-03-统一开发入口.md` |
| #19.4 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-05-Rust工具链分层.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.5
- **状态：** superseded
- **关键词：** Setup、Rust、Cargo、rustup、rust-toolchain、共享工具链、项目依赖
- **已由：** #19.6 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

Rust 采用“共享工具链 + 项目锁定版本 + 项目本地构建产物”的分层方案。

```text
rustup / rustc / cargo / 标准库工具链
→ 用户/机器共享
→ CARGO_HOME / RUSTUP_HOME 可自定义到非系统盘

rust-toolchain.toml
→ 跟项目走
→ 锁定 LFAA 要求的 Rust 版本

Cargo.toml / Cargo.lock
→ 跟项目走
→ 声明并锁定 crate 依赖

target/（或项目 build cache）
→ 跟项目走
→ 编译产物和增量缓存
```

不默认把完整 Rust 编译器复制到每个项目目录，否则多个项目会重复占用数 GB 空间。

### 最新变更

#### #19.5 Rust 工具链分层

1. 新增根 `rust-toolchain.toml`，项目锁定 Rust `1.98.1`；
2. `rustup` 只作为共享工具链管理器，不再设置全局 `rustup default stable`；
3. Setup 使用项目锁定版本安装 `rustfmt` / `clippy`；
4. 尊重用户已有 `CARGO_HOME` / `RUSTUP_HOME`，允许放到 D 盘等自定义共享目录；
5. Setup 环境检查显示项目 Rust 版本及两个 Home 路径；
6. Rust crate 声明/锁文件和构建产物继续属于项目；
7. 不把完整 Rust toolchain 纳入 `.lfaa` 项目资源。

### 影响范围

- `rust-toolchain.toml`
- `scripts/windows/lfaa-setup.ps1`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/logs/development/INDEX.md`

### 验证结果

- 项目 Rust 版本存在明确事实源；
- Setup 不再修改用户全局 default toolchain；
- 自定义 CARGO_HOME/RUSTUP_HOME 保持兼容；
- 官方 rustup + SHA-256 安全链保持；
- Windows 实机最终行为待用户验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | superseded | `archive/0019-03-统一开发入口.md` |
| #19.4 | superseded | `archive/0019-04-Rust安装诊断优化.md` |
| #19.5 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-06-依赖模型简化.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.6
- **状态：** superseded
- **关键词：** Setup、Node、pnpm、Rust、Cargo、依赖、工具链、易用
- **已由：** #19.7 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

LFAA 的依赖模型固定为：

```text
电脑基础工具
→ Node.js / pnpm / Git / Rust / Cargo
→ 一台电脑只准备一次，多个项目复用

LFAA 项目
→ node_modules/
→ Cargo.toml
→ Cargo.lock
→ rust-toolchain.toml
→ target/
→ .lfaa/
→ 跟项目走
```

普通用户不需要选择“用户级 / 项目级 / 共享目录”等安装模式。

`LFAA-Setup.bat → 1` 只做一件事：

```text
检查环境
→ 已有工具直接复用
→ 缺失工具自动补齐
→ 安装项目依赖
→ 初始化 .lfaa
→ 明确告诉用户是否可以开发
```

Rust 缺失时只使用 Rust 官方 `rustup-init` 安装路径，不再先尝试 WinGet，减少分支和不一致行为。

### 最新变更

#### #19.6 工具链与项目依赖简化

1. Node / pnpm / Git / Rust / Cargo 统一视为电脑基础工具；
2. `node_modules`、Rust 依赖、`target`、`.lfaa` 归项目；
3. 保留 `rust-toolchain.toml`，用于项目内部锁定 Rust 版本；
4. 不为每个项目复制一套完整 Rust 编译器；
5. 不让普通用户选择 Rust 安装模式或安装层级；
6. Rust 缺失时直接使用官方 `rustup-init`；
7. 官方安装器输出保持原文，LFAA 自身状态提示保持中文；
8. 已有 Rust/Cargo 无论装在哪个盘，都直接复用，不迁移、不重复安装。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/logs/development/INDEX.md`
- `README.md`

### 验证结果

- WinGet Rust 安装分支已移除；
- Rust 官方 SHA-256 校验保留；
- 已有 Cargo/rustup 继续复用；
- `rust-toolchain.toml` 保留；
- Setup 用户提示已简化；
- Governance / Import / Development Log / Docs Structure Check 通过；
- Windows PowerShell 实机行为仍以用户机器验证为准。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | superseded | `archive/0019-03-统一开发入口.md` |
| #19.4 | superseded | `archive/0019-04-Rust安装诊断优化.md` |
| #19.5 | superseded | `archive/0019-05-Rust工具链分层.md` |
| #19.6 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-07-Setup主菜单循环.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.7
- **状态：** superseded
- **关键词：** Setup、菜单、循环、返回、退出、依赖、开发工具
- **已由：** #19.8 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

`LFAA-Setup.bat` 是一个持续运行的开发菜单。

普通操作结束后：

```text
返回主菜单
```

只有：

```text
0 → 退出
```

才结束 Setup 终端。

包括：

- 一键依赖完成或取消；
- Web 停止；
- Desktop 停止；
- 构建完成；
- 环境检查完成；
- 项目资源完成或取消；
- 治理检查完成；
- 普通错误。

都不能自动关闭终端。

项目根本身无效属于启动级错误，可以直接退出，因为无法进入有效菜单。

### 最新变更

#### #19.7 Setup 主菜单循环

1. Setup 改为 `while` 主菜单循环；
2. 取消普通操作中的 `exit`；
3. 取消普通操作结束后的“关闭终端”提示；
4. 普通操作统一“按任意键返回主菜单”；
5. 只有菜单 `0` 正常退出；
6. 错误显示后返回主菜单，不再关闭整个终端；
7. Web 按 `Ctrl+C` 停止后返回主菜单。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/logs/development/INDEX.md`

### 验证结果

- 普通菜单分支不再包含 `exit`；
- `0` 保留显式退出；
- Web 停止后回到菜单；
- 错误处理不再调用终端关闭流程；
- Governance / Import / Development Log / Docs Structure Check 通过；
- Windows PowerShell 实机菜单循环仍需用户最终验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | superseded | `archive/0019-03-统一开发入口.md` |
| #19.4 | superseded | `archive/0019-04-Rust安装诊断优化.md` |
| #19.5 | superseded | `archive/0019-05-Rust工具链分层.md` |
| #19.6 | superseded | `archive/0019-06-依赖模型简化.md` |
| #19.7 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-08-node-pty跨机器安装.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.8
- **状态：** superseded
- **关键词：** Setup、pnpm、allowBuilds、node-pty、原生依赖、跨机器安装
- **已由：** #19.9 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

菜单 `1` 必须在全新电脑上无需人工执行 `pnpm approve-builds` 就能安装 LFAA 已经审核过的原生依赖。

LFAA 继续保持 pnpm 的严格构建脚本策略：

```text
strictDepBuilds: true
```

只有经过项目审核并且锁定版本的依赖可以执行安装 / 构建脚本。

当前真实终端依赖：

```text
node-pty@1.1.0
```

必须在 `pnpm-workspace.yaml` 明确：

```yaml
allowBuilds:
  "node-pty@1.1.0": true
```

不允许使用“允许所有依赖执行构建脚本”的宽泛配置。

### 最新变更

#### #19.8 node-pty 跨机器安装许可

实机在另一台 Windows 电脑执行菜单 `1` 时出现：

```text
ERR_PNPM_IGNORED_BUILDS
Ignored build scripts: node-pty@1.1.0
```

原因：`node-pty` 是原生模块，需要执行安装 / 构建脚本；pnpm 11 默认 `strictDepBuilds=true`，未审核的构建脚本会让安装返回非零退出码。

修复：

1. 在项目 `pnpm-workspace.yaml` 精确批准 `node-pty@1.1.0`；
2. 保持 `strictDepBuilds: true`；
3. 禁止 `dangerouslyAllowAllBuilds`；
4. Setup 安装后增加 node-pty 运行时 Smoke Check；
5. Smoke Check 失败时给出中文错误，避免只有底层原生模块错误。

### 影响范围

- `pnpm-workspace.yaml`
- `scripts/windows/lfaa-setup.ps1`
- `scripts/governance-check.mjs`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`

### 验证结果

- node-pty 精确版本构建许可已写入项目配置；
- 严格依赖构建策略继续开启；
- 未开启全部依赖构建权限；
- Setup 增加 node-pty 可加载性检查；
- Governance 会校验该策略存在；
- Windows 全新机器真实安装仍需用户机器最终验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | superseded | `archive/0019-03-统一开发入口.md` |
| #19.4 | superseded | `archive/0019-04-Rust安装诊断优化.md` |
| #19.5 | superseded | `archive/0019-05-Rust工具链分层.md` |
| #19.6 | superseded | `archive/0019-06-依赖模型简化.md` |
| #19.7 | superseded | `archive/0019-07-Setup主菜单循环.md` |
| #19.8 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-09-node-pty校验引号兼容.md`

## #19 一键准备与依赖检测

- **主编号：** #19
- **名称：** 一键准备与依赖检测
- **最新变更：** #19.9
- **状态：** superseded
- **关键词：** Setup、node-pty、PowerShell、Smoke Check、Windows、引号兼容
- **已由：** #19.10 替代
- **当前查看：** `docs/logs/development/active/0019-一键准备与依赖检测.md`

### 当前结论

菜单 `1` 安装 Node 依赖后必须真实验证 `node-pty` 能加载，但 Windows PowerShell 5 不应使用 `node -e` 内嵌复杂 JavaScript 字符串做校验。

统一规则：

```text
pnpm install
→ scripts/check-node-pty.mjs
→ Node 从 apps/web 的依赖上下文加载 node-pty
→ 检查 pty.spawn
```

这样避免 PowerShell 在调用原生命令时重新解释 / 丢失 JavaScript 内部引号。

### 最新变更

#### #19.9 node-pty Smoke Check 引号兼容修复

实机在 Windows PowerShell 5 执行菜单 `1` 时出现：

```text
Eval:1
const pty = require(node-pty); ...
Expected '(', got 'o'
SyntaxError
```

实际原因不是 `node-pty` 原生模块一定损坏，而是 Setup 使用：

```text
node -e '<inline JavaScript>'
```

在该 PowerShell / Node 参数传递组合下，JavaScript 内的引号被剥离，导致 `require("node-pty")` 变成 `require(node-pty)`。

修复：

1. 删除 Setup 中内嵌 `node -e` Smoke Check；
2. 新增 `scripts/check-node-pty.mjs`；
3. 使用 `createRequire(apps/web/package.json)` 从 Web workspace 的依赖上下文加载 `node-pty`；
4. Setup 只执行 `node scripts/check-node-pty.mjs`；
5. 保留 `allowBuilds` 与原生模块真实加载验证。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `scripts/check-node-pty.mjs`
- `scripts/governance-check.mjs`
- `DEVELOPMENT.md`
- `docs/standards/QUALITY_GATES.md`

### 验证结果

- Setup 不再包含 `node -e` 的 node-pty 内嵌 JavaScript；
- Smoke Check 独立脚本通过 Node 语法检查；
- `node-pty@1.1.0` 精确构建许可继续保留；
- Governance / Import / Development Log / Docs Structure Check 通过；
- Windows PowerShell 5 实机加载结果仍需用户机器最终验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #19.0 | delivered | `archive/0019-一键准备与资源根.md` |
| #19.1 | superseded | `archive/0019-01-一键准备真实检测.md` |
| #19.2 | superseded | `archive/0019-02-本地依赖与lockfile.md` |
| #19.3 | superseded | `archive/0019-03-统一开发入口.md` |
| #19.4 | superseded | `archive/0019-04-Rust安装诊断优化.md` |
| #19.5 | superseded | `archive/0019-05-Rust工具链分层.md` |
| #19.6 | superseded | `archive/0019-06-依赖模型简化.md` |
| #19.7 | superseded | `archive/0019-07-Setup主菜单循环.md` |
| #19.8 | superseded | `archive/0019-08-node-pty跨机器安装.md` |
| #19.9 | active | `active/0019-一键准备与依赖检测.md` |

> 迁移来源：`docs/logs/development/archive/0019-一键准备与资源根.md`

## #19 一键准备与项目资源根收敛

- **主编号：** #19
- **名称：** 一键准备与项目资源根收敛
- **记录版本：** #19.0
- **状态：** delivered
- **交付版本：** v0.0.17
- **关键词：** Setup、资源、lfaa、热插拔

### 当时结论

Setup 升级为一键准备，并固定 .lfaa 为项目级 Skill/Plugin/MCP 等资源唯一事实源。

### 原始来源

- `docs/prompts/archive/v0.0.17/0019-一键准备与资源根.md`
- `docs/changelog/v0.0.17.md`
- `docs/standards/PROJECT_RESOURCES.md`

### 当前说明

该主任务已经交付。

本文件是为了把旧编号纳入新的 Development Log 索引，**不会替代、删除或重写上面的原始历史文件**。

如需了解完整实现过程，应继续查看“原始来源”。

### 后续关系

该任务已经结束；后续如果同一问题重新产生设计变化，应：

1. 先查本主编号；
2. 新建对应 `#19.x` 变更；
3. 在当前 active 日志中写明最新结论；
4. 保留本历史文件用于对比。


### 后续变更

一键准备的环境检测与 Rust 安装逻辑已经继续调整：

```text
#19.1
```

当前查看：

```text
docs/logs/development/active/0019-一键准备与依赖检测.md
```

> 迁移来源：`docs/logs/development/archive/0020-00-开发日志初始分层.md`

## #20 开发日志分层规范

- **主编号：** #20
- **名称：** 开发日志分层规范
- **记录版本：** #20.0
- **状态：** superseded
- **关键词：** 日志、索引、命名、中文、归档
- **已由：** #20.1 替代
- **当前查看：** `docs/logs/development/active/0020-开发日志与文档规范.md`

### 当时结论

#20.0 建立了：

```text
docs/logs/development/
├── INDEX.md
├── active/
└── archive/
```

并规定当前日志与历史日志分离。

### 为什么被替代

#20.0 只给 #1 - #19 建立了一个 legacy 指针，没有把旧主编号逐条纳入新的 Development Log 索引。

这会导致阅读者在 `development/` 中只看到 #20，无法直接对比旧编号。

### 新方案

从 #20.1 开始：

- #1 - #19 必须逐条进入新日志索引；
- #2 因仍在进行，进入 `active/`；
- 已交付任务进入 `archive/`；
- 原 Prompt / Progress / Changelog / Release 全部保留；
- Development Log Check 检查主编号是否连续缺失。

> 迁移来源：`docs/logs/development/archive/0020-01-历史编号迁移.md`

## #20 开发日志分层规范

- **主编号：** #20
- **名称：** 开发日志分层规范
- **最新变更：** #20.1
- **状态：** superseded
- **关键词：** 日志、索引、命名、中文、归档、历史
- **已由：** #20.2 替代
- **当前查看：** `docs/logs/development/active/0020-开发日志与文档规范.md`

### 当前结论

Development Log 不允许只保留最新主编号。

当前规则：

1. 所有真实存在的主编号都必须在 `INDEX.md` 中可直接找到；
2. 当前仍生效的任务放 `active/`；
3. 已交付或历史任务放 `archive/`；
4. 原 Prompt / Progress / Changelog / Release 不删除；
5. 同一主编号的新修正继续使用 `#NN.x`；
6. 被替代的旧子版本必须保留并指向当前 active；
7. 主编号从 #1 开始，不能出现无记录缺号。

### 最新变更

#### #20.1 历史编号迁移

修复 #20.0 的不足：

- #1 - #19 已逐条纳入 Development Log；
- #2 因仍是当前主业务模块，放入 `active/`；
- #1、#3 - #19 放入 `archive/`；
- #20.0 自身保存为历史快照；
- `INDEX.md` 现在可以直接搜索每一个主编号；
- Dev Log Check 增加主编号连续性检查。

### 影响范围

- `docs/logs/development/INDEX.md`
- `docs/logs/development/active/`
- `docs/logs/development/archive/`
- `docs/standards/DEV_LOGS.md`
- `scripts/dev-log-check.mjs`
- `DEVELOPMENT.md`
- `AGENTS.md`

### 验证结果

- #1 - #20 均能在 Development Log 索引中找到；
- #2、#20 为 active；
- #1、#3 - #19 为 delivered history；
- #20.0 已保留，可与 #20.1 直接对比；
- 原历史来源文件仍全部存在；
- Governance / Import / Dev Log Check 通过。

### 历史索引

| 版本 | 状态 | 路径 |
|---|---|---|
| #20.0 | superseded | `archive/0020-dev-logs/0020.0-dev-logs.md` |
| #20.1 | active | `active/0020-dev-logs.md` |

> 迁移来源：`docs/logs/development/archive/0020-02-中文命名与文档整理.md`

## #20.2 中文命名与文档整理

- **主编号：** #20
- **名称：** 开发日志与文档规范
- **记录版本：** #20.2
- **状态：** superseded
- **关键词：** 日志、文档、中文、命名、目录、索引
- **已由：** #20.3 代码可读性与项目地图
- **当前查看：** `docs/logs/development/active/0020-开发日志与文档规范.md`

### 原结论

LFAA 文档采用“稳定目录 + 中文可读文件名 + 明确索引”，开发日志、Prompt、Runtime Log 分层管理，并由 Docs / Dev Log Check 做目录与命名检查。

### 已完成内容

1. Development Log 改为中文文件名；
2. Prompt 编号文件改为中文文件名；
3. Development Log 历史文件取消小数点文件名；
4. 新增 `docs/README.md` 文档总入口；
5. 为主要文档分类增加 README 索引；
6. 机器运行日志统一移动到 `docs/logs/runtime/`；
7. `docs/logs/development/` 只保存开发决策与需求变更日志；
8. 新增 Docs Structure Check。

### 被替代原因

#20.2 解决了“文档放哪里、怎么命名”的问题，但没有解决“源码本身是否可读”和“第一次打开仓库的人能否看懂目录 / 文件 / CSS 盒子”的问题。

#20.3 在不推翻 #20.2 的基础上补充结构化代码注释、CSS 分区、项目代码地图和自动门禁。

> 迁移来源：`docs/logs/development/archive/0020-03-代码可读性与项目地图.md`

## #20.3 代码可读性与项目地图

- **主编号：** #20
- **名称：** 开发日志与文档规范
- **记录版本：** #20.3
- **状态：** superseded
- **关键词：** 日志、文档、中文、命名、目录、索引、注释、可读性、项目地图
- **已由：** #20.4 开发规范执行闭环
- **当前查看：** `docs/logs/development/active/0020-开发日志与文档规范.md`

### 当前结论

LFAA 文档和源码必须同时做到**可追溯**和**人类可读**。

当前规则分成两层：

```text
文档层
→ 稳定 docs 目录
→ 中文可读编号文件
→ Active / Archive 分离
→ INDEX 可追溯

源码层
→ 关键实现文件结构化中文文件头
→ CSS 盒子 / 区域分区注释
→ 一级目录 README
→ 项目结构与代码地图
→ comment-check 自动门禁
```

第一次打开项目时的人类导航入口：

```text
docs/项目结构与代码地图.md
```

详细规范：

```text
docs/standards/COMMENTS.md
docs/standards/DEV_LOGS.md
docs/standards/NAMING.md
```

### 最新变更

#### #20.3 代码可读性与项目地图

发现 #20.2 虽然把 docs 分类、中文命名、日志索引做了治理，但关键 UI 实现文件没有严格执行 `COMMENTS.md` 的结构化文件头要求，而且缺少一份从“用户第一次打开仓库”角度解释项目目录和文件职责的总地图。

本次补齐：

1. 新增 `docs/项目结构与代码地图.md`；
2. 新增 `apps/README.md`、`packages/README.md`、`crates/README.md`、`scripts/README.md`；
3. 新增 `packages/app-shell/src/README.md`、`packages/ui/src/workbench/README.md`，重写 `apps/web/src/README.md`；
4. `AgentWorkbench.tsx`、`ResizableWorkbench.tsx`、`LocalTerminal.tsx`、`vite.config.ts` 等关键实现补完整中文文件头和算法边界注释；
5. `agent-workbench.css`、`workbench.css`、`local-terminal.css` 补盒子结构和分区注释；
6. Setup / Sync / GitHub / Update PowerShell 和根 BAT 补人类可读职责说明；
7. 新增 `scripts/comment-check.mjs`；
8. `governance:check` 加入代码可读性门禁；
9. 修正 #21 UI Active 文档落后于 v0.0.39 实现的问题；
10. 把 v0.0.40 的同步/ZIP 修复归回 #4.2，而不是继续错误挂在 UI #21 下。

### 影响范围

- `docs/项目结构与代码地图.md`
- `docs/standards/COMMENTS.md`
- `docs/standards/QUALITY_GATES.md`
- `docs/standards/UI_LAYOUT.md`
- `docs/logs/development/**`
- `apps/README.md`
- `packages/README.md`
- `crates/README.md`
- `scripts/README.md`
- Web UI 关键 TS / TSX / CSS 文件
- Windows Setup / Sync / GitHub / Update 入口和实现
- `scripts/comment-check.mjs`
- `scripts/governance-check.mjs`
- `package.json`

### 验证结果

- 关键实现文件已具备结构化中文文件头；
- 三个当前关键 CSS 文件具备盒子结构和分区注释；
- 项目一级目录可直接通过 README 或项目地图识别职责；
- 当前 Web UI 文档与主区悬浮按钮 / 左栏 Hover 预览实现重新一致；
- `comment-check` 进入治理链路，后续漏注释会直接失败；
- #20.2 历史已归档，没有覆盖丢失。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #20.0 | superseded | `archive/0020-00-开发日志初始分层.md` |
| #20.1 | superseded | `archive/0020-01-历史编号迁移.md` |
| #20.2 | superseded | `archive/0020-02-中文命名与文档整理.md` |
| #20.3 | active | `active/0020-开发日志与文档规范.md` |

### 原始来源

- `docs/changelog/v0.0.41.md`
- `docs/releases/v0.0.41/RELEASE.md`
- `docs/standards/COMMENTS.md`

> 迁移来源：`docs/logs/development/archive/0021-00-Web工作台初始实现.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.0
- **状态：** superseded
- **关键词：** Web、Vite、React、三栏、水墨、热插拔、工作区
- **已由：** #21.1 替代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

先完成 Web 工作台壳，再进入 `config-schema`。

工作台固定为：

```text
左侧菜单 | 中间工作区 | 右侧资源舱
```

左右栏支持自由拉伸、吸附收起和本地宽度记忆。

### 最新变更

#### #21.0 初始实现

- React + TypeScript + Vite Web 壳；
- 水墨主题；
- 三栏 Resizable Layout；
- 左右栏吸附收起；
- 窄窗口浮层；
- Vite `.lfaa` 只读资源桥接；
- Web 端资源变化实时刷新。

### 影响范围

- `packages/ui`
- `packages/app-shell`
- `apps/web`
- `docs/standards/UI_LAYOUT.md`
- `PROJECT_PLAN.md`
- Config System 开发顺序

### 验证结果

当前环境无法联网取得 pnpm/Vite 依赖，因此本版本只完成：

- 源码实现；
- 文档 / Governance 静态检查；
- 独立静态视觉预览；
- Vite 实机 build / typecheck 等待在具备依赖的 Node 24 环境验证。

禁止把未执行的 Vite build 标记为通过。

### 历史索引

当前为 #21.0，尚无旧版本。

> 迁移来源：`docs/logs/development/archive/0021-01-Web启动入口调整.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.1
- **状态：** superseded
- **关键词：** Web、Vite、React、三栏、水墨、热插拔、工作区
- **已由：** #21.2 替代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

Web 工作台仍通过 Vite 做本地热插拔验证，但启动入口统一为：

```text
LFAA-Setup.bat
→ 2 启动 Web
```

不再维护独立 `LFAA-Web.bat`。

UI 继续保持：

```text
左侧菜单 | 中间工作区 | 右侧资源舱
```

左右栏支持自由拉伸、吸附收起和本地宽度记忆。

### 最新变更

#### #21.1 Web 启动入口并入 Setup

- Vite Web 开发服务器由 Setup 菜单 2 启动；
- `.lfaa` 热插拔监听逻辑不变；
- 删除重复 Web BAT/PowerShell 入口；
- 未来 Desktop 同样使用 Setup 菜单 3；
- Web 与 Desktop 构建入口统一集中到 Setup。

### 影响范围

- `LFAA-Setup.bat`
- `scripts/windows/lfaa-setup.ps1`
- `apps/web`
- `docs/testing/WEB_UI_TEST.md`
- `docs/prompts/active/0021-Web工作台UI.md`

### 验证结果

- Web Vite package scripts 保留；
- Setup 菜单 2 调用 `@lfaa/web dev`；
- `.lfaa` 开发桥接未移除；
- 重复启动器已删除；
- Vite 实机 build / 浏览器交互仍等待 Windows + Node 24 + pnpm 环境验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-02-黑白工作台重构.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.2
- **状态：** superseded
- **关键词：** Web、Vite、React、三栏、Codex、ChatGPT、黑白主题、Resize、Snap
- **已由：** #21.3 替代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

Web 工作台视觉改为接近 Codex / ChatGPT 的简洁生产力工具风格，不再使用水墨、宣纸、松绿、朱砂等主题元素。

当前结构保持：

```text
左侧导航 / 会话
│
中间工作区 / 对话
│
右侧工具 / .lfaa 资源
```

主题只使用中性色为主：

```text
浅色：白 / 浅灰 / 深灰文字
深色：黑灰 / 深灰 / 浅色文字
```

状态提示允许少量语义色，例如连接成功、刷新、错误。

左右栏必须：

- 支持自由拉伸；
- 有明确最大宽度；
- 桌面模式始终为中央区域保留最小可用宽度；
- 拖动时不立即跳变收起；
- 松开指针后进入吸附区才平滑收起；
- 展开 / 收起使用短动画；
- 继续记住本地宽度和收起状态。

### 最新变更

#### #21.2 黑白工作台重构

完成：

1. 移除水墨视觉与宣纸背景；
2. `InkWorkbench` 更名为 `AgentWorkbench`；
3. 采用 Codex / ChatGPT 类黑白灰工作台层级；
4. 新增浅色 / 深色主题切换并保存本地偏好；
5. 左栏默认 288px，最大 640px；
6. 右栏默认 360px，最大 760px；
7. 桌面拖拽时动态限制最大宽度，保护中央工作区；
8. 吸附改为“拖动预览 + 松开吸附”，避免跨阈值瞬间跳变；
9. 分隔条 Pointer Move 继续通过 `requestAnimationFrame` 合并；
10. Vite `.lfaa` 热插拔桥接保持不变。

### 影响范围

- `packages/ui/src/workbench/*`
- `packages/app-shell/src/*`
- `apps/web/src/App.tsx`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`
- `docs/prompts/active/0021-Web工作台UI.md`

### 验证结果

- Governance / Import / Development Log / Docs Structure Check：PASS；
- 变更 TS/TSX 语法转译检查：PASS；
- Web TypeScript / Vite build：当前执行环境无法取得 pnpm 11.17.0，未伪造通过；
- Windows 实机 Resize / Snap / Light / Dark：待用户本机验证；
- `.lfaa` 热插拔桥接：不改协议，仅保留现有行为。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-03-最小宽度自动吸附.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.3
- **状态：** superseded
- **关键词：** Web、Vite、React、三栏、Codex、ChatGPT、Resize、自动吸附、最小宽度
- **已由：** #21.4 替代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

工作台继续采用 Codex / ChatGPT 类黑白灰生产力工具风格。

侧栏吸附语义改为：

```text
正常拖动
→ 到达该侧栏 min
→ 立即自动吸附到 0 / collapsed 预览
→ 不等待松手
```

不再使用独立的 `96px` 收起阈值。

反向拖回时使用小迟滞：

```text
min + 24px
```

才重新展开，避免指针在最小宽度附近抖动造成反复开合。

### 最新变更

#### #21.3 最小宽度自动吸附

修复 #21.2 的吸附行为：

1. 删除 `snapThreshold=96` 语义；
2. 左栏到达 `leftLimits.min` 时立即吸附收起；
3. 右栏到达 `rightLimits.min` 时立即吸附收起；
4. 吸附发生在 Pointer Move，不再等待 Pointer Up；
5. Pointer Move 仍通过 `requestAnimationFrame` 合并；
6. 自动吸附使用约 150ms 短动画；
7. 反向展开增加 24px hysteresis，避免 min 附近反复闪动；
8. Pointer Up 只提交最终状态，不再负责判断是否应该收起；
9. 最大宽度和中央最小宽度保护保持不变。

### 影响范围

- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `packages/ui/src/workbench/workbench.css`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`
- `docs/prompts/active/0021-Web工作台UI.md`

### 验证结果

- Governance / Import / Development Log / Docs Structure Check：PASS；
- 变更 TS/TSX 语法转译检查：PASS；
- 源码确认：旧逻辑确实在 `finishDrag` / Pointer Up 才判断 `< 96px`；
- 新逻辑已改为 Pointer Move 到 min 即自动吸附；
- Windows 实机拖拽手感仍由用户机器做最终体验验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | superseded | `archive/0021-02-黑白工作台重构.md` |
| #21.3 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-04-Web端口复用.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.4
- **状态：** superseded
- **关键词：** Web、Vite、端口、复用、冲突、热插拔、Resize、Snap
- **已由：** #21.5 替代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

工作台保持黑白灰 Codex / ChatGPT 类三栏设计和 #21.3 最小宽度自动吸附。

Web 开发启动新增端口复用策略：

```text
先扫描 5173-5199
→ 如果发现已经运行的 LFAA Vite
→ 直接复用，不启动第二个进程

没有 LFAA Vite
→ 5173 空闲则使用 5173
→ 5173 被其他程序占用则寻找下一空闲端口
→ 不自动结束未知进程
```

### 最新变更

#### #21.4 Web 端口复用

1. 修复 `Port 5173 is already in use` 直接失败；
2. 通过 `/__lfaa/dev/resources` 识别是否为已运行 LFAA Vite；
3. 已运行时直接复用并打开地址；
4. 非 LFAA 程序占用 5173 时自动选择 5174-5199 空闲端口；
5. Vite 端口由 `LFAA_WEB_PORT` 注入；
6. `strictPort` 保留，防止实际端口和脚本提示不一致；
7. #21.3 Resize/Snap 行为不回退。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `apps/web/vite.config.ts`
- `apps/web/package.json`
- `docs/testing/WEB_UI_TEST.md`
- `docs/prompts/active/0021-Web工作台UI.md`

### 验证结果

- 已运行 LFAA Web 可被识别并复用；
- 未知端口占用不会被强制结束；
- 可自动选择 5173-5199；
- Windows 实机最终端口行为待用户验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | superseded | `archive/0021-02-黑白工作台重构.md` |
| #21.3 | superseded | `archive/0021-03-最小宽度自动吸附.md` |
| #21.4 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-05-Web启动延迟修复.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.5
- **状态：** superseded
- **关键词：** Web、Vite、启动、端口、性能、复用、热插拔
- **已由：** #21.6 替代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

Web 开发启动必须快速，不得为了找端口逐个等待超时。

当前策略：

```text
读取系统当前 TCP Listener
→ 只对真正已占用的 5173-5199 端口识别是否为 LFAA
→ 已运行 LFAA：立即复用
→ 没有：直接选择第一个空闲端口
```

Vite 启动不再经过 pnpm script 调度链：

```text
直接运行项目本地 node_modules/.bin/vite.cmd
```

如果本地 Vite 不存在：

```text
明确提示先运行菜单 1
```

不在菜单 2 自动安装依赖。

### 最新变更

#### #21.5 Web 启动延迟修复

根因：

```text
旧 Find-LfaaWebDevPort
→ 5173 到 5199
→ 每个端口 Invoke-WebRequest TimeoutSec 1
```

在没有 LFAA Web 运行时，最坏会产生二十多秒无输出等待。

修复：

1. 使用系统 Active TCP Listener 一次读取占用端口；
2. 只探测真正占用的候选端口；
3. 单次 LFAA HTTP 识别超时压到约 350ms；
4. 未占用时立即得到 5173；
5. Web 启动直接调用本地 Vite binary，避免 pnpm 启动前的额外依赖检查；
6. 菜单 2 一开始立即显示“正在快速检查本地 Vite 端口”；
7. Vite `Ctrl+C` 停止后返回 Setup 主菜单。

### 影响范围

- `scripts/windows/lfaa-setup.ps1`
- `apps/web/vite.config.ts`（端口协议保持不变）
- `docs/testing/WEB_UI_TEST.md`
- `docs/standards/PERFORMANCE.md`

### 验证结果

- 不再对 27 个未占用端口逐个做 1 秒 HTTP 超时；
- 没有监听端口时端口解析只读取系统 Listener；
- 本地 Vite binary 缺失时有明确错误；
- #21.3 Resize/Snap 和 #21.4 端口复用均保留；
- Windows 实机启动耗时待用户机器最终验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | superseded | `archive/0021-02-黑白工作台重构.md` |
| #21.3 | superseded | `archive/0021-03-最小宽度自动吸附.md` |
| #21.4 | superseded | `archive/0021-04-Web端口复用.md` |
| #21.5 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-06-三栏交互与终端停靠.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.6
- **状态：** superseded
- **关键词：** Web、三栏、拖拽、侧栏、终端、动画、ChatGPT
- **已由：** #21.7 替代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

Web 工作台三栏交互继续向 ChatGPT / Codex 的日常使用方式靠拢：

```text
分隔条
→ 只负责拖拽拉伸与自动吸附

顶部角落控制
→ 负责点击展开 / 收起左右栏与终端

中间底部
→ 提供终端停靠区
```

不再把点击展开 / 收起按钮叠在分隔条中间，避免拖拽与点击命中冲突。

### 最新变更

#### #21.6 三栏交互与终端停靠

根因：

```text
旧版本
→ 分隔条中间内嵌点击按钮
→ 与拖拽热点重叠
→ 有时点不到，命中却变成拖拽
→ 收起 / 展开也缺少更顺滑的过渡
```

修复：

1. 分隔条移除独立点击按钮，只保留拖拽与键盘调宽；
2. 顶部左上增加左侧栏开合按钮；
3. 顶部右上增加终端与右侧栏开合按钮；
4. 顶部控制按钮采用 hover 淡入、鼠标移出淡出；
5. 左右栏收起 / 展开增加更明显的平滑过渡；
6. 中间区域底部增加终端停靠区；
7. 右侧工具列表中的“终端”与底部终端联动；
8. 保留最小宽度自动吸附与迟滞回弹规则。

### 影响范围

- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/WorkbenchIcon.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`

### 验证结果

- 分隔条中央点击按钮已移除；
- 左右侧栏仍可拖拽、自动吸附；
- 顶部角落可点击开合左右栏；
- 顶部角落 hover 有淡入 / 淡出；
- 中间底部终端停靠区已加入；
- 右侧“终端”按钮与底部终端联动；
- 视觉仍保持黑 / 白 / 灰工作台语言；
- 真实浏览器丝滑度待用户机器继续实机确认。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | superseded | `archive/0021-02-黑白工作台重构.md` |
| #21.3 | superseded | `archive/0021-03-最小宽度自动吸附.md` |
| #21.4 | superseded | `archive/0021-04-Web端口复用.md` |
| #21.5 | superseded | `archive/0021-05-Web启动延迟修复.md` |
| #21.6 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-09-Web常驻工作台Chrome.md`

## #21.9 Web 常驻工作台 Chrome

- **主编号：** #21
- **名称：** Web 工作台 UI
- **记录版本：** #21.9
- **状态：** superseded
- **关键词：** Web、Workbench Chrome、常驻按钮、侧栏、终端
- **已由：** #21.10 主区悬浮与左栏预览
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 原结论

v0.0.38 把左栏 / 终端 / 右栏按钮从侧栏内部 hover 控件改成 Web 全宽顶栏中的常驻 Shell Actions。

### 被替代原因

后续根据新的 ChatGPT / Codex 参考，Web 顶栏只保留标题和次要操作，Shell Actions 移到中间主区左右上角；左栏收起后增加 Hover 临时预览。

### 原始来源

- `docs/prompts/archive/v0.0.38/0021-09-Web常驻工作台Chrome.md`
- `docs/changelog/v0.0.38.md`
- `docs/releases/v0.0.38/RELEASE.md`

> 迁移来源：`docs/logs/development/archive/0021-10-主区悬浮与左栏预览.md`

## #21 Web 工作台 UI

- **状态：** superseded
- **已由：** #21.11 Header 联动与按钮归属修正
- **当前查看：** `../active/0021-Web工作台UI.md`

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.10
- **状态：** active
- **关键词：** Web、三栏、主区悬浮按钮、左栏 Hover 预览、终端、PTY、xterm、ChatGPT、Codex
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

当前 Web 工作台采用：

```text
页面顶栏
→ 只保留 Web 工作台标题 / 更多 / 分享

中间主区左上角
→ 左栏按钮
→ Hover / Focus：左栏收起时临时预览
→ Click / Ctrl+B：正式开合左栏

中间主区右上角
→ 终端按钮 Ctrl+J
→ 右栏按钮 Ctrl+Alt+B
```

左栏 Hover 预览与正式布局状态必须分开：

```text
Hover Preview
→ 临时浮层
→ 不修改 leftCollapsed

Click / Ctrl+B
→ 修改 leftCollapsed
→ 正式改变 Grid 左栏宽度
```

右栏不采用 Hover 自动展开，继续显式点击 / 快捷键控制。

侧栏分隔条只负责：

```text
拖拽调宽
→ 到最小阈值吸附收起
→ Pointer Up 后禁止 separator 反向拖开
```

底部真实终端：

```text
xterm.js
↓
Vite HMR 本地通信
↓
node-pty
↓
PowerShell / 当前系统 Shell
```

Web 服务器只绑定 `127.0.0.1`，真实终端默认 cwd 为项目根。

### 最新变更

#### #21.10 主区悬浮与左栏预览

v0.0.39 根据新的 ChatGPT / Codex 参考调整 Shell Actions 位置和左栏交互：

1. Web 顶栏移除左栏 / 终端 / 右栏三个 Shell 控制；
2. 左栏按钮固定到中间主区左上角；
3. 终端 / 右栏按钮固定到中间主区右上角；
4. 左栏收起时，Hover / Focus 左栏按钮临时淡入左栏内容；
5. 鼠标可从按钮移动到预览浮层，不立即闪退；
6. Hover 预览不修改 `leftCollapsed`；
7. 点击 / `Ctrl+B` 才执行正式左栏开合；
8. 右栏保持显式控制；
9. 终端快捷键为 `Ctrl+J`，右栏快捷键为 `Ctrl+Alt+B`；
10. #21.8 的三向吸附和吸附后禁止 separator 反向展开保持不变。

#### #21.9 Web 常驻工作台 Chrome（已替代）

v0.0.38 曾把 Shell Actions 放在全宽 Web Chrome 中。该布局已由 #21.10 替代，历史见：

`archive/0021-09-Web常驻工作台Chrome.md`

### 影响范围

- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `packages/ui/src/workbench/workbench.css`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/workbench.types.ts`
- `packages/app-shell/src/WorkbenchIcon.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `apps/web/src/LocalTerminal.tsx`
- `apps/web/src/local-terminal.css`
- `apps/web/src/vite-custom-events.d.ts`
- `apps/web/src/App.tsx`
- `apps/web/vite.config.ts`
- `docs/standards/UI_LAYOUT.md`

### 验证结果

静态实现当前满足：

- 顶栏不再承载三枚 Shell Actions；
- 左栏按钮位于中间主区左上角；
- 终端 / 右栏按钮位于中间主区右上角；
- 左栏收起后存在独立 Hover preview 浮层；
- Preview 状态与正式 collapsed 状态分离；
- 右栏没有 Hover 自动展开；
- 快捷键为 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`；
- Separator 吸附后仍不能反向拖开；
- Vite terminal bridge 继续使用真实 `node-pty`；
- Vite 仍绑定 `127.0.0.1`。

真实视觉位置与 PTY 交互仍需用户 Windows 浏览器环境执行 `LFAA-Setup.bat → 2` 实机验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 | superseded | `archive/0021-00-Web工作台初始实现.md` |
| #21.1 | superseded | `archive/0021-01-Web启动入口调整.md` |
| #21.2 | superseded | `archive/0021-02-黑白工作台重构.md` |
| #21.3 | superseded | `archive/0021-03-最小宽度自动吸附.md` |
| #21.4 | superseded | `archive/0021-04-Web端口复用.md` |
| #21.5 | superseded | `archive/0021-05-Web启动延迟修复.md` |
| #21.6 | superseded | `archive/0021-06-三栏交互与终端停靠.md` |
| #21.7 | delivered | `active/0021-Web工作台UI.md` |
| #21.8 | delivered | `active/0021-Web工作台UI.md` |
| #21.9 | superseded | `archive/0021-09-Web常驻工作台Chrome.md` |
| #21.10 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-11-Header联动与按钮归属修正.md`

## #21 Web 工作台 UI

- **状态：** superseded
- **已由：** #21.12 Shell Tooltip 单一提示源
- **当前查看：** `../active/0021-Web工作台UI.md`

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.11
- **状态：** active
- **关键词：** Web、三栏、Header联动、左栏Hover预览、终端、PTY、xterm、ChatGPT、Codex
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

当前 Web 工作台的框架级按钮必须属于顶部 Header，而不是正文悬浮层：

```text
中间 Header 左侧
→ 左栏按钮 + Web 工作台标题

中间 Header 右侧
→ 更多 / 分享
→ 右栏收起时：终端 + 右栏按钮也在这里

右栏 Header
→ 右栏展开时：终端 + 右栏按钮移动到这里
```

左栏 Hover Preview 与正式布局状态继续分离：Hover 只临时预览，Click / `Ctrl+B` 才改变 `leftCollapsed`。

### 最新变更

#### #21.11 Header 联动与按钮归属修正

v0.0.43 根据用户实机截图纠正 #21.10 的定位模型：

1. 删除独立全宽 Web Header；
2. 删除中间正文上的 absolute Shell Actions；
3. 中间区新增 48px `agent-center-header`；
4. 左栏按钮、标题、更多、分享进入中间 Header；
5. 右栏展开时，终端/右栏按钮进入 `agent-right-shell-header`；
6. 右栏收起时，同一组按钮回到中间 Header 右侧；
7. 中间 Header 与右栏 Header 同高、同边框，形成连续顶部结构；
8. 新增自定义黑色 Tooltip，同时保留 `title`；
9. `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B` 行为不变；
10. 左栏 Hover Preview、三向吸附、真实 PTY 不回退。

#### #21.10 主区悬浮与左栏预览（已替代）

#21.10 把按钮移动到中间区左右上角，但实现为正文 absolute 浮层。该布局已归档：

`archive/0021-10-主区悬浮与左栏预览.md`

### 影响范围

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`

### 验证结果

静态实现要求：

- Shell Actions 不再使用正文 absolute 定位；
- Center / Right Header 同高 48px；
- 右栏开合时控制按钮在 Center Header 与 Right Header 之间迁移；
- Hover Preview 不修改正式 collapsed 状态；
- 快捷键保持 `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B`；
- separator 吸附逻辑与真实 PTY 不变。

真实视觉仍需 Windows 浏览器实机验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.6 | superseded | `archive/` 对应历史文件 |
| #21.7 | delivered | 当前主日志历史阶段 |
| #21.8 | delivered | 当前主日志历史阶段 |
| #21.9 | superseded | `archive/0021-09-Web常驻工作台Chrome.md` |
| #21.10 | superseded | `archive/0021-10-主区悬浮与左栏预览.md` |
| #21.11 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-12-ShellTooltip单一提示源.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.12
- **状态：** superseded
- **关键词：** Web、三栏、Header联动、Tooltip、Hover、左栏预览、终端、PTY、ChatGPT、Codex
- **当前文件：** `docs/logs/development/active/0021-Web工作台UI.md`

- **已由：** #21.13 响应式重构与弹性吸附
- **当前查看：** `../active/0021-Web工作台UI.md`

### 当前结论

当前 Web 工作台继续使用 #21.11 确立的 Header 联动结构；本次只修正 Shell Header 三个框架按钮的提示层契约：

```text
左栏按钮      → 单一自定义 Tooltip：Ctrl+B
终端按钮      → 单一自定义 Tooltip：Ctrl+J
右栏按钮      → 单一自定义 Tooltip：Ctrl+Alt+B
```

同一个按钮禁止同时存在：

```text
HTML title 原生 Tooltip
+
.agent-shell-tooltip 自定义 Tooltip
```

否则浏览器会延迟再弹出第二层原生提示，形成用户实机照片中的“双层黑框/互相挤压”。

`aria-label` 继续保留给无障碍语义；自定义 Tooltip 必须 `pointer-events:none`，不能抢鼠标事件。

### 最新变更

#### #21.12 Shell Tooltip 单一提示源

v0.0.44 根据用户实机照片修复三处重复 Tooltip：

1. 左栏按钮删除原生 `title`；
2. 底部终端按钮删除原生 `title`；
3. 右侧栏按钮删除原生 `title`；
4. 三个按钮统一只使用 `ShellHeaderButton` 内的 `.agent-shell-tooltip`；
5. 保留 `aria-label` 与快捷键文本；
6. Tooltip 继续 `pointer-events:none`，避免 Hover/Click 被提示层截获；
7. 新增 `scripts/ui-contract-check.mjs`，发布门禁禁止 Shell Header 按钮再次出现 `title + 自定义 Tooltip` 双提示源；
8. #21.11 的 Header 联动、左栏 Hover Preview、三向吸附、真实 PTY 全部保持不变。

#### #21.11 Header 联动与按钮归属修正（历史基线）

结构方案仍然有效，但 v0.0.43 的 Tooltip 同时保留了原生 `title` 和自定义提示，导致视觉重复。历史快照：

`archive/0021-11-Header联动与按钮归属修正.md`

### 影响范围

- `packages/app-shell/src/AgentWorkbench.tsx`
- `scripts/ui-contract-check.mjs`
- `scripts/governance-check.mjs`
- `scripts/comment-check.mjs`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`

### 验证结果

静态实现要求：

- `ShellHeaderButton` 内不存在 `title=`；
- 仍存在 `.agent-shell-tooltip`；
- `.agent-shell-tooltip` 使用 `pointer-events:none`；
- `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B` 三个提示仍在；
- Header 联动结构不回退；
- Sync / GitHub / Setup / Update 业务逻辑不修改。

真实视觉仍需 Windows 浏览器实机验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.10 | superseded / delivered | `archive/` 对应历史文件 |
| #21.11 | delivered-with-tooltip-defect | `archive/0021-11-Header联动与按钮归属修正.md` |
| #21.12 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-13-响应式重构与弹性吸附.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.13
- **状态：** superseded
- **关键词：** Web、响应式、Desktop、Compact、Mobile、Drawer、Header、Tooltip、拖拽、弹性吸附、终端
- **当前文件：** `docs/logs/development/archive/0021-13-响应式重构与弹性吸附.md`
- **已由：** #21.14 最小尺寸吸附收起语义修正取代
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

v0.0.45 把 Web 工作台从“只有 CSS 缩小”升级为真正的三档响应式布局，并重做三向吸附手感。

```text
Desktop >=1180
→ 三栏 Dock

Compact 760~1179
→ 左栏 Dock + 右栏 Drawer

Mobile <760
→ 主区全宽 + 左右 Drawer
```

右栏在 Compact / Mobile 下从主 Header 下方覆盖式出现，不能再使用旧版 `88vw` 盖住大部分页面；Shell Actions 继续留在 Center Header，用户始终能看到关闭入口。

拖拽规则改为：

```text
按住 Pointer
→ min 以下连续弹性压缩
→ 靠边进入 snap capture
→ 不松手可反向拉回 min 并恢复正常拖拽
→ Pointer Up 才决定是否真正 collapsed
```

这条规则同时适用于左栏、右栏和底部 Terminal Dock。

### 最新变更

#### #21.13 响应式重构与弹性吸附

1. 新增 `LayoutMode = desktop / compact / mobile`；
2. React 与 CSS 使用同一组断点：1180 / 760；
3. 进入 Compact 时只自动收起右栏；进入 Mobile 时默认收起左右栏和终端；同一断点内用户仍可手动重新展开；
4. Compact 右栏宽度限制为固定抽屉上限，不再使用 `88vw`；
5. Mobile 左右栏均从 48px Header 下方滑出，不覆盖核心 Header 按钮；
6. Compact / Mobile 中 Right Header 不重复渲染，Shell Actions 留在 Center Header；
7. Tooltip 新增 start / center / end 对齐，解决左/右边缘裁切；
8. `ResizableWorkbench` 增加 `elasticSize()` 和 `snapCommitThreshold()`；
9. min 以下允许视觉连续压缩，不再从 min 突然跳到 0；
10. snapped 状态在 Pointer 仍按住时可反向拖回 min 解锁；
11. Pointer Up 后才提交正式 collapsed；
12. 移除拖拽磁区中的 CSS transition，避免 pointermove 追赶造成卡顿；
13. 正式展开/收起动画统一延长并使用 ease-out；
14. v0.0.44 的单 Tooltip 契约继续保留。

#### #21.12 Shell Tooltip 单一提示源（历史基线）

已归档：

`archive/0021-12-ShellTooltip单一提示源.md`

### 影响范围

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- `scripts/ui-contract-check.mjs`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`
- `docs/项目结构与代码地图.md`

### 验证结果

静态门禁：

- LayoutMode 断点存在；
- Compact / Mobile Drawer 规则存在；
- `88vw` 旧覆盖宽度不得回归；
- `elasticSize` / `snapCommitThreshold` 存在；
- snapped 反向释放条件必须回到 `min`；
- Pointer dragging 时 Workbench transition 必须为 none；
- Shell Button 不得重新出现原生 title；
- Windows 脚本 BOM 必须继续通过。

真实视觉仍需 Windows Chrome / Edge 实机验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.11 | superseded / delivered | `archive/` 对应历史文件 |
| #21.12 | delivered-with-responsive-defect | `archive/0021-12-ShellTooltip单一提示源.md` |
| #21.13 | superseded | `archive/0021-13-响应式重构与弹性吸附.md` |

> 迁移来源：`docs/logs/development/archive/0021-14-最小尺寸吸附收起语义修正.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.14
- **状态：** superseded
- **关键词：** Web、响应式、Dock、Drawer、Resize、Snap、最小宽度、Terminal
- **当前文件：** `docs/logs/development/archive/0021-14-最小尺寸吸附收起语义修正.md`
- **已由：** #21.15 容器响应式与布局变量化取代固定尺寸 / 固定断点方案。
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

v0.0.46 修正 v0.0.45 对“吸附”的理解错误：**展开态不再允许进入 min 以下的超窄布局；拖到 min 就进入吸附收起预览。**

统一规则：

```text
正常展开
→ 拖到可用最小尺寸 min
→ 立即进入 snap capture / 收起预览
→ Pointer 仍按住时，反向拖过 min + hysteresis
→ 恢复到 min 并继续向外拉伸
→ Pointer Up 时仍 snapped 才正式 collapsed
```

正式收起后，separator 继续禁止反向拖开展开，只能通过按钮或快捷键恢复。

本版本同时提高可用最小尺寸，避免右栏 / 左栏在仍然展开时被压成内容无法阅读的窄条：

```text
左栏：initial 300 / min 280 / max 640
右栏：initial 400 / min 360 / max 760
底部：initial 280 / min 180 / max 560
中央区拖拽保护目标：520px
```

为了给新的最小宽度留出合理空间，Desktop 断点同步调整为 `>=1240px`；Compact 为 `760~1239px`；Mobile 仍为 `<760px`。

### 最新变更

#### #21.14 最小尺寸吸附收起语义修正

1. 删除 `elasticSize()` 与 `snapCommitThreshold()`；
2. 左 / 右 / Bottom 展开态绝不小于 min；
3. `raw <= min` 即进入 snap capture；
4. snapped 时预览尺寸直接进入 0，表达“准备收起”，不再停留在超窄展开态；
5. Pointer 不松手时，反向拖到 `min + snapHysteresis` 退出 snap capture；
6. 退出后恢复到至少 min，并可继续向外拉伸；
7. Pointer Up 时仍 snapped 才正式提交 collapsed；
8. 提高左右栏和 Bottom 的最小可用尺寸；
9. Desktop / Compact 边界由 1180 调整到 1240，避免新 min 与中央区目标冲突；
10. snap preview 保留极短磁吸过渡，但普通 Pointer Move 仍禁用 transition，避免拖拽滞后；
11. UI contract 门禁同步改成“min 即吸附、禁止 min 以下展开态”的静态契约。

#### #21.13 响应式重构与弹性吸附（历史基线）

已归档：

`archive/0021-13-响应式重构与弹性吸附.md`

### 影响范围

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- `scripts/ui-contract-check.mjs`
- `docs/standards/UI_LAYOUT.md`
- `docs/testing/WEB_UI_TEST.md`
- `docs/项目结构与代码地图.md`

### 验证结果

静态门禁必须确认：

- Desktop / Compact / Mobile 断点为 1240 / 760；
- 左栏 min 280、右栏 min 360、Bottom min 180；
- 不存在 `elasticSize()` / `snapCommitThreshold()`；
- `raw <= drag.min` 进入 snap；
- `raw >= drag.min + snapHysteresis` 反向解锁；
- 非 snapped 视觉尺寸必须 clamp 到 min 以上；
- Pointer Up 后才提交 collapsed；
- PowerShell BOM / Sync / GitHub / Setup / Update 不回退。

真实视觉仍需 Windows Chrome / Edge 实机验证。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.12 | superseded / delivered | `archive/` 对应历史文件 |
| #21.13 | delivered-with-snap-semantics-defect | `archive/0021-13-响应式重构与弹性吸附.md` |
| #21.14 | superseded | `archive/0021-14-最小尺寸吸附收起语义修正.md` |
| #21.15 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-15-容器响应式与布局变量化.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.15
- **状态：** superseded
- **关键词：** Web、容器响应式、Dock、Overlay、Resize、Snap、Layout Tokens、Terminal
- **当前文件：** `docs/logs/development/archive/0021-15-容器响应式与布局变量化.md`
- **已由：** #21.16 Hover / Click 左栏宽度统一
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

v0.0.47 不再使用 `1240 / 760` 这类固定 viewport 断点，也不再由 App Shell 写死 `左 280 / 右 360` 的面板尺寸。

当前几何事实统一为：

```text
工作台容器尺寸
→ resolveWorkbenchLayoutMetrics(width, height)
→ 计算 left/right/bottom 的 min / initial / max
→ 计算 minCenterWidth / snapHysteresis
→ 自动选择 Desktop / Compact / Mobile
→ ResizableWorkbench + CSS data-layout-mode 执行布局
```

响应式依据是 `agent-workbench-stage` 自身尺寸，由 `ResizeObserver` 监听；不依赖整个浏览器窗口宽度。

### #21.15 容器响应式与布局变量化

#### 问题来源

用户 Windows 实机验证 v0.0.46 后发现：

1. 固定 `280px / 360px` 最小宽度在小窗口中过大，会把中央区挤成窄条；
2. Desktop / Compact / Mobile 使用固定 viewport 断点，不能根据左右栏、中央区实际可用空间决定布局；
3. CSS 与 TS 分别维护固定尺寸，后续调整容易漂移；
4. Compact 虽把右栏改成 Overlay，但左栏仍可能保留大屏持久化宽度，继续压缩中央区；
5. ChatGPT / Codex 类布局的核心不是“某个固定 px”，而是根据容器空间决定 Dock / Overlay，并保持主区优先。

#### 当前实现

新增统一布局计算器：

`packages/ui/src/workbench/workbench-layout.config.ts`

它集中保存：

- 左栏、右栏、底部面板的 `ratio / floor / ceiling`；
- 中央区舒适宽度规则；
- separator 预算；
- snap hysteresis 规则；
- Desktop / Compact / Mobile 的自动判定公式。

当前参考计算结果：

```text
1600px → Desktop，左 initial≈288，右 initial≈360
1280px → Desktop，左 initial≈243，右 initial≈307
1024px → Desktop，左 initial≈216，右 initial≈252
950px  → Compact，左 Dock，右 Overlay
760px  → Compact，左 Dock，右 Overlay
<680px → Mobile，左右 Overlay
```

这些结果不是断点常量，而是由容器宽度与各区域需求共同计算。

#### 最小宽度原则

当前动态范围大致为：

```text
左栏 min：196 ~ 232 CSS px
右栏 min：228 ~ 288 CSS px
Bottom min：136 ~ 176 CSS px（跟容器高度计算）
```

`px` 只作为 Pointer 几何最终结果和安全 floor/ceiling；业务层不再直接写固定 `LEFT_LIMITS / RIGHT_LIMITS / BOTTOM_LIMITS`。

#### Dock / Overlay 规则

```text
Desktop
→ 左 / 中 / 右同时 Dock
→ 只有容器真的能放下三者才进入

Compact
→ 左栏 Dock
→ 右栏 Overlay
→ 右栏不参与中央区宽度计算

Mobile
→ 中间主区全宽
→ 左右都 Overlay
```

Overlay 宽度使用 CSS 变量 + `clamp()` / 百分比，不再使用旧的 `420px / 56vw / 88vw` 方案。

#### 拖拽 / 吸附规则保持

```text
展开
→ 正常跟手 Resize
→ 到当前动态 min
→ snap preview 吸到 0
→ Pointer 不松手，反向超过 min + hysteresis 可恢复
→ Pointer Up 时仍 snapped 才正式 collapsed
```

正式 collapsed 后 separator 不能重新展开，只能通过 Header 按钮 / 快捷键恢复。

#### 持久化尺寸修复

容器缩小时，`ResizableWorkbench` 会重新 clamp 历史宽度：

- 先 clamp 到当前动态 `min/max`；
- 再 clamp 到“中心区保护”计算出的 dynamic max；
- Compact / Mobile Overlay 不再错误参与另一侧 Dock 的动态 max。

这避免“大屏保存的 340px 左栏 → 小窗仍保持 340px”导致主区崩溃。


### 最新变更

#### #21.15 容器响应式与布局变量化

- 新增 `workbench-layout.config.ts` 作为几何单一事实源；
- 使用 ResizeObserver 读取工作台容器，而不是固定 window breakpoint；
- 移除 App Shell 固定 pane limits；
- Desktop / Compact / Mobile 改为基于可容纳空间的计算结果；
- 历史 pane width 随当前容器重新 clamp；
- CSS 改用变量 / rem / clamp / calc；
- 保留三向 min snap / reverse unlock / Pointer Up commit。

### 历史基线

- #21.14 已归档：`archive/0021-14-最小尺寸吸附收起语义修正.md`
- #21.13 及更早继续保留在 archive。

### 影响范围

- `packages/ui/src/workbench/workbench-layout.config.ts`（新增）
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- `packages/ui/src/index.ts`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `scripts/ui-contract-check.mjs`
- 当前 UI / Test / Code Map / Prompt / Plan / Progress / Changelog / Release 文档

### 不影响

- Sync / GitHub / Setup / Update 业务逻辑；
- xterm / node-pty PTY bridge；
- Agent Runtime / Tool Runtime / Permission Engine；
- Config / Secret Store / Rust Native 边界。

### 当前验收

静态门禁必须确认：

- App Shell 不存在 `LEFT_LIMITS / RIGHT_LIMITS / BOTTOM_LIMITS` 固定常量；
- 响应式使用 `ResizeObserver` + `resolveWorkbenchLayoutMetrics`；
- `workbench-layout.config.ts` 存在 ratio/floor/ceiling 单一事实源；
- CSS 使用 `data-layout-mode` + CSS 变量 + `clamp()`；
- 旧 `1240 / 760` 双维护断点不回归；
- 旧 `420px / 56vw / 88vw` Drawer 不回归；
- 三向 min 吸附收起、Pointer 反向解锁、Pointer Up 提交保持；
- 大屏持久化宽度在小容器内重新 clamp；
- Windows PowerShell BOM / 基础设施脚本不回退。

真实视觉仍需 Windows Chrome / Edge 多尺寸实机验证。

### 验证结果

发布前必须通过： governance / imports / dev-log / docs / comments / Windows BOM / release consistency / UI contract / TS syntax / ZIP round-trip。

当前静态契约重点：容器响应式、变量化几何、旧固定断点禁止回归、三向 snap 保持。


### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.13 | superseded / delivered | `archive/` 对应历史文件 |
| #21.14 | superseded | `archive/0021-14-最小尺寸吸附收起语义修正.md` |
| #21.15 | active | `active/0021-Web工作台UI.md` |

> 迁移来源：`docs/logs/development/archive/0021-16-Hover与点击左栏宽度统一.md`

## #21 Web 工作台 UI

- **主编号：** #21
- **名称：** Web 工作台 UI
- **最新变更：** #21.16
- **状态：** superseded
- **关键词：** Web、Hover Preview、Dock Width、Single Source、Responsive、Resize
- **当前文件：** `docs/logs/development/archive/0021-16-Hover与点击左栏宽度统一.md`
- **已由：** #21.17 Composer 底部安全间距
- **当前查看：** `docs/logs/development/active/0021-Web工作台UI.md`

### 当前结论

v0.0.48 在 v0.0.47 容器响应式基础上，修复左栏 Hover Preview 与正式点击展开宽度漂移。

当前宽度链路只有一个事实源：

```text
ResizableWorkbench.leftWidth
→ onLeftWidthChange(width)
→ AgentWorkbench.leftPaneWidth
→ CSS 变量 --agent-left-preview-width
→ Hover Preview
```

因此 Hover Preview 不是另一套侧栏尺寸；它只是正式左栏当前真实宽度的临时视觉投影。

### #21.16 Hover / Click 左栏宽度统一

#### 问题来源

v0.0.47 正式左栏由动态 `leftWidth` 控制，但 Hover Preview 仍在 `agent-workbench.css` 中单独使用 `clamp(...)`。用户实机发现：collapsed 后 Hover 的展示宽度与点击展开后的 Dock 宽度不同，视觉会发生跳变。

#### 当前实现

- `ResizableWorkbenchProps` 新增 `onLeftWidthChange(width)`；
- ResizableWorkbench 在真实 `leftWidth` 变化时回传；
- AgentWorkbench 保存 `leftPaneWidth`；
- Stage 写入 `--agent-left-preview-width: <leftPaneWidth>px`；
- Hover Preview 只读取该 CSS 变量；
- 删除 Desktop / Compact 独立 Preview `clamp()`。

#### 一致性语义

```text
默认状态：Hover = Click = 当前 left.initial
用户 resize：Hover = Click = 用户最后 leftWidth
容器变窄：Hover = Click = 当前 clamp 后 leftWidth
```

#### 防回归

`ui-contract-check.mjs` 新增：

- 必须存在 `onLeftWidthChange`；
- 必须由 `setLeftPaneWidth` 接收；
- 必须由 `--agent-left-preview-width` 使用该值；
- 禁止 CSS 再定义 `--agent-left-preview-width: clamp(...)`。


### 最新变更

#### #21.16 Hover / Click 左栏宽度统一

- 左栏实际宽度由 `ResizableWorkbench.leftWidth` 单一拥有；
- `onLeftWidthChange` 把真实宽度回传 App Shell；
- Hover Preview 通过 `--agent-left-preview-width` 使用同一个值；
- 删除 Preview 独立 `clamp()` 宽度；
- UI contract 防止第二套宽度事实源回归。

### 影响范围

- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench-layout.types.ts`
- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `scripts/ui-contract-check.mjs`
- 当前 UI / Test / Code Map / Prompt / Plan / Progress / Changelog / Release 文档

### 验证结果

静态门禁必须确认：Hover Preview 与正式 Dock 共用真实 `leftWidth`，CSS 中不存在独立 Preview clamp，基础设施与 PTY 不回退。真实视觉仍需 Windows 实机确认无宽度跳变。

### 历史基线

- #21.15 已归档：`archive/0021-15-容器响应式与布局变量化.md`
- #21.14 及更早继续保留在 archive。

### 不影响

- 三向吸附状态机；
- Desktop / Compact / Mobile 模式计算；
- Header / Tooltip；
- Sync / GitHub / Setup / Update；
- PTY / node-pty；
- Agent Runtime / Config / Permission / Rust Native。

### 当前验收

发布前必须通过 governance / imports / dev-log / docs / comments / Windows BOM / release consistency / UI contract / TS syntax / ZIP round-trip。

真实视觉仍需 Windows Chrome / Edge 实机确认 Hover 与 Click 宽度无跳变。

### 历史索引

| 版本 | 状态 | 日志 |
|---|---|---|
| #21.0 - #21.14 | superseded / delivered | `archive/` 对应历史文件 |
| #21.15 | superseded | `archive/0021-15-容器响应式与布局变量化.md` |
| #21.16 | superseded | `archive/0021-16-Hover与点击左栏宽度统一.md` |
