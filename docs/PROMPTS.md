# LFAA 提示词与任务合同

本文件登记当前实现任务的目标、验收条件和修改边界。任务合同优先于旧的阶段草案；实际代码与架构文档需保持一致。

## 任务索引

| 编号 | 任务 | 状态 | 合同 |
|---|---|---|---|
| LFAA-UI-WORKMODE-HOME-01 | 工作区首页按钮返回当前应用与工作模式首页，应用中心入口保持原路由 | 已完成（前端构建通过；浏览器交互待验） | 本文件“LFAA-UI-WORKMODE-HOME-01” |
| LFAA-UI-APP-CONTEXT-01 | 切换应用时保留各自 AI Work 会话与未发送草稿，并明确当前应用 | 实现完成（交互未验收） | 本文件“LFAA-UI-APP-CONTEXT-01” |
| LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01 | 模式切换时保留用户主动设置的应用侧栏收起状态 | 已修复（前端构建通过；浏览器交互待验） | 本文件“LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01” |
| LFAA-UI-AI-PROVIDER-LOADING-01 | AI Work 加载 Provider 时不短暂误报未配置 | 已修复（Vite 构建通过；完整构建受 TypeScript 错误阻塞；浏览器交互待验） | 本文件“LFAA-UI-AI-PROVIDER-LOADING-01” |
| LFAA-UI-MODULE-NOTIFICATIONS-01 | 优化应用侧栏顶栏的左右布局，并提供真实 AI Work 完成通知卡片 | 已完成（构建通过；浏览器目视待验） | 本文件“LFAA-UI-MODULE-NOTIFICATIONS-01” |
| LFAA-APP-SANDBOX-01 | 将应用作为安全范围、模式作为应用内交互方式，并为当前 Minecraft Daemon 接入 fail-closed Windows OS 沙盒 | 实现代码已接入（Windows 实机验收待做） | 本文件“LFAA-APP-SANDBOX-01” |
| LFAA-UI-WORKBENCH-DEFAULTS-01 | 稍微收窄工作台左右栏默认展开宽度，并让右侧工具栏默认收起 | 已完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-UI-WORKBENCH-DEFAULTS-01” |
| LFAA-UI-WORKBENCH-SNAP-01 | 修复工作台左右栏吸附收起/展开残影、拖尾及过程中的横向滚动条 | 已修复（Vite 构建通过；TypeScript 检查被其他文件错误阻塞；浏览器实拖待验） | 本文件“LFAA-UI-WORKBENCH-SNAP-01” |
| LFAA-UI-COMPOSER-PANE-SWAP-01 | 按 Codex 对话输入框的交互层级优化 AI Work 输入区，并允许桌面工作台交换中间区与右侧工具资源栏 | 已完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-UI-COMPOSER-PANE-SWAP-01” |
| LFAA-UI-CENTER-SCROLLBAR-HIDE-01 | 隐藏应用工作区中间内容区的滚动条，同时保留原有滚动能力 | 已完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-UI-CENTER-SCROLLBAR-HIDE-01” |
| LFAA-P4-MINECRAFT-MVP-01 | 按用户优先级先完成 Minecraft 管理 MVP，并为后续应用保留统一工作台与 AI Runtime 边界 | 进行中 | 本文件“LFAA-P4-MINECRAFT-MVP-01” |
| LFAA-MINECRAFT-TASK-RECOVERY-01 | 修复 SQLite 迁移测试版本断言，并为 Minecraft Daemon 任务加入心跳租约和中断恢复 | 已完成（测试与完整构建通过；真实 Minecraft 未验） | 本文件“LFAA-MINECRAFT-TASK-RECOVERY-01” |
| LFAA-P1-01-05 | 完成依赖与持久化、server 基础、应用中心、前后端健康状态闭环、账户登录与权限基础 | 进行中 | 本文件“LFAA-P1-01-05” |
| LFAA-P1-01-07 | 提供根目录并行开发启动命令和 Windows 单窗口一键启动入口 | 已完成 | 本文件“LFAA-P1-01-07” |
| LFAA-UI-MODULE-CANVAS-01 | 让所有应用模式的中间工作区铺满可用区域，并让 AI Work 中间区只显示对话 | 已完成（浏览器目视待验） | 本文件“LFAA-UI-MODULE-CANVAS-01” |
| LFAA-UI-HOME-RESPONSIVE-01 | 收紧应用中心桌面留白并适配矮窗口 | 已完成（浏览器目视待验） | 本文件“LFAA-UI-HOME-RESPONSIVE-01” |
| LFAA-SETTINGS-AI-GROUP-SPACING-01 | 修正 AI 账户区与推理参数标题的间距 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-AI-GROUP-SPACING-01” |
| LFAA-UI-PERF-SETTINGS-01 | 修复设置中心主题闪烁与重复加载，并优化按需读取 | 已完成 | 本文件“LFAA-UI-PERF-SETTINGS-01” |
| LFAA-UI-PERF-SETTINGS-02 | 降低设置中心长分类滚动时的布局与绘制负担 | 已完成（登录后滚动帧采样待实测） | 本文件“LFAA-UI-PERF-SETTINGS-02” |
| LFAA-UI-SETTINGS-PRELOAD-01 | 预热设置页代码，减少首次进入时的等待与闪动 | 已完成（浏览器冷启动目视待验） | 本文件“LFAA-UI-SETTINGS-PRELOAD-01” |
| LFAA-UI-REFRESH-PERSISTENCE-01 | 修复刷新期间的登录闪现并记住设置分类与滚动位置 | 已完成（浏览器刷新实测待验） | 本文件“LFAA-UI-REFRESH-PERSISTENCE-01” |
| LFAA-UI-SCROLL-RESTORATION-SHARED-01 | 统一恢复设置与各功能页面的滚动位置 | 实现完成（构建通过；浏览器刷新验收待验） | 本文件“LFAA-UI-SCROLL-RESTORATION-SHARED-01” |
| LFAA-SETTINGS-AUTOSAVE-01 | 让设置中心所有已接入的账户设置自动持久化 | 实现完成（构建通过；浏览器刷新验收待验） | 本文件“LFAA-SETTINGS-AUTOSAVE-01” |
| LFAA-SETTINGS-BACKGROUND-RENDER-01 | 修复设置中心所选背景被内部工作台底色遮挡 | 已修复（前端构建通过；浏览器目视待验） | 本文件“LFAA-SETTINGS-BACKGROUND-RENDER-01” |
| LFAA-SETTINGS-NOTIFICATIONS-01 | 将设置中心通知接入真实 AI Work 完成事件与浏览器通知 | 已完成 | 本文件“LFAA-SETTINGS-NOTIFICATIONS-01” |
| LFAA-SETTINGS-TYPOGRAPHY-01 | 统一设置中心字号层级并显露外观字号控制 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-TYPOGRAPHY-01” |
| LFAA-SETTINGS-LAYOUT-UNIFICATION-01 | 统一设置中心全部分类的布局、尺寸与间距 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-LAYOUT-UNIFICATION-01” |
| LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01 | 对齐设置侧栏顶部的返回与收起按钮 | 已完成（Vite 构建通过；类型检查受其他文件错误阻塞，浏览器目视待验） | 本文件“LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01” |
| LFAA-FRONTEND-CSS-SHARED-01 | 建立清晰的前端公共 CSS 入口并分离共享样式 | 已完成 | 本文件“LFAA-FRONTEND-CSS-SHARED-01” |
| LFAA-AI-ARCH-01 | 建立 AI 插件宿主的最小后端基础并验证 Cordis | 已完成 | 本文件“LFAA-AI-ARCH-01” |
| LFAA-AI-RUNTIME-01 | 完成 AI Work Runtime 并按业务归属接入设置中心 | 进行中 | 本文件“LFAA-AI-RUNTIME-01” |
| LFAA-AI-PERMISSIONS-01 | 将 AI 工具权限接入三种模式、可记忆授权和独立审批控制 | 已完成 | 本文件“LFAA-AI-PERMISSIONS-01” |
| LFAA-AI-PERMISSIONS-DB-01 | 修复 AI 审批与记忆授权表的版本 8 数据库迁移兼容 | 已完成 | 本文件“LFAA-AI-PERMISSIONS-DB-01” |
| LFAA-SERVER-POLL-LOG-01 | 降低健康与会话轮询成功日志的终端噪声 | 已完成 | 本文件“LFAA-SERVER-POLL-LOG-01” |
| LFAA-SETTINGS-PERMISSION-CLARITY-01 | 按 LFAA 实际能力完善常规页访问边界说明与权限页策略说明 | 已完成 | 本文件“LFAA-SETTINGS-PERMISSION-CLARITY-01” |
| LFAA-OBS-SERVER-LOGS-01 | 观察开发终端中的偏好、AI 查询与认证日志；确认是否需要单独修复 | 待开始 | 本文件“LFAA-OBS-SERVER-LOGS-01” |
| LFAA-GITHUB-FORCE-PUSH-01 | 从根目录菜单一键提交并强制推送当前源码到指定 GitHub main | 已完成（PowerShell 语法通过；推送未运行） | 本文件“LFAA-GITHUB-FORCE-PUSH-01” |
| LFAA-REALTIME-SOCKET-01 | 为 Minecraft 现有任务、日志与状态接入经会话认证的 Socket.IO 实时推送 | 进行中 | 本文件“LFAA-REALTIME-SOCKET-01” |

## LFAA-UI-WORKMODE-HOME-01

### 用户目标

在应用工作区点击左侧主导航栏的房子按钮时，返回当前应用、当前工作模式的首页；明确的“应用中心”入口继续打开应用中心。

### 当前合同

- 工作模式首页使用当前路由中的应用 ID 和模式 ID，目标格式为 `/apps/{app}/{mode}`，从同一模式的子页面返回时清除子页面路径。
- 左侧主导航栏房子按钮使用“返回工作模式首页”的名称和行为。
- 侧栏“应用中心”、更多入口中的“应用中心”、全局顶栏“应用中心”和应用中心品牌入口继续导航到 `/`。
- 不改变快捷键“返回应用中心”的语义、应用/模式切换、工作区布局或其他页面行为。
- 完成标准：代码可静态确认两类入口路由分离；前端构建通过，构建产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`：区分工作模式首页按钮与应用中心入口。
- `frontend/src/components/Workbench.tsx`：向工作区提供当前应用与模式的首页路由。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不修改应用中心自身路由、侧栏明确的“应用中心”入口、快捷键语义、应用/模式偏好或持久化。
- 不改其他业务页面、样式或布局；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 工作区左侧主导航的房子按钮现在回到当前应用与工作模式根路由；侧栏和更多入口中明确的“应用中心”仍回到 `/`。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均成功，产物位于 `dist/frontend/`。未进行浏览器交互验收；当前目录没有 Git 元数据，无法核查 Git 变更状态。

## LFAA-GITHUB-FORCE-PUSH-01

### 用户目标

运行根目录 `lfaa.bat` 后，可从现有项目管理菜单一键将 `H:\LFAA` 当前源码提交并强制推送到 `https://github.com/yubboo/LFAA.git` 的 `main` 分支。

### 当前合同

- 保留现有安装、开发服务、环境检查和源码备份菜单；新增独立 GitHub 推送选项，由用户选择后才启动 Git 写操作。
- 推送前复用或初始化当前工作区 Git 仓库，将 `origin` 固定为用户指定地址；有变更时列出待提交文件并要求提交说明，缺少 Git 作者信息时只写入当前仓库配置。
- 推送目标固定为 `origin` 的 `main`，使用 `git push --force` 语义覆盖远端 `main` 历史，并明确显示该行为；本任务只实现脚本，不实际初始化 Git、提交或推送。
- 提交前从暂存区排除 `data/`、`dist/`、依赖目录、本机 `.env`、日志及数据库文件；仅移除这些文件的暂存状态，保留本地文件，并继续到提交说明步骤。
- 复用 Git CLI 的原始错误信息，不添加依赖或额外服务。
- 完成标准：从 `lfaa.bat` 能选到 GitHub 推送入口；目标 URL、目标分支、强制推送行为与敏感路径阻止逻辑可静态核对；PowerShell 脚本语法检查通过。

### 允许修改

- `lfaa.bat`：更新入口用途说明。
- `scripts/install-dependencies.ps1`：在现有管理菜单加入 GitHub 强制推送选项及其本地 Git 流程。
- `.gitignore`：忽略 `data/` 与 `server/data/` 运行数据目录。
- `docs/PROMPTS.md`：登记本任务合同与完成记录。

### 禁止修改

- 不在本任务中运行 Git 初始化、暂存、提交、远端写入或强制推送。
- 不修改目标 GitHub 仓库内容，不推送其他分支，不把运行数据、凭据或构建产物纳入提交。
- 不调整与菜单及 GitHub 推送无关的安装、启动、备份或业务代码。

### 完成记录（2026-09-28）

- 根目录 `lfaa.bat` 继续启动现有项目菜单；新增菜单项 6，选择后执行 GitHub 推送流程。首次运行会在当前工作区初始化 `main`，将 `origin` 与 push URL 固定到 `https://github.com/yubboo/LFAA.git`；检测到变化时列出暂存文件、要求提交说明，再强制推送到远端 `main`。
- 强制推送前会明确提示远端历史将被覆盖。Git 作者名和邮箱缺失时只询问并写入当前仓库配置，不修改全局 Git 配置。
- 根 `.gitignore` 忽略 `/data/` 与 `/server/data/`。针对本次失败输出中的 `server/data/ai-runtime-smoke`，脚本会仅从暂存区排除运行数据且保留本地文件，然后继续展示待提交清单并要求输入必填提交说明。
- Windows PowerShell Parser 语法检查和工作区 `git diff --check` 通过。用户运行旧版脚本后，`.git` 已初始化为 `main`，源码仍处于暂存状态且尚无提交；本轮没有更改暂存区或执行提交、推送。`git diff --cached --check` 还报告了先前暂存文件中的行尾空白问题，涉及 `.gitignore` 的旧暂存副本、`docs/updata-log.md` 和若干前端文件。仓库没有 `scripts/workspace-preflight.mjs`，因此 workspace preflight 未运行。

## LFAA-UI-MODULE-NOTIFICATIONS-01

### 用户目标

优化应用工作区左侧栏顶部：品牌入口靠左，通知、搜索与收起操作靠右；补上独立通知铃铛，并可单独打开悬浮通知卡片。

### 当前合同

