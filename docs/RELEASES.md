## LFAA v0.0.60 Release — #20.14 pnpm 原生安装输出恢复

- **状态：** pending-user-acceptance
- **基线：** v0.0.59
- **用户验收：** pending

### 交付内容

- 菜单 1 交互式 pnpm install 恢复 pnpm 原生终端 reporter；
- LFAA 不捕获、不重写、不模拟安装 stdout/stderr；
- #20.13 的开发期 / frozen 分流保持不变；
- 正式发布 frozen 与实时 Store / PNPM_HOME / 真实依赖健康语义保持不变。

### AI 验证状态

dependency-setup 静态契约、node-dependency-health、release-gates、release-environment、Config Schema 与仓库治理门禁 PASS；当前制作容器无 Windows PowerShell，因此 pnpm 原生 TTY 输出仍以用户 Windows 实机为最终验收。

### 用户实机验收重点

在当前 lockfile 落后场景确认 Y 后，LFAA 显示执行模式/命令后应直接出现 pnpm 自身的 Scope / Progress / reused / downloaded / added 等安装信息；完成后第二次运行菜单 1 应无需再次安装。

## LFAA v0.0.59 Release — #20.13 开发期依赖同步与实时输出修复

- **状态：** superseded
- **基线：** v0.0.58
- **用户验收：** not-accepted；append-only reporter 在 Windows 实机仍无原生安装信息，由 v0.0.60 修正

### 交付内容

- lockfile 落后时菜单 1 使用开发期同步模式，允许更新 `pnpm-lock.yaml`；
- lockfile 已完整但本地安装损坏时继续 frozen 精确修复；
- pnpm 写操作使用稳定逐行 reporter 并显示实际执行命令；
- 正式发布 frozen 门禁保持不变。

### AI 验证状态

dependency-setup 17/17 PASS；node-dependency-health 3/3 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；版本一致性与 Windows BOM 门禁 PASS。当前制作容器仍无 PowerShell / pnpm 11.17.0 / Cargo，不冒充 Windows 实机安装与完整 `release:full`。

### 用户实机验收重点

在当前“pnpm-lock.yaml 尚未覆盖当前外部依赖”场景确认同步后，应立即看到 pnpm 真实进度；完成后再次运行菜单 1，lockfile 应已覆盖声明且不再重复同步。

# LFAA 发布记录

## LFAA v0.0.58 Release — #20.12 PowerShell 自动变量冲突修复

- **状态：** superseded
- **基线：** v0.0.57
- **用户验收：** not-accepted；依赖同步阶段发现 frozen 模式与实时输出问题，由 v0.0.59 修复

### 交付内容

- 修复 Setup 的 `$home` / `$HOME` PowerShell 自动变量冲突；
- 增加 Windows PS1 自动/只读变量赋值防回归；
- 保留实时 PNPM_HOME、active Store、Store 来源、真实依赖与 Store 健康检测。

### 未修改

Web Account/Auth、Config Schema / Config Storage、Web UI、PTY、Sync / GitHub / Update、Agent / Tool / Policy / Permission 执行链。

### AI 验证状态

dependency-setup 15/15 PASS；node-dependency-health 3/3 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；Config System TypeScript `--noEmit` PASS；治理链全部 PASS。当前制作容器无 PowerShell、Node 22.16.0、无 Cargo，因此 Windows 动态执行与完整 `release:full` 不冒充通过。

### 用户实机验收重点

运行菜单 1：不得再出现“无法覆盖变量 HOME”；随后必须继续显示 PNPM_HOME、pnpm Store 与 Store 来源，并进入真实依赖健康检查。

> 每个版本在本文件新增一个版本章节，不再创建 `docs/releases/vX.Y.Z/RELEASE.md`。
> 当前版本在用户验收前必须标记 `pending-user-acceptance`，验收通过后才能改为 `delivered`。

## LFAA v0.0.57 Release — #20.11 pnpm 实时环境事实与 Store 来源修复

- **状态：** superseded
- **基线：** v0.0.56
- **用户验收：** not-accepted；Windows 实机发现 `$home` 与 PowerShell 自动变量 `$HOME` 冲突，由 v0.0.58 修复

### 交付内容

- 菜单 1 / 7 每次实时读取 pnpm executable、PNPM_HOME、active Store 与配置来源；
- active Store 永远来自当前项目根执行的 `pnpm store path`，不读取历史状态缓存；
- Store 来源显示环境变量 / 项目配置 / 用户全局配置 / pnpm 默认；
- 仓库不声明项目级 `storeDir`，不自动改用户全局 Store、不迁移缓存目录；
- v0.0.56 的真实依赖解析与 Store 健康探针完整保留。

### 未修改

Web Account/Auth、Config Schema / Config Storage、Web UI、PTY、Sync / GitHub / Update、Agent / Tool / Policy / Permission 执行链。

### AI 验证状态

dependency-setup 14/14 PASS；node-dependency-health 3/3 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；治理链全部 PASS。当前制作容器无 PowerShell、Node 22.16.0、无 Cargo，因此 Windows 实时 pnpm 环境与完整 `release:full` 仍需实机/受支持环境验证。

### 用户实机验收重点

1. 在 CMD 执行 `pnpm store path`，再运行菜单 1；菜单显示的 active Store 必须完全一致；
2. 当前无项目/全局显式 `storeDir` 时，来源应显示 pnpm 默认；
3. 后续若修改全局 `storeDir`，无需删除 `.lfaa/state`，重跑菜单 1 必须立即显示新路径；
4. Store 被删除时仍必须触发 v0.0.56 的真实 Store 健康警告/修复逻辑。

## LFAA v0.0.56 Release — #20.10 真实依赖健康检测与 Store 状态修复

- **状态：** superseded
- **基线：** v0.0.55
- **用户验收：** not-accepted；由 v0.0.57 补齐实时机器环境与 Store 来源

### 交付内容

