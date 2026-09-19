# LFAA 开发 Prompt 时间线

> 这是唯一 Prompt 记录文件。新任务不再创建独立 Prompt Markdown；在本文件顶部的“当前任务”区域新增 `#编号 + 功能名称` 条目。
> 历史记录只追加、不删除；任务完成后只修改状态，不移动文件。

## 开发合同生命周期

```text
用户需求
→ 分配 #NN.x 编号 + 功能名称
→ 先写本文件 Prompt 条目
→ 明确允许/禁止修改、验收条件、必须测试
→ 再改代码
→ AI 自测 / 门禁 / 实机可做验证
→ 状态 = pending-user-acceptance
→ 打包交给用户
→ 用户验收
   ├─ 不通过：新子编号 + 新 Prompt + 新版本
   └─ 通过：状态改为 delivered
```

用户未明确验收前，禁止把任务写成 `delivered`。

## 当前任务索引

| 任务 | 功能名称 | 版本 | 状态 | AI 验证 | 用户验收 |
|---|---|---|---|---|---|
| #20.15 | pnpm CMD 原生终端输出与菜单精简 | v0.0.61 | pending-user-acceptance | pass | pending |
| #20.14 | pnpm 原生安装输出恢复 | v0.0.60 | superseded | pass | not-accepted |
| #20.13 | 开发期依赖同步与实时输出修复 | v0.0.59 | superseded | pass | not-accepted |
| #20.12 | PowerShell 自动变量冲突修复 | v0.0.58 | superseded | pass | not-accepted |
| #20.11 | pnpm 实时环境事实与 Store 来源修复 | v0.0.57 | superseded | pass | not-accepted |
| #20.10 | 真实依赖健康检测与 Store 状态修复 | v0.0.56 | superseded | pass | not-accepted |
| #20.9 | 依赖提示去重与路径可见性 | v0.0.55 | delivered | pass | passed |
| #20.8 | 按需依赖增量检测与复用 | v0.0.54 | superseded | pass | not-accepted |
| #20.7 | Setup 菜单与发布门禁解耦 | v0.0.53 | superseded | pass | not-accepted |
| #20.6 | 发布环境与质量门禁闭环 | v0.0.52 | superseded | pass | not-accepted |
| #2.2 | Config Schema 基线 | v0.0.51 | pending-user-acceptance | pass | pending |
| #20.5 | 文档体系单文件时间线重构 | v0.0.50 | pending-user-acceptance | pass | pending |

## 当前任务 / 当前合同

## #20.15 pnpm CMD 原生终端输出与菜单精简

### 主模块

`project-governance / windows-setup / dependency-sync-ux`

### 背景与问题

用户在 Windows 实机验证 v0.0.60：依赖真实检测、Store 动态路径、frozen/no-frozen 分流均能继续执行，但菜单 1 内调用 pnpm 后仍看不到用户在 CMD 直接执行 `pnpm install` 时的原生 Scope / Progress / Packages / reused / downloaded / added 输出。同时菜单 1 累积了过多中文说明、实现细节和重复状态，影响可读性。

### 任务目标

Windows 交互式 pnpm 写操作优先使用与 CMD 相同的 `pnpm.cmd` 执行链，并保留原生控制台输出。菜单 1 收敛为“关键环境 + 关键路径 + 简短状态 + 必要确认 + 原生命令输出 + 最终结果”，详细环境事实继续由菜单 7 提供。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的交互式 pnpm runner 与菜单 1 输出；
- `test/dependency-setup.test.mjs` 的 `pnpm.cmd` 与精简输出防回归；
- 当前 Runtime / Testing / Prompt / Log / Plan / CHANGELOG / Release；
- v0.0.61 产品版本事实及 workspace package / Rust crate 产品版本一致性。

### 禁止修改

- #20.13 的 lockfile 落后 `--no-frozen-lockfile` / 本地修复 `--frozen-lockfile` 分流；
- 正式发布 `release:full` frozen 语义；
- pnpm Store 动态路径、Store 来源、PNPM_HOME、真实依赖/Store 健康检查；
- Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update。

### 实现约束

- Windows 交互式 pnpm 写操作优先发现并校验 `pnpm.cmd`，版本必须与项目 `packageManager` 一致；不存在时才回退现有 runner；
- 安装过程不得捕获、重定向或模拟 pnpm stdout/stderr；
- 菜单 1 默认只显示 Node/pnpm/Rust 版本、node_modules / pnpm Store / Cargo / Rust toolchains 四类关键路径、依赖状态摘要与必要确认；
- PNPM_HOME、全局配置、lockfile、状态缓存、Store 来源等详细信息保留在菜单 7，异常时菜单 1 可按需显示；
- 不打印前五个新增/缺失依赖等大段明细，安装细节交给 pnpm 原生输出；
- 不新增“假进度条”。

### 验收条件

- 在 Windows 菜单 1 需要安装时，确认后出现与 CMD 直接 `pnpm install` 同类的 pnpm 原生 Scope / Progress / Packages / Done 输出；
- 正常无变化时菜单 1 输出显著短于 v0.0.60；
- 用户仍能直接看到 Node 依赖、pnpm Store、Cargo 缓存、Rust 工具链的真实位置；
- 菜单 7 继续提供完整环境详情；
- 二次运行无变化时不重复安装。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`：静态契约锁定 Windows 交互式 pnpm 优先 `pnpm.cmd`、禁止捕获安装输出，并验证菜单 1 精简而菜单 7 保留完整路径事实。Windows 原生 pnpm TTY 仍以用户实机为最终验收。

## #20.14 pnpm 原生安装输出恢复

> **状态补充：** Windows 实机确认 v0.0.60 仍未呈现与 CMD 直接执行一致的 pnpm 原生进度，且菜单提示过多；由 #20.15 / v0.0.61 继续修正。

### 主模块

`project-governance / windows-setup / dependency-sync-ux`

### 背景与问题

用户在 Windows 实机运行 v0.0.59 菜单 1，开发期 lockfile 同步模式已经正确切换为 `--no-frozen-lockfile`，但确认后仍只看到 LFAA 的“执行命令”提示，pnpm 自身的 Scope / Progress / reused / downloaded / added 等原生安装信息没有出现。检查实现确认 v0.0.59 为了“稳定逐行输出”强制增加了 `--reporter=append-only`，这改变了原生终端 reporter 行为，并未满足用户对真实安装过程可见性的要求。

### 任务目标

撤销菜单 1 对 pnpm reporter 的强制控制。开发期同步仍保持 #20.13 的 frozen / no-frozen 分流，但 `pnpm install` 必须以前台原生命令运行，stdout/stderr 不捕获、不重写、不伪造。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的交互式 pnpm install 参数与日志说明；
- `test/dependency-setup.test.mjs` 的原生前台输出防回归；
- 当前治理/Runtime/Testing/Prompt/Log/Plan/CHANGELOG/Release；
- v0.0.60 产品版本事实及 workspace package / Rust crate 产品版本一致性。

### 禁止修改

- #20.13 已确定的 lockfile 落后 `--no-frozen-lockfile` 与本地损坏 `--frozen-lockfile` 分流；
- 正式发布 `release:full` frozen 语义；
- pnpm Store 动态路径、PNPM_HOME、Store 来源、真实依赖/Store 健康检查；
- Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update。

### 实现约束

- 菜单 1 的交互式 `pnpm install` 不传 `--reporter=*`；
- `Invoke-Pnpm -> Invoke-ProjectCommand` 必须前台直接调用当前 pnpm runner；
- 安装 stdout/stderr 不进入 `Invoke-PnpmCapture`、不重定向到文件/Null、不由 LFAA 模拟进度；
- LFAA 可以在安装前显示执行原因/命令，在安装后显示结果，但中间日志归 pnpm 自身；
- 正式发布与非交互探针可以保持各自原有行为，本任务不扩散到其他命令。

### 验收条件

- 当前 v0.0.59 同一场景确认 Y 后，立即进入 pnpm 原生前台安装输出；
- lockfile 落后时仍允许更新 `pnpm-lock.yaml`；
- lockfile 已完整的修复仍 frozen；
- 同步结束后二次运行菜单 1 不重复安装；
- 发布 frozen、Store/环境事实与业务代码无回归。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`：静态契约确认交互式 install 不再包含任何 `--reporter=*`，并继续通过 dependency setup、真实依赖健康、发布分层/环境、Config Schema 与仓库治理门禁。Windows 原生 pnpm UI 仍以用户实机为最终验收。

## #20.13 开发期依赖同步与实时输出修复

> **状态补充：** Windows 实机确认强制 append-only reporter 仍缺少原生安装信息，本任务由 #20.14 / v0.0.60 继续修正。

### 主模块

`project-governance / windows-setup / dependency-sync`

### 背景与问题

用户在 Windows 实机运行 v0.0.58 菜单 1，脚本已经正确发现 `pnpm-lock.yaml` 尚未覆盖当前外部依赖，但随后却调用 `pnpm install --frozen-lockfile`。该组合逻辑矛盾：开发期声明发生变化时需要允许 pnpm 更新 lockfile，而 frozen 模式明确禁止修改 lockfile。用户确认写操作后界面只停留在“按当前 workspace 与 lockfile 增量同步 pnpm 依赖”，缺少稳定的实时 pnpm 输出，也无法判断正在解析、下载、执行安装脚本还是已经失败。

### 任务目标

把“开发期同步”和“发布期 frozen 校验”彻底分离：lockfile 落后时菜单 1 使用可更新 lockfile 的本地同步；lockfile 已完整但本地安装损坏时继续使用 frozen 精确修复。所有 pnpm 写操作必须以稳定逐行 reporter 直接透传进度，不能出现无输出假卡死。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的 Node 依赖同步分支与实时输出；
- `test/dependency-setup.test.mjs` 的模式选择与 reporter 防回归；
- 当前治理/Runtime/Testing/Prompt/Log/Plan/CHANGELOG/Release；
- v0.0.59 产品版本事实及 workspace package / Rust crate 产品版本一致性。

### 禁止修改

- 正式发布 `release:full` 的 `pnpm install --frozen-lockfile`；
- pnpm Store 动态路径、PNPM_HOME、Store 来源与真实健康检查；
- Web Account/Auth、Config Schema/Storage、Web UI、PTY、Sync/GitHub/Update。

### 实现约束

- `LockCoverage.Complete = false` 时，本地菜单 1 使用 `pnpm install --no-frozen-lockfile`，允许只为当前声明同步 lockfile；
- lockfile 已覆盖声明但 node_modules / 真实解析损坏时使用 `pnpm install --frozen-lockfile`，不得无故改 lockfile；
- 两种路径都追加稳定逐行 reporter，实时显示解析/复用/下载/安装输出；
- 菜单 1 不执行 `pnpm update`、不清空 node_modules / Store；
- 发布门禁继续 frozen，不因本任务放宽。

### 验收条件

- 当前 v0.0.58 所示“lockfile 未覆盖外部依赖”场景不再调用 frozen install；
- 用户确认后立即出现真实 pnpm 输出，不再只停在一行执行提示；
- 同步完成后 lockfile 覆盖、真实 resolve 与 Store 检查重新通过；
- lockfile 已完整但本地缺包时仍走 frozen 精确修复；
- 正式发布 frozen 语义不变。

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass` — dependency-setup 17/17、node-dependency-health 3/3、release-gates 5/5、release-environment 8/8、Config Schema 8/8 与版本/Windows BOM 门禁 PASS。

### 用户验收

`pending`

## #20.12 PowerShell 自动变量冲突修复

### 主模块

`project-governance / windows-setup / powershell-runtime-safety`

### 背景与问题

用户在 Windows 实机运行 v0.0.57 菜单 1 时，脚本在 PNPM_HOME/PATH 实时检测阶段报错“无法覆盖变量 HOME，因为该变量为只读变量或常量”。根因是 `Test-PnpmHomeInPath` 将普通局部变量命名为 `$home`；PowerShell 变量名不区分大小写，因此它与自动只读变量 `$HOME` 冲突。v0.0.57 的 pnpm 实时事实设计本身继续保留，但该实现错误导致菜单 1 无法进入后续检测。

### 任务目标

修复 `$HOME` 冲突，并把 PowerShell 自动/保留变量赋值纳入静态防回归；菜单 1 / 7 必须能正常进入 PNPM_HOME、active Store、Store 来源与真实依赖健康检测。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 中冲突局部变量命名；
- `test/dependency-setup.test.mjs` 的 PowerShell 自动变量防回归；
- `scripts/dev-log-check.mjs` 当前治理任务契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.58 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 产品版本一致性。

### 禁止修改

- v0.0.57 已建立的 pnpm Store 实时路径、配置来源、真实依赖健康语义；
- Web Account/Auth、Config Storage、Config Schema 业务语义；
- Web UI、PTY、Sync / GitHub / Update；
- 自动改变用户 pnpm Store、自动 `pnpm update`、删除 `node_modules` / Store。

### 状态所有权

- PowerShell 用户主目录：系统自动变量 `$HOME`，脚本只读，不得覆盖；
- PNPM_HOME 归当前进程环境变量所有；
- pnpm Store 继续以每次实时 `pnpm store path` 为最终事实；
- `.lfaa/state` 继续只作为依赖同步缓存，不拥有机器环境事实。

### 实现约束

- `Test-PnpmHomeInPath` 不得声明/赋值 `$home`，改用不会与 PowerShell 自动变量冲突的语义化局部变量；
- Windows PowerShell 脚本新增静态防回归：不得把 `$HOME`、`$PID`、`$Host`、`$Error`、`$PSHOME`、`$PWD`、`$LASTEXITCODE` 等自动/只读变量当普通赋值目标；
- 不改变 #20.11 的 pnpm 实时探测决策；
- PowerShell 文件继续保持 UTF-8 with BOM。

### 验收条件

- Windows 实机运行菜单 1 不再出现“无法覆盖变量 HOME”；
- 能继续显示 PNPM_HOME、pnpm Store 与 Store 来源；
- `pnpm store path` 与菜单显示的 Store 一致；
- 原真实依赖 / Store 健康检测继续执行；
- 自动变量防回归测试可捕获再次出现的 `$home = ...` 等冲突赋值。

### 必须测试

- dependency-setup 全部回归，并新增自动变量冲突测试；
- node-dependency-health、release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.12 PowerShell 自动变量冲突修复`