- 保持当前品牌按钮的模式切换行为；在同一行将品牌入口与右侧操作组分开对齐，按钮间距清楚且适配窄侧栏。
- 通知铃铛独立开关锚定在按钮旁的通知卡片；支持键盘 Escape 和点击卡片外关闭，并提供可读的可访问名称、展开状态与焦点样式。
- 卡片只呈现按账户通知偏好允许的真实 AI Work 成功完成事件；最多保留当前工作区内存中的 8 条，不持久化、不依赖浏览器系统通知权限，并支持标记已读和清空。
- 暂无事件时显示明确空状态。权限等待、失败/中断回复、ChatGPT/Codex 外部任务、用量、健康及其他无 LFAA 事件源均不得显示为通知。
- 沿用现有主题令牌、图标与样式体系，不新增依赖、CSS 自定义属性、API、数据库字段或持久化结构。
- 完成标准：顶栏形成左右分组；铃铛可独立打开/关闭真实事件卡片；前端类型检查与构建通过，产物写入根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`、`frontend/src/shared/notification-runtime.ts`、`frontend/src/components/workbench/shared/WorkbenchIcon.tsx`：接入当前工作区内存事件、独立按钮与真实 AI Work 完成通知。
- `frontend/src/components/module-workbench.css`：只调整侧栏顶栏的左右对齐，并为通知卡片和其响应式状态添加样式。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：登记合同并同步通知行为与当前能力说明。

### 禁止修改

- 不改变应用/模式导航、搜索、侧栏收起、AI Work 通知偏好和浏览器系统通知的既有语义。
- 不新增外部通知集成、伪造未接入事件、用户消息正文、服务端 API、数据库或通知持久化。
- 不改与本次侧栏顶栏及通知卡片无关的页面布局、背景、其他导航或业务流程；不部署、发布、上传或提交 Git。

### 本轮范围调整（2026-09-28）

- 用户随后明确要求应用内只能保留一个当前应用，且其他应用不能从当前应用侧栏直接跳转；此项当前要求覆盖上面的“保持应用导航既有语义”。
- 只调整应用列表项的可用状态与提示；通知、搜索按钮本身及模式切换行为保持不变。跨应用切换统一经过“应用中心”。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对通知来源、内存边界、空状态、键盘关闭与改动范围；无法进行浏览器目视验收时如实记录。

### 完成记录（2026-09-28）

- 顶栏改为品牌靠左、通知/搜索/收起按钮靠右；新增独立通知铃铛和浮层卡片，打开时标记已读，支持清空、点击外部关闭和 Escape 关闭。
- 仅在现有账户通知策略允许时，把真实 AI Work 完成事件放入当前工作区最多 8 条的内存记录；空状态明确，不读取或显示聊天正文。应用工作区卸载后记录清空。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。未进行浏览器目视交互验收；当前目录没有 Git 元数据，无法核查完整 Git 变更状态或运行 `git diff --check`。

## LFAA-APP-SANDBOX-01

### 用户目标

以 App 作为身份、权限、数据、执行进程和 AI Work 的根安全范围；常规模式、手动模式和 AI Work 是同一 App 内的交互模式，切换模式不重建 App 沙盒、不切换数据或授权范围。只有离开 App A 并进入 App B 时才切换当前 App 范围。

根据当前真实代码，Minecraft Daemon 是唯一已接入的 App 主机进程执行路径，且当前只支持 Windows x64。本任务先为 Minecraft 实例接入真实 OS 沙盒，并让控制端只把符合沙盒能力的 Daemon 作为可执行节点；SteamCMD、写作与第三方可执行插件尚无对应运行时，不得显示为已接入沙盒。

### 当前合同

- `server` 保留身份、应用、审批和任务授权；TypeScript Daemon 保留节点连接与任务协调；最小 Rust Sandbox Host 只负责 Windows 原生进程隔离与生命周期，不新增另一套 Manager、AI Runtime 或游戏业务实现。
- 每个 Minecraft 实例以固定 `appId=minecraft`、`instanceId` 和每实例 AppContainer 身份启动；Java 进程及其子进程必须处于该身份与 Job Object 内。模式切换不启动、停止或重建这些进程。
- AppContainer 只能读取受管理 Java 运行环境，并在所属实例目录内读写；不得访问其他 Minecraft 实例、控制端数据、凭据目录或任意本机路径。网络能力仅按 Minecraft 服务端运行所需显式登记；当前授予 Internet 与 Private Network 能力，尚无域名/端口白名单。启动环境不得继承 Daemon Token、模型密钥或其他无关秘密。
- Job Object 负责进程树管理、实例内存上限与宿主关闭时终止整个进程树；它不能替代 AppContainer 的文件、网络和进程访问隔离。
- Rust Host 只接受已校验的 Minecraft 启动字段，不接受模型或用户提供的任意命令、可执行路径或额外参数。AppContainer、Job Object、允许目录或能力设置任一失败时，Daemon 必须拒绝启动；不得回退为直接 `spawn(java.exe)`。
- Daemon 只有在 Windows Sandbox Host 可用并通过能力探测后才上报沙盒能力。server 的 Minecraft 节点资格与任务创建/领取必须要求该能力；旧版或无沙盒节点不能收到可启动 Minecraft 实例的任务。
- 每实例面板只展示 Daemon 实际回报的沙盒后端与当前状态，不允许用静态文案推断沙盒已启用，也不提供关闭安全边界的普通开关。现有 AI Work 的 `appId` 会话隔离和应用内模式状态继续由现有 Owner 管理。
- Windows x64 是本合同唯一可执行平台。其他平台不得无沙盒回退运行；Linux/macOS 沙盒后端、SteamCMD/写作执行运行时、第三方插件运行时和虚拟机级隔离不属于本任务。
- 所有 Cargo 编译产物写入根目录 `dist/daemon/`；运行数据仍归 daemon 的内容型数据根目录，不得写入仓库源码或构建目录。
- 完成标准：Minecraft 节点能力和实例面板来自真实探测/进程状态；有沙盒 Host 时可在 AppContainer 中启动 Vanilla Java 服务并保留控制台、日志、安全停止；缺少或无法建立沙盒时明确失败且 Java 不启动；server/frontend/daemon 静态检查和构建通过，并记录未执行的真实服务端/网络验收。

### 允许修改

- `daemon/package.json`、`daemon/src/task-runner/minecraft-daemon.mjs`、`daemon/src/process-manager/`：构建与启动 Rust Sandbox Host、上报真实能力、为 Minecraft 实例建立沙盒启动和安全停止流程。
- `daemon/sandbox-host/`：新增最小 Rust Windows AppContainer/Job Object 可执行宿主及其 Rust 清单、锁文件和实现。
- 根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml`、`scripts/install-dependencies.ps1`、`scripts/start-dev.ps1`：只接入 Daemon 沙盒构建命令和 Rust/MSVC target 前置检查，并将产物显式写入 `dist/daemon/`。
- `server/src/api/routes.ts`、`server/src/database.ts`、`server/src/modules/nodes/`、`server/src/modules/games/minecraft/`、`server/test/database-migrations.test.mjs`：校验节点沙盒能力、任务资格，并持久化每实例真实沙盒状态所需的向前迁移及维护已有迁移版本断言。
- `frontend/src/api.ts`、`frontend/src/components/MinecraftWorkspace.tsx` 及其直接相关样式：显示真实节点/实例沙盒能力与状态，不提供绕过安全边界的开关。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`、`README.md`：同步安全合同、运行前置条件、项目状态和验收结果。

### 禁止修改

- 不改变 Minecraft EULA、官方来源校验、实例路径所有权、用户权限、AI 审批、AI Work 会话归属或模式切换语义。
- 不允许无沙盒时直接启动 Java；不开放任意 Shell、任意可执行文件、任意路径、任意环境变量或宿主机全盘访问。
- 不扩大到 SteamCMD、写作、插件市场、MCP、远程 Daemon 新平台、Linux/macOS 后端或完整第三方插件沙盒；这些能力须在其真实执行 Owner 出现后另立合同。
- 不安装系统服务、不修改全局防火墙/系统策略、不运行真实 Minecraft 世界任务、不读写或清理 `data/` 用户运行数据。
- 不修改项目版本或更新日志，不部署、发布、上传、购买、提交 Git 或创建 Git 元数据。

### 实现记录（2026-09-28）

- 增加 Windows x64 Rust Sandbox Host：为每个 Minecraft 实例建立不同 AppContainer SID，以显式网络能力启动受管理 Java，使用受限句柄列表和清洁环境；实例目录读写 ACL、低完整性标签和 Java 目录读/执行 ACL 在安装及每次启动前重新应用。固定目录链和实例目录通过规范路径验证；失败时 Daemon 不回退直接启动 Java。
- Job Object 在恢复 Java 主线程前接管进程，限制活动进程数与内存；Node Daemon 收到真实 Host 启动令牌后才将实例报告为 `running`。server schema 迁移到 12，旧的活动状态迁为无法确认；节点能力门禁、任务认领和实例启动按钮均 fail closed。Minecraft 总览及实例页展示实际探测/心跳状态、文件范围、网络能力和资源边界，并说明模式切换与 App 切换行为。
- 构建命令已接入根 `dist/daemon/target/`。`pnpm run build` 通过（前端 TypeScript/Vite、server TypeScript、Windows x64 Rust release、Daemon `node --check`）；`cargo fmt --check` 通过。现有数据库迁移测试中的目标版本断言已更新为 12，但本轮未运行测试套件。
- 按仓库规则尝试 `node scripts/workspace-preflight.mjs`，当前仓库没有该脚本；`quality:full` 也未定义。当前工作目录没有 `.git`，无法运行 `git diff --check` 或提供 Git 状态。
- 首次 Cargo 构建的 target-dir 曾多退一层，生成 `H:\dist\daemon\target`；命令已修正，最终构建位于仓库 `dist/daemon/target/`。清理误生成的仓库外 `H:\dist` 被执行策略以 `blocked by policy` 拒绝，未尝试绕过；该外部构建目录仍需处理。
- 未启动 Minecraft Java、未创建 AppContainer 用户配置、未更改实例/JRE ACL、未触碰 `data/`。因此 ACL/低完整性标签是否被目标 Windows 用户上下文接受、实际网络访问与 Sandbox Host 退出清理仍未验收；代码构建不代表这些运行时结论。

## LFAA-UI-WORKBENCH-DEFAULTS-01

### 用户目标

工作台两侧默认展开栏宽略微缩小，并让右侧工具与资源栏默认收起。

### 当前合同

- 调整工作台左、右栏的默认初始宽度；左栏最小展开尺寸降至 200px 以支持指定默认范围，保留最大可拖宽度、吸附收起、响应式布局和用户主动调整的自定义宽度。
- 桌面端首次布局默认收起右侧工具与资源栏；历史默认展开状态迁移为收起一次，用户之后主动展开或收起的选择在刷新后保留。
- 将已保存宽度中与旧默认值相同的值迁移为新默认值；不同于旧默认值的用户自定义宽度继续保留。
- 不改侧栏内容、应用导航、底部终端、业务能力或设置项；不引入依赖、图片、动效或新的用户设置字段。
- 完成标准：新用户和旧默认布局显示更窄的左右栏，右栏默认收起；用户手动调整后刷新仍保留其自定义布局；前端 TypeScript 检查与构建通过。

### 允许修改

- `frontend/src/workbench/workbench-layout.config.ts`、`frontend/src/workbench/workbench-preferences.ts`、`frontend/src/workbench/ResizableWorkbench.tsx`、`frontend/src/workbench/workbench-layout.types.ts`：调整默认尺寸并兼容迁移旧布局偏好。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/SettingsPage.tsx`：向共享工作台传递迁移所需的实际容器宽度。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不修改侧栏业务内容、应用功能、API、数据库、账户设置、CSS 变量或其他页面视觉样式。
- 不清空用户布局，不覆盖与旧默认值不同的自定义尺寸；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对旧布局迁移、新默认收起以及手动展开后的持久化路径；能访问当前浏览器时再做页面目视检查，否则明确报告未完成。

### 完成记录（2026-09-28）

- 左栏默认初始宽度改为 200–340px，右栏改为 240–340px；只迁移与旧默认宽度相同的历史值，其他已保存栏宽继续保留。旧版工具与资源栏状态迁移到新版偏好时默认收起；之后手动展开或收起由新版偏好保存，默认“三列”布局不会在初次载入时再次自动展开右栏。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物位于根目录 `dist/frontend/`。静态核对确认布局状态迁移和新开合偏好保存路径。
- 未完成浏览器目视验收：浏览器连接检查返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法提供 Git 变更状态或运行 `git diff --check`。仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full` 门禁。

### 用户进一步反馈（2026-09-28）

- 用户希望左侧栏默认展开后再窄一些，同时不影响刚修复的吸附拖动卡顿。
- 本轮只把左栏初始宽度响应比例从 18% 调为 16%；最小展开宽度仍为 200px，最大拖动宽度仍为 340px。
- 历史持久化宽度仅在等于上一版 18% 默认值时迁移到新默认；其他用户自定义宽度保持不变。保持左右栏拖拽、阻尼、吸附和释放动画实现不变。

### 本轮允许修改

- `frontend/src/workbench/workbench-layout.config.ts`：更新左栏初始宽度比例并提供上一版默认宽度的迁移计算。
- `frontend/src/workbench/workbench-preferences.ts`：只迁移等于上一版默认宽度的共享左栏偏好。
- `frontend/src/workbench/ResizableWorkbench.tsx`：升级布局默认值版本并迁移等于上一版默认宽度的布局状态。
- `docs/PROMPTS.md`：更新本轮合同和完成记录。

### 本轮禁止修改

- 不调整左栏最小/最大尺寸、左右栏吸附行为、拖拽阻尼、CSS 过渡或动画参数。
- 不覆盖任何不等于上一版默认值的用户自定义宽度，不改右栏、底部栏或业务内容。

### 本轮完成记录（2026-09-28）

- 左栏默认初始宽度比例从 18% 调至 16%；200px 最小展开宽度和 340px 最大拖动宽度保持不变。
- 布局状态版本升级到 3，并将共享宽度键升至 v3。只把恰好等于上一版 18% 默认宽度的已保存值迁移为新默认值；其他自定义宽度继续保留。
- 未修改吸附拖动、阻尼和 CSS 过渡代码；`pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物位于根目录 `dist/frontend/`。
- 未进行浏览器目视和拖拽手感验收。

## LFAA-MINECRAFT-TASK-RECOVERY-01

### 用户目标

修复当前数据库迁移测试仍断言版本 9、而程序已迁移到版本 10 的问题；避免 Minecraft Daemon 中断后，已领取任务永久停留在 `running`。

### 当前合同

- SQLite schema 以当前版本 10 为基线，新增版本 11 迁移保存 Minecraft 任务租约到期时间，不重建或删除现有用户、实例、任务或日志数据。
- Daemon 心跳上报当前进程实际持有的任务 ID；server 只为同一节点上仍为 `running` 的任务续租。任务领取时先将已过期任务标记为失败，并说明执行结果未确认。
- 租约过期任务不得自动重新执行；安装、启动、停止等可能已有部分副作用的操作必须由用户检查真实节点状态后再决定后续操作。实例状态不确定时保持 `unknown`，不得以猜测写成已停止或成功。
- Daemon 重启后不得把残留安装标记误报为当前仍在安装；只清理能确认属于旧进程的标记，不改变 Windows Sandbox Host、AppContainer、Job Object 或 Java 启动安全边界。
- 更新版本 8 迁移测试以覆盖当前完整迁移链，并新增隔离临时数据库的任务租约行为测试；通过根目录与 server 测试脚本可运行，不访问仓库 `data/` 运行数据。
- 完成标准：迁移到版本 11 并可重复启动；活跃任务续租；无心跳且租约到期的任务变为失败且不会自动重派；相关回归测试及 `pnpm build` 通过。

### 允许修改

- 根 `package.json`、`server/package.json`：提供根目录与 server 的测试命令。
- `server/src/database.ts`、`server/src/api/routes.ts`、`server/src/modules/tasks/minecraft-queue.ts`：版本 11 迁移、心跳租约续期、过期任务收敛及实例不确定状态。
- `daemon/src/task-runner/minecraft-daemon.mjs`：只上报当前活动任务 ID，并处理重启后可识别的旧安装标记；保留现有 Sandbox Host 启动与停止实现。
- `server/test/database-migrations.test.mjs`、`server/test/minecraft-task-leases.test.mjs`：修正迁移预期并覆盖隔离租约行为。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：登记任务合同并同步迁移版本与恢复语义。

### 禁止修改

- 不自动重放任何已领取的 Minecraft 副作用任务，不放宽任务节点绑定或 Daemon 身份校验。
- 不改变 Minecraft EULA、安装工件校验、AppContainer/Job Object、任意命令限制或实例文件权限边界。
- 不触碰仓库 `data/` 运行数据，不实现远程多节点调度、通用重试/取消系统或与本任务无关的功能；不部署、发布、上传、购买或提交 Git。

### 验收方式

- 在临时 `LFAA_DATA_DIR` 中运行根目录 `pnpm test`，确认旧版本迁移、租约续期、租约到期失败和重复启动行为。
- 运行 `pnpm build`，确认前端、server、daemon 检查通过且构建产物仅写入根目录 `dist/`。
- 静态核对 Sandbox Host 安全路径未被改动；不运行真实 Minecraft 世界任务。

### 完成记录（2026-09-28）

- SQLite 版本 8 兼容测试现检查完整升级至 schema 11、租约字段存在、既有授权数据保留，并验证重复启动不重复破坏数据；另以版本 10 任务数据验证迁移保留记录、为运行任务设置 30 秒宽限且不为排队任务续租。
- Daemon 心跳上报当前活动任务 ID，server 仅续租本节点仍在运行的任务；未带该字段的旧心跳按空列表处理，避免直接拒绝节点心跳，但不会续租旧 Daemon 正在执行的任务。租约过期后任务失败并保存 `{ outcome: "unknown" }`，实例转为未知状态，不自动重放；Daemon 重启后会把不属于当前活动任务的残留安装标记按未知状态上报。
- `pnpm test` 通过（5 项）；`pnpm build` 通过，覆盖前端构建、server TypeScript 构建和 Daemon 语法检查，产物写入根目录 `dist/`。已尝试 `node scripts/workspace-preflight.mjs`，但仓库没有该脚本；也没有 `.git` 元数据可供 `git diff --check`。未运行真实 Minecraft 任务；Sandbox Host 与 Java 启动路径未修改。

## LFAA-UI-WORKBENCH-SNAP-01

### 用户目标

排查并修复工作台左右栏吸附收起、吸附后反向拖出时的卡顿和拖尾感。

### 当前合同

- 左右栏拖动按 Pointer 事件逐帧合并后直接更新宽度，不在指针停下后继续追赶；吸附后立即将列宽设为零并隐藏侧栏内容，不显示半透明内容残影。
- 左右栏拖拽、吸附和反向展开期间不运行列宽、透明度或位移追赶动画；保留吸附阈值、迟滞和展开状态提交语义。
- 取消左右栏连续阻尼追赶和自续排 RAF；不调整吸附阈值、迟滞、默认宽度或底部面板阻尼。
- 完成标准：左右栏拖动紧跟 Pointer、停下后不再有追赶帧；吸附时内容立即消失且无列宽/透明度/位移追赶；前端 TypeScript 检查与构建通过。
- 左侧应用列表、应用菜单和会话列表只允许纵向滚动；吸附收起/展开经过窄宽度时不出现横向滚动条。