- Node 依赖从各 workspace importer 做真实 resolve，不再只检查 package.json 外壳；
- node-pty 在 unchanged 路径也会进入真实加载检查；
- pnpm Store 分离为独立健康状态：目录缺失/为空、lockfile 离线 fetch 探针失败均不能标记健康；
- Store 缺失但项目当前仍可解析时明确显示降级状态；
- 用户可按当前 lockfile 恢复 Store 缺失缓存，不自动升级依赖；
- 安装/修复后必须再次做真实项目依赖和 Store 检查。

### 未修改

Web Account/Auth、Config Schema / Config Storage、Web UI、Sync / GitHub / Update、Agent / Tool / Policy / Permission 执行链。

### AI 验证状态

node-dependency-health 3/3 PASS；dependency-setup 11/11 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；Config System TypeScript `--noEmit` PASS；governance/import/dev-log/docs/comment/Windows BOM/release consistency/prompt lifecycle/config-schema/release-gates/UI contract 全部 PASS。当前制作容器 Node 22.16.0、无 Cargo、无 PowerShell，因此 Windows 菜单动态 Store 删除/恢复与完整 `release:full` 不冒充通过。

### 用户实机验收重点

1. 完整环境先运行菜单 1，应显示“项目依赖真实解析通过”与“pnpm Store 覆盖当前 lockfile”；
2. 删除菜单显示的 `pnpm Store` 后再次运行菜单 1，必须报告 Store 缺失/为空，不能再显示全部依赖就绪；
3. 若项目 node_modules 仍可运行，应显示“项目当前可用，但 Store 缓存缺失”；
4. 选择恢复后只补当前 lockfile 缺失缓存，再次运行应恢复健康状态。

## LFAA v0.0.55 Release — #20.9 依赖提示去重与路径可见性

- **状态：** delivered
- **基线：** v0.0.54
- **用户验收：** passed

### 交付内容

- 菜单 1 的 Node / pnpm / workspace 环境事实只显示一次；
- unchanged 路径结尾只保留一个按需依赖总摘要；
- 新增 Node/pnpm/Rust/Cargo 关键依赖位置展示；
- pnpm Store 使用 `pnpm store path` 动态获取；
- 菜单 7 环境检查复用相同位置展示；
- #20.8 增量依赖语义保持不变。

### 未修改

Config Schema / Config Storage、Web UI、PTY、Sync / GitHub / Update、Agent / Tool / Policy / Permission 执行链、独立 Schema / Protocol 版本。

### AI 验证状态

dependency-setup 8/8 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / config-schema / release-gates / UI contract 全部 PASS；Config System TypeScript `--noEmit` PASS。当前制作容器无 PowerShell，无法冒充 Windows 动态界面实测；Node 22.16.0 / 无 Cargo 也继续阻断完整 `release:full`。

### 用户实机验收重点

在依赖已完整的 Windows 项目运行菜单 1，确认没有两组 Node/pnpm/workspace，没有两个独立完成摘要；显示出的 pnpm Store、node_modules、Cargo/Rust 路径应与本机实际位置一致。

## LFAA v0.0.54 Release — #20.8 按需依赖增量检测与复用

- **状态：** superseded
- **基线：** v0.0.53
- **用户验收：** not-accepted；增量跳过已实机体现，展示层问题由 v0.0.55 修正

### 交付内容

- 菜单 1 增加本机依赖指纹与安装完整性检测；
- unchanged 路径不再执行 `pnpm install`；
- 依赖声明 / lockfile / 本地缺失变化时才显示差异并询问是否同步；
- 依赖指纹不包含产品版本，避免普通 LFAA 版本递增触发重装；
- 本机缓存存放在 `.lfaa/state/dependency-state.json`，Git ignore，依赖真相仍归 manifests / lockfiles；
- 禁止菜单 1 自动升级上游依赖、清空 pnpm store 或 node_modules；
- Rust toolchain / rustfmt / clippy 与 Cargo fetch 增加 unchanged 复用路径；
- 新增增量依赖 6 项静态单测及 release-gates 防回归。

### 未修改

Config Schema / Config Storage、Web UI、PTY、Sync / GitHub / Update、Agent / Tool / Policy / Permission 执行链、独立 Schema / Protocol 版本。

### AI 验证状态

增量依赖契约 6/6 PASS；release-gates 5/5 PASS；release-environment 8/8 PASS；Config Schema 8/8 PASS；governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / config-schema / UI contract 全部 PASS；Config System TypeScript 补充 `--noEmit` PASS。当前制作容器 Node 22.16.0 且无 Cargo，`release:environment` / `release:rust` 按设计 FAIL，因此本候选包不声称 `release:full` 已通过。

### 用户实机验收重点

同一项目目录第一次完成依赖同步后，再次执行菜单 1 应直接报告已就绪，不出现 pnpm install / cargo fetch / rustup toolchain install；若后续项目版本真的新增、删除或改动依赖，应先展示差异并询问 Yes/No。

## LFAA v0.0.53 Release — #20.7 Setup 菜单与发布门禁解耦

- **状态：** superseded
- **基线：** v0.0.52
- **用户验收：** not-accepted；菜单 1 的无条件依赖安装由 v0.0.54 修正

### 交付内容

- Setup 菜单 1 从“流程前置”调整为按需依赖准备；
- Setup 菜单 10 改为快速 / 完整 / 正式发布三档检查中心；
- 新增 `quality:quick` / `quality:full`；
- `release:full` 保留正式发布严格环境、frozen install 与 Rust 验证；
- Windows 系统环境动作继续由 PS1 负责，跨平台质量检查继续由 package scripts / MJS 负责；
- 候选包与完整 release-ready 验证分离，未跑通 `release:full` 时必须如实披露。

### 未修改

Config Schema / Config Storage、Web UI、PTY、Sync / GitHub / Update、Agent / Tool / Policy / Permission 执行链、独立 Schema / Protocol 版本。

### AI 验证状态