### 版本目标

`v0.0.58`

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass` — dependency-setup 15/15、node-dependency-health 3/3、release-gates 5/5、release-environment 8/8、Config Schema 8/8、Config System TypeScript `--noEmit` 与治理链 PASS。

### 用户验收

`pending`

## #20.11 pnpm 实时环境事实与 Store 来源修复

### 主模块

`project-governance / windows-setup / pnpm-environment-facts`

### 背景与问题

用户确认 v0.0.56 之后又发现环境事实边界仍需收紧：旧机器曾把 pnpm Store 全局配置到 `H:\next-javaweb\.pnpm-store`，执行 `pnpm setup` 并删除全局 `storeDir` 后，`pnpm store path` 立即恢复到当前 Windows 用户的默认 Store。LFAA 必须把“当前 pnpm 实时返回值”作为唯一有效 Store 路径，不能把历史缓存、旧项目目录或上一次检测结果当作下一次运行的环境真相。

### 任务目标

让菜单 1 / 7 每次运行都重新探测 Node、pnpm、PNPM_HOME、PATH、pnpm Store 与配置来源；Store 路径和来源变化必须立即反映。默认策略为尊重 pnpm 当前用户级环境，不为 LFAA 自动写入项目级 `storeDir`，也不擅自修改用户全局 Store。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的 pnpm 实时环境事实读取、Store 来源识别、路径展示与健康检查；
- `test/dependency-setup.test.mjs`、`scripts/release-gates-check.mjs` 的静态防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.57 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Web Account/Auth、Config Storage、Config Schema 业务语义；
- Web UI、PTY、Sync / GitHub / Update；
- 自动改写用户全局 `storeDir`、自动迁移 pnpm Store、自动创建项目级 Store；
- 把 `.lfaa/state/dependency-state.json` 中的历史 Store 路径当作实时事实；
- 自动 `pnpm update`、清空 Store、删除 `node_modules`。

### 状态所有权

- pnpm 可执行文件：当前 shell `Get-Command pnpm` / Corepack 实际 runner；
- PNPM_HOME：当前进程环境变量与 PATH 实际状态；
- pnpm Store：每次从当前项目根运行 `pnpm store path` 获得；
- Store 配置来源：当前项目 `pnpm-workspace.yaml`、pnpm 全局 `config.yaml` 与当前环境覆盖共同判断；
- 项目依赖健康：v0.0.56 的真实 Node resolve / 原生模块加载 / Store lockfile 探针；
- `.lfaa/state`：只允许记录最近成功同步状态，不得覆盖上述实时环境事实。

### 实现约束

- `Get-PnpmStorePath` 每次调用都必须真实执行当前 pnpm runner，且工作目录固定为 `$ProjectRoot`；禁止读取状态缓存返回旧路径；
- 新增 pnpm 环境事实对象时必须至少包含 `PNPM_HOME`、pnpm 可执行源、Store 当前路径、全局配置文件、全局 `storeDir`、项目 `storeDir`、Store 来源；
- LFAA 仓库自己的 `pnpm-workspace.yaml` 不得声明 `storeDir`；默认采用 pnpm 用户/机器环境当前结果；
- 若项目级存在 `storeDir`，必须明确显示“项目配置”；若全局存在则显示“用户全局配置”；二者均无显式值时显示“pnpm 默认”；
- 环境变量覆盖无法可靠归因时显示“环境/其他覆盖”，但仍以 `pnpm store path` 为最终路径；
- `pnpm setup` 只在 PNPM_HOME / PATH 缺失且确有需要时提示/执行，已就绪时不得重复 setup；
- PowerShell 保持 UTF-8 with BOM。

### 验收条件

- 用户从旧全局 Store 配置切回默认后，菜单 1 立即显示新的 `C:\Users\<用户>\AppData\Local\pnpm\store\v11`（实际路径以本机 `pnpm store path` 为准），不得继续显示旧 `H:\next-javaweb...`；
- 菜单 1 / 7 显示 Store 来源为项目配置 / 用户全局配置 / pnpm 默认 / 环境或其他覆盖之一；
- 修改全局 `storeDir` 后无需删除 `.lfaa/state`，下次运行即显示新路径；
- 项目仓库中没有 LFAA 强加的 `storeDir`；
- v0.0.56 的真实依赖健康与 Store 缺失检测继续生效。

### 必须测试

- dependency-setup 原有测试全部回归；
- 新增“Store 路径每次调用 pnpm 获取、不读缓存”“Store 来源识别”“仓库不声明项目 storeDir”“PNPM_HOME/PATH 只读显示”静态契约；
- node-dependency-health、release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.11 pnpm 实时环境事实与 Store 来源修复`

### 版本目标

`v0.0.57`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

### 被后续修正

Windows 实机发现局部变量 `$home` 与 PowerShell 自动只读变量 `$HOME` 冲突；由 #20.12 / v0.0.58 修复实现错误，#20.11 的实时 Store 设计继续保留。

## #20.10 真实依赖健康检测与 Store 状态修复

### 主模块

`project-governance / windows-setup / dependency-health`

### 背景与问题

用户在 Windows 实机中删除 `pnpm store path` 指向的 Store 后再次运行菜单 1，v0.0.55 仍显示“依赖声明、锁文件和本地安装状态均未变化；跳过 pnpm install”，最终还显示“当前依赖均已就绪”。根因是旧实现只检查依赖指纹、`node_modules/.modules.yaml` 和直接依赖 `package.json`，没有把真实 Node 解析/关键运行时可用性和 pnpm Store 健康拆开验证。

### 任务目标

把菜单 1 从“文件存在性检查”升级为真实依赖健康检查：依赖声明、项目真实可解析性、pnpm Store 缓存三层事实独立检测和展示。缓存指纹只能用于判断“声明是否变化”，不得再作为“本机依赖真实可用”的证据。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的 Node 依赖计划、Store 健康、修复提示与 unchanged 路径真实验证；
- 新增跨平台只读项目级依赖健康检查脚本与对应 Node 单测；
- `test/dependency-setup.test.mjs`、`scripts/release-gates-check.mjs` 的防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.56 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Web Account/Auth、Config Storage、Config Schema 业务语义；
- Web UI、PTY 业务功能、Sync / GitHub / Update；
- Agent / Tool / Policy / Permission 执行链；
- 自动 `pnpm update`、自动删除 `node_modules` / pnpm Store、静默升级锁定版本；
- 把 pnpm Store 缺失错误描述成“项目一定无法运行”。

### 状态所有权

- 依赖声明真相：workspace `package.json`、`pnpm-lock.yaml`、`pnpm-workspace.yaml`；
- 项目当前真实可用性：当前项目目录中的真实 Node 模块解析、关键入口和原生模块加载结果；
- pnpm Store 状态：运行时 `pnpm store path` 指向的真实目录与 pnpm Store 检查结果；
- `.lfaa/state/dependency-state.json` 仍仅为最近成功同步的缓存，不得决定依赖健康。

### 实现约束

- `Test-NodeDependencyInstallState` 的 manifest 检查只能作为浅层证据，跳过安装前必须额外通过真实依赖解析检查；
- 新增跨平台依赖健康检查时，必须从各 workspace 的真实 importer 位置解析外部依赖，不能只搜索字符串或读取旧状态缓存；
- `node-pty` 等原生关键模块在 unchanged 路径也必须执行既有真实加载检查，不能只在安装后检查；
- pnpm Store 必须区分“路径不存在/为空/状态异常”和“健康”；Store 缺失时必须明确提示；
- Store 缺失但项目实际解析仍通过时，显示“项目当前可用，但 Store 缓存缺失/不完整”，不得声称“全部依赖均已就绪”；
- 用户选择修复 Store 时，只按当前 lockfile 补齐缺失缓存，优先使用 pnpm 的 lockfile fetch 能力；不得 `pnpm update`；
- 项目真实解析失败时进入依赖同步分支；同步完成后必须再次执行真实解析和 Store 状态检查再写成功缓存；
- PowerShell 保持 UTF-8 with BOM。

### 验收条件

- 删除 `pnpm store path` 指向的 Store 后运行菜单 1，必须检测到 Store 缺失/为空，不得输出“当前依赖均已就绪”；
- 如果 node_modules 仍真实可解析，必须准确区分“项目当前可用”和“Store 缓存缺失”；
- 用户确认修复后，只恢复当前 lockfile 所需缓存，不升级依赖版本；
- 删除/损坏某个依赖的真实入口文件但保留其 `package.json` 时，真实健康检查必须失败，不能被 manifest 存在性骗过；
- unchanged + 项目真实解析通过 + Store 健康时，仍保持零安装快速返回；
- v0.0.55 的提示去重与路径展示保持。

### 必须测试

- 新增真实依赖健康检查单测：健康 fixture 通过；只保留 package.json 但删除真实入口时失败；
- dependency-setup 原 8 项全部回归，并增加 Store/真实解析门禁；
- release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.10 真实依赖健康检测与 Store 状态修复`

### 版本目标

`v0.0.56`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

## #20.9 依赖提示去重与路径可见性

### 主模块

`project-governance / windows-setup / dependency-ux`

### 任务目标

修正 v0.0.54 菜单 1 在“预检 → 检测 → 完成”之间重复输出 Node/pnpm/workspace 与 Node/Rust 完成状态的问题，并让用户能够直接看到项目依赖、pnpm Store、lockfile、Cargo 缓存和 Rust 工具链的实际位置。保持 #20.8 的增量安装语义不变：本任务只优化可读性与路径可见性，不改变何时安装依赖。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的菜单 1 / 菜单 7 输出组织、依赖路径探测与最终摘要；
- `test/dependency-setup.test.mjs`、`scripts/release-gates-check.mjs` 的防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.55 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- #20.8 已确定的依赖指纹、增量安装、Yes/No 同步语义；
- Config Schema / Config Storage、Web UI、PTY、Sync / GitHub / Update；
- Agent / Tool / Policy / Permission 执行链；
- Agent Protocol / Config Schema Version / Database Schema Version；
- 为显示路径而创建、删除或迁移真实依赖目录。

### 输出约束

- Node / pnpm / workspace 环境摘要只显示一次，禁止“预检”和“检测”重复打印同一事实；
- unchanged 路径保留一次 Node 依赖状态和一次 Rust/Cargo 状态，结尾只保留一个 `【完成】【按需依赖】` 总结；
- 菜单 1 与菜单 7必须显示：项目 `node_modules`、`node_modules/.pnpm`、真实 `pnpm store path`、`pnpm-lock.yaml`、`.lfaa/state/dependency-state.json`、Cargo registry/git 缓存、Rust toolchains、Cargo.lock 状态；
- `pnpm Store` 必须运行时读取，不能写死用户名、盘符或固定 AppData 路径；
- 路径展示只读，不允许触发 update/prune/删除缓存；
- PowerShell 保持 UTF-8 with BOM。

### 验收条件

- 用户再次执行菜单 1 时，不再连续看到两组 Node/pnpm/workspace；
- unchanged 情况结尾不再分别重复 `Node/pnpm 完成` 与 `Rust/Cargo 完成`；
- 用户能从菜单 1 直接知道 Node 依赖、pnpm Store、锁文件、Cargo 缓存和 Rust 工具链在哪里；
- 菜单 7 环境检查同样能显示上述路径；
- v0.0.54 的增量检测、零安装、Yes/No 与禁止自动升级行为全部保持。

### 必须测试

- 依赖增量原 6 项测试全部回归；
- 新增路径可见性与提示去重测试；
- release gates、release environment、Config Schema 回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.9 依赖提示去重与路径可见性`

### 版本目标

`v0.0.55`

### 当前状态

`delivered`

### AI 验证

`pass`

### 用户验收

`passed`

## #20.8 按需依赖增量检测与复用

### 主模块

`project-governance / windows-setup / dependency-state`

### 任务目标

修复 v0.0.53 菜单 1 每次执行都会再次调用依赖安装的问题。菜单 1 必须先判断“工具链是否可用、项目依赖声明/锁文件是否变化、本地直接依赖是否缺失”；如果状态未变化且依赖完整，直接返回“已就绪”，不得再次执行 `pnpm install` / Cargo 下载。只有首次准备、依赖新增/删除/版本变化、锁文件变化、依赖目录缺失或工具链损坏时，才进入写操作。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的菜单 1 依赖检测、状态缓存、增量同步与 Rust 工具链复用逻辑；
- `test/` 与 `scripts/release-gates-check.mjs` 中针对按需依赖的防回归契约；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.54 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Config Schema / Config Storage 业务语义；
- Web 工作台 UI、PTY / node-pty 业务实现；
- Sync / GitHub / Update 行为；
- Agent / Tool / Policy / Permission 执行链；
- Agent Protocol / Config Schema Version / Database Schema Version；
- 自动执行 `pnpm update`、自动追逐上游最新版本或删除 pnpm 全局 store。

### 状态所有权

依赖真相仍来自 `package.json` / workspace manifests / `pnpm-lock.yaml` / `Cargo.lock` / `rust-toolchain.toml`；`.lfaa/state/dependency-state.json` 只保存本机“最近一次成功同步”的指纹缓存，可随时删除并重新建立，不得反向覆盖依赖声明。该状态目录已被 `.gitignore` 忽略，不进入正式版本事实。

### 实现约束