### 允许修改

- `frontend/src/workbench/workbench.css`：修复吸附预览时侧栏越界绘制和拖拽动画叠加；左右栏拖拽全程直接跟随 Pointer，吸附时立即隐藏内容。
- `frontend/src/workbench/ResizableWorkbench.tsx`：仅在 CSS 修复不能解决时调整拖拽状态清理；不改吸附计算与提交语义。
- `frontend/src/components/module-workbench.css`：限制左侧应用列表、应用菜单和会话列表为纵向滚动，避免宽度过渡中的横向滚动条。
- `docs/PROMPTS.md`：登记本任务合同与完成记录。

### 禁止修改

- 不修改吸附阈值、释放迟滞、默认宽度、持久化布局或底部栏阻尼和交互。
- 不移除左栏必要的纵向滚动，不改业务内容、默认宽度、吸附阈值或迟滞；不改底部面板动画。
- 不新增依赖、CSS 自定义属性或其它视觉效果；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对普通拖动直接应用最新 Pointer 尺寸、吸附及反向展开无侧栏内容残影或动画追赶、左栏内部纵向滚动区不再显示横向滚动条；浏览器交互检查无法执行时明确报告。

### 完成记录（2026-09-28）

- 移除左右栏吸附捕获和反向释放期间对 `grid-template-columns` 的 CSS 过渡；保留栏内淡出/位移和松手后收起归位动画，避免它们与 `ResizableWorkbench` 的逐帧阻尼重复追逐列宽。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物写入根目录 `dist/frontend/`。静态核对确认左右栏拖动捕获/释放选择器不再覆盖 Grid 列宽过渡。
- 未进行浏览器拖拽手感验收。

### 用户补充反馈（2026-09-28）

- 用户指出左栏吸附收起与重新展开过程仍出现横向滚动条。代码检查发现应用列表、左侧菜单和会话列表的 `overflow: auto` 同时启用了横纵滚动；栏宽暂时小于内容时会显示横向滚动条。
- 本轮仅将上述滚动区限定为纵向滚动，保留其纵向滚动能力和已修复的吸附动画。

### 本轮完成记录（2026-09-28）

- 左侧应用列表、Minecraft 菜单和 AI Work 会话列表均改为横向溢出隐藏、纵向滚动保留；未改吸附阈值、阻尼、动画或默认宽度。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物写入根目录 `dist/frontend/`。静态核对确认三个左栏纵向滚动区均不再启用横向滚动。
- 未完成浏览器实拖验收：当前浏览器工具返回 `nodeRepl.fetch request failed`。

### 用户再次反馈（2026-09-28）

- 用户反馈收起时仍有明显卡顿和拖尾，担心多层动画或重复绘制。
- 源码确认左右栏仍有 72ms 阻尼以及偏差超过 0.35px 后自续排的 RAF；因此指针停下后仍持续写入 Grid 尺寸，形成追尾。本轮移除这条连续追赶路径，恢复逐个浏览器帧直接跟随 Pointer，并仅在吸附捕获时启用一次固定目标的 Grid 过渡。
- 不改吸附参数、横向溢出修复、默认宽度和底部面板阻尼。

### 本轮完成记录（2026-09-28）

- 左右栏拖动移除 72ms 阻尼和偏差阈值自续排 RAF，仍按 `requestAnimationFrame` 合并 Pointer 事件；指针停下后不会继续写入宽度。吸附捕获时仅播放一次目标为 0 的 Grid 过渡，反向拖出直接跟随 Pointer。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建，产物写入根目录 `dist/frontend/`。静态核对确认 `flushPending` 不再递归调度，底部面板原有阻尼保持不变。
- 浏览器实拖未完成：`agent-browser` 的独立会话落在登录页；当前浏览器连接返回 `nodeRepl.fetch request failed`，没有自动输入账户凭据。

### 用户再次反馈（2026-09-28）

- 用户提供的实机照片显示吸附收起过程出现侧栏内容半透明残留，并指出收起效果仍有明显拖尾。
- 源码确认吸附预览将整个侧栏降至 28% 不透明度并向画布位移，左侧 Pane 还允许内容越界绘制；Pointer 拖拽时同时额外开启 260ms Grid 列宽过渡，造成侧栏内容残影与拖动反馈滞后。
- 本轮取消左右栏吸附期间的 Grid 和内容过渡；进入吸附预览时立即隐藏侧栏内容，并确保拖拽规则不能重新显示已收起或正在吸附的 Pane。保留底部面板的现有动画与左右栏吸附阈值、迟滞。

### 用户继续询问（2026-09-28）

- 用户对比设置中心与应用工作区的侧栏吸附手感，询问是否共用同一实现以及卡顿差异。
- 两处共用 `ResizableWorkbench`；应用工作区的 `.module-sidebar` 在半透明侧栏设置下实时采样并模糊背景，设置中心的 `.settings-sidebar` 则明确关闭 `backdrop-filter`，避免滚动/绘制成本。
- 本轮允许在左栏 Pointer 拖拽期间临时关闭应用侧栏的背景模糊采样；空闲时视觉维持现状。吸附仍直接跟随 Pointer，不增加动画。

### 本轮完成记录（2026-09-28）

- `frontend/src/workbench/workbench.css`：左右栏拖拽/吸附/反向展开期间不再额外过渡列宽、透明度或位移；吸附预览立即隐藏 Pane 内容，并限制拖动态可见规则，避免左侧 overflow-visible 将内容画到主区。
- `frontend/src/components/module-workbench.css`：仅在应用左栏拖拽期间关闭应用侧栏的实时背景模糊采样。
- 左右栏吸附阈值、迟滞、展开提交、底部面板动画和先前的横向滚动修复均保持不变。
- `pnpm --filter lfaa-frontend run build` 未通过 TypeScript 检查：`MinecraftWorkspace.tsx` 存在未使用变量，`SettingsPage.tsx` 存在声明前引用，`Workbench.tsx` 传入不受 `ApplicationWorkspaceProps` 接受的 `userId`；错误均位于本轮未修改的文件。单独运行 `pnpm --filter lfaa-frontend exec vite build` 通过，产物位于根目录 `dist/frontend/`。
- 设置页和应用工作区共用 `ResizableWorkbench`；设置页点击收起按钮是一次状态切换，不经过拖拽吸附帧。设置页禁用了侧栏背景模糊，应用左栏则会在 Pointer 拖拽时临时禁用该采样。
- 浏览器登录态无法通过当前自动化连接访问，未完成实机吸附/反向展开验收；当前目录无 Git 元数据，无法运行 `git diff --check` 或提供 Git 差异状态。

## LFAA-UI-COMPOSER-PANE-SWAP-01

### 用户目标

参考 Codex 对话输入框的清晰层级和操作布局，优化 LFAA 共享 AI Work 输入区；增加桌面工作台中间区与右侧工具资源栏的位置交换功能。

### 当前合同

- 三款应用共用同一 AI Work 输入区；保留实际活动 Provider/模型信息、最多 12000 字符、账户配置门槛、当前发送快捷键、流式发送和停止行为。
- 输入区采用清晰的上下文信息、消息编辑区和 Codex 风格底部操作栏，并适配当前主题、背景、紧凑布局与窄屏。
- 对话消息列与输入框共用居中的最大宽度（920px）；助手消息从列内左侧开始，用户消息继续靠列内右侧对齐，避免回复横跨整个画布。
- 底部操作栏显示并接通现有活动模型选择、AI Runtime 快速/平衡/深入档位、权限模式；模型和设置变更调用现有 API，并同步工作台设置状态；切换完全权限前保留二次确认。
- 附件和语音宿主目前未接入 AI 会话；对应入口可按参考布局显示为禁用状态，并说明尚未接入，不得接收后丢弃素材或伪装语音功能。
- 仅桌面双 Dock 布局提供中间区与右侧工具资源栏交换按钮；使用现有右栏宽度、拖拽和收起状态，刷新后沿用工作台 Chrome 偏好保存交换状态。
- 交换时视觉顺序与 DOM/键盘顺序一致；右栏收起时中心内容仍占满主区，重新展开后恢复交换位置。紧凑和移动布局继续使用现有右栏浮层行为，不提供交换操作。
- 完成标准：输入、快捷键、发送/停止、字符上限和无 Provider 状态保持正确；底部模型/推理档位/权限模式可用且持久化，附件/语音入口明确禁用；对话消息列与输入框居中对齐；桌面可交换并恢复布局；前端 TypeScript 检查与构建通过；未执行的浏览器目视验收明确记录。

### 允许修改

- `frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/ai-work-chat.css`、`frontend/src/components/workbench/shared/WorkbenchIcon.tsx`：调整共享 AI Work 输入区、底部真实操作控件与图标。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/Workbench.tsx`：把已保存设置变更同步回共享工作台状态。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/module-workbench.css`：持有和呈现桌面交换偏好。
- `frontend/src/workbench/ResizableWorkbench.tsx`、`frontend/src/workbench/workbench-layout.types.ts`、`frontend/src/workbench/workbench.css`：为共享工作台增加可选的中间/右栏交换呈现与分隔按钮。
- `docs/PROMPTS.md`、`docs/开发计划.md`：维护本任务合同与实际结果。

### 禁止修改

- 不新增 API、数据库、Provider、Agent Runtime 或 AI Work 业务能力；只调用已有的模型、设置保存 API。
- 不新增依赖、CSS 自定义属性、假交互、占位数据、图片或无关动效。
- 不改变全局主导航、应用左侧菜单、右栏资源内容、紧凑/移动浮层行为和已有面板拖拽规则。
- 不部署、发布、上传、购买或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对输入区真实 Provider 状态、快捷键/字符限制/发送/停止路径，以及桌面交换、收起恢复、DOM 顺序和小屏不交换行为。
- 能访问当前浏览器时再做页面目视检查，否则明确报告未完成。

### 完成记录（2026-09-28）

- AI Work 输入框现显示真实应用上下文和活动 Provider/模型，保留 12000 字符限制与配置门槛；发送快捷键提示、圆形发送/停止按钮和自动扩展编辑区与现有发送逻辑一致。
- 回复消息列已与输入框共用 920px 居中宽度；助手消息左对齐、用户消息右对齐仍在同一内容列内。
- 桌面双 Dock 分隔处增加左右窗格交换按钮；交换后 DOM 顺序与视觉顺序一致，工作台本地偏好保存位置。右栏收起时聊天恢复占满中心区，重新展开恢复交换；紧凑/移动布局保留原浮层。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物写入根目录 `dist/frontend/`。
- 未执行浏览器目视验收。当前目录没有 Git 元数据，无法核查完整 Git 变更状态或运行 `git diff --check`。

## LFAA-OBS-SERVER-LOGS-01

### 用户目标

记录开发终端中重复请求与认证日志的观察事项，暂不修改实现；先判断这些请求是否只随正常页面操作出现，还是会在页面空闲时重复触发。

### 当前合同

- 已观察到短时间内多次 `PUT /api/preferences`，并伴随 `GET /api/ai/sessions` 与 `GET /api/settings/ai/accounts`；另有两组相隔约 16 秒的 `GET /api/auth/setup-status` 和 `GET /api/auth/me`，后者返回 `401`。
- 当前调用路径显示偏好保存由打开/切换应用或模式触发，AI 会话与账户读取由 AI Work 面板挂载或应用切换触发；`/auth/me` 的定时复核仅在已有登录用户时运行。现有日志不足以证明代码故障。
- 先观察页面不操作、不刷新、不重新聚焦，且 server 持续在线时是否再次出现这些请求组合。若复现，记录时间、请求发起方及当时登录状态，再定位触发路径；未复现时按正常页面操作/未登录检查记录并关闭观察项。
- 完成标准：确认空闲复现与否并把证据写回 `docs/开发计划.md`；若确认是实现缺陷，另开精准修复任务及合同后再改代码。

### 允许修改

- `docs/开发计划.md`、`docs/PROMPTS.md`：维护观察状态和结论。
- 只读检查 `frontend/src/App.tsx`、`frontend/src/components/AiWorkChat.tsx` 与相关 API 调用。

### 禁止修改

- 观察完成前不修改前端、server、API、数据库或日志级别，不通过隐藏日志处理现象。
- 不为观察项运行测试、构建或重启服务；不部署、发布、上传或提交 Git。

### 本轮范围调整（2026-09-28）

- 用户明确要求单独优化应用切换体验；允许 `LFAA-UI-APP-CONTEXT-01` 修改其列出的前端工作区状态与展示文件。
- 此授权不关闭本观察项，也不允许修改偏好请求发起逻辑、server/API 或日志；空闲请求观察仍需单独完成。

## LFAA-P4-MINECRAFT-MVP-01

### 用户目标

先完成 Minecraft 应用，再开始 SteamCMD 与写作应用。明确“应用”与“模式”的关系：应用提供自己的菜单、工作台和业务流程；常规与 AI Work 是该应用内的两种交互方式。Minecraft AI Work 复用现有 LFAA AI Runtime 和活动 Provider，通过 Minecraft 应用上下文与独立会话工作，不复制一套模型服务。

### 当前合同

- 工作台最左侧全局导航保持跨应用一致；进入 Minecraft 后，第二栏切换为 Minecraft 专属菜单，应用选择留在该栏顶部；常规/AI Work 切换保持在工作区标题栏。
- Minecraft 常规工作台按“总览、实例、Java 环境、任务”组织；选中实例后提供该实例自己的概览、配置、日志和世界备份视图。日志视图只展示 Daemon 回传内容，不提供任意命令输入。任务是可追踪的真实后端状态，不用演示数据。
- 首个可验收目标暂定本机 Windows x64 Daemon、Minecraft Java Edition、官方 Vanilla 服务端；远程 Daemon、其他系统、Bedrock、Paper/Spigot/Fabric/Forge、插件和复杂升级迁移不属于本合同。
- 游戏版本/服务端工件和 Java 发行版仅使用官方来源；下载前验证来源、大小与官方摘要/校验值。Minecraft EULA 必须在首次下载前展示并取得明确同意，不能由 AI 权限模式替代。
- 前端只调用 server API。server 持有身份授权、Minecraft 业务校验、节点/任务状态与控制面元数据；daemon 在目标主机执行已登记的 Minecraft/Java 操作，并独占实例文件、运行进程、日志和世界备份。
- 实例路径由 daemon 按实例 ID 在数据根目录内生成；不接收任意本机路径，不把 Minecraft 文件、存档或日志写进仓库源码或 `dist/`。
- 仅具备当前 server 管理员角色的账户可执行安装、创建、启动/停止、配置写入和备份等副作用操作；所有状态以 server/daemon 实际返回为准。
- AI Work 使用现有会话/Provider/权限基础并保留 `appId=minecraft` 的上下文隔离。Agent Loop 或真实 Minecraft AI 执行工具只有在其调用真实 Minecraft 业务服务、节点 Runner 并经授权后才能开放；本任务不提供模拟执行结果。
- 执行顺序按用户明确优先级调整为 Minecraft → SteamCMD → 写作；只做支撑 Minecraft 闭环所需的节点与任务能力，不在本任务实现 SteamCMD 或写作业务。
- 完成标准：进入 Minecraft 后有专属菜单和工作台；至少一个受支持节点能显示真实状态；用户可查看官方版本/Java 环境、创建 Vanilla 实例、显式同意 EULA 后启动、查看运行状态/日志、停止、修改受支持的 `server.properties` 字段并为停止中的世界创建安全备份；刷新后实例与任务状态仍来自 server/daemon 数据。

### 允许修改

- `frontend/src/components/`、`frontend/src/styles/`、`frontend/src/api.ts`：通用工作台中的 Minecraft 导航、视图与真实 API 交互；保持现有 Ant Design、用户主题和响应式布局。
- `server/src/api/routes.ts`、`server/src/database.ts`、`server/src/modules/games/minecraft/`、`server/src/modules/nodes/`、`server/src/modules/tasks/`：认证 API、迁移、Minecraft 业务规则和本合同所需的节点/任务控制面。
- `daemon/package.json`、`daemon/src/connection/`、`daemon/src/task-runner/`、`daemon/src/runners/minecraft/` 与确有需要的 `daemon/src/process-manager/`、`daemon/src/monitoring/`：受认证、限权的节点连接和 Minecraft 本地执行。
- 根 `package.json`、`pnpm-workspace.yaml`、`pnpm-lock.yaml` 以及启动/构建配置：只接入和输出到根 `dist/` 所需的 daemon 命令与依赖。
- `docs/PROMPTS.md`、`docs/开发计划.md`、`docs/系统总体架构.md`、`README.md`：登记合同、调整应用实施顺序并同步真实能力和限制。