分层门禁契约 5/5 PASS；发布环境 8/8 PASS；Config Schema 8/8 PASS；governance / import / dev-log / docs / comment / Windows BOM / release consistency / config-schema / release-gates / UI contract 全部 PASS；Config System TypeScript 补充检查 PASS。当前制作容器仍不满足 Node 24 / pnpm 11.17.0 / Cargo，因此正式环境与 Rust 门禁按设计阻断；本版本是 `pending-user-acceptance` 候选包，不声称 `release:full` 已通过或 release-ready。

## LFAA v0.0.52 Release — #20.6 发布环境与质量门禁闭环

- **状态：** superseded
- **基线：** v0.0.51
- **用户验收：** not-accepted；菜单 1 / 10 的过重绑定由 v0.0.53 修正。

### 交付内容

- Node 24.x / pnpm 11.17.0 / lockfile 正式发布环境门禁；
- pnpm preinstall 精确版本校验；
- Setup Corepack 锁定 pnpm 自动准备；
- 真实根级 typecheck / test / build 聚合；
- `release:verify` / `release:full` 唯一发布质量链；
- frozen lockfile 发布安装；
- Rust workspace check/test 发布门禁；
- 8 个发布环境单元测试与静态防回归门禁。

### 未修改

- Config Schema 业务语义与 Schema Version 1；
- Config Storage / SQLite / Drizzle / Migration；
- Web UI 业务交互与布局；
- PTY / node-pty 业务实现；
- Sync / GitHub / Update；
- Agent / Tool / Policy / Permission 执行链；
- Agent Protocol / Database Schema Version。

### AI 验证状态

发布环境测试 8/8 PASS；Config Schema 8/8 PASS；Config System TypeScript noEmit PASS；import / dev-log / docs / comment / Windows BOM / config-schema / release-gates / UI contract PASS。当前制作容器是 Node 22.16.0，缺少 pnpm 11.17.0 与 Cargo，且网络策略阻止 Corepack 从 npm registry 下载，因此环境 / Rust 门禁按设计明确失败；本记录不声称 `pnpm run release:full` 已通过。

### 自举说明

本版本用于把“没有正确工具链就不得假绿”的规则第一次固化为代码。v0.0.52 交由用户验收；从下一递增版本开始，正式 ZIP 打包前必须在满足项目工具链的机器真实通过 `pnpm run release:full`。

该“所有候选 ZIP 都必须先通过 release:full”的绝对规则未被用户接受，已由 #20.7 / v0.0.53 调整为“候选包如实披露阻断；只有完整发布验证 / release-ready 才要求 release:full PASS”。


## LFAA v0.0.51 Release — #2.2 Config Schema 基线

- **状态：** pending-user-acceptance
- **基线：** v0.0.50
- **用户验收：** pending

### 交付内容

- 新增 `@lfaa/config-system`；
- Config Schema Version 1 单一事实源；
- Settings / Runtime / Provider / Account / Model / Permission Default 类型；
- 默认配置与纯内存运行时校验；
- Provider / Model / Account 唯一性与引用完整性；
- Account `credentialRef` 安全边界；
- Secret 明文字段拒绝；
- Config Schema 专项门禁与 8 个单元测试。

### 未修改

- Config Storage / SQLite / Drizzle / Migration 执行器；
- Rust Secret Store；
- Config UI；
- Agent / Tool / Policy / Permission 执行逻辑；
- PTY / node-pty；
- Sync / GitHub / Setup / Update 业务逻辑。

### 验证状态

AI 可执行验证：TypeScript noEmit PASS；Schema unit 8/8 PASS；config-schema-check PASS；`governance:check` 的 10 个实际 Node 门禁逐项 PASS；典型 100/100/100 配置校验 1000 次实测 P95 约 0.61ms。当前执行环境无法联网取得项目锁定的 pnpm 11.17.0，因此没有伪造 `pnpm run governance:check` 包装命令的执行结果。


## LFAA v0.0.50 Release — #20.5 文档体系单文件时间线重构

- **状态：** pending-user-acceptance
- **基线：** v0.0.49
- **用户验收：** pending

### 交付内容

- docs 长期 Markdown 固定为 9 个；
- Prompt / Development Log / Changelog / Release 统一改为文件内时间线；
- 当前事实和历史时间线明确分工；
- AGENTS / DEVELOPMENT 改为 AI 一眼可读的开发生命周期；
- 增加 `prompt-lifecycle-check.mjs`；
- 文档治理脚本改为固定文档契约；
- 历史 Prompt、日志、Changelog、Release 原文迁入对应长期文件，并保留迁移来源路径。

### 未修改

- Web UI 交互实现；
- 三向吸附 / 响应式布局算法；
- PTY / node-pty；
- Sync / GitHub / Setup / Update 业务逻辑；
- Protocol / DB Schema / 安全执行链。

> 迁移来源：`docs/releases/v0.0.49/RELEASE.md`

## LFAA v0.0.49 Release

本版本以 v0.0.48 为历史基线，只调整 Composer 底部安全间距和对应静态 UI 契约。

### 交付内容

- 新增 `--agent-composer-bottom-gap`；
- Desktop / Compact / Mobile 分别使用响应式底部留白；
- safe-area 与布局间距取较大值；
- Composer 保持正常 Grid 文档流；
- UI contract 增加 bottom-gap 防回归；
- #21.16 归档，#21.17 Active。

### 未修改

- 三向吸附 / reverse unlock / collapsed 规则；
- 容器响应式 Mode 计算；
- Hover / Click 左栏宽度统一；
- Sync / GitHub / Setup / Update；
- Windows PowerShell 编码；
- PTY bridge / node-pty。

真实视觉状态：`pending-windows-visual-test`。

> 迁移来源：`docs/releases/v0.0.48/RELEASE.md`

## LFAA v0.0.48 Release

本版本以 v0.0.47 为历史基线，只修复左栏 Hover Preview 与正式 Dock 宽度不统一的问题。

### 交付内容

- Hover / Click 共用 `ResizableWorkbench.leftWidth`；
- 新增 `onLeftWidthChange`；
- App Shell 通过 `--agent-left-preview-width` 传递实际宽度；
- 删除 Preview 独立 clamp 宽度；
- UI contract 增加单一宽度事实源防回归；
- #21.15 归档，#21.16 Active。