- 菜单 1 先检测后决定，不允许无条件执行 `pnpm install`；
- Node 指纹只包含包管理器事实、依赖声明和 lockfile，不包含 LFAA 产品版本号，避免纯版本递增触发无意义安装；
- 指纹一致且直接依赖完整时，显示“依赖已就绪”，不运行安装命令；
- 指纹变化时必须区分新增 / 删除 / 版本变化 / lockfile 变化并展示摘要，再由用户 Y/Yes 确认是否同步；
- 同步完成后重新计算真实指纹并写入 `.lfaa/state/dependency-state.json`；
- `pnpm install` 只负责把当前项目声明同步到本地；不得自动执行 `pnpm update`；pnpm store 与现有 `node_modules` 必须复用，不主动清空；
- 项目新版本明确改变锁定依赖时属于该项目版本所需依赖，用户可以取消本次写操作，但必须提示取消后当前版本可能无法运行；
- “上游出现更高版本”不属于菜单 1 自动更新范围；未来如提供更新检查，必须是独立显式操作并由用户确认；
- Rust 已存在正确 toolchain + rustfmt + clippy 时不得重复 `rustup toolchain install`；无外部 crate 时不得执行 `cargo fetch`；有 `Cargo.lock` 时只有 lockfile 指纹变化或首次同步才 fetch；
- Windows 安装与状态逻辑继续由 PS1 负责，MJS 只做静态/跨平台测试。

### 安全约束

- 只允许 pnpm，不降级 npm / yarn / bun；
- 不自动删除 node_modules / pnpm store / Cargo cache；
- 不静默升级依赖版本；
- 本机状态文件不得包含 Token、API Key、Secret 或用户业务数据；
- 任何依赖写操作必须在变更摘要后由用户确认。

### 验收条件

- 连续两次运行菜单 1：第一次成功同步后，第二次在依赖未变化时不得再次调用 `pnpm install`；
- 仅产品版本从 v0.0.53 → v0.0.54、依赖声明与锁文件不变时，不应触发 Node 依赖重装；
- 新增依赖 / 改版本 / 删除依赖 / lockfile 变化时，菜单 1 能检测并提示，再按用户确认同步；
- 缺失直接依赖或 node_modules 状态损坏时，即使指纹相同也必须修复；
- Rust 工具链已完整时不重复安装；无 Rust 外部依赖时不 fetch；
- 1 仍然只是按需入口，不变回开发前强制步骤；
- Windows PowerShell 保持 UTF-8 with BOM。

### 必须测试

- 依赖指纹不包含产品版本字段；
- unchanged 状态路径必须跳过 `pnpm install`；
- changed/missing 状态路径才进入同步；
- 依赖差异摘要覆盖新增 / 删除 / 版本变化；
- 禁止 `pnpm update` 与主动 store 清理的静态回归；
- Rust 重复安装 / fetch 防回归静态契约；
- 原 release environment、release gates、Config Schema 单测回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.8 按需依赖增量检测与复用`

### 版本目标

`v0.0.54`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

### 被后续修正

用户实机确认增量安装已正确跳过，但指出菜单 1 输出重复且缺少依赖实际路径；由 #20.9 / v0.0.55 修正展示层。

## #20.7 Setup 菜单与发布门禁解耦

### 主模块

`project-governance / windows-setup / quality-gates`

### 任务目标

修正 v0.0.52 把 `LFAA-Setup.bat` 菜单 1 / 10 绑定得过重、过绝对的问题。菜单编号只应是 Windows 便捷入口，不应成为开发流程或未来 CLI 的架构事实。保留严格的质量判断，但把“环境准备、快速检查、完整检查、正式发布验证”拆成可独立调用的能力；开发者环境已就绪时可以跳过菜单 1，日常开发也不必每次执行最重的发布验证。

### 允许修改

- `scripts/windows/lfaa-setup.ps1` 的菜单 1 / 10 文案、分层入口和调用关系；
- 根 `package.json` 的 `quality:*` / `release:*` 聚合脚本；
- 发布门禁静态检查与对应测试；
- `DEVELOPMENT.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、项目地图、Prompt、Development Log、Plan；
- v0.0.53 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Config Schema / Config Storage 业务语义；
- Web 工作台 UI、PTY / node-pty 业务实现；
- Sync / GitHub / Update 行为；
- Agent / Tool / Policy / Permission 执行链；
- Agent Protocol / Config Schema Version / Database Schema Version；
- 用菜单编号定义未来 CLI / GUI API。

### 状态所有权

跨平台质量能力以根 `package.json` 脚本为调用入口；Windows 系统环境准备与交互归 `scripts/windows/*.ps1`；`LFAA-Setup.bat` 和菜单编号只是 Windows Adapter，不拥有业务状态，也不是未来 CLI 协议。产品版本仍以 `lfaa.release.json` 为唯一事实源。

### 实现约束

- 菜单 1 改为“按需依赖准备”：仅在首次环境准备、依赖变化或环境损坏时使用；环境已就绪时可直接启动 Web / 构建 / 检查；
- 菜单 1 的 Windows 环境准备逻辑继续留在 PowerShell，不把下载、PATH、Corepack、Rust 安装行为迁入 MJS；
- 菜单 10 改为“检查中心”，至少提供：快速检查、完整项目检查、正式发布检查、返回主菜单；
- 快速检查不得做 `pnpm install`、不得要求 Rust，面向高频开发反馈；
- 完整项目检查覆盖 governance + typecheck + test + build，但不隐式安装依赖；
- 正式发布检查才执行冻结依赖安装、正式环境版本检查与 Rust check/test；
- 所有 `quality:*` / `release:*` 命令都必须可以脱离菜单直接在 CLI 调用；
- 禁止规定“必须先点 1 再点 10”或把菜单编号写成发布协议；
- 正式候选 ZIP 在 `pending-user-acceptance` 阶段允许在受限制作环境生成，但必须真实记录未执行/被阻断的门禁；只有 `release:full` 在受支持环境真实通过后，才允许写“完整发布门禁通过 / release-ready”；
- 用户明确验收前仍不得写 `delivered`。

### 安全约束

- 项目依赖仍只允许 pnpm；不允许自动降级 npm / yarn / bun；
- 正式发布检查仍使用 `pnpm install --frozen-lockfile`，不得静默修改 lockfile；
- 快速/完整检查不得借“修复环境”之名修改用户系统；
- Windows 环境写操作必须经过现有 PowerShell 明确交互，不得转移到 MJS 隐式执行。

### 验收条件

- Setup 主菜单明确说明 1 是按需入口，不是开发前强制步骤；
- Setup 菜单 10 进入分层检查中心，而不是直接执行最重发布链；
- 快速检查、完整项目检查、正式发布检查三种语义明确且可分别从 CLI 调用；
- `release:full` 继续作为“完整发布验证”命令，但不再被写成生成每个 pending 验收候选 ZIP 的绝对前置条件；
- PS1 负责 Windows 环境动作，MJS 仅保留跨平台项目级检查 / 静态门禁；
- v0.0.52 保留为未被用户接受的历史版本，不覆盖；
- Windows PowerShell 保持 UTF-8 with BOM。

### 必须测试

- PowerShell 菜单静态契约：1 为按需依赖，10 为检查中心且存在 3 个分层选项；
- `quality:quick` 不包含 install / Rust；
- `quality:full` 覆盖 governance / typecheck / test / build 且不包含 install；
- `release:full` 覆盖环境检查、frozen install、完整项目检查、Rust；
- 发布环境单测与 Config Schema 单测回归；
- governance / import / dev-log / docs / comment / Windows BOM / release consistency / prompt lifecycle / UI contract；
- 当前受限容器无法满足 Node 24 / pnpm / Cargo 时，必须记录阻断，不得伪造 `release:full` 通过。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/RUNTIME.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.7 Setup 菜单与发布门禁解耦`

### 版本目标

`v0.0.53`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

## #20.6 发布环境与质量门禁闭环

### 主模块

`project-governance / toolchain / release-gates`

### 任务目标

修复 v0.0.51 暴露出的发布流程缺口：项目虽然声明 Node 24.x + pnpm 11.17.0，但 Setup 在缺少正确 pnpm 时会提前退出，根级 `typecheck / test / build` 仍是占位失败命令，导致“完整检查”无法真正成为正式发布硬门禁。本任务把工具链版本、依赖锁定安装、真实质量聚合和 Rust 检查收敛成可执行发布闭环。

### 允许修改

- `LFAA-Setup.bat` 与 `scripts/windows/lfaa-setup.ps1` 的开发环境 / 完整检查逻辑；
- `scripts/pnpm-only.mjs` 与新增发布环境、Rust、发布质量门禁脚本；
- 根 `package.json` 的真实 `typecheck / test / build / release:*` 脚本；
- 开发规范、Runtime / Testing / Code Map / Prompt / Development Log；
- v0.0.52 产品版本事实、CHANGELOG、Release；
- workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- Config Schema 业务结构与校验语义；
- Config Storage / SQLite / Drizzle / Migration；
- Web 工作台 UI 交互和视觉行为；
- Agent / Tool / Policy / Permission 执行链；
- PTY / node-pty 业务实现；
- Sync / GitHub / Update 行为；
- Agent Protocol / Config Schema Version / Database Schema Version。

### 状态所有权

工具链要求以根 `package.json` 的 `engines` + `packageManager` 为单一事实源；产品版本仍以 `lfaa.release.json` 为事实源。Setup 只负责准备本机开发环境和调用门禁，不得修改业务真值。

### 实现约束

- Node 必须为 24.x；pnpm 必须精确为 11.17.0；
- `pnpm-only.mjs` 除限制包管理器外，还必须拒绝错误 pnpm 版本；
- Setup 在已有 Node 24 且 pnpm 不匹配 / 缺失时，必须优先通过 Corepack 准备 `pnpm@11.17.0`；准备失败必须明确失败，不得降级到其他包管理器；
- 发布依赖安装必须使用 `pnpm install --frozen-lockfile`，禁止发布门禁修改 lockfile；
- 根 `typecheck / test / build` 必须调用当前已实现模块的真实命令，不再调用“假成功/固定失败”的占位入口；
- 发布完整检查必须覆盖环境、frozen install、governance、TypeScript、单测、Web build、Rust check/test；
- 所有失败返回非零退出码，禁止“打印通过但实际未执行”。

### 安全约束

- 不自动使用 npm / npx / yarn / bun 管理项目依赖；
- Corepack 只能准备根 `package.json` 锁定的 pnpm 版本；
- 不下载或执行项目未声明的业务依赖；
- 环境准备与发布验证不得静默修改 Config / Secret / 用户业务数据。

### 验收条件

- 错误 Node 主版本被环境门禁拒绝；
- 错误 pnpm 版本被 preinstall / 发布环境门禁拒绝；
- 缺少精确 pnpm 时 Setup 会尝试 Corepack 准备锁定版本；
- frozen lockfile 安装失败时正式发布检查失败；
- 根 `typecheck / test / build` 全部为真实聚合命令；
- `release:verify` 覆盖 governance、TypeScript、tests、build、Rust；
- Setup“完整检查”先做 frozen install，再执行统一 `release:verify`；
- Windows PowerShell 继续 UTF-8 with BOM；
- 用户明确验收前状态保持 `pending-user-acceptance`。

### 必须测试

- 发布环境脚本在当前非 Node 24 环境必须正确失败；
- 对环境检测核心逻辑做可注入单元测试，覆盖 Node / pnpm 正确和错误版本；
- `pnpm-only.mjs` 版本门禁静态 / 行为测试；
- Setup PowerShell 语法与 BOM；
- `node scripts/governance-check.mjs` 及全部现有 Node 门禁；
- 在满足 Node 24 + pnpm 11.17.0 的环境运行 `pnpm install --frozen-lockfile` + `pnpm run release:verify`；若当前执行容器无法满足，正式发布包不得伪造该结果，且 Release 必须记录阻塞事实。

### 必须更新的文档

`DEVELOPMENT.md`、`PROJECT_PLAN.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/TESTING.md`、`docs/RUNTIME.md`、`docs/项目结构与代码地图.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#20.6 发布环境与质量门禁闭环`

### 版本目标

`v0.0.52`

### 当前状态

`superseded`

### AI 验证

`pass`

### 用户验收

`not-accepted`

## #2.2 Config Schema 基线

### 主模块

`config-system / config-schema`

### 任务目标

正式开始 LFAA 第一个业务模块 `config-system`，本次只完成第一阶段 `config-schema`：建立配置对象的版本化 TypeScript 契约、默认值、运行时校验与安全字段边界，为后续 Config Storage / Migration / Settings / Model / Account / Permission / UI 提供唯一 Schema 事实源。

### 允许修改

- `packages/config-system/**`；
- Config Schema 专项门禁与根 package 脚本；
- Config System 的 Plan / Progress / Prompt / Development Log / Testing / Code Map；
- v0.0.51 版本事实、CHANGELOG、Release；
- 所有 workspace package / Rust crate 的产品版本一致性。

### 禁止修改

- SQLite / Drizzle / Config Storage / Migration 执行器；
- Rust Secret Store 的真实 Secret 实现；
- API Key / Token / Password 等 Secret 明文持久化；
- Config UI / Web 工作台交互；
- Agent Runtime / Tool Runtime / Policy / Permission 执行逻辑；
- PTY / node-pty；
- Sync / GitHub / Setup / Update 业务行为；
- Agent Protocol 与 Database Schema Version 语义。

### 状态所有权

Config Schema 的唯一事实源是 `@lfaa/config-system`。Schema Version 只在该模块定义；账号仅保存 `credentialRef`；真实 Secret 归未来 Rust Secret Broker / OS Credential Store。UI 不拥有 Config 真值，后续 Storage 不得另造第二套配置结构。

### 实现约束

- Product Version 与 Config Schema Version 分离；本版本产品为 v0.0.51，Config Schema Version 为 1；
- Schema 使用可序列化 JSON 数据；
- Provider / Model / Account ID 唯一；引用必须完整；
- 校验保持本地纯内存 O(n)，典型各 100 项配置目标 P95 < 10ms；
- 不新增第三方运行时依赖；
- 新关键实现文件使用结构化中文文件头。