### 禁止修改

- 不实现 SteamCMD、写作业务、通用插件市场、第三方可执行插件、Bedrock、Paper/Spigot/Fabric/Forge、复杂多实例升级迁移或生产发布。
- 不把节点执行放进 Vite、浏览器或 Minecraft AI 聊天进程；不绕过 server 授权直接控制 daemon。
- 不提供任意 Shell、任意文件路径、URL 指定目标或浏览器本地凭据存储；不向日志、URL 或普通 API 响应泄露节点凭据。
- 不伪造节点在线、安装进度、实例运行状态、日志、玩家数、资源用量或备份成功状态。
- 不在未接入真实 Minecraft Runner 前开放会执行副作用的 AI 工具；“完全权限”不绕过业务校验或 EULA 同意。
- 不修改、清理或覆盖用户运行数据，不部署、发布、上传、购买或提交 Git。

## LFAA-SETTINGS-TYPOGRAPHY-01

### 用户目标

统一设置中心不同分类的标题、分组标题和设置条目文字层级；让用户能在“外观”中直接找到字号调整，并通过已有外观偏好驱动共享字号变量。

### 当前合同

- 设置中心各分类共用一致的页面标题、分组标题、条目标题和说明文字字号层级；“常规/通知”与普通分类不得因布局样式类而显示成两套字号。
- 共享字号令牌放在已有的 `frontend/src/styles/tokens.css`；页面样式留在各自职责样式表，不创建重复的通用令牌文件或迁移无关样式。
- 将已有账户级“界面字号”设置从“高级”折叠区提升到外观页常显区域，并让其缩放设置中心的语义字号；保留现有设置字段、范围、保存流程和实时预览。
- 现有 `SettingGroup`、`SettingRow` 等共享组件继续复用；不做与字号一致性无关的组件重构。
- 完成标准：上述四类文字在设置分类间使用共享令牌；字号偏好可在外观页直达并控制这些令牌；前端类型检查与构建通过。

### 允许修改

- `frontend/src/styles/tokens.css`：补齐设置中心使用的共享语义字号令牌。
- `frontend/src/components/Workbench.tsx`：按账户的界面字号为共享令牌提供缩放值。
- `frontend/src/components/SettingsPage.css`、`frontend/src/components/SettingsPage.tsx`：统一设置中心文字层级，并调整字号控件位置。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不搬迁整个前端样式、不创建重复的 `common.css`，不把所有页面的专属样式合并到全局文件。
- 不新增设置字段、API、数据库迁移、依赖、自由格式 CSS 输入或新的字号体系。
- 不改设置分类内容、业务行为、其他页面布局；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 检查最终变更范围；如果没有可用的 Git 元数据或浏览器目视验收环境，明确报告限制，不宣称已完成相应核查。

### 完成记录（2026-09-28）

- 设置中心页面标题、分组标题、设置条目标题和说明文字改为使用共用字号令牌；通知页与常规页继续共享布局，但不再覆盖成更大的标题和分组字号。
- 在全局令牌中增加导航标题和页面标题字号，Workbench 按账户已保存的界面字号统一缩放。外观页将界面字号与代码字体大小控件从“高级”折叠区提升至可见的“字体大小”分组，原账户字段、10–24px 与 8–24px 范围、保存和预览路径均保留。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；构建产物写入根目录 `dist/frontend/`。
- 未执行浏览器目视验收；当前工作目录没有 Git 元数据，无法运行 `git diff --check` 或读取完整 Git 变更状态。当前项目没有 `scripts/workspace-preflight.mjs` 或 `quality:full` 门禁。

## LFAA-SETTINGS-LAYOUT-UNIFICATION-01

### 用户目标

对设置中心全部功能分类进行二次优化，让各分类复用同一套页面宽度、外边距、页头间距、分组容器、设置行尺寸、控件列宽和响应式规则；只为确有不同内容结构的模块保留局部布局。

### 当前合同

- 所有设置分类（含常规、通知、外观、快捷键、AI、用量、插件、权限、账户、存储、开发者和待接入入口）共用统一的内容最大宽度、页面内边距、页头间距、分组间距、标题间距、面板边框/圆角、设置行高度/内边距/列宽、表单控件宽度和底部操作区规则。
- 移除“常规/通知”与其他分类之间的特殊大留白、大行高、大控件列和大开关等重复布局变体；共享 `SettingGroup`、`SettingRow` 和共享字号令牌继续作为通用页面构件。
- 在设置样式职责范围内集中定义带中文说明的 CSS 自定义属性；使用统一值驱动共享布局，避免各分类分别维护相同尺寸。响应式变化由公共断点规则统一处理。
- 主题选择、工作台布局预设、背景图库、快捷键列表、AI Provider 卡片、账户数据表等内容可以保留各自必需的内部排列，但必须使用相同的外层内容宽度、分组标题、容器边框/圆角、间距与断点。
- 保存/恢复操作固定出现在该分类内容末尾；只读页面保持没有虚假的保存操作。
- 不改设置项语义、账户数据、API、权限行为和导航分类；不引入依赖，不进行全站样式迁移。
- 完成标准：全部分类使用同一套外层与标准行布局；剩余变体仅服务于已列出的特殊内容结构；320px 窄屏、中等宽度与桌面宽度下布局均可收缩且不造成横向滚动；前端类型检查与构建通过。

### 允许修改

- `frontend/src/components/SettingsPage.css`：集中设置中心布局变量，统一外层、分组、行、控件、卡片和响应式样式。
- `frontend/src/components/SettingsPage.tsx`：移除分类特有外层布局标记，并将需保存分类的操作区统一置于内容末尾。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不修改设置内容、设置字段、数据格式、API、数据库、权限逻辑、导航顺序和真实能力状态。
- 不把所有前端 CSS 搬入一个全局文件，不重做主题配色，不增加图像、动效或依赖。
- 不修改工作台/侧栏整体架构，不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对设置页分类结构、共享布局令牌和剩余特殊变体；如果浏览器或 Git 元数据不可用，明确说明相应目视验收或变更状态限制。

### 完成记录（2026-09-28）

- 移除常规和通知分类的旧专属布局覆盖，使全部设置页共用内容宽度、页边距、页头/分组间距、行高、行内边距、控件列宽、表单高度、面板圆角、卡片内边距和底部操作间距；布局响应式收缩统一由设置页变量驱动。
- 设置页全部可读字体改用 `tokens.css` 中会随账户“界面字号”缩放的共享字号令牌。主题卡片、布局预览、背景图库、快捷键、AI Provider 和账户表格仅保留自身所需的内部网格，并复用统一外层样式；插件与权限页的保存/恢复操作移至内容末尾。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。静态核对确认旧的常规/通知布局类已移除；仅保留 LFAA 品牌预览字样按桌面/窄屏切换字号的装饰性特例。
- 未完成登录后设置页及 320px/中等宽度的浏览器目视验收：可访问的本地设置路由显示登录页，且没有可用登录态；未读取或输入账户凭据。当前目录没有 Git 元数据，不能提供完整 Git 变更状态或运行 `git diff --check`。

## LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01

### 用户目标

修正设置中心侧栏顶部“返回工作台”与“收起设置导航”按钮错位的问题，让两者沿同一行对齐并保持在侧栏内容边界内。

### 当前合同

- 收起按钮以侧栏标题区域为定位容器，垂直位置与返回按钮一致，水平位置贴合标题区域右侧内容边界。
- 保留返回与收起按钮的现有文字、可访问名称、事件行为和设置导航布局；不改其他分类内容、侧栏宽度或工作台面板尺寸。
- 不新增 CSS 变量、依赖或断点，只修正设置页专属样式。
- 完成标准：顶部两个按钮在桌面侧栏中沿同一水平行对齐且不越出内容边界；前端类型检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.css`：修正收起按钮相对侧栏标题区域的偏移。
- `docs/PROMPTS.md`：维护本任务索引、合同与完成记录。

### 禁止修改

- 不改 `SettingsPage.tsx`、工作台共享布局、侧栏交互、导航内容或其他页面样式。
- 不新增设置项、CSS 变量、依赖、图片或动效；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 静态核对按钮定位值与改动范围；浏览器无法访问已登录设置页时，明确说明未完成目视验收。

### 完成记录（2026-09-28）

- 收起按钮从标题栏左上方 8px、右侧 6px 的偏移改为 `top: 0; right: 0`，与返回按钮顶边对齐并留在侧栏标题内容区内；按钮文案与行为未改。
- `pnpm --filter lfaa-frontend run build` 的 TypeScript 检查被两个当前错误阻断：`ApplicationWorkspace.tsx:588` 传入 `AiWorkChatProps` 未声明的 `draft`，以及 `ResizableWorkbench.tsx:712` 找不到 `WorkbenchIcon`。随后单独执行 `pnpm --filter lfaa-frontend exec vite build` 通过，CSS 产物写入根目录 `dist/frontend/`。
- 未完成登录后浏览器目视验收：本轮浏览器状态读取返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法运行 `git diff --check` 或读取完整 Git 变更状态。

## LFAA-FRONTEND-CSS-SHARED-01

### 用户目标

建立容易查找的前端公共 CSS 文件入口，把真正跨多个独立组件复用的加载状态、服务状态和页面错误提示集中维护；保留设计变量与页面/组件样式各自的职责。

### 当前合同

- `frontend/src/styles/tokens.css` 继续作为全局颜色、字号、间距和字体变量的唯一来源，不新增重复令牌文件。
- 新增 `frontend/src/styles/common.css`，只收纳有多个独立组件真实复用的通用状态样式；本任务将 `loading-page`、`loading-indicator`、`service-status` 和 `page-alert` 从 `base.css` 移入该文件。
- `base.css` 只保留盒模型、文档背景、原生控件字体、键盘焦点等文档级基础样式；`main.tsx` 是全局 CSS 的单一导入入口，公共样式只导入一次并保持基础样式先于页面专属样式。
- `pages.css`、`responsive.css`、工作台样式、设置中心样式及其他组件样式继续由原有职责文件维护；不将仅在一个页面/组件使用的样式提升为全局样式。
- `docs/系统总体架构.md` 记录上述前端 CSS 所有权与加载规则；不改变页面结构、主题、断点、交互和业务行为。
- 完成标准：公共状态类在唯一 `common.css` 中定义、由 `main.tsx` 导入一次；基础与组件专属样式边界清晰；前端构建通过。

### 允许修改

- `frontend/src/styles/common.css`：新增跨组件共享状态样式。
- `frontend/src/styles/base.css`：移出上述共享状态样式，保留文档级基础样式。
- `frontend/src/main.tsx`：在全局样式导入顺序中加入公共 CSS。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：记录前端样式职责和任务验收结果。

### 禁止修改

- 不迁移或重写所有前端 CSS，不把设置中心、应用工作区、AI Work 或认证页面的专属规则放入公共文件。
- 不新增重复设计令牌、依赖或样式架构工具，不调整现有样式数值或用户可见行为。
- 不部署、发布、上传、购买或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查及前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态检查共享类只在 `common.css` 定义一次，`main.tsx` 仅导入一次，并确认页面/组件专属样式仍在其原 Owner 文件。

### 完成记录（2026-09-28）

- 新增 `frontend/src/styles/common.css`，集中加载容器、加载指示器、服务状态及多页面错误提示；这些样式仅在公共文件定义，并由 `main.tsx` 在基础样式之后导入一次。
- `base.css` 现在只负责盒模型、文档背景、原生控件字体与焦点样式；全局设计变量仍集中在 `tokens.css`，页面/组件专属样式保留原文件。架构文档已记下样式所有权和导入规则。
- 通用错误提示的 20px 下边距改用等值的 `--space-5`，其余共享状态规则保留原有声明值。`pnpm --filter lfaa-frontend run build` 通过，含 TypeScript 检查；产物写入根目录 `dist/frontend/`。静态核对确认公共类只定义一次且只从主入口导入一次。
- 未做浏览器目视验收；本次仅调整 CSS 文件归属和单一导入位置，没有改动布局、颜色、交互或业务行为。当前目录没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-UI-HOME-RESPONSIVE-01

### 用户目标

减少应用中心在宽屏和矮窗口中的过大留白，让应用入口在不同 CSS 视口宽度下保持清晰、紧凑且可访问。

### 当前合同

- 保留应用中心现有导航、文案、卡片入口和交互，不改变应用能力、数据或路由。
- 桌面布局减少宽屏顶部留白、欢迎区高度和卡片的非必要最小高度；矮窗口进一步压缩垂直间距。
- 保留现有宽度断点和自然页面滚动；窄屏不强制缩小全部内容以挤入首屏，不产生横向滚动。
- 完成标准：320px 窄屏、常见桌面宽度、超宽桌面、横屏矮窗口均保持内容可读；类型检查与前端构建通过；明确说明未执行的实机视觉验收。

### 允许修改

- `frontend/src/styles/workbench.css`、`frontend/src/styles/responsive.css`：仅调整应用中心及其共享页面框架的尺寸与响应式规则。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改导航、卡片文案、应用行为、设置数据、API、路由或页面信息架构。
- 不增加依赖、图片或动画，不重做首页，不把完整首屏展示作为牺牲可读性和可访问性的目标。
- 不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 应用中心桌面留白收紧：主内容顶部间距上限由 108px 降为 64px，欢迎区最小高度由 286px 降为 244px，卡片最小高度由 340px 降为 320px。
- 增加宽度至少 721px、高度不超过 960px 时的紧凑布局，压缩欢迎区、卡片图文和页脚间距；页面仍按内容自然增高并支持滚动。保留既有 1050px、720px 宽度断点及移动端纵向滚动。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；产物位于根目录 `dist/frontend/`。
- 未完成浏览器多视口目视验收：本次浏览器控制面连续返回 `nodeRepl.fetch request failed`。仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`；当前工作目录也没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-SETTINGS-AI-GROUP-SPACING-01

### 用户目标

修正设置中心“AI 与模型”页面中，模型账户卡片区域与“推理参数”分组标题之间过近的问题。

### 当前合同

- 保持模型账户卡片、推理设置行、字段顺序和交互不变。
- 只调整账户卡片网格与后续参数分组之间的垂直间距；桌面双列和窄屏单列布局均应保留清晰分组。
- 完成标准：标题不再紧贴账户卡片；前端类型检查与构建通过；未执行的浏览器视觉验收需明确说明。

### 允许修改

- `frontend/src/components/SettingsPage.css`：仅调整 AI 与模型页面的分组间距。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改 AI 设置内容、数据、API、表单顺序、页面信息架构或其他设置分类。
- 不增加依赖，不做无关布局重构；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 原因是 `.ai-settings-layout` 后面直接进入“推理参数”分组，网格自身没有底部间距。现为账户卡片网格增加 24px 下边距，让标题与上方卡片分开。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；产物写入根目录 `dist/frontend/`。
- 未执行修改后的浏览器目视验收；仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`，当前工作目录也没有 Git 元数据。

## LFAA-UI-PERF-SETTINGS-01

### 用户目标

修复设置中心首次进入时与账户主题不一致、重复读取设置造成等待的问题，并确保分类数据按需读取；同时处理有源码证据支持的滚动和切换开销。

### 当前合同

- 会话恢复或登录时与账户偏好一起读取当前账户设置，设置返回前不挂载工作台，避免系统深色模式暂时代替账户主题；读取失败时提供重试入口，不回退到临时主题。
- 工作台持有已读取的账户设置；设置页复用工作台传入的设置，不重复请求完整设置。
- 设置默认分类立即呈现；外观背景、AI Provider、插件、用量、归档、权限和运行状态等数据只在进入对应分类时请求，并避免未访问分类的数据阻塞首屏。
- 分类切换期间继续完成已发出的读取；重复进入同一分类或读取共享的运行状态、扩展信息时复用进行中的请求，不因切换产生重复请求。
- 检查设置分类的 React 渲染、外观图片预览和相关布局样式，按源码证据选择最小有效优化。
- 保持设置项、API 契约、数据归属、权限行为和视觉层级；优化不能以隐藏内容或减少功能为代价。
- 某个分类的数据请求失败时，只显示该分类的错误，不改变工作台已加载的账户主题或阻塞其他分类。
- 完成标准：工作台首次显示已采用账户保存的主题；设置页不重复读取完整设置；未访问分类没有对应数据请求；前端类型检查与构建通过；明确说明无法运行时采样的限制。

### 允许修改

- `frontend/src/App.tsx`：会话恢复或登录时预载账户设置，并在返回前不挂载工作台。
- `frontend/src/components/Workbench.tsx`：持有已读取的账户设置并将其传递给设置页。
- `frontend/src/components/SettingsPage.tsx`、`frontend/src/components/SettingsPage.css`：设置分类按需读取及设置页专属的加载与渲染处理。
- `docs/PROMPTS.md`：维护本任务合同与完成状态。

### 禁止修改

- 不改设置 API、数据格式、设置项归属、其他页面行为或用户可见功能。
- 不在浏览器本地存储复制账户设置，不增加依赖，不做无关重构；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 主题闪烁来自 Workbench 首次使用 `system` 默认主题，随后异步加载账户设置；认证恢复与登录现在会先并行读取账户偏好和账户设置，再挂载 Workbench，因此初始主题直接来自账户保存值。
- 如果完整账户设置读取失败，保留已恢复的会话并显示明确错误和重试入口，不以默认系统主题冒充账户设置。
- 设置页此前在 Workbench 已读取后又调用一次完整设置接口，并把首屏内容挡在加载态后；现改为复用 Workbench 设置，默认“常规”页立即显示。保存成功后同步完整账户设置，避免重新进入时读到旧状态。
- 分类数据原本已按当前分类懒加载，本次保留该行为；外观、AI、插件、用量、归档、权限和运行信息仍只在进入相应分类时请求。
- 滚动路径没有设置页自定义滚轮处理；已去掉设置正文实时模糊采样，将设置页壁纸改为普通滚动背景，并关闭半透明设置导航的实时背景模糊，保留半透明配色。
- 外观背景卡片改用懒加载、异步解码，并跳过视口外卡片内容的布局与绘制；切换分类不会丢弃仍在进行的读取，同分类请求及 AI 插件/运行状态等共享读取会复用进行中的 Promise，避免快速切换触发重复请求。
- `pnpm run build:frontend` 通过，含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。未运行浏览器实机采样；当前工作目录无 Git 元数据，仓库也未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`，因此无法执行 `git diff --check` 或这些额外 Gate。截图中的通用“服务器内部错误”没有请求 ID 或接口信息，无法据此确认其独立服务端原因。