### 未修改

- 三向吸附 / reverse unlock / collapsed 规则；
- 容器响应式 Mode 计算；
- Sync / GitHub / Setup / Update；
- Windows PowerShell 编码；
- PTY bridge / node-pty。

真实视觉状态：`pending-windows-visual-test`。

> 迁移来源：`docs/releases/v0.0.47/RELEASE.md`

## LFAA v0.0.47 Release

本版本以 v0.0.46 为历史基线，重点修复小窗口响应式与固定侧栏尺寸问题，并把 Workbench 几何改成单一变量/公式驱动。

### 交付内容

- 新增 `workbench-layout.config.ts` 作为几何单一事实源；
- 左 / 右 / Bottom 使用 ratio + floor + ceiling 计算 limits；
- 当前参考 min：左约 196~232、右约 228~288、Bottom 约 136~176；
- 使用 ResizeObserver 监听 Workbench Stage 实际尺寸；
- 删除固定 1240 / 760 viewport 响应式；
- Desktop：仅容器实际放得下三栏时双 Dock；
- Compact：左 Dock + 右 Overlay；
- Mobile：主区全宽 + 双 Overlay；
- 右 Overlay 使用 CSS 变量 + clamp / 百分比；
- 历史持久化 pane width 在小容器中重新 clamp；
- 三向 min 吸附收起与 Pointer 反向恢复行为保持；
- UI contract 增加容器响应式与变量化布局防回归。

### 未修改

- Sync / GitHub / Setup / Update 业务逻辑；
- Windows PowerShell 编码契约；
- PTY bridge / node-pty；
- Agent Runtime / Tool Runtime / Permission / Config / Rust Native 边界。

### 发布前门禁

- governance / imports / dev-log / docs / comments；
- Windows PowerShell BOM；
- release consistency；
- UI contract；
- TS / TSX syntax；
- ZIP 根目录 / 中文路径 / Round-trip Hash。

真实视觉状态：`pending-windows-visual-test`。

> 迁移来源：`docs/releases/v0.0.46/RELEASE.md`

## LFAA v0.0.46 Release

本版本以 v0.0.45 为历史基线，修正三向拖拽吸附的语义错误：**到最小可用尺寸就吸附收起，不允许继续以更窄尺寸展开。**

交付内容：

- 左栏 min 280px / initial 300px；
- 右栏 min 360px / initial 400px；
- Bottom Terminal min 180px / initial 280px；
- 左 / 右 / Bottom 到 min 即进入 snap capture；
- Pointer 按住时可从已吸附状态反向拖回并恢复到至少 min；
- Pointer Up 时仍 snapped 才正式 collapsed；
- 正式 collapsed 后 separator 继续禁止反向展开；
- Desktop / Compact 断点更新为 1240 / 760；
- 删除旧的 min 以下弹性展开算法；
- UI 静态门禁更新为“min 即吸附收起”契约。

未修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- Windows PowerShell 编码契约；
- PTY bridge 与 node-pty 行为；
- Agent / Tool / Permission / Config 边界。

发布前要求：治理、导入、开发日志、文档、注释、Windows PowerShell 编码、版本一致性、UI 静态契约、TS/TSX 语法、ZIP 根目录与 Round-trip 全部通过。

> 迁移来源：`docs/releases/v0.0.45/RELEASE.md`

## LFAA v0.0.45 Release

本版本以 v0.0.44 为历史基线，解决 Web 工作台响应式崩溃、边缘 Tooltip 裁切和三向吸附手感问题，不覆盖旧版本。

交付内容：

- Desktop / Compact / Mobile 三档响应式；
- Compact 右 Drawer、Mobile 左右 Drawer；
- 核心 Shell Actions 在窄屏始终可见；
- Tooltip start/end 贴边安全定位；
- 左 / 右 / Bottom 三向弹性吸附；
- Pointer 按住期间可从 snap capture 反向拖回 min；
- Pointer Up 后正式 collapsed，separator 继续禁止反向展开；
- 拖拽阶段取消 CSS transition 追鼠标；
- 正式开合动画平滑化；
- UI 静态契约门禁升级。

未修改：

- Sync / GitHub / Setup / Update 业务逻辑；
- Windows PowerShell 编码契约；
- PTY bridge 与 node-pty 行为；
- Agent / Tool / Permission / Config 边界。

发布前要求：治理、导入、开发日志、文档、注释、Windows PowerShell 编码、版本一致性、UI 静态契约、TS/TSX 语法、ZIP 根目录与 Round-trip 全部通过。

> 迁移来源：`docs/releases/v0.0.44/RELEASE.md`

## LFAA v0.0.44 Release

本版本以 v0.0.43 为历史基线，专门修复 Shell Header 三个框架按钮的双层 Tooltip，不覆盖旧版本。

交付内容：

- 左栏按钮只保留自定义 Tooltip；
- 底部终端按钮只保留自定义 Tooltip；
- 右侧栏按钮只保留自定义 Tooltip；
- 保留 aria-label 和快捷键提示；
- Tooltip 不抢鼠标事件；
- 新增 UI 静态契约门禁；
- Header 联动、Hover Preview、三向吸附、真实 PTY 保持不变；
- Windows Sync/GitHub/Setup/Update 业务逻辑保持不变。

发布前要求：治理、导入、开发日志、文档、注释、Windows PowerShell 编码、版本一致性、UI 静态契约、TS/TSX 语法、ZIP 根目录与 Round-trip 全部通过。

> 迁移来源：`docs/releases/v0.0.43/RELEASE.md`

## LFAA v0.0.43 Release

本版本以 v0.0.42 为历史基线，专门修正 Web 工作台顶部按钮的结构归属，不覆盖旧版本。

交付内容：