### 安全约束

- 禁止 `apiKey` / `token` / `secret` / `password` 等 Secret 明文字段；
- Account 只允许 `credentialRef`；
- 运行时校验拒绝嵌套 Secret 字段和危险对象键；
- 本任务不读取 OS Credential Store，不进行数据库、网络或进程 I/O。

### 验收条件

- 新增 `@lfaa/config-system`；
- Config Schema Version 单一且为 1；
- Settings / Runtime / Provider / Model / Account / Permission 边界清晰；
- 默认配置通过自身校验；
- 错误 Schema Version、重复 ID、悬空引用、Secret 明文字段被拒绝；
- 不包含 Storage / Secret 明文 / Config UI 实现；
- 当前任务状态为 `pending-user-acceptance`，用户明确验收前不得写 `delivered`。

### 必须测试

- `pnpm --filter @lfaa/config-system exec tsc -p tsconfig.json --noEmit`；
- `pnpm --filter @lfaa/config-system test`；
- `node scripts/config-schema-check.mjs`；
- `pnpm run governance:check`；
- Windows PowerShell BOM 不回退。

### 必须更新的文档

`PROJECT_PLAN.md`、`docs/MODULES.md`、`docs/PROMPTS.md`、`docs/DEVELOPMENT_LOG.md`、`docs/TESTING.md`、`docs/项目结构与代码地图.md`、`packages/README.md`、`README.md`、`CHANGELOG.md`、`docs/RELEASES.md`。

### CHANGELOG 编号

`#2.2 Config Schema 基线`

### 版本目标

`v0.0.51`

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`

### 用户验收

`pending`


> 迁移来源：`docs/prompts/active/0020-05-文档体系单文件时间线重构.md`

## #20.5 文档体系单文件时间线重构

### 主模块

`project-governance / documentation`

### 任务目标

把当前按“每次任务 / 每个版本一个 Markdown”拆分的文档体系重构为“按文档职责长期维护少量固定文档 + 编号递增时间线”的结构，减少 Markdown 文件数量，同时保留现有历史内容和可追溯性。

### 背景

截至 v0.0.49，`docs/` 中约有 251 个 Markdown 文件。Prompt、Development Log、Changelog、Release 等时间序列信息被拆成大量独立文件和 active/archive/version 目录，长期维护会造成：

- 人类浏览成本高；
- AI 读取入口过多；
- active/archive 搬运容易产生新旧漂移；
- 治理脚本需要维护大量具体路径；
- 项目继续迭代后 Markdown 文件数量会线性膨胀。

用户要求改为：同一职责由一个长期 Markdown 承载，通过 `#编号 + 功能名称 + 版本 + 状态` 递增追加记录。

### 允许修改

- `docs/**`
- `AGENTS.md`
- `DEVELOPMENT.md`
- `ARCHITECTURE.md`
- `PROJECT_PLAN.md`
- `CHANGELOG.md`
- 文档治理相关 `scripts/*.mjs`
- `package.json`
- `lfaa.release.json`
- 各 workspace / crate 版本号
- 为 v0.0.50 所需的 Release / Changelog / Prompt / Development Log 记录

### 禁止修改

- Web UI 功能实现；
- 三向吸附与响应式布局逻辑；
- PTY / node-pty；
- Sync / GitHub / Setup / Update 的业务行为；
- Protocol / DB Schema；
- 安全执行链。

### 状态所有权

文档治理状态由 `DEVELOPMENT.md` + 固定时间线文档 + 治理脚本共同约束。

### 实现约束

1. 不按任务继续创建新的碎片化 Markdown；
2. 当前事实与历史时间线分开：当前事实允许覆盖更新，历史记录只追加；
3. 旧 Prompt / Log / Changelog / Release 内容必须迁移到固定长期文档，不能静默丢失；
4. 新体系必须让 AI 打开仓库后通过 `AGENTS.md` / `DEVELOPMENT.md` 一眼知道读取顺序和开发生命周期；
5. 新任务必须先写 Prompt 条目，再改实现，再 AI 自测，再进入 `pending-user-acceptance`，用户验收后才允许标记 `delivered`；
6. 治理脚本必须从“检查大量具体历史文件”改成“检查固定文档及编号 / 版本 / 状态一致性”。

### 目标文档形态

优先保留少量长期文档，例如：

- `docs/README.md`
- `docs/项目结构与代码地图.md`
- `docs/PROMPTS.md`
- `docs/DEVELOPMENT_LOG.md`
- `docs/MODULES.md`
- `docs/UI.md`
- `docs/TESTING.md`
- `docs/RELEASES.md`
- `docs/RUNTIME.md`

根目录继续保留当前事实 / 项目入口：

- `DEVELOPMENT.md`
- `ARCHITECTURE.md`
- `PROJECT_PLAN.md`
- `CHANGELOG.md`

### 验收条件

- `docs/` Markdown 文件数量从约 251 大幅下降到十几个以内；
- 历史 Prompt、Development Log、Changelog、Release 可通过编号或版本在固定文档中搜索到；
- 不再存在 `docs/prompts/active|archive`、`docs/logs/development/active|archive`、`docs/changelog/v*.md`、`docs/releases/v*/RELEASE.md` 这类无限增长结构；
- DEVELOPMENT / AGENTS 明确写出 `Prompt → Code → AI Test → pending-user-acceptance → User Acceptance → delivered`；
- 当前开发任务编号、版本、Prompt、Log、Changelog、Release 状态一致；
- governance / docs / dev-log / release consistency / comment / Windows encoding / UI contract 等相关门禁全部通过；
- ZIP round-trip、中文路径、PowerShell BOM 验证通过。

### 必须测试

- 文档迁移内容计数和源文件映射；
- 固定文档存在性；
- 碎片目录不存在；
- `#20.5` / `v0.0.50` 一致性；
- 开发状态不得在用户验收前写成 `delivered`；
- 现有 UI / Windows 脚本核心文件 Hash 不发生无关变化。

### 必须更新的文档

本任务本身即负责重构文档体系；完成后所有当前规则更新到新固定文档。

### CHANGELOG 编号

`#20.5`

### 版本目标

`v0.0.50`

### 当前状态

`pending-user-acceptance`

### AI 验证

`pass`

### 用户验收

`pending`

> 迁移来源：`docs/prompts/active/0002-配置系统.md`

## #2 配置系统

### 主模块

`config-system`

### 任务目标

按照 LFAA 开发规范，逐步完成配置系统，先完成整个配置系统达到可交付，再进入其他业务模块。

### 开发顺序

0. Web Workbench Shell（#21，先用于本地 UI / 热插拔验证）
1. Config Schema
2. Config Storage
3. Settings Domain
4. Model Management
5. Account Management
6. Permission Settings
7. Config UI
8. Tests
9. Optimization
10. Delivery

### 安全约束

- API Key/Token 不得明文存入普通 SQLite 配置表。
- 只保存 Credential Reference。
- UI 不直接读取 Secret。

### 工具链约束

- Node.js 包管理器只允许 pnpm；
- 新增依赖使用 `pnpm add`；
- workspace 命令使用 `pnpm run` / `pnpm --filter` / `pnpm -r`；
- 禁止 npm、npx、yarn、bun 替代 pnpm。

### 项目资源作用域

Skills、Experts、Plugins、Extensions、MCP 只从当前项目 `.lfaa/` 解析。

### 验收条件

Schema 唯一；Storage 可迁移；Model/Account/Permission 清晰分层；UI 与业务状态分离；测试通过；Progress/Changelog 完整。

### CHANGELOG 编号

`#2 配置系统`

> 迁移来源：`docs/prompts/active/0020-开发规范执行.md`
> 状态：`superseded`，已由 #20.5 的单文件文档合同取代；保留在此只用于追溯。

## #20.4 开发规范执行合同

### 触发条件

用户明确说：

```text
按照开发要求做
按照开发规范开发
严格按照开发规范
```

即触发本合同。

### 强制流程

必须先按 `DEVELOPMENT.md` / `AGENTS.md` 的顺序读取当前事实源，再修改代码。不能先改代码后补记录。

每次实际交付必须同时确认：

1. 当前版本与历史版本分离；
2. Plan / Progress / Prompt / Development Log 是否需要更新；
3. 相关 Standards 是否发生变化；
4. CHANGELOG / Release 与实际代码一致；
5. 代码注释、目录地图、文件职责与实现一致；
6. 相关治理 / 编码 / 版本 / ZIP 门禁通过；
7. 不覆盖旧版本包。

### Windows PowerShell 特别规则

任何 `scripts/windows/*.ps1`：

- 必须使用 UTF-8 with BOM；
- 中文结构化注释不能以牺牲 Windows PowerShell 5.1 可执行性为代价；
- 修改后必须经过 `windows-script-encoding-check.mjs`。