## LFAA-UI-PERF-SETTINGS-02

### 用户目标

修复设置中心在 Web 浏览器和桌面容器中滚动卡顿的问题，优先优化两端共享前端的长分类滚动路径。

### 当前合同

- 先核对设置中心滚动容器、背景合成、分类 DOM 和滚动时的 React 更新来源，按可观察代码证据选择修复点。
- 只优化当前活动分类中视口外设置行的布局与绘制；视口内内容、交互、无障碍树、背景配置和滚动行为保持可用。
- 不新增依赖、不修改设置 API 或数据、不移除用户可见设置；桌面端继续复用共享 Web 前端实现。
- 完成标准：离屏设置行按需跳过布局与绘制并保留自然高度；前端类型检查与构建通过；核对产物与源码规则；说明浏览器/桌面运行时滚动帧采样是否实际完成。

### 允许修改

- `frontend/src/components/SettingsPage.css`：设置中心滚动容器和行级布局/绘制优化。
- `docs/PROMPTS.md`：维护本任务合同和完成状态。

### 禁止修改

- 不改变设置项、背景图片显示、页面结构、滚轮事件、API、权限或持久化行为。
- 不新增运行时依赖，不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 源码核对未发现滚轮处理器或随滚动更新 React 状态的代码；设置页只渲染当前分类，但该分类中的设置行此前始终参与完整布局与绘制。
- 设置行现使用 `content-visibility: auto`，并按普通行、快捷键行、布局预览行和窄屏分别提供估算尺寸；滚入视口后使用真实布局，保留控件、键盘访问和用户设置。
- `pnpm run build:frontend` 通过，类型检查与 Vite 构建成功，产物位于根目录 `dist/frontend/`。本机 Headless Chrome 151 确认支持 `content-visibility: auto` 与对应内在尺寸语法，开发服务器返回的设置样式也包含这些规则。
- 自动化浏览器是隔离的未登录会话，只能确认登录入口可显示；未取得用户账户会话，未实测登录后设置分类的滚动帧率，也未实测桌面容器帧率。改动位于 Web/Desktop 共用前端，因此两端使用同一优化实现。

## LFAA-UI-SETTINGS-PRELOAD-01

### 用户目标

减少首次进入设置中心时因 `SettingsPage` 按需加载而出现的等待和视觉闪动。

### 当前合同

- 保留设置页代码分块和现有路由；工作台首屏稳定后在空闲时预加载设置页模块，设置入口获得鼠标悬停或键盘焦点时也可提前预热。
- 懒加载展示仍保留安全兜底；预加载失败不得形成未处理拒绝或阻止用户后续进入设置页。
- 预加载仅获取前端模块及其样式，不挂载设置页、不触发分类数据 API、不重复读取账户设置。
- 不改设置业务、导航、API、数据归属、账户权限和页面布局，不新增依赖。
- 完成标准：前端类型检查与构建通过，产物位于根目录 `dist/frontend/`；说明浏览器实际冷启动耗时是否完成目视验收。

### 允许修改

- `frontend/src/components/Workbench.tsx`：复用同一个设置页动态导入，并在工作台空闲和设置入口交互时预加载。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不移除设置页代码分块，不在应用初始关键路径同步载入设置页。
- 不触发设置分类数据读取，不改设置项、数据格式、API、权限、其他页面行为或布局。
- 不新增依赖，不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对动态导入复用、预加载失败处理及交互预热入口；浏览器若不可用，明确说明未完成冷启动目视验收。

### 完成记录（2026-09-28）

- Workbench 初次稳定后使用 `requestIdleCallback`（最长等待 1500ms）预加载设置页模块；不支持该 API 的浏览器使用 1000ms 延迟回退。设置入口悬停或键盘聚焦时也会立即预热。
- 设置页懒加载与预热复用同一动态导入 Promise。预热失败会清除缓存并吞掉后台拒绝，用户随后打开设置页时仍可重新加载；模块导入不会挂载设置页或触发设置分类数据 API。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 构建产物位于根目录 `dist/frontend/`。
- 未执行浏览器冷启动目视或网络采样，无法确认实机首次打开耗时；当前工作目录没有 Git 元数据，无法运行 `git diff --check` 或读取 Git 变更状态。

## LFAA-UI-REFRESH-PERSISTENCE-01

### 用户目标

刷新设置中心时保持当前分类与正文滚动位置，避免服务检查期间短暂误显示登录页；控制端不可达时给出明确连接提示和重试操作。

### 当前合同

- 浏览器刷新 `/settings` 时，从有效 URL 分类恢复设置页；同时按当前用户持久化最近选择的分类，重新打开设置中心时恢复该分类。
- 按当前用户与分类分别持久化设置正文垂直滚动位置；刷新或返回同一分类时，在同步内容或该分类异步数据加载完成后恢复滚动位置。
- 服务状态为 `checking` 时继续显示初始化状态，不提前将未验证会话呈现为登录页；仅在服务端明确返回未认证后显示登录表单。
- 控制端不可达或会话恢复发生临时错误时显示可恢复状态与重试操作；健康接口恢复后自动继续恢复会话。
- 确认有效会话后，Workbench 模块与偏好/账户设置读取并行预热；共享同一动态导入请求，不提前挂载设置页或显示未经验证的账户内容。
- 不把账户设置、令牌或会话凭据复制到浏览器存储；本地只保存设置分类标识与正文滚动位置等非敏感界面偏好。
- 完成标准：前端类型检查与构建通过，产物位于根目录 `dist/frontend/`；明确说明未执行的浏览器刷新验收。

### 允许修改

- `frontend/src/App.tsx`：修正健康检查与会话恢复状态机、增加可恢复连接提示，并并行预热 Workbench 模块。
- `frontend/src/components/SettingsPage.tsx`：从 URL/当前账户本地界面偏好恢复并保存当前设置分类和各分类正文滚动位置。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不在会话验证前渲染账户工作台，不改变 HttpOnly 会话认证和服务端授权。
- 不把账户设置、身份资料、Cookie、Token 或秘密写入浏览器存储。
- 本地仅保存当前分类和滚动位置等非敏感界面状态，不保存分类内容或设置数据。
- 不改设置 API、账户设置字段、分类内容、业务权限或其他页面行为；不新增依赖。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与前端构建通过，产物位于根目录 `dist/frontend/`。
- 静态核对初始化状态转换、登录判定、重试流程、分类恢复优先级与异步内容滚动恢复；浏览器若不可用，明确说明未完成刷新实测。

### 完成记录（2026-09-28）

- 初始化阶段等控制端健康检查结束后再恢复会话，避免 `checking` 状态提前显示登录页。仅 `/auth/me` 明确返回 401 时显示登录；健康接口离线或会话恢复失败时显示重试界面，恢复连接后自动继续检查。
- 会话确认后并行读取偏好/账户设置并预热 Workbench 动态模块，渲染时复用同一导入请求；登录前不显示工作台账户内容。若刷新时 URL 指向设置中心，成功登录后保留该目标路由。
- 设置分类按用户 ID 保存在浏览器本地的非敏感界面状态中，同时同步到 `?section=`；有效 URL 值优先，其次是旧版账户入口指定分类，再其次是该账户上次分类，最后才回退“常规”。
- 设置正文滚动位置按用户 ID 和分类分别保存；分类切换时立即保存离开的分类，刷新/离开页面时冲刷待保存位置，并在对应分类的异步数据加载结束后恢复。没有历史位置的分类从顶部开始。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。
- 仓库未提供 `scripts/workspace-preflight.mjs` 或 quality/release Gate 脚本；按要求尝试运行 workspace preflight 时因脚本不存在而无法执行。未执行浏览器刷新实测；当前工作目录没有 Git 元数据，无法运行 `git diff --check` 或读取 Git 变更状态。检查时本机控制端健康接口返回 `status: ok`、`persistence: ready`。

## LFAA-SETTINGS-NOTIFICATIONS-01

### 用户目标

让设置中心“通知”中的当前 LFAA 通知偏好接入真实通知宿主和事件；AI Work 的成功回复完成后，按用户选择向操作系统发送浏览器通知，并实际播放所选提示音。

### 当前合同

- 当前 LFAA 只有 AI Work 流式对话完成事件可作为通知来源。仅 `complete` 结果触发通知；失败、中断和取消不触发。
- 使用浏览器 Notifications API；设置页显示当前浏览器支持情况和授权状态，并通过明确的用户操作请求授权。系统拒绝授权时说明需在浏览器站点设置中恢复。
- `completionNotification` 的“始终 / 仅工作台未聚焦时 / 关闭”由页面可见性与焦点状态真实执行。通知正文只说明哪个 LFAA 应用的 AI 回复已完成，不包含用户消息或模型回复内容。
- `notificationSound` 由 Web Audio 实际播放，并在设置页提供试听；浏览器限制或音频设备错误时不伪称已播放。
- 当前没有权限等待、AI 反问、Codex/ChatGPT 外部任务、用量重置、健康数据、群聊、营销、资料库分享或项目邀请等 LFAA 事件源。对应权限/问题提醒保持清楚的待接入状态；不得创建虚假开关、推送或外部产品联动。
- 浏览器通知仅在 LFAA 页面进程仍运行时有效，不承诺关闭页面后的 Web Push 或后台任务投递。保留现有账户级设置字段和服务端存储格式，不新增依赖、数据库字段或 API。
- 完成标准：授权与不支持/拒绝状态可见；通知策略能针对真实 `complete` 事件执行；提示音可试听且在通知事件中按设置播放；通知不泄漏会话正文；前端类型检查与构建通过，并说明未执行的浏览器/桌面环境验收。

### 允许修改

- `frontend/src/shared/notification-runtime.ts`：浏览器通知授权、状态、投递和提示音运行时。
- `frontend/src/components/SettingsPage.tsx`：通知状态、授权/测试操作和真实功能状态说明。
- `frontend/src/components/AiWorkChat.tsx`：将 AI Work 成功完成事件接入通知运行时。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：同步事件来源、通知宿主边界和实际接入状态。

### 禁止修改

- 不增加 ChatGPT、Codex、健康、营销、群聊、分享或项目等外部服务通知；当前没有对应 LFAA 连接器和授权 API。
- 不把权限请求、问题等待、模型额度或后台任务显示成已接入事件；不在通知中暴露用户消息、模型回复或秘密。
- 不新增服务端 API、账户设置格式、数据库迁移、依赖、Service Worker 或 Web Push 服务；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 设置页显示浏览器通知能力和授权状态，支持由用户主动请求授权、发送测试通知及试听提示音；被浏览器阻止或运行环境不支持时显示对应说明。
- 三个应用共用的 AI Work 聊天在收到真实 `complete` 事件后，按“始终 / 仅工作台未聚焦时 / 关闭”策略发送系统通知，并根据提示音偏好播放 Web Audio 音效。失败和中断不会通知，通知正文不包含聊天消息。
- 权限等待与问题提醒显示为待接入，不保留会造成误解的有效开关。ChatGPT/Codex 外部任务及其他没有 LFAA 事件源的通知类别不纳入本次范围。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物位于根目录 `dist/frontend/`。仓库未提供 `workspace-preflight.mjs` 或 `quality:full` 脚本。未进行浏览器权限弹窗、操作系统通知弹出及桌面容器的交互验收。

## LFAA-AI-PERMISSIONS-01

### 用户目标

在“用户与权限”中正式提供“请求审批”“替我审批”“完全权限”三种账户级 AI 工具策略，并让 server 核心按真实工具、操作类型和目标范围执行策略；审批与记忆授权必须由当前账户明确决定，且能查看和撤销。

### 当前合同

- “请求审批”：只读工具可按既有能力执行；每项写入或高风险操作都必须单独审批，不建立记忆授权。
- “替我审批”：未记忆的写入或高风险操作必须先审批；审批流随后单独询问是否记住。只有用户明确选择记住，才保存精确到用户、应用、工具 ID/版本、风险和目标范围的授权。任何键变化均重新审批。
- “完全权限”：不对已登记且真实可执行的工具逐项弹出审批；仍受工具登记、应用范围、目标校验、身份/角色授权和业务规则约束，不开放任意 Shell/任意路径能力，也不代表同意 Minecraft EULA。
- 授权决策由 server 核心作出。缺少可执行工具登记、目标范围或有效参数时必须拒绝或要求审批，不能因前端选择、Hook 或模型回复提升权限。
- 单次审批继续按用户隔离、参数哈希绑定、五分钟失效且只能消费一次；“记住”授权不绑定本次参数值，但绑定稳定工具版本与完整授权范围，并支持当前账户撤销。
- 设置读取兼容旧 `defaultPermission` 值；旧 `workspace` 不迁移成无条件放行，转换为需要首次审批的“替我审批”模式。
- 当前尚无业务工具执行器；本任务接入策略、设置、记忆授权 API/界面和审批闭环，不虚构 Minecraft/Java 下载、EULA 接受或开服执行结果。
- 完成标准：账户可读取/保存三种模式；权限核心对三种模式、未登记工具、跨应用、工具版本变化、范围变化、记忆授权及撤销给出正确结果；审批可选记忆且仍只能授权单次参数；类型检查和构建通过。

### 允许修改

- `server/src/ai/permissions.ts`、`server/src/modules/settings/service.ts`、`server/src/api/routes.ts`、`server/src/database.ts`：策略决策、账户级授权记录、兼容读取、API 与显式数据库迁移。
- `frontend/src/api.ts`、`frontend/src/components/SettingsPage.tsx`：三种模式说明、两步审批/记忆确认、已记忆授权查看与撤销。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：同步权限语义、EULA 边界和当前没有业务工具的状态。

### 禁止修改