- Center Workspace 新增正常文档流 Header；
- 左栏按钮与工作台标题进入 Center Header；
- 右栏展开时，终端 / 右栏按钮进入 Right Header；
- 右栏收起时，按钮回到 Center Header；
- 左栏 Hover Preview / Click 开合语义保持不变；
- 快捷键与自定义 Tooltip 同步；
- 三向吸附、真实 PTY、资源桥保持不变；
- v0.0.42 Windows PowerShell BOM 修复保持不变。

发布前要求：治理、导入、开发日志、文档、注释、Windows PowerShell 编码、版本一致性、TS/TSX 语法、ZIP 根目录与 Round-trip 全部通过。

> 迁移来源：`docs/releases/v0.0.42/RELEASE.md`

## LFAA v0.0.42 Release

本版本是 v0.0.41 的 Windows 脚本编码回归修复版。

交付内容：

- 恢复 Sync / GitHub / Setup / Update PowerShell 脚本 UTF-8 BOM；
- 新增 Windows PowerShell 编码自动门禁；
- 新增发布版本一致性门禁；
- 把“按照开发规范开发”固化为 DEVELOPMENT / AGENTS 的强制执行合同；
- 保留 v0.0.41 为历史版本，不覆盖旧包；
- Web UI、同步算法、GitHub 业务逻辑不变。

发布前要求：治理、导入、文档、开发日志、注释、Windows 脚本编码、发布版本一致性、ZIP Round-trip 全部通过。

> 迁移来源：`docs/releases/v0.0.41/RELEASE.md`

## LFAA v0.0.41 Release

本版本不改变 v0.0.40 的功能行为，重点修复项目可读性和文档事实源：补齐关键源码中文注释、CSS 盒子分区、项目结构地图、一级目录 README，并新增 `comment-check` 治理门禁。

> 迁移来源：`docs/releases/v0.0.40/RELEASE.md`

## LFAA v0.0.40 Release

本版本修复稳定工作区同步目标推导和 Windows ZIP 中文路径兼容问题，并保留 v0.0.39 的工作台 UI 改动。

> 迁移来源：`docs/releases/v0.0.38/RELEASE.md`

## LFAA-v0.0.38 Release

### 状态

```text
delivered
```

### 任务

```text
#21.9 Web 常驻工作台 Chrome
```

### 基线

```text
v0.0.37
```

本版本保留 v0.0.37 及之前已完成的：

- #10.2 GitHub 推送预检容错；
- #21.8 左 / 右 / 底部三向吸附与显式重新展开；
- #4.1 中文路径打包 / 同步保护。

### 主要变化

- Web 页面增加全宽、常驻的 Workbench Chrome；
- 左栏开合按钮固定在顶栏最左侧；
- 终端与右栏开合按钮固定在顶栏右侧；
- 框架级按钮不再依赖 hover 显示；
- 删除侧栏内部重复的 hover 开合按钮；
- 删除收起后的屏幕边缘 / 底部 hover 重开热点；
- 保留右栏“终端”工具项与键盘快捷键作为额外入口；
- 桌面端后续可把同一组 shell actions 映射到原生标题栏，Web 端则使用页面自己的顶栏。

### 实机验证重点

```text
LFAA-Setup.bat
→ 2 启动 Web
```

验收：

1. 左栏展开时左上角开合按钮始终可见；
2. 左栏收起后按钮仍停留在相同的 Web 顶栏位置；
3. 终端 / 右栏按钮始终显示在右上角；
4. 不需要鼠标移入侧栏或屏幕边缘才能看到入口；
5. 拖动侧栏到阈值仍会吸附收起；
6. 吸附收起后 separator 仍不能反向拖开；
7. 窄屏下三枚框架级入口仍可用。

> 迁移来源：`docs/releases/v0.0.37/RELEASE.md`

## LFAA-v0.0.37 Release

### 状态

```text
delivered
```

### 任务

```text
#4.1 版本包中文路径修复与同步保护
```

### 基线

```text
v0.0.36
```

本版本不回退 v0.0.36 已完成的：

- #10.2 GitHub 推送预检容错；
- #21.8 左 / 右 / 底部三向吸附与显式重新展开。

### 主要变化

- 恢复 v0.0.36 发布包中 83 个错误编码的中文文件名；
- 同步脚本在差异计算前增加源路径编码损坏检测；
- 检测到疑似 CP437→UTF-8 可逆乱码时拒绝同步，保护稳定工作区；
- 发布产物重新验证 ZIP 内部文件名为正确 Unicode 中文路径；
- 嵌套 `node_modules` / `target` / `dist` 等本机缓存目录也按保护规则排除，不再出现在删除计划。

### 实机验证重点

```text
LFAA-Sync.bat
→ 2 预览差异
```

从 v0.0.35 稳定工作区预览时：

- 不应出现 `Θ`、`τ`、`╜` 等 CP437 乱码文件名；
- 不应批量删除原有中文开发日志 / Prompt；
- 应只显示真实的 v0.0.36 / v0.0.37 文件变化。

> 迁移来源：`docs/releases/v0.0.36/RELEASE.md`

## LFAA-v0.0.36 Release

### 状态

```text
delivered
```

### 任务

```text
#10.2 GitHub 推送预检容错
#21.8 三向吸附与显式重新展开
```

### 主要变化

- GitHub 一键推送改为 fetch + rebase + safe push；
- 远程预检失败不再直接阻断真正的 push；
- 对网络 / 代理 / TLS、认证权限、non-fast-forward 给出分类提示；
- 已经 commit 但尚未 push 的本地提交可直接继续推送；
- 左右栏吸附后不能从 resize handle 反向拖开；
- 底部终端新增向下吸附收起；
- 左 / 右 / 底部均通过显式入口重新展开。

### 实机验证重点

```text
LFAA-GitHub.bat
→ 1 一键推送
```

在工作区无新文件变化、但本地存在未推送 commit 时，应继续执行远端同步与 push。

Web 工作台：

```text
左 / 右 / 底部拖到阈值 → 吸附收起
收起后拖拽分隔条 → 不展开
点击对应边缘 / 底部入口 → 展开
```

> 迁移来源：`docs/releases/v0.0.35/RELEASE.md`

## LFAA-v0.0.35 Release