> 迁移来源：`docs/prompts/active/0021-Web工作台UI.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

以 v0.0.48 为历史基线，调整 Composer 垂直落点。输入框不应贴近窗口底边；底部间距必须变量化并按 Desktop / Compact / Mobile 响应，不允许通过散落的固定 `margin-bottom` 或 absolute 定位硬抬。

### 当前实现要求

#### 1. 单一底部间距变量

```text
--agent-composer-bottom-gap
→ .agent-composer-wrap
→ max(variable, safe-area-inset-bottom)
```

#### 2. 响应式取值

- Desktop 使用 `clamp()` + `vh`，适度抬高 Composer；
- Compact 减小留白，避免短窗口浪费高度；
- Mobile 保留较小固定 rem，并尊重 safe area；
- 不新增第二套 Composer bottom 数值来源。

#### 3. 保持现有行为

- Hover / Click 左栏宽度统一不回退；
- 容器响应式 / Desktop / Compact / Mobile 不回退；
- 三向到 min 吸附收起不回退；
- Pointer 不松手反向解锁不回退；
- Header / Tooltip / PTY / Sync / GitHub / Setup / Update 不改业务逻辑。

### 允许修改

- `packages/app-shell/src/agent-workbench.css`；
- `scripts/ui-contract-check.mjs`；
- 当前 UI 文档、测试、Plan / Progress / Development Log / Changelog / Release / Version。

### 验收条件

- Desktop 输入框下方留白明显比 v0.0.48 更舒适；
- Compact / Mobile 不因固定大间距浪费高度；
- safe-area 仍然生效；
- 不用 absolute / transform 假移动 Composer；
- UI contract 能阻止固定底部 padding 回归；
- 基础设施和 PTY 不变。

### 当前状态

`active / pending-windows-visual-test`

## 历史 Prompt 时间线

> 以下内容由 v0.0.49 及以前的独立 Prompt 文件无损迁移而来。原路径作为迁移来源保留，旧碎片文件已移除。

> 迁移来源：`docs/prompts/archive/v0.0.1/0001-项目基础.md`

## #1 项目初始化与架构骨架

### 主模块

`project-foundation`

### 任务目标

建立 Little Fish AI Agent（LFAA）v0.0.1 的项目治理与 Monorepo 架构骨架。

### 允许修改

项目根目录治理文件、apps/packages/crates 骨架、docs。

### 禁止修改

不实现真实业务能力。

### 验收

- 当前架构明确；
- 历史架构隔离；
- 开发规则可被 AI 第一时间发现；
- 主模块与下一步明确；
- 首包名称为 `LFAA-v0.0.1`。

> 迁移来源：`docs/prompts/archive/v0.0.2/0003-导入路径规范.md`

## #3 导入路径与 Alias 优化

### 主模块

`project-foundation`

### 任务类型

基础架构优化 / config-system 开发前置任务

### 任务目标

避免 LFAA 随目录增长出现：

```text
../../../
../../../../
```

等深层相对路径。

建立：

- `./` 同模块导入；
- `@/` 当前 workspace 导入；
- `@lfaa/*` 跨 package 导入；
- 自动检查。

### 允许修改

- 项目治理文件
- TypeScript workspace `tsconfig.json`
- scripts
- project-foundation Plan/Progress
- config-system Progress 前置记录
- Changelog / Release

### 禁止修改

- config-system 真实业务代码
- Agent Runtime 行为
- Rust 执行逻辑
- 数据库业务 Schema

### 验收

- 所有 TS workspace 有本地 `@/* -> src/*`
- 禁止 `../../` 及以上深层导入
- 跨 package 不访问 internal
- 自动检查可执行
- 主模块仍保持 `config-system`

> 迁移来源：`docs/prompts/archive/v0.0.3/0004-稳定工作区同步.md`

## #4 稳定工作区同步与 GitHub 推送

### 主模块

`project-foundation`

### 任务类型

开发基础设施优化

### 任务目标

让每个 LFAA 版本快照能够安全、完整地同步到：

```text
H:\lfaa\lfaa
```

并保证：

- `.git` 常驻；
- 新增/修改/删除真实检测；
- 彩色详细路径；
- 删除前确认；
- 同步后完整校验；
- 一键 GitHub 推送脚本随版本包恢复。

### 参考脚本风格

用户提供的 XMA Sync/GitHub BAT 采用：

- BAT 仅作为启动器；
- PowerShell 承担真实逻辑；
- 窗口保留结果。

LFAA 沿用该分层方式，并增加真实 diff、SHA-256 校验、颜色输出和稳定工作区定位。

### 禁止修改

- config-system 业务实现；
- Agent Runtime 行为；
- Rust Broker 行为。

### 验收

- 正式版本包含 `LFAA-Sync.bat` 与 `LFAA-GitHub.bat`
- PowerShell 位于 `scripts/windows/`
- 同步前展示 ADD/MOD/DEL 完整路径
- 同步后无项目文件差异
- `.git` 不被删除/覆盖
- GitHub 脚本始终优先操作稳定工作区

> 迁移来源：`docs/prompts/archive/v0.0.4/0005-同步日志目录.md`

## #5 同步日志目录优化

### 主模块

`project-foundation`

### 任务目标

将 LFAA-Sync 运行生成的同步日志从隐藏目录：

```text
.lfaa-local/sync-logs/
```

迁移到：

```text
docs/logs/workspace-sync/
```

使开发留痕更直观、可发现、按 docs 分类管理。

### 约束

- `*.log` 不参与版本镜像差异判断；
- `*.log` 不被新版本同步删除；
- `*.log` 默认不推送 GitHub；
- `README.md` 正常进入版本控制；
- 不修改 config-system 业务。

### 验收

- PowerShell 生成日志到新目录；
- 同步后校验不会因旧日志失败；
- `.gitignore` 忽略运行日志；
- 文档/Progress/Changelog 同步更新。

> 迁移来源：`docs/prompts/archive/v0.0.5/0006-GitHub推送修复.md`

## #6 GitHub 一键推送修复

### 主模块

`project-foundation`

### 问题

首次运行：

```text
LFAA-GitHub.bat
```

到：

```text
git init
```

时 Git 只显示帮助页，没有真正执行 `init`。

### 根因

PowerShell helper 使用：

```text
param([string[]]$Args)
```

`$Args` 与 PowerShell 自动变量冲突，导致 Git 子命令没有正确传递。

### 任务目标

- 修复 Git 命令参数传递；
- 按同步脚本标准显示 Git 文件变化；
- Commit 名称由用户自定义；
- 首次 Commit 不写死 `first commit`；
- Commit/Push 分别确认；
- 保留 `.git`；
- 不使用 force push；
- 生成 GitHub Push 本机日志。

### 禁止修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

### 验收

首次运行能够执行：

```text
git init
git branch -M main
git remote add origin ...
git add -A
git commit -m "<用户输入>"
git push -u origin main
```

后续运行复用原 `.git`。

> 迁移来源：`docs/prompts/archive/v0.0.6/0007-GitHub远程检测.md`

## #7 GitHub 首次远程仓库检测与中文输出修复

### 主模块

`project-foundation`

### 问题

首次 Git 初始化成功后：

```text
git remote get-url origin
```

因为 `origin` 尚未创建而返回错误。

Windows PowerShell 在 `$ErrorActionPreference = "Stop"` 下把 Git stderr 包装成错误，导致脚本提前退出。

同时 Git 原生命令直接输出到控制台，出现大量英文。

### 根因

1. 首次状态没有 `origin` 是正常情况，脚本却直接读取 URL。
2. PowerShell 对原生命令 stderr 的处理导致预期状态升级为错误。
3. 没有统一捕获 Git stdout/stderr。

### 修复

- 先执行 `git remote` 判断是否存在 `origin`；
- 不存在则直接 `git remote add origin`；
- 存在才执行 `git remote get-url origin`；
- 新增 `Invoke-GitRaw` 捕获原始 Git 输出；
- 默认控制台只显示中文状态；
- Git 原始英文技术信息仅在失败时写入日志；
- Git 中文路径设置 `core.quotepath=false`；
- 保留用户自定义 Commit 名称流程。

### 验收

- 已经存在但没有 origin 的 `.git` 可以继续运行；
- 全新 `.git` 可以首次添加 origin；
- 控制台默认不直接打印 Git 英文帮助/错误；
- 首次和后续 Commit 均由用户自定义名称。

> 迁移来源：`docs/prompts/archive/v0.0.7/0008-Git远程配置.md`

## #8 用户首次配置 Git origin

### 主模块

`project-foundation`

### 目标

GitHub / Git 一键推送脚本不得写死仓库地址。

首次运行时，如果 `.git/config` 中没有 `origin`：

1. 提示用户输入 Git 仓库地址；
2. 显示并确认；
3. 执行 `git remote add origin <地址>`；
4. 保存到 `.git/config`；
5. 后续运行自动读取，不再次要求输入。

### 原则

`origin` 的唯一事实源：

```text
.git/config
```

不再额外创建 LFAA 自定义 origin 配置文件。

### 支持地址

- HTTPS
- SSH URL
- SCP 风格 SSH
- file://

### 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.8/0009-终端完成状态.md`

## #9 终端完成状态与关闭提示

### 主模块

`project-foundation`

### 问题

同步或 GitHub 推送成功后，终端虽然显示成功信息，但没有明确告诉用户：

- 后台流程是否已经彻底结束；
- 终端是否可以关闭；
- 是否还需要等待。

### 目标

同步与 GitHub 推送脚本必须在结束时给出明确状态。

成功：

```text
【提示】【可关闭】全部操作已完成，现在可以安全关闭终端窗口。
【提示】【操作】按任意键关闭窗口，或直接点击右上角 X。
```

失败：

```text
【提示】【可关闭】错误信息已经保留，现在可以关闭窗口；处理问题后再重新运行。
```

### 实现

- BAT 只负责启动 PowerShell；
- 不再由 BAT 执行额外 pause；
- PowerShell 统一掌控最终提示；
- 成功和失败分别显示不同颜色；
- Windows 交互终端下等待任意键；
- 非交互终端不因 ReadKey 失败而再次报错。

### 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.9/0010-Commit确认优化.md`

## #10 移除 Commit 二次确认

### 主模块

`project-foundation`

### 问题

用户已经手工填写：

```text
【提交】【名称】
```

之后，脚本又要求：

```text
【确认】【创建提交】
```

属于重复确认，增加不必要的交互。

### 目标

流程改为：

```text
输入 Commit 名称
→ 直接创建本地 Commit
→ 检测远程
→ Push 前确认
```

### 保留

Push 前确认必须保留，因为 Push 会修改远程仓库。

### 不修改

- config-system 业务
- Agent Runtime
- Rust Broker

> 迁移来源：`docs/prompts/archive/v0.0.10/0011-源码更新脚本.md`

## #11 Git Clone 后一键更新源码

### 主模块

`project-foundation`

### 问题

`git clone` 只适合第一次下载仓库。

GitHub 仓库后续更新时，不应该重新删除目录再 clone。

### 目标

新增：

```text
LFAA-Update.bat
scripts/windows/lfaa-update.ps1
```

实现已有 Git 工作区的一键安全更新。

### 安全规则

- 有未提交修改：停止；
- 本地与远程分叉：停止；
- 本地领先：不 pull，提示 Push；
- 本地纯落后：允许 fast-forward only；
- 禁止 hard reset；
- 禁止自动删除用户本地文件；
- 更新前展示远程文件变化；
- 更新后验证 HEAD；
- 保存本机更新日志。

### 不修改

- config-system 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.11/0012-脚本菜单与强制更新.md`

## #12 Windows 脚本菜单化与强制拉取

### 主模块

`project-foundation`

### 目标

三个 Windows 工具双击后不得直接执行写操作，必须先进入数字菜单。

#### Update

```text
1 安全拉取
2 强制拉取
3 仅检查更新
0 退出
```

#### Git Push

```text
1 一键提交并推送
2 查看 Git 状态
3 配置/修改 origin
0 退出
```

#### Sync

```text
1 预览同步差异
2 执行同步
3 查看同步配置
0 退出
```

### 强制拉取安全设计

强制模式允许当前分支完全对齐远程，但必须先建立恢复点：

1. `git fetch --prune`
2. 建立 `lfaa-backup/<branch>-<timestamp>` 备份分支
3. 未提交文件使用 `git stash push -u`
4. `git reset --hard origin/<branch>`
5. `git clean -fd`
6. 校验本地/远程一致
7. 显示 backup branch / stash 恢复信息

Git ignored 文件不使用 `-x` 清理，因此 `.env`、缓存等忽略项继续保留。

> 迁移来源：`docs/prompts/archive/v0.0.12/0013-更新路径无关.md`

## #13 Git 更新脚本路径无关化

### 主模块

`project-foundation`

### 问题

源码拉取不能依赖：

```text
H:\lfaa\lfaa
```

也不能假设项目目录一定叫：

```text
lfaa
```

用户可能把项目放在：

```text
C:\Code\LFAA
D:\AI\LittleFish
E:\Projects\Agent
U:\Source\LFAA
```

### 目标

`LFAA-Update.bat` 必须根据用户实际项目位置自动找到 Git 根目录。

### 定位顺序

1. 脚本所在项目 `git rev-parse --show-toplevel`
2. 用户启动脚本时的当前目录
3. 扫描脚本附近 Git 工作区
4. 多个项目时让用户选择
5. 无法识别时要求用户输入项目路径并验证

### 原则

- 不写死盘符；
- 不写死 `H:\lfaa`；
- 不要求目录名必须为 `lfaa`；
- 只认真实 `.git` / Git 根目录；
- 路径中有空格也必须正常工作。

> 迁移来源：`docs/prompts/archive/v0.0.13/0014-同步菜单顺序.md`

## #14 同步菜单顺序优化

### 主模块

`project-foundation`

### 目标

调整 `LFAA-Sync.bat` 菜单顺序，让最高频操作放在数字 `1`。

### 新顺序

```text
1 执行同步
2 预览差异
3 同步配置
0 退出
```

### 原因

日常最常用操作是实际同步，因此数字 `1` 应直接进入执行同步流程。

### 不修改

- 同步安全机制；
- SHA-256 校验；
- Git 保护；
- config-system 业务。

> 迁移来源：`docs/prompts/archive/v0.0.14/0015-更新差异修复.md`

## #15 Update 安全拉取远程差异读取修复

### 主模块

`project-foundation`

### 现象

安全拉取已经得到：

```text
本地领先 0
本地落后 0
```

随后仍执行远程文件差异读取，并可能错误终止为：

```text
读取远程文件变化失败
```

### 根因

状态判断顺序错误。

`0 / 0` 已经证明本地与远程一致，本不需要继续执行文件 diff。

### 修复

1. ahead=0 / behind=0 时立即返回“已是最新”；
2. 本地纯领先、且不是强制模式时不读取远程 diff；
3. 安全拉取遇到分叉时先停止，不执行无意义 diff；
4. 只有真正需要展示变化时才读取文件差异；
5. 文件比较由 revision-range：
   `HEAD..origin/main`
   改为两个明确 ref：
   `git diff <local-sha> <origin/ref>`；
6. 增加 `git diff-tree` fallback；
7. 两种比较都失败时才真正终止并写技术日志。

> 迁移来源：`docs/prompts/archive/v0.0.15/0016-项目治理加固.md`

## #16 项目治理、归属与项目级资源边界加固

### 主模块

`project-foundation`

本任务是 `config-system` 开发前的全项目基础设施加固，不改变当前主业务模块顺序。

### 完成范围

- 性能、安全、质量门禁；
- LFAA 官方命名、作者署名和第三方归属规则；
- `.lfaa/` 项目级 Skills / Experts / Plugins / Extensions / MCP；
- `LFAA-Setup.bat` 开发环境与依赖菜单；
- pnpm 版本与 lockfile；
- 禁止 build/typecheck/test 假成功。

### 状态

`delivered in v0.0.15`

> 迁移来源：`docs/prompts/archive/v0.0.15/0017-pnpm一致性.md`

## #17 pnpm-only 一致性修复

### 主模块

`project-foundation`

### 问题

项目已经固定 pnpm，但根 `package.json` 的 test 脚本和 `DEVELOPMENT.md` 仍残留 npm 命令，Setup 环境页也继续展示 npm，容易让后续开发者或 AI 误认为 npm 可用。

### 修复

- 根 test 改为 `pnpm run governance:check`；
- DEVELOPMENT 命令统一为 pnpm；
- Setup 不再展示 npm；
- 新增 `preinstall` pnpm-only 门禁；
- Governance 检查根 scripts 不得调用 npm/npx/yarn/bun；
- AGENTS/README/QUALITY_GATES 明确 pnpm-only。

### 状态

`delivered in v0.0.15`

> 迁移来源：`docs/prompts/archive/v0.0.16/0018-Setup缺少Cargo修复.md`

## #18 Setup 菜单缺少 Cargo 时错误终止修复

### 主模块

`project-foundation`

### 问题

用户运行：

```text
LFAA-Setup.bat
→ 1 全部依赖
```

pnpm workspace 依赖已经成功安装，但机器未安装 Cargo 时，脚本随后抛出：

```text
未检测到 Cargo。
```

导致菜单 1 被标记为失败。

### 根因

菜单 1 将 Node/pnpm 与 Rust/Cargo 两套工具链错误地当成一个不可分割的前置条件。

### 修复

- 菜单 1 先做 Node/Rust 工具链预检；
- Node 可用则安装 Node 依赖；
- Cargo 可用则安装 Rust 依赖；
- 缺少某一工具链时安全跳过并明确提示；
- 已成功完成的依赖安装结果保留；
- 两类工具链都不存在时才失败；
- 菜单 4 和菜单 10 仍严格要求 Cargo。

### 不修改

- Config System 业务；
- Agent Runtime；
- Rust Broker。

> 迁移来源：`docs/prompts/archive/v0.0.17/0019-一键准备与资源根.md`

## #19 一键准备与项目资源根收敛

### 主模块

`project-foundation`

### 目标

1. 将 Setup 菜单 1 升级为真正的一键准备入口；
2. 消除根 `/skills`、`/plugins` 与 `.lfaa/*` 双重事实源；
3. 固定 `.lfaa` 热插拔资源模型。

### Setup

- pnpm install 始终可重复运行并复用已下载依赖；
- 缺少 Cargo 时通过 winget 尝试安装 Rustlang.Rustup；
- 不在没有受控 Cargo.lock 时偷偷生成本机锁文件；
- 项目尚无外部 Rust crate 时明确无需 fetch。

### Resource Root

唯一项目资源根：

```text
.lfaa/
```

删除：

```text
/skills
/plugins
```

### Hot Plug

后续 File Watcher 监听 `.lfaa/skills|experts|plugins|extensions|mcp`，经校验后发布新的 Registry Generation。运行中的 Run 固定使用原 generation。

> 迁移来源：`docs/prompts/archive/v0.0.18/0020-开发日志规范.md`

## #20 开发日志分层规范

### 主模块

`project-foundation`

### 目标

建立“当前日志 / 历史日志”分层，并把开发日志读取顺序、编号、命名和中文文档要求写成硬规则。

### 关键要求

- 开发前先读 DEVELOPMENT；
- 再读 Development Log INDEX；
- 只从 active 获取当前结论；
- archive 只用于回溯；
- 同一问题使用 #NN.x；
- 旧记录不删除；
- 旧记录必须指向新记录；
- 文档中文为主；
- 标题清晰、内容逐项列出；
- 文件名短、准、规范。

### 状态

`delivered in v0.0.18`

> 迁移来源：`docs/prompts/archive/v0.0.19/0020-01-历史编号迁移.md`

## #20.1 历史编号迁移

### 主任务

`#20 开发日志分层规范`

### 问题

#20.0 建立了 active/archive，但 Development Log 中只直接显示 #20，#1 - #19 只有 legacy 指针。

这不满足“旧记录不删除、可以直接搜索和对比”的要求。

### 修复

- #1 - #19 逐条纳入 Development Log；
- #2 保持 active；
- #1、#3 - #19 进入 archive；
- #20.0 保存为 superseded 历史快照；
- #20 active 更新为 #20.1；
- Dev Log Check 增加主编号连续性检查；
- 原 Prompt / Progress / Changelog / Release 全部保留。

### 编号说明

没有真实 #0 历史，不伪造 #0。

### 状态

`delivered in v0.0.19`

> 迁移来源：`docs/prompts/archive/v0.0.20/0020-02-中文命名与文档整理.md`

## #20.2 中文命名与文档整理

### 主任务

`#20 开发日志与文档规范`

### 目标

让 `docs/` 长期可读、可查、可维护，避免英文短名和目录混乱增加维护成本。

### 本次规则

- 编号类人类文档使用中文短名；
- Development Log 当前文件使用 `NNNN-中文短名.md`；
- Development Log 历史文件使用 `NNNN-NN-中文短名.md`；
- Prompt 同样使用编号 + 中文短名；
- `docs/` 顶层目录保持短英文稳定路径；
- 每个主要分类必须有中文 README 导航；
- 运行日志统一归入 `docs/logs/runtime/`；
- 开发决策日志只放 `docs/logs/development/`。

### 状态

`delivered in v0.0.20`

> 迁移来源：`docs/prompts/archive/v0.0.21/0010-01-GitHub推送取消二次确认.md`

## #10.1 GitHub 推送取消二次确认

### 主任务

`#10 GitHub 推送确认交互`

### 目标

取消“一键推送”在本地 Commit 已创建之后的远程 Push 二次确认。

### 新流程

```text
菜单 1 一键推送
→ 查看变化
→ 输入 Commit 名称
→ 创建 Commit
→ 显示 origin / 分支 / Commit
→ 直接 Push
```

### 保留确认

- 新增 origin；
- 修改 origin；
- 强制拉取；
- 其他高风险覆盖操作。

### 状态

`delivered in v0.0.21`

> 迁移来源：`docs/prompts/archive/v0.0.22/0019-01-一键准备真实检测.md`

## #19.1 一键准备真实检测

### 主任务

`#19 一键准备与依赖检测`

### 问题

用户机器已有 Node / pnpm，`pnpm install` 也成功，但：

- 当前项目没有实际第三方 Node 依赖；
- `node_modules` 因此只有少量 pnpm 元数据；
- Cargo 缺失；
- winget 也缺失；
- 旧逻辑无法继续自动补 Rust。

### 修改

- Node 版本和路径真实检测；
- pnpm 版本和路径真实检测；
- workspace / Node 依赖声明统计；
- 明确解释零外部依赖时 node_modules 很小；
- winget 不可用时使用 Rust 官方 rustup-init；
- rustup-init 同时下载官方 SHA-256 并校验；
- 显式安装 stable Rust toolchain；
- 自动安装仍失败时返回“部分完成”，不假绿。

### 状态

`delivered in v0.0.22`

> 迁移来源：`docs/prompts/archive/v0.0.24/0019-03-统一开发入口.md`

## #19.3 统一开发入口

### 主任务

`#19 一键准备与依赖检测`

### 目标

将 Web / Desktop 的启动、构建和发布入口统一收敛到：

```text
LFAA-Setup.bat
```

### 新菜单

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

### 约束

- 删除重复 `LFAA-Web.bat`；
- Desktop 尚未实现时必须明确失败；
- 构建发布只生成本地产物，不自动上传远程；
- 不允许假成功。

### 状态

`delivered in v0.0.24`

> 迁移来源：`docs/prompts/archive/v0.0.25/0019-04-Rust安装诊断优化.md`

## #19.4 Rust 安装诊断优化

### 主任务

`#19 一键准备与依赖检测`

### 问题

Windows 实机安装中出现：

```text
winget exit -1978335189
```

旧逻辑直接显示“安装未完成”，随后重新下载 Rust 官方安装器。

该 WinGet 返回码表示：

```text
No applicable update found
```

不能简单当普通安装失败。

同时用户 Cargo 最终位于自定义目录，说明检测必须支持 `CARGO_HOME`。

### 修改

- 优先识别 `CARGO_HOME\bin`；
- WinGet 返回码语义映射；
- WinGet 返回后重新检测现有 rustup/Cargo；
- 只有仍不可用才走 Rust 官方安装器；
- 官方 rustup 英文原始日志保留；
- LFAA 自身提示保持中文；
- 官方 SHA-256 校验继续保留。

### 状态

`delivered in v0.0.25`

> 迁移来源：`docs/prompts/archive/v0.0.26/0021-02-黑白工作台重构.md`

## #21.2 黑白工作台重构

### 主任务

`#21 Web 工作台 UI`

### 用户要求

- UI 改为 Codex / ChatGPT 类风格；
- 不再使用水墨风格；
- 使用黑 / 白 / 灰主题；
- 左右栏允许更大范围拉伸，但必须有最大宽度；
- 吸附收起必须更丝滑。

### 实现约束

- 不复制 Codex / ChatGPT 品牌标识；
- 保留 LFAA 自有信息架构；
- 复用同一套 Web / Desktop App Shell；
- 侧栏拖动使用 rAF + CSS 变量预览；
- collapsed 状态只在拖动结束时提交；
- 动态最大宽度保护中央工作区；
- 不改 `.lfaa` 热插拔协议。

### 状态

`in-progress in v0.0.26`

> 迁移来源：`docs/prompts/archive/v0.0.27/0021-03-最小宽度自动吸附.md`

## #21.3 最小宽度自动吸附

### 主任务

`#21 Web 工作台 UI`

### 问题

v0.0.26 使用独立：

```text
snapThreshold = 96px
```

并在 Pointer Up 才决定收起。

目标交互要求侧栏一碰到最小宽度就自动吸附，不需要继续向内拖，也不等待松手。

### 修改

```text
左栏 min = 240px
右栏 min = 300px
```

Pointer Move 到对应 min：

```text
立即吸附到 collapsed 预览
```

反向拖回：

```text
min + 24px
```

重新展开，防止边界抖动。

### 保留

- 最大宽度动态限制；
- 中央区最小宽度保护；
- requestAnimationFrame 合并 Pointer Move；
- localStorage 宽度与收起状态；
- 双击 / 键盘控制。

### 状态

`delivered in v0.0.27`

> 迁移来源：`docs/prompts/archive/v0.0.28/0019-05-Rust工具链分层.md`

## #19.5 Rust 工具链分层

### 目标

采用“共享工具链 + 项目锁定版本 + 项目本地依赖/构建”的 Rust 开发模型，避免每个项目复制完整编译器。

### 决策

- rustup/rustc/cargo：共享；
- `rust-toolchain.toml`：项目；
- Cargo.toml/Cargo.lock：项目；
- target：项目；
- CARGO_HOME/RUSTUP_HOME：允许用户放到非系统盘。

### 状态

`delivered in v0.0.28`

> 迁移来源：`docs/prompts/archive/v0.0.28/0021-04-Web端口复用.md`

## #21.4 Web 端口复用

### 目标

菜单 2 在 5173 已被占用时不直接失败。

### 行为

- 已有 LFAA Vite：复用；
- 其他程序占用 5173：自动找 5174-5199；
- 不结束未知进程；
- 终端必须显示真实 URL。

### 状态

`delivered in v0.0.28`

> 迁移来源：`docs/prompts/archive/v0.0.29/0019-06-依赖模型简化.md`

## #19.6 依赖模型简化

### 主任务

`#19 一键准备与依赖检测`

### 目标

把工具链和项目依赖规则固定成简单、稳定、普通用户无需理解内部细节的模式。

### 最终规则

```text
Node / pnpm / Git / Rust / Cargo
→ 电脑基础工具，只准备一次

node_modules / Cargo.lock / target / .lfaa
→ 项目内容，跟项目走
```

Rust 项目版本继续由：

```text
rust-toolchain.toml
```

锁定。

### Setup 行为

```text
已有工具
→ 直接复用

缺少 Rust/Cargo
→ Rust 官方 rustup-init
→ 官方 SHA-256 校验
→ 自动准备项目要求版本
```

不再让用户选择安装模式，不再优先尝试 WinGet。

### 状态

`delivered in v0.0.29`

> 迁移来源：`docs/prompts/archive/v0.0.30/0019-07-Setup主菜单循环.md`

## #19.7 Setup 主菜单循环

### 主任务

`#19 一键准备与依赖检测`

### 目标

Setup 普通操作结束后返回主菜单，不自动退出终端。

### 规则

```text
1 - 10
→ 执行操作
→ 显示结果
→ 按任意键返回主菜单

0
→ 退出
```

Web 按 Ctrl+C 停止后也必须返回主菜单。

普通错误同样返回主菜单。

### 状态

`delivered in v0.0.30`

> 迁移来源：`docs/prompts/archive/v0.0.30/0021-05-Web启动延迟修复.md`

## #21.5 Web 启动延迟修复

### 主任务

`#21 Web 工作台 UI`

### 根因

旧端口识别会从 5173 到 5199 逐个执行 HTTP 请求，每个失败请求可等待 1 秒。

在没有运行中的 LFAA Web 时会造成明显空白等待。

### 修复

```text
读取当前 TCP Listener
→ 只探测真正已占用端口
→ 识别已有 LFAA
→ 否则立即选空闲端口
```

Vite 改为直接执行项目本地 binary，不在菜单 2 走依赖安装流程。

### 验收

- 无服务时端口选择接近即时；
- 已运行 LFAA 时快速复用；
- 5173 被其他程序占用时快速切到下一端口；
- Ctrl+C 停止后返回 Setup 主菜单。

### 状态

`delivered in v0.0.30`

> 迁移来源：`docs/prompts/archive/v0.0.31/0021-06-三栏交互与终端停靠.md`

## #21.6 三栏交互与终端停靠

### 主任务

`#21 Web 工作台 UI`

### 目标

把工作台三栏交互继续收敛到接近 ChatGPT / Codex 的使用方式。

### 重点

- 分隔条只负责拖拽拉伸与自动吸附；
- 不再在分隔条中央叠加点击收起按钮；
- 左上 / 右上使用淡入式控制按钮做侧栏与终端显隐；
- 收起 / 展开要有过渡动画；
- 中间底部增加终端停靠区；
- 右侧工具里的“终端”与底部终端联动。

### 验收

- 三栏拖拽与自动吸附保留；
- 分隔条点击冲突消失；
- 左上 / 右上 hover 显示控制按钮；
- 点击可展开 / 收起左右侧栏与终端；
- 底部中间可以看到终端区；
- 过渡动画不再瞬间跳变。

### 状态

`delivered in v0.0.31`

> 迁移来源：`docs/prompts/archive/v0.0.32/0021-07-侧栏Hover与真实终端.md`

## #21.7 侧栏 Hover 与真实终端

### 主任务

`#21 Web 工作台 UI`

### 用户修正

#### 侧栏控制

Hover 控件不是中间顶部控件。

必须是：

```text
鼠标进入左侧栏
→ 左侧栏自己的控制淡入

鼠标进入右侧栏
→ 右侧栏自己的控制淡入
```

#### 终端

禁止模拟终端。

必须是：

```text
最底部 Dock
+ xterm.js
+ 真实 PTY
+ 可输入命令
+ 可看到真实 Shell 输出
```

### 开发实现

Web Vite 本地开发模式：

```text
@xterm/xterm
@xterm/addon-fit
node-pty
Vite custom HMR events
```

Windows 默认 Shell：

```text
powershell.exe -NoLogo
```

### 安全限制

- 仅 `127.0.0.1`；
- 只用于人类直接交互；
- 不作为 Agent 自动命令绕过 Tool Runtime 的入口；
- 正式 Desktop / Agent PTY 仍归 Rust Native Core。

### 状态

`pending-test in v0.0.32`

> 迁移来源：`docs/prompts/archive/v0.0.33/0019-08-node-pty跨机器安装.md`

## #19.8 node-pty 跨机器安装

### 主任务

`#19 一键准备与依赖检测`

### 问题

全新 Windows 电脑执行：

```text
LFAA-Setup.bat → 1
```

pnpm 因 `node-pty@1.1.0` 的构建脚本未被项目审核而报：

```text
ERR_PNPM_IGNORED_BUILDS
```

### 目标

- 用户不需要手动运行 `pnpm approve-builds`；
- 只批准 LFAA 已审核、锁定的原生依赖；
- 不降低 pnpm 的供应链安全门禁。

### 实现

```yaml
strictDepBuilds: true
allowBuilds:
  "node-pty@1.1.0": true
```

并在 Setup 安装后做 node-pty Smoke Check。

### 状态

`delivered in v0.0.33`

> 迁移来源：`docs/prompts/archive/v0.0.34/0019-09-node-pty校验引号兼容.md`

## #19.9 node-pty 校验引号兼容

### 主任务

`#19 一键准备与依赖检测`

### 问题

Windows PowerShell 5 下调用 `node -e` 时，内嵌 JavaScript 字符串中的引号可能被原生命令参数转换影响。

导致本来正确的：

```js
require("node-pty")
```

传到 Node 后变成：

```js
require(node-pty)
```

从而出现 SyntaxError。

### 修复

- 不再用 `node -e` 做 node-pty Smoke Check；
- 使用独立 `scripts/check-node-pty.mjs`；
- 从 `apps/web/package.json` 创建 require 上下文；
- 保留真实 `pty.spawn` 检查。

### 状态

`delivered in v0.0.34`

> 迁移来源：`docs/prompts/archive/v0.0.35/0019-10-Rustup平台目标修复.md`

## #19.10 Rustup 平台目标修复

### 主任务

`#19 一键准备与依赖检测`

### 问题

Windows 新机器菜单 `1` 在 Rust 缺失时调用：

```text
Get-WindowsRustupTarget
```

但函数没有定义，导致 Rust 官方安装流程在下载前直接失败。

### 修复

新增 Windows 架构到 Rustup 官方 target tuple 的映射：

```text
AMD64 → x86_64-pc-windows-msvc
ARM64 → aarch64-pc-windows-msvc
x86   → i686-pc-windows-msvc
```

同时：

- 兼容 32 位 PowerShell 运行于 64 位 Windows；
- 未知架构直接中文失败；
- 官方 HTTPS 与 SHA-256 校验保持；
- Governance 防止 helper 再次缺失。

### 状态

`delivered in v0.0.35`

> 迁移来源：`docs/prompts/archive/v0.0.36/0010-02-GitHub推送预检容错.md`

## #10.2 GitHub 推送预检容错

- 目标：修复 v0.0.35 在 `git ls-remote` 失败时提前中止一键推送。
- 约束：不强推、不覆盖远端历史，保留失败原始日志。
- 实现：fetch + rebase + safe push；预检异常只警告，最终以 push 结果为准。

> 迁移来源：`docs/prompts/archive/v0.0.36/0021-08-三向吸附与显式展开.md`

## #21.8 三向吸附与显式展开

- 左 / 右 / 底部都支持拖拽到阈值后吸附收起。
- 吸附完成后禁止通过 resize handle 反向拉开。
- 重新展开必须使用对应方向的显式 UI 入口。
- 底部终端新增 hover 展开控件。

> 迁移来源：`docs/prompts/archive/v0.0.37/0004-01-中文路径打包保护.md`

## #4.1 中文路径打包保护

- 目标：修复 v0.0.36 发布包中文文件名编码损坏，并防止错误版本包被同步到稳定工作区。
- 基线：必须保留 v0.0.36 的 GitHub 推送和三向吸附功能，不回退业务实现。
- 约束：稳定工作区 `.git`、本机日志、依赖缓存和 `.env` 保护规则保持不变。
- 实现：恢复 UTF-8 中文路径；同步前检测可逆 CP437→UTF-8 乱码；ZIP 产物生成后校验文件名。

> 迁移来源：`docs/prompts/archive/v0.0.38/0021-09-Web常驻工作台Chrome.md`

## #21.9 Web 常驻工作台 Chrome

- 参考 Codex 桌面端时，左栏 / 终端 / 右栏属于工作台壳层按钮，应常驻显示，不依赖 hover。
- 桌面端可承载在原生标题栏；Web 端没有原生应用菜单栏，必须在页面自身创建全宽顶栏承载这些入口。
- Web 顶栏左侧固定放左栏开合按钮，再显示当前工作台标题。
- Web 顶栏右侧固定放终端和右栏开合按钮；更多 / 分享属于次要操作。
- 左右侧栏内部不要重复放框架级开合按钮。
- 收起后不要依赖屏幕边缘 hover 热点重新展开。
- 保留拖拽吸附、吸附后 separator 禁止反向拉开、终端真实 PTY 等既有行为。

> 迁移来源：`docs/prompts/archive/v0.0.39/0021-10-主区悬浮与左栏预览.md`

## #21.10 主区悬浮与左栏预览

- Web 顶栏只保留标题、更多、分享等页面级操作；
- 左栏按钮移动到中间主区左上角；
- 终端 / 右栏按钮移动到中间主区右上角；
- 左栏收起后，鼠标移入左栏按钮临时淡入预览左栏内容，移出后淡出；
- Hover 只做临时预览，点击 / `Ctrl+B` 才改变正式 collapsed 状态；
- 右栏保持显式点击控制；
- 快捷键：`Ctrl+B`、`Ctrl+J`、`Ctrl+Alt+B`；
- 保留三向吸附和吸附后禁止 separator 反向展开。

> 迁移来源：`docs/prompts/archive/v0.0.40/0004-02-同步目标与ZIP编码.md`

## #4.2 同步目标与 ZIP 编码

- 修复版本包多包一层目录后，Sync 把目标错误推导到版本包内部的问题；
- 默认目标应始终定位到版本目录同级 `lfaa` 稳定工作区；
- 扩展中文路径乱码保护，除 CP437 外还要识别 CP936/GBK；
- 发布 ZIP 直接以项目根内容入包；
- 打包后验证 UTF-8 中文路径和文件内容 Round-trip。

> 迁移来源：`docs/prompts/archive/v0.0.41/0020-03-代码可读性与项目地图.md`

## #20.3 代码可读性与项目地图

- 关键 TS / TSX / CSS / PowerShell 文件必须写结构化中文文件头；
- 文件头说明作用、负责、不负责、状态归属、对外接口、关联文件、修改注意事项；
- CSS 必须说明页面区域、盒子父子关系和分区；
- 第一次打开项目的人必须有一份完整的项目结构 / 文件职责地图；
- `apps/`、`packages/`、`crates/`、`scripts/` 等一级目录必须有人类可读 README；
- 当前 Web UI 要明确说明 App → App Shell → Layout → Terminal 的文件调用链；
- 增加自动检查，防止以后关键实现文件再次漏注释；
- 修正 v0.0.39 / v0.0.40 后开发日志和 UI 规范没有跟上代码的事实源漂移。

> 迁移来源：`docs/prompts/archive/v0.0.42/0004-03-PowerShell脚本编码保护.md`

## #4.3 PowerShell 脚本编码保护

### 主模块

`project-foundation / workspace-sync`

### 任务目标

修复 v0.0.41 因 PowerShell 脚本 UTF-8 BOM 被移除导致的 Windows PowerShell 5.1 兼容性回归，并建立发布前自动编码门禁。

### 当前约束

- v0.0.41 不覆盖，作为历史缺陷版本保留；
- 修复进入 v0.0.42；
- Sync 业务算法不改，只恢复可执行编码契约；
- GitHub / Setup / Update 同类 `.ps1` 一并恢复 BOM；
- `.git` 稳定工作区规则不变；
- 发布 ZIP 不允许双层根目录。

### 验收

- `scripts/windows/*.ps1` 全部 UTF-8 with BOM；
- 编码门禁进入 governance；
- ZIP 解压后 BOM 仍存在；
- 同步目标逻辑仍与 v0.0.40/v0.0.41 一致。

### 状态

`delivered / v0.0.42`

> 迁移来源：`docs/prompts/archive/v0.0.42/0021-10-主区悬浮与左栏预览.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell`

### 任务目标

实现可通过 Vite 本地启动、可供 Web / Desktop 复用的三栏工作台 UI，作为 Config UI、Agent UI 和 `.lfaa` 热插拔验证壳。

### 当前交互事实

#### 三栏

- 左栏：导航 / 项目 / 会话；
- 中间：工作区 / 对话 / Composer；
- 右栏：工具 / 运行状态 / 项目资源；
- 左右分隔条只负责拖拽；
- 到达最小宽度立即自动吸附；
- 同一次拖拽反向拉回使用迟滞避免抖动；
- Pointer Up 完成吸附后，separator 禁止反向拖开。

#### Web 页面顶栏

页面顶栏只保留：

```text
Web 工作台标题
更多
分享
```

Shell 开合按钮不再放在顶栏。

#### 中间主区 Shell Actions

```text
中间主区左上角
→ 左栏按钮

中间主区右上角
→ 终端按钮
→ 右栏按钮
```

左栏按钮有两种不同交互：

```text
Hover / Focus（仅左栏已收起）
→ 临时淡入左栏内容预览
→ 不修改 leftCollapsed

Click / Ctrl+B
→ 正式改变 leftCollapsed
→ 展开 / 收起 Grid 左栏
```

右侧保持显式控制：

```text
Ctrl+J
→ 终端

Ctrl+Alt+B
→ 右栏
```

右栏禁止 Hover 自动展开。

#### 真实终端

底部终端必须位于工作区最底部：

```text
左侧栏保持全高
中间 + 右侧区域底部
→ Terminal Dock
```

Web 本地开发终端：

```text
xterm.js
↓
Vite HMR custom events
↓
node-pty
↓
PowerShell / 系统 Shell
```

禁止模拟日志冒充终端。

### 允许修改

- `packages/ui`
- `packages/app-shell`
- `apps/web`
- Vite 开发桥接
- UI / Security / Testing / Readability 文档

### 禁止修改

- Agent Loop
- Tool Runtime
- Permission Engine
- 正式 Rust Broker / Rust PTY Broker
- Config Storage
- Secret Store
- Knowledge
- Plugin Runtime 正式实现

### 状态所有权

- 左右栏正式 collapsed 状态：`AgentWorkbench` Shell 状态；
- 左栏 Hover Preview：`AgentWorkbench` 临时 UI 状态；
- 侧栏宽度 / 底栏高度：`ResizableWorkbench` 几何状态；
- 终端显隐：`AgentWorkbench` Shell 状态；
- Web 终端 PTY 进程：Vite 本地开发桥接；
- 正式 Desktop / Agent PTY：未来 Rust Native Core；
- `.lfaa` 资源快照：Vite 只读开发桥接。

### 安全边界

开发终端属于人类直接交互，不属于 Agent Tool。

必须：

- 绑定 `127.0.0.1`；
- 默认 cwd 为项目根；
- 不自动提升权限；
- 不读取 / 注入 Secret；
- 页面 / Vite 关闭时回收 PTY；
- 不作为 Agent 绕过 Policy / Permission 的执行路径。

### 性能要求

- 侧栏拖拽使用 `requestAnimationFrame`；
- 吸附 150ms - 220ms；
- 左栏 Preview 使用 opacity / transform 淡入淡出，不改变 Grid；
- Terminal resize 使用 `ResizeObserver` + xterm FitAddon；
- UI 主线程不执行阻塞系统调用。

### 验收条件

- 页面顶栏只保留标题 / 更多 / 分享；
- 左栏按钮位于中间主区左上角；
- 终端 / 右栏按钮位于中间主区右上角；
- 左栏收起时 hover 可临时预览，离开后淡出；
- Hover Preview 不修改正式 collapsed 状态；
- 点击 / `Ctrl+B` 正式开合左栏；
- 右栏不做 Hover 自动展开；
- `Ctrl+J` 控制终端；
- `Ctrl+Alt+B` 控制右栏；
- 左右侧栏拖拽 / 吸附正常；
- 吸附完成后不能从 separator 反向拖开；
- 底部 Terminal Dock 可拉高 / 拉低 / 吸附收起；
- Web Terminal 可以真正输入 PowerShell 命令并看到输出；
- `.lfaa` 热插拔继续可用；
- 关键实现文件注释与 UI 文档同步。

### 当前状态

`active / pending-test`

> 迁移来源：`docs/prompts/archive/v0.0.43/0021-11-Header联动与按钮归属修正.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell`

### 当前任务目标

实现接近 ChatGPT / Codex 的顶部 Header 联动三栏工作台：框架按钮属于区域 Header，不能漂在正文层。

### 当前交互事实

#### 顶部 Header

```text
Center Header 左侧
→ 左栏按钮 / 标题

Center Header 右侧
→ 更多 / 分享
→ RightCollapsed=true 时再显示终端 / 右栏按钮

Right Header
→ RightCollapsed=false 时显示终端 / 右栏按钮
```

Center / Right Header 必须同高并形成连续顶部结构。

#### 左栏

- Hover / Focus（仅正式收起时）：临时淡入左栏预览，不修改 `leftCollapsed`；
- Click / `Ctrl+B`：正式开合左栏；
- Preview 必须低于 Header 层级，不能挡住左栏按钮点击。

#### 右栏与终端

- `Ctrl+J`：切换底部终端；
- `Ctrl+Alt+B`：切换右栏；
- 右栏不做 Hover 自动展开；
- 按钮提供可见 Tooltip + 原生 title 提示。

#### 拖拽与真实终端

- 左右 separator 只负责拖拽/吸附；
- 吸附后禁止 separator 反向拖开；
- Terminal Dock 使用 xterm + node-pty，禁止模拟日志冒充终端。

### 允许修改

- `packages/app-shell`
- 必要时 `packages/ui`
- `apps/web`
- UI / Testing / Readability 文档

### 禁止修改

- Agent Loop / Tool Runtime / Permission Engine
- Config Storage / Secret Store
- 正式 Rust PTY Broker
- GitHub / Sync / Setup / Update 业务逻辑

### 验收条件

- 不存在 `agent-center-floats` / `agent-center-toggle` 旧正文悬浮实现；
- 中间 Header 是正常文档流第一行；
- 右栏展开时按钮位于右栏 Header；
- 右栏收起时按钮回到中间 Header；
- 左栏 Hover Preview 与点击开合语义分离；
- 快捷键与 Tooltip 一致；
- 三向吸附、PTY、资源桥不回退；
- 代码注释、UI Layout、Development Log、Changelog / Release 同步。

### 当前状态

`active / pending-test`

> 迁移来源：`docs/prompts/archive/v0.0.44/0021-12-ShellTooltip单一提示源.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell`

### 当前任务目标

保持 #21.11 的 Header 联动布局，只修复 Shell Header 三个框架按钮的重复 Tooltip，并建立防回归门禁。

### 当前交互事实

#### Header 布局

```text
Center Header 左侧
→ 左栏按钮 / 标题

Center Header 右侧
→ 更多 / 分享
→ RightCollapsed=true 时再显示终端 / 右栏按钮

Right Header
→ RightCollapsed=false 时显示终端 / 右栏按钮
```

#### Tooltip 单一来源

三个 Shell Header 按钮只允许：

```text
aria-label
+
.agent-shell-tooltip
```

禁止：

```text
title="..."
+
.agent-shell-tooltip
```

原因：浏览器原生 `title` 会在自定义 Tooltip 之后再次弹出第二层提示，造成重复黑框。

Tooltip 必须 `pointer-events:none`，不得抢鼠标 Hover / Click。

#### 快捷键

- `Ctrl+B`：左栏正式开合；
- `Ctrl+J`：底部终端开合；
- `Ctrl+Alt+B`：右栏开合。

### 允许修改

- `packages/app-shell/src/AgentWorkbench.tsx`
- UI 契约门禁脚本
- UI / Testing / Development Log / Changelog / Release 文档

### 禁止修改

- `packages/ui` 拖拽吸附算法（本次无必要）
- Agent Loop / Tool Runtime / Permission Engine
- Config Storage / Secret Store
- GitHub / Sync / Setup / Update 业务逻辑
- PTY 业务逻辑

### 验收条件

- 左栏按钮 Hover 只出现一层提示；
- 终端按钮 Hover 只出现一层提示；
- 右栏按钮 Hover 只出现一层提示；
- Shell Header 按钮不存在 `title=`；
- 自定义 Tooltip 仍显示快捷键；
- Tooltip 不拦截鼠标事件；
- Header 联动、Hover Preview、三向吸附、PTY 不回退；
- `scripts/ui-contract-check.mjs` 进入治理门禁；
- Development Log / UI Layout / Test / Changelog / Release 同步。

### 当前状态

`active / pending-test`

> 迁移来源：`docs/prompts/archive/v0.0.45/0021-13-响应式重构与弹性吸附.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

在 v0.0.44 的 Header / Tooltip 基线上，修复窄屏布局崩溃、Shell 控件在覆盖式侧栏中不可见、三向拖拽吸附过硬的问题，并把响应式与拖拽状态机升级为当前正式方案。

### 当前交互事实

#### 1. 三档响应式

```text
Desktop >= 1180px
→ 左 / 中 / 右 Dock 布局
→ 右栏展开时 Shell Actions 位于 Right Header

Compact 760 ~ 1179px
→ 左栏保持 Dock
→ 右栏改为覆盖式 Drawer
→ Shell Actions 始终留在 Center Header，保证关闭入口可见

Mobile < 760px
→ 中间主区全宽
→ 左右栏都改为覆盖式 Drawer
→ 默认收起左右栏与底部终端
→ Header 中始终保留左栏 / 终端 / 右栏三个核心入口
```

#### 2. Tooltip

- 左栏 Tooltip 从按钮左边界向右展开；
- 右侧两个 Tooltip 从按钮右边界向左展开；
- 禁止原生 `title` 与自定义 Tooltip 共存；
- Mobile 下不依赖 Hover Tooltip 作为必要入口。

#### 3. 三向拖拽吸附

左栏、右栏、底部终端统一：

```text
Pointer Down
→ Pointer Capture
→ 正常跟手拖拽
→ min 以下进入弹性磁区
→ 靠近边缘才标记 snapped
→ 鼠标仍按住时可以反向拖回 min
→ 回到 min 即退出 snapped
→ 继续向外拉伸
```

只有：

```text
Pointer Up 时仍处于 snapped
```

才真正提交收起。

Pointer Up 完成收起后，separator 禁止重新展开，只能通过显式按钮或快捷键重新打开。

#### 4. 动画手感

- Pointer Move 阶段禁止 CSS transition 追赶鼠标；
- 吸附提交 / 按钮展开使用统一 ease-out；
- 不允许从 `min` 硬跳到 `0`；
- 展开/收起要平滑，但不能拖泥带水。

### 允许修改

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- UI 契约门禁
- UI / Testing / Development Log / Plan / Progress / Changelog / Release 文档

### 禁止修改

- GitHub / Sync / Setup / Update 业务逻辑
- PTY 协议和 node-pty bridge
- Agent Runtime / Tool Runtime / Permission Engine
- Config Storage / Secret Store

### 验收条件

- Desktop / Compact / Mobile 三档结构明确；
- 小窗口不再出现右栏占 80%+ 宽度导致主区消失；
- 右栏覆盖模式下关闭按钮始终可见；
- Mobile 中间主区保持完整可用；
- 左 / 右 / 底部三向拖拽都支持“按住时吸附后反向拖回 min”；
- 松手确认收起后不能从 separator 反向展开；
- 拖拽过程中无 transition 追鼠标造成的卡顿；
- Tooltip 不被左右边缘裁切；
- `Ctrl+B` / `Ctrl+J` / `Ctrl+Alt+B` 保持；
- Windows PowerShell 脚本不修改且 BOM 不回退；
- Development Log / UI Layout / Test / Code Map / Changelog / Release 同步。

### 当前状态

`active / pending-windows-visual-test`

> 迁移来源：`docs/prompts/archive/v0.0.46/0021-14-最小尺寸吸附收起语义修正.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

在 v0.0.45 的响应式基线上，修正三向吸附语义：**吸附目标是收起，不是把仍然展开的面板压到 min 以下。** 同时提高左栏、右栏、底部终端的可用最小尺寸，保证内容在展开状态下仍可阅读。

### 当前交互事实

#### 1. 三档响应式

```text
Desktop >= 1240px
→ 左 / 中 / 右 Dock 布局

Compact 760 ~ 1239px
→ 左栏 Dock
→ 右栏 Drawer

Mobile < 760px
→ 中间主区全宽
→ 左右栏 Drawer
```

#### 2. 可用最小尺寸

```text
左栏：min 280 / initial 300 / max 640
右栏：min 360 / initial 400 / max 760
Bottom：min 180 / initial 280 / max 560
```

min 是“展开态还能正常排版”的硬下限，不能再拿 min 以下的宽度显示内容。

#### 3. 三向拖拽吸附

左栏、右栏、底部终端统一：

```text
Pointer Down
→ 正常跟手 Resize
→ 到达 min
→ 立即进入 snap capture / 收起预览
→ 预览尺寸吸到 0
```

如果鼠标仍然按住：

```text
snap capture
→ 反向拖动
→ 达到 min + snapHysteresis
→ 退出 snap capture
→ 面板恢复到至少 min
→ 可继续向外拉伸
```

只有：

```text
Pointer Up 时仍处于 snapped
```

才真正提交 collapsed。

正式 collapsed 后 separator 不能重新拉开，只能通过：

```text
Ctrl+B       左栏
Ctrl+J       Bottom Terminal
Ctrl+Alt+B   右栏
```

或对应 Header 按钮恢复。

#### 4. 动画手感

- 普通 pointermove 阶段不启用 Grid transition；
- 到 min 触发 snap preview 时允许一个很短的磁吸收起过渡；
- 不允许出现 min 以下的“半残废展开态”；
- 正式开合继续使用平滑 ease-out。

### 允许修改

- `packages/app-shell/src/AgentWorkbench.tsx`
- `packages/app-shell/src/agent-workbench.css`
- `packages/ui/src/workbench/ResizableWorkbench.tsx`
- `packages/ui/src/workbench/workbench.css`
- `scripts/ui-contract-check.mjs`
- UI / Testing / Development Log / Plan / Progress / Changelog / Release / Code Map

### 禁止修改

- GitHub / Sync / Setup / Update 业务逻辑
- PTY 协议和 node-pty bridge
- Agent Runtime / Tool Runtime / Permission Engine
- Config Storage / Secret Store

### 验收条件

- 左右栏展开时不允许小于 min；
- 拖到 min 立即进入吸附收起预览；
- Pointer 不松手可从已吸附状态反向拖回并恢复至少 min；
- 松手后正式 collapsed，separator 不可展开；
- 右栏最小宽度足以完整显示“审查 / 终端 / 浏览器 / 文件”及快捷键，不再出现截图中的文字截断；
- Desktop / Compact 断点与新 min 相容；
- Windows PowerShell 脚本不修改且 BOM 不回退；
- Development Log / UI Layout / Test / Code Map / Changelog / Release 同步。

### 当前状态

`active / pending-windows-visual-test`

> 迁移来源：`docs/prompts/archive/v0.0.47/0021-15-容器响应式与布局变量化.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

以 v0.0.46 为历史基线，修正固定侧栏宽度与固定 viewport 断点导致的小窗口布局崩溃。布局必须更接近 ChatGPT / Codex 的“主区优先 + 侧栏按空间自动 Dock/Overlay”行为，并把几何配置集中为可维护变量和计算公式。

### 当前实现要求

#### 1. 单一布局变量源

禁止在 `AgentWorkbench.tsx` 继续出现：

```text
LEFT_LIMITS
RIGHT_LIMITS
BOTTOM_LIMITS
```

统一使用：

```text
packages/ui/src/workbench/workbench-layout.config.ts
```

其中必须集中维护：

- ratio；
- floor；
- ceiling；
- center 保护；
- separator；
- snap hysteresis。

#### 2. 容器响应式

不以 `window.innerWidth < 某固定值` 决定工作台模式。

必须：

```text
agent-workbench-stage
→ ResizeObserver
→ resolveWorkbenchLayoutMetrics(rect.width, rect.height)
→ Desktop / Compact / Mobile
```

#### 3. 当前几何目标

当前动态安全范围：

```text
左栏 min 约 196~232
右栏 min 约 228~288
Bottom min 约 136~176
```

实际值必须由容器计算，不能直接作为业务固定宽度使用。

#### 4. 模式语义

```text
Desktop：容器真正放得下 left + center + right 才双 Dock
Compact：左 Dock + 右 Overlay
Mobile：左右 Overlay + 主区全宽
```

右 Overlay 不能再把主区挤小；Overlay 宽度必须通过 CSS 变量 + `clamp()` / 百分比计算。

#### 5. 三向吸附

左 / 右 / Bottom 继续统一：

```text
正常 Resize
→ 到动态 min
→ snap preview 收到 0
→ Pointer 仍按住可反向越过 hysteresis 恢复
→ Pointer Up 仍 snapped 才正式 collapsed
```

正式 collapsed 后 separator 不能拖开，只能通过：

```text
Ctrl+B
Ctrl+J
Ctrl+Alt+B
```

或 Header 对应按钮恢复。

#### 6. 动画

- 普通 resize：transition:none，跟手；
- snap preview：短磁吸过渡；
- 正式按钮开合：ease-out；
- 不允许以 min 以下尺寸继续渲染残缺侧栏。

### 允许修改

- App Shell / UI Workbench 当前实现；
- 布局 config / types / exports；
- UI contract；
- UI Standard / Test / Code Map / README；
- Prompt / Plan / Progress / Development Log / Changelog / Release / Version。

### 禁止修改

- Sync / GitHub / Setup / Update 业务逻辑；
- PTY 协议 / node-pty bridge；
- Agent Runtime / Permission / Config / Rust Native 边界。

### 验收条件

- 950px 左右窗口不再同时被大左栏 + 大右栏挤压；
- 1024px 左右在容器允许时可维持合理双 Dock；
- 760~950px 右栏变 Overlay，中央主区不变窄；
- <680px 左右栏都 Overlay；
- 侧栏最小宽度明显小于 v0.0.46 的 280 / 360，但仍足够阅读；
- 历史持久化宽度会随容器重新 clamp；
- CSS 尺寸由变量 / rem / clamp / calc 维护；
- 三向吸附行为不回退；
- Windows 脚本与 PTY 不变；
- 所有当前事实源同步更新。

### 当前状态

`active / pending-windows-visual-test`

> 迁移来源：`docs/prompts/archive/v0.0.48/0021-16-Hover与点击左栏宽度统一.md`

## #21 Web 工作台 UI

### 主模块

`project-foundation / app-shell / ui-workbench`

### 当前任务目标

以 v0.0.47 为历史基线，修复左栏 Hover Preview 与点击正式展开宽度不一致的问题。两种展示必须共享同一个实际左栏宽度事实源，不能再分别用 CSS clamp 和 ResizableWorkbench 内部 width 两套值。

### 当前实现要求

#### 1. 单一宽度事实源

```text
ResizableWorkbench.leftWidth
→ onLeftWidthChange(width)
→ AgentWorkbench.leftPaneWidth
→ --agent-left-preview-width
→ Hover Preview
```

正式 Dock 和 Hover Preview 必须使用同一个 width。

#### 2. 默认与用户调整后都一致

- 初次打开：Preview = 当前响应式 `left.initial`；
- 用户拖过左栏后：Preview = 用户最后真实左栏宽度；
- 容器缩小时：Preview 跟随重新 clamp 后的真实宽度；
- collapsed 状态 Hover 不得维护第二套 `clamp()` 宽度。

#### 3. 保持现有行为

- 容器响应式 / Desktop / Compact / Mobile 不回退；
- 三向到 min 吸附收起不回退；
- Pointer 不松手反向解锁不回退；
- Header / Tooltip / PTY / Sync / GitHub / Setup / Update 不改业务逻辑。

### 允许修改

- `AgentWorkbench.tsx`；
- `agent-workbench.css`；
- `ResizableWorkbench.tsx`；
- `workbench-layout.types.ts`；
- UI contract；
- 当前 UI 文档、测试、代码地图、Plan / Progress / Development Log / Changelog / Release / Version。

### 验收条件

- Hover Preview 与点击展开后的左栏宽度视觉一致；
- 用户手动 resize 后再次 collapsed，Hover Preview 仍与下一次 click 展开宽度一致；
- CSS 不再存在独立 `--agent-left-preview-width: clamp(...)`；
- UI contract 能阻止第二套 Preview 宽度回归；
- 基础设施和 PTY 不变。

### 当前状态

`active / pending-windows-visual-test`