- 不实现或伪装尚不存在的 Minecraft、Java、文件、网络、Shell 或 daemon 工具；不把授权偏好等同于工具执行能力。
- 不将用户审批、记忆授权或 EULA 同意合并；不自动接受 EULA。
- 不放宽单次审批参数绑定、用户隔离、过期或单次消费要求；不让前端或插件成为授权事实来源。
- 不引入新依赖，不改与权限策略无关的页面或业务，不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 设置中心已提供“请求审批”“替我审批”“完全权限”三种账户级模式；旧 `defaultPermission: workspace` 以兼容读取映射到需首次审批的“替我审批”，不会继续静默放行。
- server 授权器从 SQLite 读取当前账户的已保存模式；仅对真实登记、适用当前应用且有可信目标范围的工具作出授权。记忆授权匹配账户、应用、工具 ID/版本、风险和目标范围哈希；审批需先确认本次操作，再单独选择“仅批准一次”或“记住并批准”。
- 新增记忆授权列表与账户内撤销接口。单次审批绑定参数、工具版本、风险和目标范围，有效 5 分钟且单次消费；升级时旧审批标记过期。EULA 仍需单独由用户明确同意。
- 当前没有可执行的 Minecraft/Java 或其他 AI 业务工具；本次接入的是可信授权策略和审批控制，真实下载、配置及开服执行尚未接入。
- 验证：`pnpm run build`、`pnpm --filter lfaa-server run typecheck` 通过；临时 SQLite 烟测覆盖三种模式、账户隔离、风险/版本/范围变化、撤销、旧设置兼容及单次参数绑定消费。未执行浏览器交互验收；仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full` 门禁。

## LFAA-AI-PERMISSIONS-DB-01

### 用户目标

修复版本 8 SQLite 数据库缺少 `scope_summary` 列时，设置页读取 AI 审批和记忆授权列表返回 500 的问题。

### 当前合同

- 通过新增版本 9 迁移兼容两种版本 8 结构：审批表和授权表均已有 `scope_summary`，或两表均缺少该列。
- 迁移保留审批与授权记录及原有字段；旧记录没有保存目标范围时，使用明确说明“旧版本未记录目标范围”的值，不推断实际范围。
- 迁移在事务中完成，成功后才更新数据库版本；不删除数据库、不重置用户数据。
- 完成标准：临时 SQLite 烟测覆盖缺列与已有列两种版本 8 数据库、字段补齐、旧记录保留和重复启动；server 类型检查及工作区构建通过。

### 允许修改

- `server/src/database.ts`：新增兼容迁移。
- `server/test/database-migrations.test.mjs`：新增 Node 内置测试覆盖两种版本 8 结构与数据保留。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不手动改写或删除 `data/database/lfaa.sqlite`；不丢弃审批、授权或账户数据来绕过迁移。
- 不改变 AI 权限策略、API 响应、前端行为或其他数据库迁移。
- 不增加依赖，不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- 新增 SQLite 迁移 v9，兼容两种版本 8 授权表结构；缺失目标范围说明的旧记录显示“旧版本未记录目标范围”，授权表重建时保留原记录、约束与索引。
- 新增临时 SQLite 回归测试，覆盖缺列/已有列、记录保留、外键检查与重复启动；2 项通过。
- 验证：`pnpm --filter lfaa-server run typecheck` 与 `pnpm run build` 通过。本地数据库为 v9，两张表均有 `scope_summary`，现有审批/授权记录数量为 0；未执行浏览器界面验收。仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 Git 元数据。

## LFAA-SERVER-POLL-LOG-01

### 用户目标

减少开发终端中由前端定时健康检查和会话复核产生的重复成功请求日志，同时保留真实请求失败及其他 API 请求的可诊断日志。

### 当前合同

- 前端现有 `/api/health` 健康检查和 `/api/auth/me` 会话复核频率及认证行为保持不变。
- 成功的 `GET /api/health` 与 `GET /api/auth/me` 请求使用 `debug` 级别；默认 `LOG_LEVEL=info` 时不持续打印这些轮询记录。失败响应仍保持可见。
- 其他 HTTP 请求仍按现有 `info` 级别记录；服务器错误仍保留 `error` 日志和请求 ID，不得记录请求正文、Cookie、Token 或密钥。
- AI 审批与记忆授权接口曾因 v8 SQLite 数据库缺少 `scope_summary` 返回 500；该问题由 `LFAA-AI-PERMISSIONS-DB-01` 的 v9 兼容迁移处理。本任务不重复迁移、不重置或直接修改用户数据库。
- 完成标准：server 类型检查与工作区构建通过；使用隔离的临时数据目录验证健康轮询成功记录在默认日志级别下被压低，失败请求仍有可见诊断；说明未执行的环境验收。

### 允许修改

- `server/src/index.ts`：仅调整成功健康/会话轮询请求的日志级别及其路径判定。
- `docs/PROMPTS.md`：维护本任务索引、合同与完成记录。

### 禁止修改

- 不改变前端轮询频率、认证语义、API 响应或用户可见行为。
- 不改变其他接口的日志级别，不记录请求正文或认证秘密。
- 不修改 SQLite 迁移、权限 API、数据库运行数据或依赖；不部署、发布、上传或提交 Git。

### 完成记录（2026-09-28）

- `/api/health` 与 `/api/auth/me` 的成功 GET 请求改为 `debug` 级别；默认 `LOG_LEVEL=info` 下不再持续打印。失败响应与其他接口继续记录为 `info`，500 错误保留原有 `error` 及请求 ID。
- 在全局中间件处理时固定原始请求路径，完成日志不再受 Express 路由挂载期间的路径变化影响。
- 隔离数据目录运行验证：`GET /api/health` 返回 200 且不产生 `info` 请求日志；`GET /api/auth/me` 返回 401、未知接口返回 404，两者仍输出含稳定原始路径和请求 ID 的请求日志。临时数据库和密钥已清理。
- `node --test server/test/database-migrations.test.mjs` 通过（2 项）；`pnpm --filter lfaa-server run typecheck` 通过；`pnpm run build` 通过，前后端产物位于根目录 `dist/`。
- 日志中的审批与记忆授权 500 对应版本 8 SQLite 表缺少 `scope_summary`；现有 v9 迁移已处理该兼容问题，本次复跑其迁移回归通过。本次未直接修改用户数据库。
- 未运行浏览器目视验收；仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`，当前目录也没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-SETTINGS-PERMISSION-CLARITY-01

### 用户目标

按 LFAA 当前的权限模型与宿主能力，完善“常规”中的访问边界说明和“用户与权限”中的 AI 工具授权说明，避免借用其他产品的权限定义或让账户偏好看起来能直接授予本机能力。

### 当前合同

- “常规”只说明 LFAA 当前客户端的主机访问边界，并提供到“用户与权限”的明确入口；不在常规设置中复制 AI 工具权限模式，也不提供无法执行的本机完整访问开关。
- 页面不得链接到 Codex 或其他产品的权限说明；所有描述必须以 LFAA 代码、当前项目架构和权限合同为依据。
- 清楚区分账户级 AI 工具授权策略与本机/节点实际执行能力：当前没有已接入的 AI 业务执行工具；权限模式本身不授予任意本机文件、Shell 或网络命令能力。
- “请求审批”说明：已登记且适用于当前应用的只读工具按规则执行；写入与高风险操作逐项审批，且不保存记忆授权。
- “替我审批”说明：首次写入或高风险操作仍需用户批准；用户可仅批准一次或记住授权。记忆授权仅匹配当前用户、应用、工具 ID/版本、风险和目标范围，不绑定单次参数值；工具参数仍由业务规则校验。
- “完全权限”说明：仅对已登记、可执行、适用于当前应用且具有有效目标范围的工具免逐项审批；server 仍执行身份、应用、工具、目标和业务规则检查。不开放任意 Shell 或任意路径，不代替 Minecraft EULA 的单独同意。
- 保持现有设置 API、账户数据格式、数据库、授权器和审批流程不变；不新增实际主机访问能力。
- 完成标准：常规页提供 LFAA 自有且准确的访问边界和权限页入口；权限页按当前 server 策略解释三种模式及未接入的执行能力；前端检查与构建通过。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：常规访问边界入口、三种 AI 工具权限模式说明和当前能力状态。
- `docs/PROMPTS.md`、`docs/开发计划.md`：维护任务合同和设置归属描述。

### 禁止修改

- 不实现或伪装桌面宿主、daemon、本机文件、Shell、网络命令或其他业务执行器。
- 不修改用户权限 API、授权核心、数据库格式、审批/记忆授权语义或 EULA 处理。
- 不增加依赖、不引入其他产品的设置说明链接、不修改无关设置或视觉样式；不部署、发布、上传或提交 Git。

### 完成记录