### 状态

```text
delivered
```

### 任务

```text
#19.10 Rustup Windows Target 缺失修复
```

### 主要变化

- 恢复 `Get-WindowsRustupTarget`；
- x64 Windows 使用 `x86_64-pc-windows-msvc`；
- ARM64 Windows 使用 `aarch64-pc-windows-msvc`；
- 32 位 x86 Windows 使用 `i686-pc-windows-msvc`；
- 未知架构不猜测，直接中文失败；
- 官方 SHA-256 校验保持。

### 实机验证重点

```text
LFAA-Setup.bat
→ 1 一键依赖
```

新机器 Rust 未安装时，应先显示：

```text
【检测】【Rust 平台】 <target tuple>
```

然后进入 Rust 官方安装器下载与 SHA-256 校验。

> 迁移来源：`docs/releases/v0.0.34/RELEASE.md`

## LFAA-v0.0.34 Release

### 状态

```text
delivered
```

### 任务

```text
#19.9 node-pty Smoke Check 引号兼容
```

### 核心变化

- 修复 Windows PowerShell 5 下 `node -e` 参数引号丢失；
- node-pty 校验改为独立 `.mjs` 文件；
- 保留 node-pty 精确构建许可；
- 保留真实 `pty.spawn` 检查。

### 实机验证

```text
LFAA-Setup.bat
→ 1 一键依赖
```

正常应看到：

```text
【校验】【node-pty】 检测真实终端原生模块是否可加载。
【通过】【node-pty】 真实终端原生模块可用。
```

> 迁移来源：`docs/releases/v0.0.33/RELEASE.md`

## LFAA-v0.0.33 Release

### 状态

```text
delivered
```

### 任务

```text
#19.8 node-pty 跨机器安装
```

### 核心变化

- pnpm 精确批准 `node-pty@1.1.0` 的构建脚本；
- `strictDepBuilds` 继续开启；
- 禁止全部依赖构建许可；
- Setup 菜单 1 增加 node-pty Smoke Check。

### 实机验证重点

在没有旧 `node_modules` 的 Windows 机器：

```text
LFAA-Setup.bat → 1
```

不应再出现 `ERR_PNPM_IGNORED_BUILDS`。

> 迁移来源：`docs/releases/v0.0.32/RELEASE.md`

## LFAA-v0.0.32 Release

### 状态

```text
pending-test
```

### 任务

```text
#21.7 侧栏 Hover 与真实终端
```

### 已实现

- 侧栏自己的 Hover 控件；
- 分隔条与按钮彻底分离；
- 最底部 Terminal Dock；
- Terminal Dock 高度拖拽；
- xterm.js + node-pty 真实 PTY；
- Windows 默认 PowerShell；
- PTY 会话生命周期清理；
- localhost 开发安全边界。

### 未伪造通过

当前构建环境没有项目 pnpm/node_modules，无法真实安装 `node-pty` 并启动 Windows PTY。

因此本版本必须在用户 Windows 环境：

```text
Setup 1 → 安装新增依赖
Setup 2 → 启动 Web
```

完成实机测试后再将 #21.7 标记 deliverable。

> 迁移来源：`docs/releases/v0.0.31/RELEASE.md`

## LFAA-v0.0.31 Release

### 状态

```text
delivered
```

### 任务

```text
#21.6 三栏交互与终端停靠
```

### 主要变化

- 分隔条只负责拖拽与自动吸附；
- 顶部左上 / 右上提供淡入式控制按钮；
- 中间底部加入终端停靠区；
- 右侧“终端”工具联动底部终端；
- 侧栏收起 / 展开动画更平滑。

### 实机验证重点

```text
LFAA-Setup.bat
→ 2 启动 Web
```

重点确认：

- 左右分隔条拖拽；
- 顶部 hover 控件显隐；
- 左右栏开合；
- 底部终端开合；
- 视觉过渡是否足够丝滑。

> 迁移来源：`docs/releases/v0.0.30/RELEASE.md`

## LFAA-v0.0.30 Release

### 状态

```text
delivered
```

### 任务

```text
#19.7 Setup 主菜单循环
#21.5 Web 启动延迟修复
```

### 主要变化

- Web 端口检测由“逐端口网络超时”改为“读取实际 TCP Listener”；
- 菜单 2 不再隐式安装依赖；
- 直接运行项目本地 Vite；
- Setup 普通操作全部返回主菜单；
- 只有 `0` 退出。

### 实机验证重点

```text
LFAA-Setup.bat
→ 2 启动 Web
```

应明显恢复为快速启动。

按 `Ctrl+C` 停止 Web 后，应回到主菜单。

> 迁移来源：`docs/releases/v0.0.29/RELEASE.md`

## LFAA-v0.0.29 Release

### 状态

```text
delivered
```

### 任务

```text
#19 一键准备与依赖检测
最新变更：#19.6
```

### 核心变化

LFAA 正式固定为：

```text
电脑基础工具
→ 一次安装，多项目复用

项目依赖与构建内容
→ 跟项目走
```

Setup 菜单 1 只负责“准备好开发环境”，不再让普通用户选择安装模式。

Rust 缺失时直接使用 Rust 官方安装器，并保留 SHA-256 校验。

### Web

v0.0.28 的 Web 端口自动复用 / 自动换端口逻辑继续保留。

> 迁移来源：`docs/releases/v0.0.28/RELEASE.md`

## LFAA-v0.0.28 Release

### 状态

`delivered`

### 任务

- #19.5 Rust 工具链分层
- #21.4 Web 端口复用

### 关键变化

- `rust-toolchain.toml` 锁定 Rust 1.98.1；
- Rust toolchain 共享安装，不复制到每个项目；
- Cargo/Rustup Home 可放非系统盘；
- Web 5173 冲突自动复用/换端口。

> 迁移来源：`docs/releases/v0.0.27/RELEASE.md`

## LFAA-v0.0.27 Release

### 状态

```text
delivered
```

### 任务

```text
#21 Web 工作台 UI
最新变更：#21.3
```

### 核心变化