- 常规页移除不可用的“完整访问权限”开关和 Codex 外链，改为显示账户级 AI 工具策略入口与当前未接入的本机/节点执行边界；AI 策略入口直接跳转“用户与权限”。
- “用户与权限”按 LFAA server 的实际授权语义逐项说明请求审批、替我审批和完全权限，并明确当前没有可执行的 AI 业务工具、授权策略不会授予本机文件/Shell/网络命令能力，Minecraft EULA 仍需单独同意。
- 将 P1-08 的设置归属描述改为：常规保存通用偏好，AI 工具权限、审批与记忆授权归入“用户与权限”。
- 验证：`pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物写入 `dist/frontend/`。未执行浏览器/桌面交互验收；`scripts/workspace-preflight.mjs` 与 `quality:full` 当前不存在，工作目录没有 `.git` 元数据，无法核查 Git 状态或运行 `git diff --check`。

## LFAA-AI-ARCH-01

### 用户目标

为后续 LLM、Agent、Skills、提示词和专家扩展建立可组合的后端 AI 插件宿主；先验证 DeepSeek Harness 使用的 Cordis 插件生命周期是否适合 LFAA，不提前实现完整 AI Work。

### 当前合同

- AI Runtime 宿主位于 `server/src/ai/`，由 server 启动和关闭；首阶段使用 Cordis Context、Loader 和生命周期管理。
- Core 服务保留 LFAA 身份、授权策略、审批、审计、业务规则和节点任务边界。插件不得替代这些服务或绕开 server 业务 API。
- 首阶段仅装载随 LFAA 源码发布且由代码清单登记的内置插件；不得从 `data/plugins/` 或用户输入路径装载第三方可执行代码。
- 开发模式可对受信任的内置插件启用代码热更新；生产模式不监视源码目录。Skills/提示词的用户管理、第三方插件沙箱、插件市场和插件 UI 不属于本任务。
- AI 插件宿主在 HTTP 服务开始接收请求前完成初始化，并在 server 正常关闭时释放插件资源。
- 完成标准：Cordis 宿主可启动、登记内置插件、提供插件状态，并释放全部运行资源；server TypeScript 检查与构建通过。不得将宿主就绪报告为 LLM 推理或 AI Work 已接入。

### 允许修改

- `server/package.json`、`pnpm-lock.yaml`：加入并锁定本任务验证所需的 Cordis 依赖。
- `server/src/ai/`、`server/src/index.ts`：实现最小宿主和生命周期接线。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：记录任务合同、插件边界和实际阶段状态。

### 禁止修改

- 不实现 LLM 推理、Agent Loop、模型 API 调用、AI 对话 API、游戏/写作/网络穿透工具或新数据库表。
- 不从插件执行任意 Shell、任意文件路径或自行授予主机权限；不装载未经信任和授权的外部可执行插件。
- 不实现插件商店、在线安装、前端插件 UI、MCP 服务管理或跨进程第三方插件沙箱。
- 不部署、发布、上传、购买、提交 Git 或执行外部环境变更。

## LFAA-AI-RUNTIME-01

### 用户目标

完成可用的 AI Work 后端闭环，并复用设置中心已加密保存的 Provider 账户。模型运行参数、AI 扩展、连接器、权限审批、用量和会话归档必须进入各自正确的设置分类。

### 设置中心归属规则

| 设置分类 | AI 能力归属 |
|---|---|
| AI 与模型 | Provider 账户、密钥状态、活动模型、推理参数和 Runtime 状态 |
| 插件 | 内置/受信任插件、Skills、Experts、Prompts 和 Tools 的目录与启用状态 |
| 连接 | MCP 与外部服务连接及其凭据引用 |
| 用户与权限 | Agent 工具权限、风险级别、审批策略和用户角色 |
| 使用情况和计费 | 本地 Token 与请求用量；暂无成本数据时不虚构费用 |
| 已归档的聊天 | AI Work 会话列表、归档和恢复 |
| 常规 | 通用工作台交互偏好 |
| 外观 | 主题、强调色、背景和视觉效果；不得放置 AI 服务配置 |

### 当前合同

- AI 推理必须读取当前用户在设置中心激活的 Provider 账户；密钥只在 server 内解密使用，不返回浏览器，不复制维护第二份 Provider 配置。
- 实现可取消、限流、持久化且按用户隔离的会话与流式响应；支持当前设置中心登记的六类 Provider，并只请求固定 HTTPS 白名单端点。
- Agent、模型、Skill、Prompt、Expert 和 Tool 使用可版本化的类型化契约及 Cordis 生命周期；所有扩展注册和监听均随拥有它的插件卸载。
- 核心授权与审批优先于 Hook 决策；插件不能提升用户权限、绕过拒绝结果或直接执行任意 Shell/任意路径文件操作。
- 每个应用 AI Work 使用独立会话上下文。只有仓库中确实存在的业务服务/daemon Runner 才能注册为可执行工具；不存在的 SteamCMD、Minecraft、写作和隧道执行能力必须明确显示待接入，不得用假工具完成演示。
- 只允许代码登记的受信任内置插件运行；Markdown/JSON 型 Skills、Prompts、Experts 可以作为数据扩展管理。第三方可执行插件、在线市场和进程沙箱不纳入本任务，不能从任意路径执行用户代码。
- 数据库使用向前兼容的显式迁移；AI Provider、AI Runtime 偏好、会话、消息和 Token 用量按用户隔离并持久化。设置中心只在其业务归属分类呈现配置。
- 完成标准：已配置活动 Provider 的用户可在 SteamCMD、Minecraft 和写作的 AI Work 中创建/继续/归档会话并收到流式模型回复；无活动 Provider 时 UI 引导进入“AI 与模型”；插件目录、权限状态、Token 用量和会话归档都来自真实后端数据；server 与 frontend 检查和构建通过。

### 当前实现与边界（2026-09-28）

- 已接入六个固定 Provider 的账户复用、加密密钥、模型选择、限流、超时、取消、流式响应、持久化会话、用量、归档和三个应用内 AI Work 面板。当前没有真实 Provider 密钥，故没有发起真实模型请求；首次使用者需在“AI 与模型”配置并激活账户。
- 设置中心已按业务归属拆分：AI 参数与 Runtime 状态在“AI 与模型”，受信任扩展与运行期 Hooks 在“插件”，默认工具策略与审批队列在“用户与权限”，本地 token 用量在“使用情况和计费”，会话恢复在“已归档的聊天”。“外观”只处理视觉设置。
- 当前登记 Agent 是可版本化的对话/规划配置，不包含 Agent Loop、子 Agent 委派或工具执行。SteamCMD、Minecraft、写作文件、MCP、网络穿透和 daemon 工具尚不存在，因此没有登记虚假可执行工具。
- Cordis Hooks 只观察不含用户正文的推理元数据；Hook 异常不能改写请求或权限。server 核心授权器读取当前账户权限模式，按应用、工具版本、风险和目标范围给出 allow/approval-required/deny；记忆授权只在“替我审批”模式匹配，单次审批绑定完整参数且有效期 5 分钟、只能消费一次。当前无执行工具，审批队列为空。
- 迁移 v6/v7 新增按用户隔离、有时效的单次工具审批记录；迁移 v8 新增工具版本、目标范围与记忆授权，并将旧格式待处理审批置为过期。历史设置由迁移 v5 从“常规”拆到 AI Runtime、用户权限和插件分类，历史会话消息和配置不删除。
- 当前验收：server/frontend TypeScript 检查与构建通过；临时 SQLite API 烟测确认三个 Cordis 插件 ACTIVE、六项扩展登记、设置分类正确、无 Provider 时返回 409、审批列表与拒绝 API 可用；授权烟测确认跨应用拒绝、危险操作需审批、审批绑定参数且单次消费。真实 Provider 流式响应仍待配置密钥后验证。

### 允许修改

- `server/src/ai/`、`server/src/api/`、`server/src/modules/settings/`、`server/src/database.ts`、`server/src/index.ts`：Provider 推理、Agent/Hooks、数据迁移、API 和生命周期。
- `frontend/src/api.ts`、`frontend/src/components/`、`frontend/src/styles/`：AI Work 页面和与设置分类对应的真实控制面。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：同步契约、设置归属、实现状态和验收结果。

### 禁止修改

- 不在“外观”或不相关页面添加 AI 服务配置；不将 AI 密钥发送到浏览器存储、URL、日志或普通设置响应。
- 不用占位响应伪装模型调用、业务工具、插件隔离或权限审批已接通。
- 不调用不存在的 SteamCMD、Minecraft、写作、daemon、主机 Shell 或任意文件操作能力。
- 不装载任意来源第三方可执行代码；不在此任务中实现市场下载和进程沙箱。
- 不部署、发布、上传、购买、提交 Git 或执行外部环境变更。

## LFAA-P1-01-05

### 用户目标

以当前 `H:\LFAA` 新项目为唯一工作对象，完成此前列出的 1 至 5 项：确认并实现持久化边界；建立 server 启动、配置、日志和健康接口；建立 Web 应用中心与路由骨架；连接前端健康状态；实现首次管理员初始化、登录、权限检查及可恢复的用户偏好。

### 当前合同

- server 是用户、角色、登录会话、应用偏好和健康状态的唯一 Owner；前端只消费 server API，不在浏览器保存密码或登录凭据。
- 本阶段使用 Node.js `node:sqlite` 文件数据库，位置为 `LFAA_DATA_DIR/database/lfaa.sqlite`；数据库迁移以 `PRAGMA user_version` 顺序管理。开发最低 Node.js 版本为 24.15.0。
- 登录密码和恢复密钥使用 Node.js `scrypt` 加随机盐保存；登录凭证通过 `HttpOnly`、`SameSite=Strict` Cookie 传递，生产模式要求配置强 `JWT_SECRET`。仅当本地用户表为空时可初始化唯一超级管理员；之后不开放注册和新增账户接口。新设密码至少 8 位并包含至少 3 类字符，恢复密钥可用于重设密码；已有账户可登录后补设恢复密钥。
- 最小业务持久化对象为用户、服务端登录会话、用户选中的应用及模式。游戏实例、节点、任务和写作数据不在本任务内。
- SteamCMD、Minecraft、写作及 AI Work 只提供明确标记为开发中的应用入口；不得表现成已经连接或可执行的功能。
- 完成标准：配置错误有明确启动诊断；server 可提供真实健康状态；唯一超级管理员可初始化并登录；登录后可访问应用中心；密码强度在界面提示并由服务端校验；恢复密钥可重设密码；用户偏好重启后仍可恢复；应用卡片入口、路由和健康状态可运行。
- 当前核查：server/front 构建通过；本机临时 SQLite API 流程通过首次管理员、登录、会话撤销、角色授权、用户隔离和重启后数据恢复；浏览器已显示首次管理员初始化表单及真实在线状态。未自动化提交登录表单，登录后的应用中心视觉验收仍待完成。

### 允许修改

- `package.json`、工作区包 `package.json`、`pnpm-workspace.yaml` 与 `pnpm-lock.yaml`：只调整本阶段需要的依赖、Node 引擎范围和命令。
- `server/src/`、`server/tsconfig.json`：实现配置、日志、SQLite 迁移、认证授权、用户偏好、健康接口及 server 启动。
- `frontend/src/`、`frontend/index.html`、`frontend/vite.config.ts`、`frontend/tsconfig.json`：实现应用中心、登录/首次初始化、用户管理页面和 API 状态连接。
- `.env.example`、`README.md`、`docs/开发计划.md`、`docs/系统总体架构.md`：同步运行方式、持久化合同和本阶段状态。
- `docs/PROMPTS.md`：维护本任务的合同状态与完成记录。

### 禁止修改

- 不实现 daemon 节点通信、真实 SteamCMD 或 Minecraft 部署、实例/文件/终端操作、写作业务、LLM 或 Agent 执行能力。
- 不新增数据库服务、ORM、UI 组件库或动效依赖；不把账号、密码、Token 或敏感配置写入前端、本地存储、URL、日志或仓库。
- 不部署、发布、上传、购买、提交 Git 或执行外部环境变更。
- 不执行与本任务无关的重构或大范围测试；只运行适用于本交付的构建和静态检查。

## LFAA-P1-01-07

### 用户目标

在新项目 `H:\LFAA` 中，让根目录 `pnpm dev` 能同时启动前端和 server；`lfaa.bat` 菜单选项 `2` 在当前窗口启动这两个服务，选项 `4` 保留给环境检查。

### 当前合同

- 前端和 server 仍分别由现有 `dev:frontend`、`dev:server` 命令负责；启动入口不重复实现服务逻辑。
- `pnpm dev` 在当前终端并行运行两个工作区开发脚本。
- `lfaa.bat` 保留依赖管理菜单；选项 `2` 在当前窗口前台同时运行两个开发服务，按 `Ctrl+C` 停止；选项 `4` 执行环境检查。
- 启动脚本验证 Node.js、项目指定的 pnpm 版本、工作区依赖及服务脚本；不自动安装依赖或更改运行配置。
- 完成标准：根目录 `pnpm dev` 指向两个真实工作区脚本；批处理菜单选项 `2` 在当前窗口前台调用并行启动脚本、不创建额外窗口；选项 `4` 检查运行环境；README 给出启动和停止方式。

### 允许修改

- `package.json`：只添加根目录 `dev` 脚本。
- `scripts/install-dependencies.ps1`、`scripts/start-dev.ps1`、`lfaa.bat`：只增加开发服务启动菜单及其检查、调度逻辑。
- `README.md`、`docs/开发计划.md`、`docs/PROMPTS.md`：同步开发启动方式、任务状态和合同。

### 禁止修改

- 不修改前端、server、daemon 业务实现及其 API、数据格式或架构边界。
- 不自动安装依赖、修改 `.env`、启动生产服务、部署、发布、上传、购买或提交 Git。
- 不引入服务编排依赖，不实现与本任务无关的进程管理或后台服务安装功能。

### 完成记录（2026-09-28）

- 根目录 `pnpm dev` 配置为并行运行前端和 server 的现有开发脚本。
- `lfaa.bat` 菜单调整为选项 `2` 一键启动前端和 server，选项 `4` 检查 Node.js、pnpm 版本和依赖。
- 启动脚本在当前窗口以前台方式运行根目录 `pnpm dev`；按 `Ctrl+C` 停止两个服务，不再调用 `Start-Process` 打开额外窗口。
- README 已记录命令行、菜单入口和停止方式。静态核对已完成；未启动开发服务或运行测试。

## LFAA-UI-MODULE-CANVAS-01

### 用户目标

让 SteamCMD、Minecraft 和写作应用在常规模式与 AI Work 模式下都使用中间列全部可用宽度和高度，不因内容最大宽度、外围内边距或固定内容高度留下大块空白。

### 当前合同

- 三款应用共用 `ApplicationWorkspace` 和其中间工作区布局；保留导航轨、当前应用左侧菜单、中心区和右侧工具资源栏的现有 Owner，不新增独立导航栏。
- 常规模式和 AI Work 模式的主内容均贴合中间列边缘，并占满顶部工作区标题栏以下的可用高度。
- 背景必须使用当前工作区对应的 `settings.appearance.backgrounds` 位置：选图片时同一张图片铺满中间画布并从内容面板中可见；选“纯色”时不显示工作区背景图片或独立横幅图片。
- 浅色和深色主题均尊重外观页的背景遮罩设置；有背景图片时，聊天和状态面板保持透光，文字与输入控件仍清晰可读；无背景图片时继续使用不透明纯色面板。
- 常规模式保留真实的“尚未连接业务能力”说明和状态占位；底部状态区域随工作区扩展填满剩余高度。
- AI Work 中心内容顶部不显示额外的应用标题/说明区；中心区域直接由对话消息和输入区占满。
- AI Work 会话列表显示在当前应用对应的 `ApplicationSidebar` 左侧菜单中，不显示在中心区或覆盖抽屉；会话按应用隔离，新建、切换、归档行为保持可用。
- AI Work 聊天面板在桌面、紧凑和移动布局中占满可用区域，不受旧最小高度覆盖；全局应用导航仍由外层工作台侧栏负责。
- 完成标准：共享实现覆盖三款应用的 AI Work；中心内容紧接工作区模式工具栏开始对话；会话只出现在当前应用的左侧菜单；前端 TypeScript 检查和构建通过；说明未执行的浏览器视觉验收。

### 本轮导航决策（2026-09-28）

- 在应用工作区内，侧栏只标记当前应用；其他应用入口禁用，避免直接跨应用跳转。用户先返回“应用中心”，再选择另一应用。
- 应用中心仍是跨应用切换入口；最左侧全局导航与应用内业务菜单保持原有职责。

### 允许修改

- `frontend/src/components/Workbench.tsx`：向共享外壳标记当前工作区是否配置了背景图片，供样式按真实设置切换透明度。
- `frontend/src/components/module-workbench.css`：调整共享中间工作区的尺寸、背景继承、主题透明度、纯色回退样式及应用侧栏中的会话区域。
- `frontend/src/components/ApplicationWorkspace.tsx`：将 AI Work 会话导航放入当前应用左侧菜单，并连接会话选择、新建和归档状态。
- `frontend/src/components/AiWorkChat.tsx`：移除会话抽屉和对话区会话入口，通过受控会话状态加载与显示消息。
- `frontend/src/components/ai-work-chat.css`：保持 AI Work 中间画布为单列对话布局。
- `docs/PROMPTS.md`：登记本任务合同和完成记录。

### 禁止修改

- 不新增功能、占位业务数据、图片、动效、依赖或 CSS 自定义属性。
- 不修改应用路由、后端 API、全局主导航轨和右侧上下文栏；仅调整当前应用左侧菜单中的 AI Work 会话导航与中心区标题呈现。
- 不部署、发布、上传、购买或提交 Git。

### 本轮修正（2026-09-28）

- 用户指出进入 SteamCMD AI Work 时，中间工作区仍被内部“会话”侧栏分成两列；中间区域应由对话区独占。
- 通过对话区内的“会话”入口按需打开覆盖抽屉，默认不为会话列表保留横向空间；抽屉保留会话新建、切换、归档与 Provider 状态。
- 外层应用导航属于全局工作台左栏，保持原有位置和职责。

### 用户进一步澄清（2026-09-28）

- 用户指出红框中的 AI Work 应用标题与说明不应占据中心对话区；该标题区必须移除。
- 会话列表必须迁入当前应用真正对应的左侧菜单，由 `ApplicationSidebar` 持有展示与选择入口；中心区不出现会话侧栏、抽屉或会话按钮。
- 本节取代上方“覆盖抽屉”方案；保留原有会话持久化与会话操作。

### 完成记录（2026-09-28）

- 用户反馈首轮铺满调整仍被浅色聊天面板遮住背景，常规模式还存在硬编码横幅图；现已按当前工作区的外观背景位置修正图层与透明面板规则。
- 图片背景时，同一张设置图片铺满中间画布并透过聊天和常规状态面板显示；“纯色”时中间画布使用主题画布色，常规模式不再显示独立横幅图片。
- `pnpm run build:frontend` 通过，TypeScript 检查与 Vite 构建均成功，产物写入根目录 `dist/frontend/`；构建产物内确认包含图片/纯色分支样式且不含硬编码应用横幅图片。
- 仓库未提供 `workspace-preflight` 脚本，当前目录没有 Git 元数据；浏览器目视核对因 `cua_repl` 返回 `nodeRepl.fetch request failed` 未能执行。
- 用户进一步指出覆盖抽屉仍属于中间区域，前一版抽屉方案已撤销。
- 最终实现已移除中心区 AI Work 标题/说明和会话入口；会话列表显示在当前应用左侧菜单，保留按应用读取、新建、切换、归档和 Provider 状态。
- `pnpm run build:frontend` 通过，包含 `tsc --noEmit` 和 Vite 构建，产物位于根目录 `dist/frontend/`。本轮未执行浏览器目视验收。

## LFAA-UI-APP-CONTEXT-01

### 用户目标

应用工作区同一时间只显示一个当前应用；切换应用后，原应用的 AI Work 会话选择和未发送草稿仍可恢复，不串入新应用。

### 当前合同

- 左侧应用列表在工作区内明确显示唯一“当前”应用，其他应用入口禁用；需要切换时先返回“应用中心”再选择。
- AI Work 当前会话选择与未发送草稿按 `appId` 保存在已挂载的 `Workbench` 内存状态中；切换应用或模式后返回，恢复对应应用的会话和草稿。
- 新建、选择、归档会话仍使用现有 API 与会话列表；不同应用的状态互相隔离。
- 草稿不写入 `localStorage`、URL、账户偏好或 server；不新增 API、数据库字段或持久化层。
- 不改变 `/api/preferences` 的请求时机、应用路由语义、AI 请求中断行为或 P1-09 的服务端请求观察范围。
- 完成标准：应用内不能直接跳转到其他应用；经“应用中心”切换后，仍只有一个当前应用，返回原应用可恢复其 AI 会话和未发送草稿；切换会话操作保持原状；前端构建通过。

### 允许修改

- `frontend/src/components/Workbench.tsx`：持有按应用隔离的短期 AI Work 界面状态并传递给应用工作区。
- `frontend/src/components/ApplicationWorkspace.tsx`：恢复当前应用会话选择、同步会话操作，并呈现明确的当前应用标识。
- `frontend/src/components/AiWorkChat.tsx`：本地响应式编辑草稿，并通过回调同步到工作台内存以便按应用恢复。
- `frontend/src/components/module-workbench.css`：当前应用标记、禁用应用入口及切换提示样式，不新增 CSS 自定义属性。
- `docs/PROMPTS.md`：维护任务索引、合同及完成记录。

### 禁止修改

- 不移除“应用中心”这一跨应用切换路径，不增加并行应用面板或新的全局导航。
- 不修改 `frontend/src/App.tsx`、偏好保存/API 请求、server、数据库或日志观察逻辑；P1-09 的空闲请求观察仍待单独完成。
- 不把对话草稿写入浏览器持久存储；不新增依赖、业务功能或与本任务无关的视觉改动。
- 不部署、发布、上传、购买或提交 Git。

### 完成记录（2026-09-28）

- 左侧应用列表把唯一当前应用标为“当前”，并禁用其他应用的直接跳转；切换路径为先返回应用中心。
- `Workbench` 按 `appId` 在内存中保留 AI Work 当前会话 ID 和未发送草稿；应用或模式切换后，回到原应用可恢复对应内容。工作区按应用和模式使用独立 React key，避免旧应用的对话组件状态短暂复用到新应用。
- 新建、选择、归档会话继续使用现有 API；未修改偏好保存请求、服务端或 P1-09 日志观察链路。
- `pnpm run build:frontend` 通过，包含 TypeScript 检查和 Vite 构建，产物位于根目录 `dist/frontend/`。未执行浏览器交互验收。
- 已尝试执行 `node scripts/workspace-preflight.mjs`，但当前仓库没有该脚本；仓库也没有 `quality:full` 门禁脚本或 Git 元数据，无法运行 `git diff --check`。

## LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01

### 用户目标

用户收起应用工作区左侧导航后，切换常规模式与 AI Work 时继续保持收起；模式切换不得把用户刚刚做出的侧栏选择重置为默认展开。

### 当前合同

- 同一应用内切换模式导致工作区重新挂载时，必须尊重现有 `lfaa.module-workbench.chrome.v2`（或兼容的 v1）中保存的 `leftCollapsed` 状态；不得因初始化导航布局默认值而覆盖。
- 首次使用且没有已保存工作区开合状态时，仍按账户当前 `navigationLayout` 初始化侧栏；用户之后显式修改该设置时，现有布局行为保持有效。
- 继续使用现有浏览器偏好键，不新增 API、账户字段、数据库、依赖或另一套状态存储；不改变移动端响应式收起、侧栏内容、快捷键或模式路由。
- 完成标准：代码路径可证明已有保存状态优先于挂载默认值；`pnpm --filter lfaa-frontend run build` 通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`：修正首次挂载与模式切换重挂载时的侧栏状态初始化/默认值应用时机。
- `docs/PROMPTS.md`：维护本任务合同、任务索引和完成记录。

### 禁止修改

- 不修改应用路由、模式切换请求、偏好 API、server、数据库、布局 CSS、拖拽与吸附行为。
- 不改变已有用户保存的侧栏状态，不新增存储键或设置项；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对已有 v2/v1 状态会阻止挂载默认值覆盖、无历史状态仍应用账户导航布局、显式更改布局设置仍生效。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查及 Vite 构建通过，产物位于根目录 `dist/frontend/`；若浏览器交互验收不可用，如实记录。

### 完成记录（2026-09-28）

- 工作区状态保存时附带当时的 `navigationLayout` 快照。模式切换重新挂载时，如果导航布局未变，就保留已保存的左右侧栏开合状态；旧版 v1/v2 记录没有快照时也优先保留已有状态。无历史工作区状态时仍按账户导航布局初始化，设置值后续变化时继续应用。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查和 Vite 构建；产物写入根目录 `dist/frontend/`。
- 未完成浏览器点击验收：当前浏览器枚举因 `nodeRepl.fetch request failed` 失败。当前目录没有 Git 元数据，无法核对 Git 变更状态或运行 `git diff --check`。

## LFAA-UI-AI-PROVIDER-LOADING-01

### 用户目标

从常规模式进入 AI Work 时，不因活动 Provider 仍在加载而短暂显示“尚未配置活动 Provider”黄色警告。

### 当前合同