- 侧栏 `min` 即自动吸附边界；
- Pointer Move 到 min 直接收起；
- 不再等待 Pointer Up；
- 删除独立 96px snapThreshold；
- 24px 迟滞防止边界抖动；
- 约 150ms 自动吸附动画。

### 待验证

Windows 实机重点验证左右侧栏到最小宽度时的吸附手感，以及反向拖回是否自然。

> 迁移来源：`docs/releases/v0.0.26/RELEASE.md`

## LFAA-v0.0.26 Release

### 状态

```text
not-delivered
```

### 任务

```text
#21 Web 工作台 UI
最新变更：#21.2
```

### 核心变化

- Codex / ChatGPT 类黑白灰视觉；
- 浅色 / 深色；
- 动态侧栏最大宽度；
- 更平滑的吸附收起；
- `AgentWorkbench` 新命名。

### 说明

源码和静态检查完成后仍需 Windows 浏览器实机验证，因此本版 UI 任务保持 `in-progress`，不标记为 delivered。

> 迁移来源：`docs/releases/v0.0.25/RELEASE.md`

## LFAA-v0.0.25 Release

### 状态

```text
delivered
```

### 任务

```text
#19 一键准备与依赖检测
最新变更：#19.4
```

### 核心变化

- 自定义 `CARGO_HOME` 检测；
- WinGet 返回码中文语义化；
- WinGet 后重新检测；
- Rust 官方英文输出保留；
- 官方 rustup-init + SHA-256 安全链保持。

### 当前结果

用户 Windows 实机已经成功得到 Cargo / rustc。

本版重点是优化后续重复安装与新机器首次安装体验。

> 迁移来源：`docs/releases/v0.0.24/RELEASE.md`

## LFAA-v0.0.24 Release

### 状态

```text
delivered
```

### 核心变化

统一 Windows 开发入口：

```text
LFAA-Setup.bat
```

菜单：

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

重复 Web 启动器已删除。

### 当前限制

Web 工作台仍为 `in-progress`，真实 Vite build / 浏览器交互需要用户 Windows 环境验证。

Desktop Electron 尚未实现，因此 Desktop 相关菜单会真实阻止，而不是伪装成功。

> 迁移来源：`docs/releases/v0.0.23/RELEASE.md`

## LFAA-v0.0.23 Release

### 状态

```text
in-progress
```

### 用途

Web UI 开发预览，用于本地 Vite 三栏布局和 `.lfaa` 热插拔验证。

### 已完成

- 三栏工作台源码；
- 水墨主题；
- Resizable / Collapse；
- Vite 开发桥接；
- 文档与日志。

### 待实机

```text
pnpm install
pnpm run typecheck:web
pnpm run build:web
pnpm run dev:web
```

完成后再把 #21 状态推进到 testing / deliverable。

> 迁移来源：`docs/releases/v0.0.22/RELEASE.md`

## LFAA-v0.0.22 Release

### 状态

```text
delivered
```

### 任务

```text
#19 一键准备与依赖检测
最新变更：#19.1
```

### 核心变化

- Node / pnpm 真实检测；
- Node 依赖声明统计；
- Rust winget + 官方 rustup 双路径安装；
- Rustup 官方 SHA-256 校验；
- 部分完成状态不再伪装成全部成功。

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.21/RELEASE.md`

## LFAA-v0.0.21 Release

### 状态

```text
delivered
```

### 任务

```text
#10 GitHub 推送确认交互
最新变更：#10.1
```

### 变化

GitHub 一键推送不再在 Commit 后询问：

```text
【确认】【推送远程仓库】输入 Y 确认
```

选择“一键推送”并输入 Commit 名称后直接 Push。

origin 新增/修改确认仍保留。

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.20/RELEASE.md`

## LFAA-v0.0.20 Release

### 状态

```text
delivered
```

### 任务

```text
#20 开发日志与文档规范
最新变更：#20.2
```

### 核心变化

- 编号类人类文档使用中文短名；
- docs 新增总入口；
- Development Log 与 Runtime Log 分开；
- docs 结构新增自动检查；
- 原历史不删除。

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.19/RELEASE.md`

## LFAA-v0.0.19 Release

### 状态

```text
delivered
```

### 变更

```text
#20 开发日志分层规范
最新变更：#20.1
```

Development Log 现在直接覆盖真实主编号：

```text
#1 - #20
```

其中：

- #2、#20：active；
- #1、#3 - #19：archive；
- #20.0：superseded 历史快照。

原历史文件不删除。

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.18/RELEASE.md`

## LFAA-v0.0.18 Release

### 状态

```text
delivered
```

### 主要变化

```text
Development Log
├── INDEX.md
├── active/
└── archive/
```

开发要求正式固定：

```text
DEVELOPMENT
→ Development Log INDEX
→ relevant active log
→ Architecture / Plan / Progress / Prompt / Standards
→ Code
```

### 当前开发日志

```text
#20 开发日志分层规范
最新变更：#20.0
```

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.17/RELEASE.md`

## LFAA-v0.0.17 Release

### 类型

Developer Bootstrap / Project Resource Architecture

### 状态

```text
delivered
```

### 核心变化

- Setup `1`：一键准备 Node + Rust 开发依赖；
- `.lfaa/`：唯一项目级热插拔资源根；
- 移除根 `/skills` 和 `/plugins` 双重资源目录。

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.16/RELEASE.md`

## LFAA-v0.0.16 Release

### 类型

Developer Workflow / Setup Bug Fix

### 状态

```text
delivered
```

### 修复