- 只有活动 Provider 查询成功且结果中没有活动账户时，才显示未配置 Provider 警告。
- Provider 查询期间不显示未配置警告或“模型未配置”状态，模型标签和输入提示显示读取中；查询失败时显示实际加载错误，不将失败伪装成“没有活动 Provider”。
- 保留现有 Provider API、发送禁用条件、Runtime、会话和警告文案；不新增依赖、CSS、存储、API 或设置项。
- 完成标准：状态判断能区分加载中、已成功且无账户、加载失败；`pnpm --filter lfaa-frontend run build` 通过，产物写入根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/AiWorkChat.tsx`：区分 Provider 加载状态，并根据成功结果呈现未配置警告。
- `docs/PROMPTS.md`：维护任务索引、合同及完成记录。

### 禁止修改

- 不修改 Provider API、模型 Runtime、会话/模式路由、发送行为或账户数据。
- 不改变实际无活动 Provider 时的警告与输入禁用语义；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对加载中不显示未配置警告、成功返回空活动账户时显示警告、加载失败显示真实错误。
- 运行 `pnpm --filter lfaa-frontend run build`；浏览器交互无法使用时如实记录。

### 完成记录（2026-09-28）

- Provider 状态新增加载中、成功、失败三态。加载中显示读取提示；只有成功读取后确认没有活动账户才显示原黄色警告；读取失败显示实际错误，不叠加“未配置”误报。
- `pnpm --filter lfaa-frontend exec vite build` 通过，产物写入根目录 `dist/frontend/`，并核对构建包包含读取中与未配置提示文案。
- 完整命令 `pnpm --filter lfaa-frontend run build` 被 `frontend/src/components/MinecraftWorkspace.tsx:47` 的 `TS6133 sandboxStatusLabel is declared but its value is never read` 阻断；该错误不在本任务修改文件内，未顺手改动。
- 未完成浏览器交互验收：浏览器枚举返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法核对 Git 变更状态或运行 `git diff --check`。

## LFAA-UI-SCROLL-RESTORATION-SHARED-01

### 用户目标

刷新设置中心、应用中心和应用内功能页面后，恢复用户最后停留的主要滚动位置，避免页面或菜单跳回顶部。滚动记忆由前端共享模块实现，各页面只提供账户与区域标识并调用同一能力。

### 当前合同

- 新增共享滚动恢复 hook 与 key 构造函数，统一完成账户/区域隔离、读取、节流保存、离页冲刷和恢复。
- 设置正文按账户与设置分类隔离；设置导航按账户隔离。应用中心按账户隔离；应用工作区正文、工具资源栏、左侧应用列表/功能菜单/会话列表和 Minecraft 日志按账户及其应用、路由、会话或实例区域分别隔离。
- AI Work 消息列表按账户、应用与会话隔离；为刷新后恢复对应消息列表，只额外保存最近选中的会话 ID，不保存消息正文、草稿、设置值或认证信息。
- 同步内容在布局提交时恢复；异步内容必须等对应数据加载就绪后恢复，避免初始空内容把已存位置钳制到顶部。
- 滚动数值作为非敏感浏览器界面偏好保存在 `localStorage`；存储不可用时静默降级，不影响页面滚动和业务操作。
- 不改变页面布局、路由、业务加载、聊天消息自动行为或服务端数据归属；不新增依赖、API、数据库字段或 CSS 变量。
- 完成标准：设置与主要应用功能滚动区域均调用同一共享实现，前端 TypeScript 检查与构建通过，产物位于根目录 `dist/frontend/`；准确说明是否完成浏览器刷新实测。

### 允许修改

- `frontend/src/shared/scroll-restoration.ts`：实现共享滚动位置 key 与 React hook。
- `frontend/src/components/Workbench.tsx`、`frontend/src/components/SettingsPage.tsx`、`frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/MinecraftWorkspace.tsx`：将各自实际负责滚动的持久页面/菜单区域接入共享 hook，并传递账户及所需区域标识。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`：维护本任务合同与完成记录，并说明共享滚动偏好的前端归属和持久化边界。

### 禁止修改

- 不把滚动位置、聊天消息正文、草稿、账户设置或认证凭据写入服务端；浏览器只保存区域化滚动数值和恢复 AI Work 会话所需的非敏感会话 ID。
- 不持久化短暂弹窗、通知列表、工具提示等临时浮层的滚动状态；不改变 Minecraft 日志的实时加载或 AI Work 对话行为。
- 不修改业务 API、数据库、权限、样式布局或 CSS 自定义属性；不新增依赖，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对每个实际滚动容器使用共享 key/hook，且用户、应用、路由、设置分类、会话与实例之间不会串位；异步区域恢复受加载状态控制。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 当前无已登录浏览器会话时，不伪称完成刷新验收；记录仍需在浏览器验证的区域。

### 完成记录（2026-09-28）

- 新增共享 `createScrollRestorationKey` 与 `useScrollRestoration`，按用户和界面区域隔离，统一读取、140ms 滚动节流保存、路由/组件切换冲刷、`pagehide` 冲刷和布局提交前恢复；支持异步就绪门控及浏览器窗口滚动。
- 应用中心窗口滚动、工作区主内容、设置正文与分类导航、应用/功能/会话导航、工具资源栏、AI Work 消息列表、Minecraft 日志均接入同一 hook。设置正文会从旧 `lfaa.settings.scroll-position.v1` 键迁移；AI Work 只额外保存当前会话 ID以便刷新后加载服务端消息，不保存消息正文或草稿。
- `docs/系统总体架构.md` 已记录共享模块 Owner 与浏览器/服务端持久化边界。静态核对确认其余实际溢出区域属于临时通知或弹出面板，未写入持久偏好。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 和 Vite 构建；产物位于根目录 `dist/frontend/`。
- 未完成浏览器刷新验收：当前 CUA 浏览器枚举失败（`nodeRepl.fetch request failed`），没有可操作的已登录页面。仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full`；当前目录无 Git 元数据，无法运行 `git diff --check` 或核查 Git 变更状态。

## LFAA-UI-CENTER-SCROLLBAR-HIDE-01

### 用户目标

应用工作区中间区域不显示滚动条，同时继续支持滚轮、触控、键盘及现有滚动位置恢复。

### 当前合同

- 隐藏共享中间内容区及其内部滚动区域的可见滚动条；不改变实际滚动容器、滚动方向或滚动位置恢复行为。
- 适用于 Minecraft、SteamCMD、写作应用的常规模式与 AI Work；左侧导航、应用菜单、右侧工具资源栏及外层工作台不受影响。
- 不改变布局尺寸、内容、路由、业务逻辑或 CSS 自定义属性；不新增依赖。
- 完成标准：中间区域不绘制滚动条，内容仍可正常滚动；前端构建通过且产物位于根目录 `dist/frontend/`。浏览器目视验收未执行时如实记录。

### 允许修改

- `frontend/src/components/module-workbench.css`：仅隐藏共享中间内容区及其后代滚动容器的滚动条外观，保留滚动行为。
- `docs/PROMPTS.md`：维护本任务索引、合同和完成记录。

### 禁止修改

- 不改滚动容器的 `overflow`、滚动位置恢复 hook、页面布局、侧栏或右侧上下文栏。
- 不修改业务组件、路由、服务端、运行数据或其他样式；不新增 CSS 变量、依赖或动效。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对隐藏规则仅作用于共享中间内容区及其后代，且没有移除已有滚动行为。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建结果；若完整构建受无关既有问题阻塞，单独运行 Vite 构建核对样式产物并说明限制。

### 完成记录（2026-09-28）

- 共享中间内容区及其内部滚动区域通过标准滚动条属性和 WebKit 伪元素隐藏滚动条外观；保留 `overflow: auto`、原有滚动位置恢复及滚动操作。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均成功；构建产物写入根目录 `dist/frontend/`，并在 Workbench CSS 产物中核对到隐藏规则。
- 浏览器目视验收未完成：浏览器枚举返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-SETTINGS-AUTOSAVE-01

### 用户目标

修复设置中心所有已接入账户设置只改内存、刷新后丢失的问题；设置分类、滚动位置及加载体验继续保持稳定。

### 当前合同

- 设置中心中由 `updateSettings` 编辑的服务端账户设置，在控件变更后自动保存；短时间连续变化按类别合并，停止操作后保存最新值。现有“立即保存”操作保留为即时提交和失败重试入口。
- 同一设置类别的并发写入串行收敛到最新修订，旧响应不得覆盖新编辑或其他类别的当前内存值；保存失败时保留本次页面中的编辑值并显示可重试错误。
- `UserSettings` 的 `aiRuntime` 前端键必须映射到服务端现有 `ai-runtime` 路径；不改服务端分类、数据格式、权限或数据库合同。
- 服务端仍是账户设置的持久化 Owner。浏览器只保留设置分类、分类滚动位置、外观高级设置展开状态和背景目标选择等非敏感界面状态，不复制账户设置或设置草稿。
- AI Provider 密钥、密码、恢复密钥和其他需明确提交的凭据，不进入自动保存队列或浏览器存储；沿用各自已有的明确提交 API。
- 只读状态和未接入分类继续保持说明性，不伪装为可保存设置；快捷键冲突等服务端校验失败必须明确反馈，不能被自动保存绕过。
- 完成标准：所有真实账户设置控件通过统一自动保存路径，刷新后从服务端恢复；前端类型检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：为所有账户设置编辑接入自动保存、合并短时间连续改动、错误提示和离页冲刷；保留凭据显式提交边界。
- `frontend/src/api.ts`：将 `aiRuntime` 客户端键映射到已存在的 `ai-runtime` 服务端路径，并允许设置写入在页面离开时继续完成。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改 server、数据库 schema、设置类别字段、服务端授权或真实业务能力。
- 不把任何账户设置、设置草稿、密码、恢复密钥或 Provider Secret 写入浏览器持久存储。
- 不新增依赖，不移除安全校验，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对所有账户设置控件统一经过自动持久化路径，短时间连改不会旧值覆盖新值，`aiRuntime` 路径映射有效，秘密字段仍需显式提交。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物位于根目录 `dist/frontend/`；如无法使用已登录浏览器实测保存后刷新，准确记录限制。

### 完成记录（2026-09-28）

- 设置中心全部 21 处 `updateSettings` 控件共用按账户设置类别自动保存路径；300ms 内的连续变化合并写入。同类别请求串行追到最新修订，响应只合并对应类别，避免旧响应覆盖其他类别的编辑。
- 页面离开时冲刷等待中的类别写入，设置 API 请求启用 `keepalive`；保存失败按类别保留错误提示，现有按钮改为“立即保存”并作为手动提交/重试入口。快捷键冲突时暂停写入并提示。
- 修正 `aiRuntime` 客户端键写入服务端已存在的 `/settings/ai-runtime` 路径。背景上传后的选择与背景删除前的引用更新都通过同一持久化路径。
- 设置分类和滚动位置、外观高级区展开状态、背景目标选择按账户保存在浏览器；账户设置值仍只由服务端保存。AI Provider 密钥和恢复密钥保留显式提交，不进入自动保存。
- `pnpm --filter lfaa-frontend run build` 通过，含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。当前没有已登录浏览器会话可完成保存后刷新实测。
- 仓库没有 `scripts/workspace-preflight.mjs` 或 quality/release Gate 脚本，workspace preflight 无法运行；当前目录无 Git 元数据，无法运行 `git diff --check` 或核对 Git 变更状态。

## LFAA-SETTINGS-BACKGROUND-RENDER-01

### 用户目标

修复外观设置中为“设置中心”选择背景图片后，设置中心实际页面仍显示纯色的问题。

### 当前合同

- 设置中心继续使用账户设置 `appearance.backgrounds.settings` 选择背景；外层 `.workbench-shell` 负责背景图片与遮罩，设置页面内部工作台根容器不得用不透明底色覆盖该背景。
- 设置正文使用透出所选壁纸的半透明主题表面；在保留文字可读性的前提下让图片可辨认，侧栏、设置卡片和滚动行为保持现状。
- 本次只修复设置中心的 CSS 遮挡，不改变背景选择目标、资源映射、自动保存、API、设置数据结构、登录页或其他工作区行为。
- 完成标准：设置中心的内部工作台透出所选背景；前端 TypeScript 检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.css`：仅调整设置中心内部工作台根容器和设置正文表面的背景绘制。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不修改设置 API、账户设置 schema、图片资源、登录页或其他工作区的背景样式。
- 不改变侧栏和设置卡片的背景样式、背景遮罩控制、布局或交互；不新增 CSS 自定义属性或依赖。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态确认设置中心的内部工作台根容器透明，外层背景能够透过设置正文既有透明层显示，其他背景所有者不变。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。

### 完成记录（2026-09-28）

- 设置中心内部工作台根容器改为透明，避免覆盖外层所选背景；正文主题表面改为 72% 不透明度，使图片在当前内容区可辨认，同时保持侧栏与设置卡片原有表面样式。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功；检查 `dist/frontend/assets/SettingsPage-Nz19ErVM.css` 确认透明根层和正文透明度已写入产物。
- `git diff --check -- docs/PROMPTS.md frontend/src/components/SettingsPage.css` 通过。仓库没有 `scripts/workspace-preflight.mjs` 或 quality/release 脚本；未进行浏览器目视验收。

## LFAA-REALTIME-SOCKET-01

### 用户目标

参考 GSM3 的 Socket.IO 实时连接，为 LFAA 当前已有的 Minecraft 任务进度、日志及节点/实例状态提供低延迟浏览器更新，并能呈现连接状态与恢复操作。

### 当前合同

- 在 LFAA Manager HTTP 服务上挂载 Socket.IO；Web、Tauri 与 Electron 共用的 Minecraft Renderer 连接同源 Socket.IO 服务。开发环境 Vite 代理 `/socket.io` 并允许 WebSocket 升级。
- Socket 握手复用现有 HttpOnly `lfaa_session` Cookie；服务端使用与 HTTP API 相同的 JWT issuer/audience、活动会话和用户身份检查。不得把会话 Token 放到 URL、`localStorage` 或普通日志中。
- 仅接受已认证连接加入实时事件范围。Socket.IO 只推送最小范围的 Minecraft 数据变更通知，不新增绕过 REST 角色授权的命令入口；客户端收到通知后通过现有受保护 REST API 重新读取权威任务、日志和状态快照。
- 对现有 Minecraft 任务创建、领取、进度、完成、日志追加及真实节点/实例状态变化发送事件。页面初次加载、重连及现有 HTTP 轮询继续用于状态对账；AI Work SSE、Daemon HTTP 心跳/任务领取/上报及 REST 命令行为保持不变。
- Minecraft 页面显示实时连接状态；Socket.IO 自动重连，连接恢复后刷新快照，并提供手动重连入口。暂不实现交互式 PTY、SteamCMD 推送、主机资源采集、通用事件总线或多 Manager 横向扩展。
- 完成标准：匿名/无效会话的 Socket 握手被拒绝；有效现有会话可连接并仅收到真实 Minecraft 变更通知；前端在收到任务/日志/状态通知及重连后刷新 REST 快照；server 测试、前端构建和工作区构建通过，构建产物只写入根 `dist/`。记录未完成的浏览器/真实 Windows Daemon 验收。

### 允许修改

- `frontend/package.json`、`server/package.json`、`pnpm-lock.yaml`：加入匹配版本的 Socket.IO 客户端与服务端依赖。
- `frontend/vite.config.ts`、`frontend/src/realtime/`、`frontend/src/components/MinecraftWorkspace.tsx`：代理 Socket.IO，建立会话 Cookie 连接、重连与连接状态 UI，并响应 Minecraft 变更事件。
- `server/src/index.ts`、`server/src/middleware/auth.ts`、`server/src/realtime/`、`server/src/api/routes.ts`、`server/src/modules/nodes/local-daemon.ts`：装配已认证 Socket.IO 并从现有 Minecraft API/Daemon 回报路径发布变更通知。
- `server/test/`：覆盖 Socket.IO 身份验证、事件访问与实时通知。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`、`README.md`：登记合同并同步实际传输、功能范围和当前验收状态。

### 禁止修改

- 不更改 HttpOnly Cookie/JWT 的签发策略、现有 REST API 权限、SQLite 数据结构、Minecraft EULA、安全沙盒或任务租约语义。
- 不把 Daemon 连接改为 WebSocket，不由 Socket.IO 接收控制端命令，不把瞬时推送当作持久任务状态或日志数据源。
- 不实现未接入的终端、资源监控、SteamCMD、远程多节点或 AI 工具能力；不改变健康/会话轮询行为及其日志观察合同。
- 不修改无关既有工作，不清理或覆盖 `data/`、`dist/` 用户数据，不部署、发布、上传或提交 Git。

### 验收方式

- 在隔离临时 `LFAA_DATA_DIR` 下运行 Socket.IO 鉴权与变更推送测试，验证缺失/无效 Cookie 被拒绝、会话失效无法新建连接、有效会话只接收已定义的 Minecraft 变更通知。
- 运行 `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-frontend run build`、`pnpm test` 和 `pnpm build`；确认所有构建输出位于根 `dist/`。
- 静态核对 Vite WebSocket 代理、Cookie 认证、事件字段最小化、REST 重新读取路径与 Daemon HTTP 协议未变；浏览器与真实 Windows Daemon 验收未执行时明确记录。