`LFAA-Setup.bat` 菜单 `1` 现在允许在未安装 Cargo 的机器上完成 Node/pnpm 依赖安装，并安全跳过 Rust 依赖。

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.15/RELEASE.md`

## LFAA-v0.0.15 Release

### 状态

```text
delivered
```

### 包含

- #16 项目治理、归属与项目级资源边界加固
- #17 pnpm-only 一致性修复

### Node.js 包管理器

唯一允许：

```text
pnpm
```

### 下一步

```text
config-system → config-schema
```

> 迁移来源：`docs/releases/v0.0.14/RELEASE.md`

## LFAA-v0.0.14 Release

### 类型

Developer Workflow / Source Update Bug Fix

### 状态

```text
delivered
```

### 修复

`LFAA-Update` 在 ahead=0 / behind=0 时现在会直接判定“已是最新”，
不会继续执行无意义的远程文件 diff。

> 迁移来源：`docs/releases/v0.0.13/RELEASE.md`

## LFAA-v0.0.13 Release

### 类型

Developer Workflow / Sync Menu UX

### 状态

```text
delivered
```

### 变化

同步菜单现在优先显示：

```text
1 执行同步
2 预览差异
3 同步配置
0 退出
```

> 迁移来源：`docs/releases/v0.0.12/RELEASE.md`

## LFAA-v0.0.12 Release

### 类型

Developer Workflow / Path Independent Git Update

### 状态

```text
delivered
```

### 变化

`LFAA-Update.bat` 现在根据实际 Git 仓库位置工作，不依赖任何固定盘符或固定目录名称。

> 迁移来源：`docs/releases/v0.0.11/RELEASE.md`

## LFAA-v0.0.11 Release

### 类型

Developer Workflow / Windows Menu UX

### 状态

```text
delivered
```

### 主要变化

三个 Windows 工具统一改为数字菜单。

`LFAA-Update.bat` 同时新增带自动恢复点的“强制拉取”模式。

> 迁移来源：`docs/releases/v0.0.10/RELEASE.md`

## LFAA-v0.0.10 Release

### 类型

Developer Workflow / Git Source Update

### 状态

```text
delivered
```

### 新增

```text
LFAA-Update.bat
scripts/windows/lfaa-update.ps1
docs/logs/source-update/README.md
```

### 作用

已经 Git Clone 的仓库以后可直接一键更新远程最新源码，无需重复 Clone。

默认采用安全 fast-forward 更新策略。

> 迁移来源：`docs/releases/v0.0.9/RELEASE.md`

## LFAA-v0.0.9 Release

### 类型

Developer Workflow / Git Commit UX

### 状态

```text
delivered
```

### 变化

Commit 名称输入完成后直接创建本地 Commit，不再二次确认。

Push 前确认仍然保留。

> 迁移来源：`docs/releases/v0.0.8/RELEASE.md`

## LFAA-v0.0.8 Release

### 类型

Developer Workflow / Terminal UX

### 状态

```text
delivered
```

### 变化

同步和 GitHub 推送在成功/失败结束时，都会明确告诉用户当前流程已经结束，以及终端是否可以关闭。

成功结束后可：

- 按任意键关闭；
- 直接点击右上角 X。

> 迁移来源：`docs/releases/v0.0.7/RELEASE.md`

## LFAA-v0.0.7 Release

### 类型

Developer Workflow / Git Origin Configuration

### 状态

```text
delivered
```

### 变化

远程 Git 仓库地址不再硬编码。

首次运行由用户输入并保存至：

```text
.git/config
```

以后自动复用。

> 迁移来源：`docs/releases/v0.0.6/RELEASE.md`

## LFAA-v0.0.6 Release

### 类型

Developer Workflow / GitHub Push Reliability

### 状态

```text
delivered
```

### 修复

- 首次没有 `origin` 时不再错误退出；
- 已初始化但没有 `origin` 的工作区可以自动恢复；
- Git 原始英文输出默认隐藏；
- 控制台流程改为中文；
- Commit 名称继续由用户自定义；
- Git 中文文件路径改善。

> 迁移来源：`docs/releases/v0.0.5/RELEASE.md`

## LFAA-v0.0.5 Release

### 类型

Developer Workflow / GitHub Push Fix

### 状态

```text
delivered
```

### 关键修复

修复 Windows PowerShell Git helper 首次初始化失败。

Commit 名称现在完全由用户手工输入，不再固定 `first commit` 或自动提交名。

### GitHub

官方仓库：

```text
https://github.com/yubboo/LFAA.git
```

> 迁移来源：`docs/releases/v0.0.4/RELEASE.md`

## LFAA-v0.0.4 Release

### 类型

Developer Workflow / Documentation Trace

### 状态

```text
delivered
```

### 变化

同步日志现位于：

```text
docs/logs/workspace-sync/
```

不再使用：

```text
.lfaa-local/sync-logs/
```

运行日志默认不提交 GitHub，但保留在稳定工作区，便于开发排查。

> 迁移来源：`docs/releases/v0.0.3/RELEASE.md`

## LFAA-v0.0.3 Release

### 类型

Project Foundation / Developer Workflow

### 状态

```text
delivered
```

### 新增

```text
LFAA-Sync.bat
LFAA-GitHub.bat
scripts/windows/lfaa-sync.ps1
scripts/windows/lfaa-github.ps1
docs/standards/WORKSPACE_SYNC.md
```

### 稳定工作区

```text
H:\lfaa\lfaa
```

### 注意

PowerShell 脚本使用 UTF-8 BOM，并主动切换控制台 UTF-8，以降低 Windows PowerShell 中文乱码概率。

本版本仍未进入 `config-system` 真实业务实现。

> 迁移来源：`docs/releases/v0.0.2/RELEASE.md`

## LFAA-v0.0.2 Release

### 类型

Project Foundation Optimization

### 状态

```text
delivered
```

### 主要变化

- `@/` 当前 workspace Alias
- `@lfaa/*` workspace package 导入规则
- 深层相对导入自动检查
- 跨 package internal 访问限制
- TS workspace tsconfig 边界

### 主业务模块

仍然是：

```text
config-system
```

本版本没有提前实现配置系统业务。

> 迁移来源：`docs/releases/v0.0.1/RELEASE.md`

## LFAA-v0.0.1 Release

### 类型

Architecture / Governance Skeleton

### 状态

```text
delivered
```

### 内容

本包建立项目骨架与开发治理，不宣称已经具备完整 AI Agent 产品功能。

### 下一阶段

`config-system`
