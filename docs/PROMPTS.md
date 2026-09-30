# LFAA 提示词与任务合同

本文件登记当前实现任务的目标、验收条件和修改边界。任务合同优先于旧的阶段草案；实际代码与架构文档需保持一致。

## 任务索引

| 编号 | 任务 | 状态 | 合同 |
|---|---|---|---|
| LFAA-HARNESS-CLEANUP-01 | 固定大模型驱动核心、硬编码与新旧代码规则，清理迁移残留并整理节点入口 | 实施记录见 harness-cleanup.md；完整自主子 Agent 协作仍待实现 | 本文件“LFAA-HARNESS-CLEANUP-01” |
| LFAA-HARNESS-DSH-PACKAGES-01 | 按 DSH 实际包树重构并迁移现有项目，保留全部同名目录占位 | 源码迁移与构建完成；隔离运行通过；5 项既有测试失败及未验项目详见交付记录 | 本文件“LFAA-HARNESS-DSH-PACKAGES-01” |
| LFAA-SETTINGS-NOTIFICATION-COMPLETION-SOUND-01 | 让 AI Work 回复完成通知在工作台聚焦时也播放设置中心选定的提示音 | 已修复（前端构建和目标差异检查通过；浏览器/桌面播放待验） | 本文件“LFAA-SETTINGS-NOTIFICATION-COMPLETION-SOUND-01” |
| LFAA-AUTH-PASSKEY-01 | 为 LFAA 登录增加可选通行密钥并提供安全管理 | 代码已接入（前端构建受既有 SteamCMD 类型错误阻塞，实机待验） | 本文件“LFAA-AUTH-PASSKEY-01” |
| LFAA-MINECRAFT-APPCONTAINER-ENV-01 | 修复 Minecraft AppContainer 启动因 Windows 子进程环境块错误返回 Win32 203 | 代码修正完成（Sandbox Host 构建通过；实例启动待实机复验） | 本文件“LFAA-MINECRAFT-APPCONTAINER-ENV-01” |
| LFAA-PORTABLE-DATA-ISOLATION-01 | 曾将可移动盘数据隔离到各电脑本机 | 历史实现已被更新后的数据归属规则取代：固定盘使用用户级目录，可移动盘数据跟随项目目录 | 本文件“LFAA-PORTABLE-DATA-ISOLATION-01” |
| LFAA-FILE-MANAGER-RECOVERY-01 | 修正文件管理的离线节点状态、空目录误报与节点恢复控制 | 实现完成（前端构建通过；浏览器和 Daemon 验收待做） | 本文件“LFAA-FILE-MANAGER-RECOVERY-01” |
| LFAA-UI-WORKMODE-HOME-01 | 工作区房子按钮返回当前应用与所选工作模式首页，应用中心入口保持原路由 | 已修正（路由静态核对；构建未运行） | 本文件“LFAA-UI-WORKMODE-HOME-01” |
| LFAA-UI-RECENT-SESSIONS-NAV-01 | 将左一“最近会话”接入现有跨 App AI Work 会话查询与打开流程 | 实现完成（前端构建与差异检查通过；登录态交互待验） | 本文件“LFAA-UI-RECENT-SESSIONS-NAV-01” |
| LFAA-UI-APP-CENTER-NAV-01 | 左一提供应用中心直达入口；应用切换统一从应用中心进行，左二只保留当前应用导航 | 实现完成（前端构建与差异检查通过；浏览器目视待验） | 本文件“LFAA-UI-APP-CENTER-NAV-01” |
| LFAA-UI-APP-CONTEXT-01 | 切换应用时保留各自 AI Work 会话与未发送草稿，并明确当前应用 | 实现完成（交互未验收） | 本文件“LFAA-UI-APP-CONTEXT-01” |
| LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01 | 模式切换时保留用户主动设置的应用侧栏收起状态 | 已修复（前端构建通过；浏览器交互待验） | 本文件“LFAA-UI-WORKBENCH-CHROME-PERSISTENCE-01” |
| LFAA-UI-AI-PROVIDER-LOADING-01 | AI Work 加载 Provider 时不短暂误报未配置 | 已修复（Vite 构建通过；完整构建受 TypeScript 错误阻塞；浏览器交互待验） | 本文件“LFAA-UI-AI-PROVIDER-LOADING-01” |
| LFAA-UI-MODULE-NOTIFICATIONS-01 | 优化应用侧栏顶栏的左右布局，并提供真实 AI Work 完成通知卡片 | 已完成（构建通过；浏览器目视待验） | 本文件“LFAA-UI-MODULE-NOTIFICATIONS-01” |
| LFAA-UI-SETUP-REMINDER-PERFORMANCE-01 | 修复首次配置提醒弹窗打开卡顿，避免全屏实时模糊和工作台整树重渲染 | 复查中（用户反馈仍卡；运行版本未核实） | 本文件“LFAA-UI-SETUP-REMINDER-PERFORMANCE-01” |
| LFAA-STEAMCMD-CONFIG-INSTALL-01 | 分离 SteamCMD 专项配置与应用存储，并让在线安装可独立选择目标节点 | 合同已登记，待实现 | 本文件“LFAA-STEAMCMD-CONFIG-INSTALL-01” |
| LFAA-APP-SETTINGS-SCOPE-01 | 共用账户偏好与三种 App 的业务配置分域，并让现有 App 配置范围互不串改 | 已实现（前端构建通过；浏览器范围切换待验） | 本文件“LFAA-APP-SETTINGS-SCOPE-01” |
| LFAA-UI-WRITING-SIDEBAR-01 | 将写作常规模式的作品与章节导航移入应用侧栏空白区，移除编辑页常驻导航列 | 已实现（前端 TypeScript/Vite 构建通过；浏览器目视待验） | 本文件“LFAA-UI-WRITING-SIDEBAR-01” |
| LFAA-WRITING-VOLUME-GROUPING-01 | 在现有写作作品目录内增加卷分组，保留章节数据并支持在指定卷中新建章节 | 实现完成（v27 迁移专项通过；浏览器交互待验） | 本文件“LFAA-WRITING-VOLUME-GROUPING-01” |
| LFAA-WRITING-AGENT-PLACEMENT-01 | 让写作 Agent 按自然语言目标将内容精确写入当前作品大纲或章节正文，并经逐项审批与业务服务持久化 | 已接入（前后端构建通过；Provider 工具调用和浏览器交互待验） | 本文件“LFAA-WRITING-AGENT-PLACEMENT-01” |
| LFAA-DEEPWRITE-WRITING-SKILLS-01 | 参考 DeepWrite 方法，增强写作 Agent 的按需 Skills、自然语言目标提示与唯一锚点编辑工具 | 实现完成（server 类型检查/构建和差异检查通过；Provider 交互待验） | 本文件“LFAA-DEEPWRITE-WRITING-SKILLS-01” |
| LFAA-WRITING-PROMPT-LIBRARY-01 | 整理外部 14 份网文提示词，优化后加入写作工作区并按需供模型读取 | 已接入（相关包构建、Host 类型检查和差异检查通过；模型交互待验） | 本文件“LFAA-WRITING-PROMPT-LIBRARY-01” |
| LFAA-APP-SANDBOX-01 | 将应用作为安全范围、模式作为应用内交互方式，并为当前 Minecraft Daemon 接入 fail-closed Windows OS 沙盒 | 实现代码已接入（Windows 实机验收待做） | 本文件“LFAA-APP-SANDBOX-01” |
| LFAA-UI-WORKBENCH-DEFAULTS-01 | 稍微收窄工作台左右栏默认展开宽度，并让右侧工具栏默认收起 | 已完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-UI-WORKBENCH-DEFAULTS-01” |
| LFAA-UI-WORKBENCH-SNAP-01 | 修复工作台左右栏吸附收起/展开残影、拖尾及过程中的横向滚动条 | 已修复（Vite 构建通过；TypeScript 检查被其他文件错误阻塞；浏览器实拖待验） | 本文件“LFAA-UI-WORKBENCH-SNAP-01” |
| LFAA-UI-WORKBENCH-SNAP-02 | 修复按住鼠标从吸附收起反向拉出时侧栏展开突跳、手感卡顿 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器实拖待验） | 本文件“LFAA-UI-WORKBENCH-SNAP-02” |
| LFAA-UI-WORKBENCH-SNAP-03 | 统一设置和应用工作区左右侧栏及底部终端的拉伸、吸附收起与反向展开动效 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器实拖待验） | 本文件“LFAA-UI-WORKBENCH-SNAP-03” |
| LFAA-UI-SIDEBAR-GLASS-STABILITY-01 | 修复左侧栏悬停预览和拉伸期间透明度/背景模糊突变 | 实现完成（前端 TypeScript/Vite 构建通过；浏览器悬停与实拖待验） | 本文件“LFAA-UI-SIDEBAR-GLASS-STABILITY-01” |
| LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01 | 修复左侧栏收起预览悬停时上下抖动 | 实现完成（TypeScript/Vite 构建和差异检查通过；浏览器悬停待验） | 本文件“LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01” |
| LFAA-UI-WORKBENCH-SWAP-CONTROL-01 | 让交换按钮仅在鼠标移入右侧拉伸位置时显示，移出后隐藏 | 已修复（前端构建通过；浏览器交互待验） | 本文件“LFAA-UI-WORKBENCH-SWAP-CONTROL-01” |
| LFAA-SETTINGS-GLOBAL-NAV-01 | 将应用工作区左侧全局导航轨复用到设置中心，统一两处导航外壳 | 已完成（TypeScript/Vite 构建通过；浏览器目视待验） | 本文件“LFAA-SETTINGS-GLOBAL-NAV-01” |
| LFAA-SETTINGS-RETURN-CONTEXT-01 | 设置中心全局导航房子和侧栏返回均回到进入设置前的路由 | 已修复（TypeScript/Vite 构建通过；浏览器交互待验） | 本文件“LFAA-SETTINGS-RETURN-CONTEXT-01” |
| LFAA-UI-COMPOSER-PANE-SWAP-01 | 按 Codex 对话输入框的交互层级优化 AI Work 输入区，并允许桌面工作台交换中间区与右侧工具资源栏 | 已完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-UI-COMPOSER-PANE-SWAP-01” |
| LFAA-UI-AI-PERMISSION-POPOVER-01 | 将 AI Work 权限模式菜单收敛为紧凑弹层，展示 LFAA 现有三种权限模式 | 已按反馈修订（前端构建与差异检查通过；浏览器目视待验）；执行语义以 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 为准 | 本文件“LFAA-UI-AI-PERMISSION-POPOVER-01” |
| LFAA-SETTINGS-APPEARANCE-DEFAULTS-01 | 对齐外观设置默认值与工作区 CSS 兜底值，保留各组件独立外观 | 已完成（前端与 server 构建通过；背景路由映射静态核对；浏览器目视待验） | 本文件“LFAA-SETTINGS-APPEARANCE-DEFAULTS-01” |
| LFAA-UI-CENTER-SCROLLBAR-HIDE-01 | 隐藏应用工作区中间内容区的滚动条，同时保留原有滚动能力 | 已修复（前端构建通过；浏览器目视与滚动交互待验） | 本文件“LFAA-UI-CENTER-SCROLLBAR-HIDE-01” |
| LFAA-UI-CENTER-RESIZE-REFLOW-01 | 中间列缩窄时让 Minecraft 卡片按实际可用宽度排版，减少内容跳动 | 已完成（Vite 构建通过；完整构建被无关 TypeScript 错误阻塞；浏览器拖拽待验） | 本文件“LFAA-UI-CENTER-RESIZE-REFLOW-01” |
| LFAA-UI-WORKBENCH-REFLOW-STABILITY-01 | 修复左右菜单和底部终端开合时中间内容闪动、跳动 | 实现完成（静态核对；构建与浏览器目视待验） | 本文件“LFAA-UI-WORKBENCH-REFLOW-STABILITY-01” |
| LFAA-P4-MINECRAFT-MVP-01 | 按用户优先级先完成 Minecraft 管理 MVP，并为后续应用保留统一工作台与 AI Runtime 边界 | 进行中 | 本文件“LFAA-P4-MINECRAFT-MVP-01” |
| LFAA-MINECRAFT-CONTROL-CENTER-01 | 将 Minecraft 总览整理为真实状态监控卡片中心，并补齐控制节点页面与分类菜单 | 实现完成（前端构建、Manager 健康与 Daemon 心跳通过；浏览器目视验收待做） | 本文件“LFAA-MINECRAFT-CONTROL-CENTER-01” |
| LFAA-MINECRAFT-TASK-RECOVERY-01 | 修复 SQLite 迁移测试版本断言，并为 Minecraft Daemon 任务加入心跳租约和中断恢复 | 已完成（测试与完整构建通过；真实 Minecraft 未验） | 本文件“LFAA-MINECRAFT-TASK-RECOVERY-01” |
| LFAA-P1-01-05 | 完成依赖与持久化、server 基础、应用中心、前后端健康状态闭环、账户登录与权限基础 | 进行中 | 本文件“LFAA-P1-01-05” |
| LFAA-P1-01-07 | 提供根目录并行开发启动命令和 Windows 单窗口一键启动入口 | 已完成 | 本文件“LFAA-P1-01-07” |
| LFAA-DEV-STARTUP-RESILIENCE-01 | 避免旧服务占端口时误启新实例，并让 Daemon 等待控制端就绪 | 实现完成（代码静态检查；Windows 启动实测待验） | 本文件“LFAA-DEV-STARTUP-RESILIENCE-01” |
| LFAA-UI-MODULE-CANVAS-01 | 让所有应用模式的中间工作区铺满可用区域，并让 AI Work 中间区只显示对话 | 已完成（浏览器目视待验） | 本文件“LFAA-UI-MODULE-CANVAS-01” |
| LFAA-UI-WRITING-AI-CENTER-01 | 让写作 AI Work 空状态沿用共享中间聊天区样式，并完整说明外观设置影响范围 | 实现完成（前端构建与差异检查通过；登录后浏览器目视待验） | 本文件“LFAA-UI-WRITING-AI-CENTER-01” |
| LFAA-UI-AI-WORK-CANVAS-BACKGROUND-01 | 移除 AI Work 消息画布重复的整面遮罩和模糊，让中间区透出工作台统一壁纸 | 实现完成（前端构建与静态映射核对通过；登录后目视待验） | 本文件“LFAA-UI-AI-WORK-CANVAS-BACKGROUND-01” |
| LFAA-UI-HOME-RESPONSIVE-01 | 收紧应用中心桌面留白并适配矮窗口 | 已完成（浏览器目视待验） | 本文件“LFAA-UI-HOME-RESPONSIVE-01” |
| LFAA-SETTINGS-AI-GROUP-SPACING-01 | 修正 AI 账户区与推理参数标题的间距 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-AI-GROUP-SPACING-01” |
| LFAA-UI-PERF-SETTINGS-01 | 修复设置中心主题闪烁与重复加载，并优化按需读取 | 已完成 | 本文件“LFAA-UI-PERF-SETTINGS-01” |
| LFAA-UI-PERF-SETTINGS-02 | 降低设置中心长分类滚动时的布局与绘制负担 | 已完成（登录后滚动帧采样待实测） | 本文件“LFAA-UI-PERF-SETTINGS-02” |
| LFAA-UI-SETTINGS-PRELOAD-01 | 预热设置页代码，减少首次进入时的等待与闪动 | 已完成（浏览器冷启动目视待验） | 本文件“LFAA-UI-SETTINGS-PRELOAD-01” |
| LFAA-UI-REFRESH-PERSISTENCE-01 | 修复刷新期间的登录闪现并记住设置分类与滚动位置 | 已完成（浏览器刷新实测待验） | 本文件“LFAA-UI-REFRESH-PERSISTENCE-01” |
| LFAA-UI-SCROLL-RESTORATION-SHARED-01 | 统一恢复设置与各功能页面的滚动位置 | 实现完成（构建通过；浏览器刷新验收待验） | 本文件“LFAA-UI-SCROLL-RESTORATION-SHARED-01” |
| LFAA-SETTINGS-AUTOSAVE-01 | 让设置中心所有已接入的账户设置自动持久化 | 修复完成（外观字段白名单已对齐；前后端构建通过；登录后刷新实测待验） | 本文件“LFAA-SETTINGS-AUTOSAVE-01” |
| LFAA-SETTINGS-BACKGROUND-RENDER-01 | 修复设置中心所选背景被内部工作台与侧栏底色遮挡 | 已修复（前端构建通过；浏览器目视待验） | 本文件“LFAA-SETTINGS-BACKGROUND-RENDER-01” |
| LFAA-WORKSPACE-BACKGROUND-UNIFICATION-01 | 统一设置中心、应用常规与 AI Work 的背景绘制及遮罩透明度 | 实现完成（前端构建通过；浏览器目视待验） | 本文件“LFAA-WORKSPACE-BACKGROUND-UNIFICATION-01” |
| LFAA-SETTINGS-NOTIFICATIONS-01 | 将设置中心通知接入真实 AI Work 完成事件与浏览器通知 | 已完成 | 本文件“LFAA-SETTINGS-NOTIFICATIONS-01” |
| LFAA-SETTINGS-TYPOGRAPHY-01 | 统一设置中心字号层级并显露外观字号控制 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-TYPOGRAPHY-01” |
| LFAA-SETTINGS-LAYOUT-UNIFICATION-01 | 统一设置中心全部分类的布局、尺寸与间距 | 已完成（浏览器目视待验） | 本文件“LFAA-SETTINGS-LAYOUT-UNIFICATION-01” |
| LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01 | 对齐设置侧栏顶部的返回与收起按钮 | 已完成（Vite 构建通过；类型检查受其他文件错误阻塞，浏览器目视待验） | 本文件“LFAA-SETTINGS-SIDEBAR-HEADER-ALIGNMENT-01” |
| LFAA-FRONTEND-CSS-SHARED-01 | 建立清晰的前端公共 CSS 入口并分离共享样式 | 已完成 | 本文件“LFAA-FRONTEND-CSS-SHARED-01” |
| LFAA-AI-ARCH-01 | 建立 AI 插件宿主的最小后端基础并验证 Cordis | 已完成 | 本文件“LFAA-AI-ARCH-01” |
| LFAA-AI-RUNTIME-01 | 完成 AI Work Runtime 并按业务归属接入设置中心 | 进行中 | 本文件“LFAA-AI-RUNTIME-01” |
| LFAA-AI-PERMISSIONS-01 | 将 AI 工具权限接入三种模式、可记忆授权和独立审批控制 | 已完成 | 本文件“LFAA-AI-PERMISSIONS-01” |
| LFAA-AI-PERMISSION-MODE-EXECUTION-02 | 落实三种项目权限模式、Daemon 主机命令执行，并修复权限弹层外观 | 实现完成（Server、前端、Daemon 构建与差异检查通过；浏览器及真实 Daemon 验收待运行环境） | 本文件“LFAA-AI-PERMISSION-MODE-EXECUTION-02” |
| LFAA-AI-PERMISSIONS-DB-01 | 修复 AI 审批与记忆授权表的版本 8 数据库迁移兼容 | 已完成 | 本文件“LFAA-AI-PERMISSIONS-DB-01” |
| LFAA-SERVER-POLL-LOG-01 | 降低健康与会话轮询成功日志的终端噪声 | 已完成 | 本文件“LFAA-SERVER-POLL-LOG-01” |
| LFAA-SETTINGS-PERMISSION-CLARITY-01 | 按 LFAA 当时的实际能力完善常规页访问边界说明与权限页策略说明 | 历史任务已完成；权限语义已由 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 更新 | 本文件“LFAA-SETTINGS-PERMISSION-CLARITY-01” |
| LFAA-OBS-SERVER-LOGS-01 | 观察开发终端中的偏好、AI 查询与认证日志；确认是否需要单独修复 | 待开始 | 本文件“LFAA-OBS-SERVER-LOGS-01” |
| LFAA-GITHUB-FORCE-PUSH-01 | 从根目录菜单一键提交纯净源码并安全推送或强制推送到指定 GitHub main | 已完成（语法与静态分支核对通过；GitHub 推送未运行） | 本文件“LFAA-GITHUB-FORCE-PUSH-01” |
| LFAA-REALTIME-SOCKET-01 | 为 Minecraft 现有任务、日志与状态接入经会话认证的 Socket.IO 实时推送 | 已完成（代码与自动验证） | 本文件“LFAA-REALTIME-SOCKET-01” |
| LFAA-SETTINGS-CENTER-CLEANUP-01 | 依据设置中心审查结论整理导航、重复入口与尚未生效的设置项 | 本轮仅归档；整改待开始（排在架构升级后） | 本文件“LFAA-SETTINGS-CENTER-CLEANUP-01” |

## LFAA-AI-PERMISSION-MODE-EXECUTION-02

### 用户目标

让 LFAA 账户级三种项目权限模式真实控制项目操控；“完全权限”下由模型根据当前用户指令自主执行项目管理、文件、任意主机命令和其他应用能力，不再逐项等待用户审批。通过真实 Daemon Host 执行终端命令，并修复权限弹层与启用确认框的视觉问题。

### 当前合同

- “请求审批”：模型可以调用项目能力；每项写入、高风险操作和主机命令都创建并消费一次性用户审批，不创建记忆授权。
- “替我审批”：未匹配记忆授权的写入、高风险操作和主机命令逐项审批；用户明确选择记住后，严格匹配账户、应用、操作 ID/版本、风险和目标范围的后续操作可自动执行。
- “完全权限”：模型按当前用户指令自主决定并执行项目的所有操控能力，包括主机 Shell 与任意路径访问；读、写、部署、配置、文件和命令操作均不再逐项审批。切换到账户完全权限仍保留一次显式确认。
- 这三项是 LFAA 项目权限模式，不是其他产品的工具权限模式。模式只决定逐项审批方式，不得按操作风险、记忆授权或目标路径缩减完全权限；主机命令按目标 Daemon 进程账户的 OS 权限执行。
- Shell 工具面向所有已登记在线节点，通过 daemon 心跳能力 `agent-shell-v1`、server 持久化任务队列和 Daemon 执行，不在 server 进程直接运行主机命令。命令使用账户已有 `general.integratedShell` 选择的 Shell；允许模型提供任意命令与工作目录，不添加命令白名单、路径限制或默认运行超时；提供任务查询以继续跟踪长时间命令。
- 当前用户明确请求才可驱动操作；项目文件、命令输出和其他资料中的指令只作为数据，不构成用户授权。模型返回成功结果后才可说已完成。Minecraft EULA 的展示与用户明确同意仍单独执行。
- “完全权限”确认框与权限弹层使用 `Modal.useModal()`/`.workbench-shell` 继承设置中心现有主题、强调色、界面字体/字号、对比度、壁纸遮罩/模糊与减少动态效果设置，不新增设置字段、依赖或 CSS 自定义属性。
- 设置中心与 AI Work 的三种模式说明及完全权限确认文案保持一致，强调项目权限模式语义，不称为 Codex/其他产品的工具权限模式。
- 保持三种模式的账户设置类型、默认值、API 与现有单次审批/记忆授权表结构、哈希、有效期及消费格式不变；只新增独立 AI Host 任务表，不把任务队列保存为用户设置。
- 完成标准：路由只在授权器返回 `approval_required` 时创建并等待审批；`allow` 直接调用现有工具；前端、server、daemon 构建与差异检查通过。无真实 Provider/登录态时不声称完成浏览器或 Host/Daemon 验收。

### 允许修改

- `server/src/api/routes.ts`：按 server 授权器结果决定等待审批或直接执行模型选择的项目能力。
- `server/src/database.ts`、`server/src/modules/nodes/ai-host-tasks.ts`：新增任意主机命令任务迁移、排队、租约、结果和查询。
- `server/src/ai/permissions.ts`：完全权限直接授权，不要求操作范围哈希；请求审批/替我审批继续使用原有精确范围合同。
- `server/src/ai/business-tools.ts`、`server/src/ai/runtime.ts`、`server/src/ai/prompts/writing.ts`：向各 App 提供节点发现与主机命令能力，并把三种项目权限模式告知模型。
- `daemon/src/task-runner/minecraft-daemon.mjs`：上报主机命令能力、领取并执行 Shell 命令任务、回传真实退出状态和输出。
- `frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/SettingsPage.tsx`、`frontend/src/components/ai-work-chat.css`：统一三种模式说明、紧凑权限弹层和完全权限确认。
- `frontend/src/styles/workbench.css`：添加确认框局部主题样式，复用既有设置映射。
- `开发规范.md`、`docs/PROMPTS.md`、`docs/开发计划.md`、`docs/系统总体架构.md`：同步新架构执行语义与本轮记录。
- `server/test/database-migrations.test.mjs`：只把现有迁移版本断言从 29 更新到 30；按本合同不运行测试套件。

### 禁止修改

- 不改变三种模式的账户设置字段、默认值、API、现有审批哈希/有效期/单次消费和记忆授权规则；新增任务表不保存为用户设置。
- 不添加新的权限限制、命令白名单、路径约束或全局主题变量；不运行测试套件，不部署、发布、上传或提交 Git。

### 实施记录（2026-09-29）

- 权限模式按 LFAA 账户设置落实：请求审批逐项审批，替我审批按既有精确范围记忆授权，完全权限直接提供当前应用全部已登记工具并免逐项审批；完全权限授权不再要求风险/目标范围哈希，App 和账户写作归属仍由当前上下文约束。
- 新增 `agent-shell-v1` Daemon 队列：模型可发现在线节点、提交任意命令与工作目录并按任务 ID 查询；默认不加命令运行超时。命令由目标 Daemon 按 `general.integratedShell` 设置运行，执行失败、退出码、超时和截断状态真实回传。活动摘要不复制命令正文或终端输出。
- 三模式弹层收敛为紧凑列表；完全权限确认框和弹层挂在 `.workbench-shell` 主题上下文，读取既有外观令牌。
- Server、前端和 Daemon 构建通过；`git diff --check` 通过。迁移测试仅同步断言至版本 30，按合同未运行测试套件。仓库没有 `workspace-preflight` 脚本或对应包命令，未运行该 Gate。
- 检查时本机 `5173`/`3000` 没有监听服务；登录态浏览器目视、真实 Provider 工具调用和 Daemon 主机命令实机验收未执行。

## LFAA-UI-WORKBENCH-SWAP-CONTROL-01

### 用户目标

让截图红框中的 `↔` 交换按钮只在鼠标移入右侧栏拉伸区域时显示，鼠标移出后隐藏。

### 当前合同

- 桌面布局且右侧栏展开时，交换按钮默认透明且不接收鼠标点击；指针移入右侧拉伸分隔区域（包括浮现后的按钮区域）时显示，移出后隐藏。
- 键盘聚焦交换按钮时保持可见并可激活；鼠标悬停仍显示提示文字。
- 右侧栏收起或布局不是桌面时，保持现有不渲染语义；不改分隔器拖拽、键盘调整和吸附行为。
- 不新增 CSS 自定义属性或依赖；只调整交换按钮的显隐反馈。

### 允许修改

- `frontend/src/workbench/workbench.css`：让 pane swap 按钮跟随右侧分隔器 hover 显示，并在键盘聚焦时可见。
- `docs/PROMPTS.md`：登记当前任务合同与完成记录。

### 禁止修改

- 不改分隔器热区尺寸、拖拽阈值、默认栏宽、按钮条件渲染或其他工作台区域。
- 不新增 CSS 自定义属性、依赖、动画或与本任务无关的视觉修改；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建；产物必须写入根目录 `dist/frontend/`。
- 核对交换按钮只在右侧分隔区域 hover 或键盘聚焦时可见，并保留现有桌面/展开显示条件及窗格交换行为。

### 代码修改记录（2026-09-29）

- 移除交换按钮常驻可见样式；默认透明且不接收鼠标事件，右侧分隔区/按钮悬停或键盘聚焦时显示，移出后隐藏。保留现有条件渲染、提示文字和窗格交换行为。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物写入根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- 未完成浏览器实际悬停与移出交互验收；当前无法通过 CUA 获取浏览器状态，静态构建不能代替目视验证。

## LFAA-SETTINGS-GLOBAL-NAV-01

### 用户目标

把应用工作区左侧红框中的全局导航轨加入设置中心，使两处共用相同的导航组件和视觉样式。

### 当前合同

- 设置中心在最左侧显示应用工作区现有全局导航轨；原设置分类侧栏仍保留在其右侧。
- 导航轨复用一个 React 组件，应用工作区与设置中心不维护两份菜单结构；首页、设置、工具、快捷键和账户入口按当前页面能力执行，未接入的动作保持禁用。
- 应用工作区导航轨原有的模式首页、工具栏、快捷键、账户菜单和退出登录行为保持不变；设置中心的首页入口最初打开应用中心，此行为由后续 `LFAA-SETTINGS-RETURN-CONTEXT-01` 调整为返回进入设置前的路由，明确的“应用中心”入口仍打开应用中心；设置图标标示当前页面。
- 只调整设置页自身外层布局以容纳导航轨；不改变设置分类、表单、布局偏好或背景配置行为。
- 完成标准：静态确认共享导航组件被两处复用、设置轨道不遮挡设置分类栏和正文；前端构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/GlobalNavigationRail.tsx`：承载两处共用的全局导航轨与原有交互。
- `frontend/src/components/ApplicationWorkspace.tsx`：改为使用共享导航组件，保持应用工作区现有行为。
- `frontend/src/components/SettingsPage.tsx`：在设置页面挂载共享导航轨并接入页面动作。
- `frontend/src/components/SettingsPage.css`：为设置导航轨与设置工作台增加外层布局。
- `frontend/src/components/module-workbench.css`：更新共享导航轨样式归属说明（如需要）。
- `frontend/src/components/Workbench.tsx`：向设置页传递现有导航和账户动作。
- `docs/系统总体架构.md`：更新设置中心全局导航轨与分类侧栏的布局事实。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不新增第二份导航菜单，不改变既有按钮含义、应用路由、快捷键绑定、权限或退出登录行为。
- 不修改设置分类导航、设置数据、服务端接口、CSS 自定义属性或依赖；不部署、发布、上传或提交 Git。

### 验收方式

- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建；产物必须写入根目录 `dist/frontend/`。
- 静态核对两处挂载同一组件，设置布局包含 64px 导航轨和原有可调整分类栏，窄屏规则适配现有工作区。
- 检查本任务的差异没有覆盖其他未提交改动。

### 完成记录（2026-09-28）

- 应用工作区和设置中心统一使用 `GlobalNavigationRail`；设置中心左侧增加 64px 导航轨，宽度不超过 420px 时收窄到 48px。设置分类栏仍由原有 `ResizableWorkbench` 管理，轨道的工具入口因设置页没有工具资源栏而禁用。
- 设置工作区测量可用宽度时扣除导航轨宽度；架构文档同步说明全局导航轨与设置分类栏的位置关系。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查与 Vite 构建；构建产物位于 `dist/frontend/`。本任务涉及文件的 `git diff --check` 通过。
- 未进行浏览器目视验收；当前仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 未定义额外的 quality/release Gate。

## LFAA-SETTINGS-RETURN-CONTEXT-01

### 用户目标

设置中心左侧全局导航的房子入口返回进入设置前所在的页面或应用工作区，不固定跳回应用中心。

### 当前合同

- 设置中心侧栏“返回工作台”和全局导航房子使用同一已保存来源路由，离开设置后恢复进入设置前的精确路由。
- 从应用工作区打开设置时，返回该应用、模式及原子页面；从应用中心打开时，返回应用中心。
- 直接访问设置路由且没有本次导航来源时，沿用工作台现有的当前应用/模式默认返回目标。
- 仅改变设置中心房子入口的目标与说明；全局导航的明确“应用中心”入口和快捷键继续导航到 `/`。
- 不改变设置分类、设置数据、应用内导航或返回目标的所有权与存储方式。
- 完成标准：静态确认设置中心两个返回入口复用相同回调、明确应用中心入口仍指向 `/`；前端构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：让全局导航房子复用现有的设置返回回调，并说明其来源路由语义。
- `docs/系统总体架构.md`：明确设置中心房子与侧栏返回都恢复进入设置前的路由。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改变 `Workbench` 已有的来源路由捕获、直接访问设置时的默认目标或 `/` 应用中心入口语义。
- 不修改设置数据、服务端接口、账户偏好、应用业务页或其他导航行为；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对设置中心房子与侧栏返回调用同一返回回调，并核对快捷键及明确应用中心入口仍指向 `/`。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。
- 记录未执行的浏览器交互验收，不以静态检查替代实际点击验收。

### 首版完成记录（2026-09-29）

- 设置中心全局导航房子改为复用侧栏“返回工作台”的 `onBack`，返回 `Workbench` 进入设置前保存的精确路由；直接访问设置时继续沿用原有应用/模式默认目标。
- 快捷键“应用中心”和导航轨“更多入口 > 应用中心”仍指向 `/`；同步更新架构说明，并标记旧的设置首页行为已由本合同调整。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物位于根目录 `dist/frontend/`；本任务涉及文件 `git diff --check` 通过。
- 未进行浏览器点击验收；构建和静态核对未验证实际浏览器中的导航交互。

## LFAA-UI-WORKMODE-HOME-01

### 用户目标

在应用工作区点击左侧主导航栏的房子按钮时，返回当前应用中用户当前选择的工作模式首页。

### 当前合同

- 首页目标由当前应用和当前选择的模式共同决定，清除该模式下的子页面路径，目标格式为 `/apps/{app}/{mode}`。Minecraft 常规模式根页呈现总览，AI Work 根页呈现 AI Work 对话入口。
- 左侧主导航栏房子按钮使用“返回当前模式首页”的名称和行为。
- 明确的“应用中心”入口继续导航到 `/`。
- 不改变快捷键“返回应用中心”的语义、应用/模式切换、工作区布局或其他页面行为。
- 完成标准：代码可静态确认两类入口路由分离；前端构建通过，构建产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`：将当前模式首页动作接入全局导航轨。
- `frontend/src/components/Workbench.tsx`：按当前应用与所选模式提供首页路由。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不修改应用中心自身路由、侧栏明确的“应用中心”入口、快捷键语义、应用/模式偏好或持久化。
- 不改其他业务页面、样式或布局；不部署、发布、上传或提交 Git。

### 首次实现记录（2026-09-28）

- 房子按钮指向当前应用与当前工作模式根路由，从子页面返回时清除子页面路径；应用中心入口单独指向 `/`。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均成功，产物位于 `dist/frontend/`。未进行浏览器交互验收；当前目录没有 Git 元数据，无法核查 Git 变更状态。

### 用户澄清（2026-09-29）

- 用户确认首页应跟随当前所选模式：常规模式返回常规根页，AI Work 返回 AI Work 根页；从模式子页面进入时清除子页面路径。明确的应用中心入口仍进入 `/`。
- `Workbench.tsx` 使用当前应用和路由中的所选模式构造首页路径；`ApplicationWorkspace.tsx` 的回调与无障碍名称明确表达当前模式首页。
- 静态路由核对确认目标不依赖前一页面或应用中心入口。未运行构建或测试；浏览器交互待验。

## LFAA-GITHUB-FORCE-PUSH-01

### 用户目标

运行根目录 `lfaa.bat` 后，可从现有项目管理菜单一键将 `H:\LFAA` 当前纯净源码提交并推送到 `https://github.com/yubboo/LFAA.git` 的 `main` 分支；提供不覆盖远端历史的常规推送和单独确认的强制推送两种方式。

### 当前合同

- 保留现有安装、开发服务、环境检查和源码备份菜单；新增独立 GitHub 推送选项，由用户选择后才启动 Git 写操作。
- 菜单提供两个明确选项：常规推送使用不带 `--force` 的 `git push`；强制推送使用 `git push --force` 并明确显示会覆盖远端 `main` 历史。默认菜单选项应为不覆盖历史的常规推送。
- 两种推送均从 `docs/updata-log.md` 读取当前正式版本，显示并要求用户确认；提交说明前自动加入 `LFAA 版本号`，成功提示也显示该版本。用户要推送新版本时，须先按项目版本规则更新更新日志，不允许在脚本里填写一个与项目记录不一致的版本。
- 推送前复用或初始化当前工作区 Git 仓库，将 `origin` 固定为用户指定地址；有安全源码变更时列出待提交文件并要求提交说明，过滤后没有可提交内容时不创建空提交；缺少 Git 作者信息时只写入当前仓库配置。
- HTTPS 推送的持续低速阈值为 1 KiB/s、60 秒，避免传输无进展时无限等待；超时或失败时保留 Git 原始错误信息。常规推送遇到非快进拒绝时不得自动强推。
- 本任务只实现脚本，不实际初始化 Git、提交或推送。
- 提交前从暂存区排除 `data/`、`server/data/` 运行数据、构建产物、Node/Python/原生依赖与缓存、本机凭据文件、数据库、日志、归档和模型权重；仅移除明确受保护路径的暂存状态，保留本地文件。单个文件超过 25 MiB 时也从暂存区排除并保留本地文件；剩余安全源码有变更时继续到必填提交说明步骤。推送前扫描当前提交历史中的受保护路径、大文件和高风险凭据特征。
- 不提交 SQLite 等账户数据库、超级管理员注册结果、会话、用户设置或其他运行状态；锁文件和项目清单保留，用于可复现地重新安装依赖。
- 复用 Git CLI 的原始错误信息，不添加依赖或额外服务。
- 完成标准：从 `lfaa.bat` 菜单能分别选择常规和强制推送；两个选项都能确认当前正式版本；目标 URL、分支、强推隔离、正常推送非覆盖、超时、依赖/运行状态排除、大文件闸门与敏感内容扫描可静态核对；PowerShell 脚本语法检查通过。

### 允许修改

- `lfaa.bat`：更新入口用途说明。
- `scripts/install-dependencies.ps1`：在现有管理菜单加入 GitHub 强制推送选项及其本地 Git 流程。
- `.gitignore`：忽略仓库运行数据目录、本地环境凭据、依赖与构建缓存目录。
- `docs/PROMPTS.md`：登记本任务合同与完成记录。

### 禁止修改

- 不在本任务中运行 Git 初始化、暂存、提交、远端写入或强制推送。
- 不修改目标 GitHub 仓库内容，不推送其他分支，不把运行数据、凭据或构建产物纳入提交。
- 不调整与菜单及 GitHub 推送无关的安装、启动、备份或业务代码。

### 完成记录（2026-09-28）

- 菜单项 6 执行普通快进推送，菜单项 7 单独执行强制推送；两种模式均从 `docs/updata-log.md` 读取并要求输入确认当前项目版本，成功提示显示版本，新提交说明自动带版本前缀。普通推送不带 `--force`，非快进时明确报告被拒且不会覆盖远端；HTTPS 上传持续低于 1 KiB/s 达 60 秒时退出并保留 Git 错误信息。
- `origin` 与 push URL 固定为 `https://github.com/yubboo/LFAA.git`；Git 作者名和邮箱缺失时只询问并写入当前仓库配置，不修改全局 Git 配置。
- 根 `.gitignore` 与暂存保护规则排除根 `data/`、`server/data/` 运行数据、本机环境文件、数据库、日志、依赖目录和构建/原生缓存；支持本次失败记录中的 `server/data/ai-runtime-smoke` 从暂存区移除并保留本地文件，然后继续到提交说明步骤。另有本机凭据文件名与私钥/令牌特征扫描，以及超过 25 MiB 的暂存文件和历史对象拦截。
- 附件中的强制推送显示已发送 162 个对象、8.78 MiB，但输出止于 Git 写入对象之后，没有远端完成确认。随后只读比对发现本地 `HEAD` 为 `627d19f`、远端 `main` 为 `3694219`，确认该次推送没有更新远端；缺少后续 Git 错误输出，具体传输/权限原因仍未确定。脚本已增加低速超时。
- 静态检查确认当前 `HEAD` 追踪树不含运行数据、依赖、构建输出、账号数据库或大于 25 MiB 的文件；`.env.example` 仅保留空的 `JWT_SECRET` 配置项。当前追踪历史与工作区源码的五类高风险凭据特征扫描均无命中。PowerShell Parser、版本解析（`LFAA 0.1.1`）、推送分支静态核对、忽略规则抽查和目标文件 `git diff --check` 均通过；索引保持干净。本轮未提交、未推送；`scripts/workspace-preflight.mjs` 不存在，未运行。

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
- AppContainer 只能读取实例显式选择的受版本校验 Java 安装目录，并在所属实例目录内读写；外部 Java 不复制、修改或卸载，不能因此访问其他 Minecraft 实例、LFAA 数据、凭据目录或任意本机路径。Java 目录授权只读和执行；运行时 ID 必须匹配服务端所需主版本，已选路径失效时启动失败，不静默回退。网络能力仅按 Minecraft 服务端运行所需显式登记；当前授予 Internet 与 Private Network 能力，尚无域名/端口白名单。启动环境不得继承 Daemon Token、模型密钥或其他无关秘密。
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

- 增加 Windows x64 Rust Sandbox Host：为每个 Minecraft 实例建立不同 AppContainer SID，以显式网络能力启动受管理或实例选定 Java，使用受限句柄列表和清洁环境；实例目录读写 ACL、低完整性标签和当前 Java 目录读/执行 ACL 在安装及每次启动前重新应用。固定目录链和实例目录通过规范路径验证；失败时 Daemon 不回退直接启动 Java。
- Job Object 在恢复 Java 主线程前接管进程，限制活动进程数与内存；Node Daemon 收到真实 Host 启动令牌后才将实例报告为 `running`。server schema 迁移到 12，旧的活动状态迁为无法确认；节点能力门禁、任务认领和实例启动按钮均 fail closed。Minecraft 总览及实例页展示实际探测/心跳状态、文件范围、网络能力和资源边界，并说明模式切换与 App 切换行为。
- 构建命令已接入根 `dist/daemon/target/`。`pnpm run build` 通过（前端 TypeScript/Vite、server TypeScript、Windows x64 Rust release、Daemon `node --check`）；`cargo fmt --check` 和 PowerShell 启动/环境脚本解析通过。菜单显示 Rust/MSVC target 状态，启动 Daemon 前检查 `x86_64-pc-windows-msvc`。现有数据库迁移测试中的目标版本断言已更新为 12，但本轮未运行测试套件。
- 按仓库规则尝试 `node scripts/workspace-preflight.mjs`，当前仓库没有该脚本；`quality:full` 也未定义。初次检查时没有 `.git`；之后 Git 出现根提交 `627d19f`（`1`），本轮没有创建提交或更改暂存区。随后工作区又出现其他未提交文件变更；我未触碰这些并行改动。`git diff --check` 与 `git diff --cached --check` 当时均通过。
- 首次 Cargo 构建的 target-dir 曾多退一层，生成 `H:\dist\daemon\target`；命令已修正，最终构建位于仓库 `dist/daemon/target/`。清理误生成的仓库外 `H:\dist` 被执行策略以 `blocked by policy` 拒绝，未尝试绕过；该外部构建目录仍需处理。
- 未启动 Minecraft Java、未创建 AppContainer 用户配置、未更改实例/JRE ACL、未触碰 `data/`。因此 ACL/低完整性标签是否被目标 Windows 用户上下文接受、实际网络访问与 Sandbox Host 退出清理仍未验收；代码构建不代表这些运行时结论。

### 实例选择电脑已有的 Java（2026-09-29）

- 用户反馈 Java 页面已能发现其他软件安装的 Java，但 Minecraft 版本卡片仍引导重新下载，实例也没有选用入口。目标是让管理员在创建实例及实例停止时选择同节点、主版本匹配的 Java，并保留自动管理模式。
- 实例把 Java 运行时 ID 存在 SQLite 与实例元数据中。显式选中外部 Java 时 Daemon 重新扫描、校验真实版本及规范 `bin\java.exe` 路径；Rust Sandbox Host 只给该安装目录添加 AppContainer 读取/执行 ACL，实例目录仍单独读写。外部 Java 文件不复制、不改动、不卸载；外部路径失效或 Daemon 不支持运行时选择时明确失败，不静默切换版本。显式选择的 LFAA 托管版如果被卸载，则按需重装同主版本。
- 新增 `minecraft-java-runtime-selection-v1` 能力以门控新旧 Daemon，自动管理仍复用现有 LFAA 托管 Java 安装流程。数据库迁移版本 21 保存实例所选运行时 ID。同步更新 `docs/系统总体架构.md` 和 `docs/开发计划.md` 的运行时及沙盒边界描述。
- 前后端 TypeScript 类型检查、Daemon `node --check`、Rust Windows x64 `cargo check` 和 `cargo fmt --check` 均通过；未运行测试套件。Windows AppContainer 对外部 Java 目录的实际访问仍需在目标 Windows 主机验收。

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

- 左右栏拖动按 Pointer 事件逐帧合并后直接更新宽度，不在指针停下后继续追赶；吸附触发时只播放一次列宽收拢动画，同时立即隐藏侧栏内容，不显示半透明内容残影。
- 左右栏拖拽、反向展开期间不运行透明度或位移追赶动画；保留吸附阈值、迟滞和展开状态提交语义。
- 取消左右栏连续阻尼追赶和自续排 RAF；不调整吸附阈值、迟滞、默认宽度或底部面板阻尼。
- 完成标准：左右栏拖动紧跟 Pointer、停下后不再有追赶帧；吸附时内容立即隐藏、列宽只收拢一次且无透明度/位移拖尾；前端 TypeScript 检查与构建通过。
- 左侧应用列表、应用菜单和会话列表只允许纵向滚动；吸附收起/展开经过窄宽度时不出现横向滚动条。

### 允许修改

- `frontend/src/workbench/workbench.css`：修复吸附预览时侧栏越界绘制和拖拽动画叠加；左右栏拖拽全程直接跟随 Pointer，吸附时立即隐藏内容并只播放一次列宽收拢。
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

### 用户指出吸附效果被移除（2026-09-28）

- 用户反馈取消所有列宽过渡后，吸附收起变成瞬间消失，原有吸附收拢效果不见了。
- 本轮恢复一次固定零宽目标的列宽收拢过渡；侧栏内容仍立即隐藏，透明度/位移过渡及拖动期间实时模糊采样保持关闭，避免恢复残影和拖尾。

### 本轮完成记录（2026-09-28）

- `frontend/src/workbench/workbench.css`：左右栏拖拽/吸附/反向展开期间不再额外过渡列宽、透明度或位移；吸附预览立即隐藏 Pane 内容，并限制拖动态可见规则，避免左侧 overflow-visible 将内容画到主区。
- `frontend/src/components/module-workbench.css`：仅在应用左栏拖拽期间关闭应用侧栏的实时背景模糊采样。
- 左右栏吸附阈值、迟滞、展开提交、底部面板动画和先前的横向滚动修复均保持不变。
- `pnpm --filter lfaa-frontend run build` 未通过 TypeScript 检查：`MinecraftWorkspace.tsx` 存在未使用变量，`SettingsPage.tsx` 存在声明前引用，`Workbench.tsx` 传入不受 `ApplicationWorkspaceProps` 接受的 `userId`；错误均位于本轮未修改的文件。单独运行 `pnpm --filter lfaa-frontend exec vite build` 通过，产物位于根目录 `dist/frontend/`。
- 设置页和应用工作区共用 `ResizableWorkbench`；设置页点击收起按钮是一次状态切换，不经过拖拽吸附帧。设置页禁用了侧栏背景模糊，应用左栏则会在 Pointer 拖拽时临时禁用该采样。
- 浏览器登录态无法通过当前自动化连接访问，未完成实机吸附/反向展开验收；当前目录无 Git 元数据，无法运行 `git diff --check` 或提供 Git 差异状态。

### 本轮补充完成记录（2026-09-28）

- `frontend/src/workbench/workbench.css`：吸附预览恢复单次 `grid-template-columns` 收拢动画；栏内内容立即隐藏，不恢复半透明和位移动画。
- `pnpm --filter lfaa-frontend exec vite build` 通过，Vite 产物写入根目录 `dist/frontend/`。完整前端构建仍被前述其他文件的 TypeScript 错误阻塞，浏览器实拖仍待验。

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

### 用户补充反馈（2026-09-29）

- 用户指出 Codex 输入框底部操作栏没有对应到 LFAA；截图中 LFAA 仅有快捷键提示和发送按钮。

### 本轮补充完成记录（2026-09-29）

- 输入框底部现提供真实权限模式、已保存模型和 Runtime 推理档位选择，并同步保存回工作台；切换完全权限保留二次确认。附件和语音入口按未接入能力显示禁用状态与说明。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 与 Vite 构建，产物写入根目录 `dist/frontend/`。
- 未完成浏览器目视验收：浏览器连接返回 `nodeRepl.fetch request failed`。当前工作树没有 `scripts/workspace-preflight.mjs` 或 Git 元数据，未能运行该预检脚本或 `git diff --check`。

## LFAA-UI-AI-PERMISSION-POPOVER-01

### 用户目标

将 AI Work 输入区的 LFAA 权限模式切换菜单整理为紧凑、轻量的弹层；清楚呈现项目现有“请求审批 / 替我审批 / 完全权限”三种模式，而非借用其他产品或额外工具权限提示的语义。参考用户提供的紧凑菜单截图，并继承外观设置。

### 当前合同

- 保留账户级 `permissions.mode` 三种既有选项及真实保存流程；保留切换“完全权限”前的二次确认。
- 模式说明必须以当前 LFAA 设置页和 server 行为为准，不能复制其他产品的权限语义，也不能暗示 LFAA 未开放的能力。
- 弹层挂载在 `.workbench-shell` 内，使用现有主题、强调色、字体、字号、对比度、壁纸遮罩透明度、模糊和减少动态效果映射；不新增设置字段、CSS 自定义属性或硬编码主题色。
- “权限说明”入口可打开现有设置中心“用户与权限”页面；不改变授权规则、审批流程或会话数据。
- 标题使用“权限模式”，不称为“工具权限模式”；三种模式作为一组紧凑列表呈现，不再使用占空间较大的卡片式选项和图标底板。
- 三种模式文案以“用户与权限”设置页、server `authorizeAiTool` 和 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 为准；“完全权限”下当前已接入工具由模型按指令直接执行，不逐项审批。
- 完成标准：三种选项文字、图标、说明和选中态可读；弹层在浅/深色、壁纸和用户字号/字体设置下继续使用共享令牌；原有持久化与完全权限确认保持不变；前端构建及差异检查通过；浏览器目视验收如未运行须明确说明。

### 允许修改

- `frontend/src/components/AiWorkChat.tsx`：呈现权限模式选项、当前选择和现有设置页说明入口。
- `frontend/src/components/ai-work-chat.css`：定义该弹层的局部布局、状态和外观令牌适配。
- `docs/PROMPTS.md`：维护本任务合同及实际验证记录。

### 禁止修改

- 不改权限模式类型/默认值/API、server 授权和审批、模式保存与完全权限二次确认。
- 不新增设置项、依赖、全局设计令牌、图标包、模拟能力或与弹层无关的布局/动效。
- 不修改其他 AI Work 操作菜单、消息区、工作台尺寸、导航、后端和 Daemon。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对菜单仍绑定 `settings.permissions.mode` 与既有 `saveSettings`，切换 `full_access` 仍调用既有二次确认；“权限说明”打开当前权限设置分类。
- 运行 `pnpm --filter lfaa-frontend run build`，确认构建产物只写入根目录 `dist/frontend/`；执行 `git diff --check`。
- 检查当前运行浏览器可达性；能登录时目视核对菜单位置、主题和外观映射，否则如实记录未完成的验收。

### 完成记录（2026-09-29）

- `frontend/src/components/AiWorkChat.tsx`：权限模式选择器增加说明标题、到“用户与权限”的入口、三种模式图标/说明与当前选择标记；仍调用原有账户设置保存流程，并保留“完全权限”二次确认。
- `frontend/src/components/ai-work-chat.css`：为卡片弹层和选项行补充局部样式；弹层挂入 `.workbench-shell`，沿用主题、强调色、字体/字号、对比度、壁纸遮罩透明度、模糊和减少动态效果设置，没有新增设置项或 CSS 自定义属性。
- `pnpm --filter lfaa-frontend run build` 通过，包含 `tsc --noEmit` 和 Vite 构建；产物位于根目录 `dist/frontend/`，未生成包内构建目录。
- `git diff --check -- frontend/src/components/AiWorkChat.tsx frontend/src/components/ai-work-chat.css docs/PROMPTS.md` 通过。
- 未完成浏览器目视验收：开发页端口 5173 正在监听，但浏览器连接返回 `nodeRepl.fetch request failed`，没有取得可检查的页面或登录态；未运行测试套件。
- 当前仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 release Gate 脚本，因此这些 Gate 无法运行。

### 用户反馈修订合同（2026-09-29）

- 用户指出上版菜单视觉过大，且“工具权限模式”标题没有表达 LFAA 项目真实权限模式。本次目标为紧凑菜单，并明确展示 `permissions.mode` 对应的三项既有模式。
- 只允许调整 `AiWorkChat.tsx` 中的模式标题、真实模式说明和无障碍文案，以及 `ai-work-chat.css` 的弹层/选项局部尺寸与布局；同步记录本轮结果。
- 保留 `permissions.mode` 类型、默认值、`saveSettings` 持久化、“完全权限”二次确认和 server 授权语义；不接入新设置，不新增 CSS 自定义属性或硬编码主题色。
- 使用已映射的主题、强调色、界面字体与字号、对比度、壁纸遮罩/模糊和减少动态设置；三项说明准确反映 LFAA 执行语义，完全权限具体行为以 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 为准。
- 验证前端构建和 `git diff --check`；不运行测试套件。若当前浏览器可访问，核对实际弹层高度、文案、选中态和主题，否则记录未目视验收。

### 本轮调整与验证记录（2026-09-29）

- `AiWorkChat.tsx` 将标题改为“LFAA 权限模式”，继续呈现并保存 `ask`、`approve_remembered`、`full_access`；说明按项目实际授权语义收短，并保留“完全权限”二次确认。
- `ai-work-chat.css` 将最大宽度收至 360px、选项高度收至 42px，改为紧凑列表并移除大图标底板。字体字号、主题/强调色、对比度、壁纸遮罩、模糊继续使用工作台既有设置映射；未新增 CSS 变量或设置项。
- `pnpm --filter lfaa-frontend run build` 通过，`git diff --check` 通过；构建产物位于根目录 `dist/frontend/`。
- 本轮未运行测试套件，也未完成浏览器目视验收；当前可用的 Codex IAB 没有打开标签，未在登录态页面核对实际弹层，也未尝试登录或更改权限值。

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

> 历史合同（2026-09-28）：以下内容记录当时的能力状态，已由 `LFAA-AI-PERMISSION-MODE-EXECUTION-02` 和当前代码更新；后续实现以新合同为准。

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

## LFAA-DEV-STARTUP-RESILIENCE-01

### 用户目标

减少一键启动时旧前端端口冲突、后端启动失败后 Daemon 连续报连接错误造成的误判，并让数据库版本不兼容信息可定位。

### 当前合同

- Windows 菜单启动前检查 Vite 5173 和当前控制端端口；被占用时显示端口、进程名和 PID 并停止本次启动，不自动结束未知进程。
- Vite 固定使用 5173；端口冲突时报错退出，不静默切换到 5174。
- Daemon 先等待控制端健康检查通过，再扫描环境、提交心跳和领取任务；控制端未就绪时按间隔重试，并避免重复打印相同错误。
- 数据库版本高于当前代码支持值时继续 fail-closed，并在错误中显示数据库路径与保护数据的原因；不降级或删除数据库。
- 完成后核对菜单与单服务启动入口、当前数据库 14 到 15 的迁移兼容，以及 Windows 端口冲突提示；未运行的构建/启动验收如实记录。

### 允许修改

- `scripts/start-dev.ps1`、`frontend/vite.config.ts`、`daemon/src/task-runner/minecraft-daemon.mjs`、`server/src/database.ts`：实现启动前检查、固定前端端口、Daemon 健康等待与清晰的数据库版本错误。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：登记启动行为及本次任务记录。

### 完成记录（2026-09-29）

- 启动脚本会先检查服务监听端口并显示占用进程，不会自动结束进程；Vite 端口冲突时不再换端口。Daemon 等待 `/api/health` 成功后才开始节点扫描和心跳，同一连接错误只提示一次，恢复后提示已连通。
- 数据库高版本拒绝信息包含数据文件路径，并说明不会为保护数据而自动降级；当前代码支持数据库版本 16，版本 15 会继续执行已有迁移。
- 未运行 PowerShell 启动、构建或自动化测试；Windows 端口占用场景与完整菜单启动待实机验收。

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

- 用户截图显示中间 AI Work 长回复旁仍出现原生滚动条。在共享中间内容区及其后代的隐藏规则上补充强制覆盖，并将 Chromium/WebKit 滚动条宽高归零；保留消息列表原有 `overflow: auto`、滚动位置恢复 Hook 和滚轮/触控板滚动路径。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均成功；构建产物写入根目录 `dist/frontend/`。未执行浏览器目视或滚轮/触控板交互验收。
- 浏览器目视验收未完成：浏览器枚举返回 `nodeRepl.fetch request failed`。当前目录没有 Git 元数据，无法运行 `git diff --check`。

## LFAA-UI-CENTER-RESIZE-REFLOW-01

### 用户目标

拖窄应用工作区中间列时，Minecraft 总览卡片不要因仍强制四列而连续挤压、折行和跳动；过渡保持跟手。

### 当前合同

- Minecraft 总览的统计卡片与沙盒说明卡片依据中间内容容器的实际宽度重排，不依赖浏览器视口宽度判断列数。
- 统计值标题随中间容器宽度在清晰可读范围内连续缩放，降低分隔条微小位移就触发行内折行的情况。
- 保持工作台分隔条直接跟随指针、现有吸附阈值、布局持久化、滚动行为和其余应用内容不变。
- 不新增动画、依赖、CSS 自定义属性或业务状态；不修改组件状态、API、路由或布局 Owner。
- 完成标准：中间列变窄时 Minecraft 卡片保持可读并按容器宽度重排；前端构建通过，产物写入根目录 `dist/frontend/`。浏览器拖拽目视验收未完成时如实记录。

### 允许修改

- `frontend/src/components/module-workbench.css`：将共享中心内容标记为按自身宽度查询的命名容器。
- `frontend/src/components/MinecraftWorkspace.css`：依据中间列容器宽度重排总览卡片，并连续缩放统计值标题。
- `docs/PROMPTS.md`：维护任务索引、合同和完成记录。

### 禁止修改

- 不修改 `ResizableWorkbench` 拖拽算法、工作台宽度阈值、吸附迟滞、宽度偏好或侧栏布局。
- 不修改 Minecraft 业务组件、数据、API、路由、滚动恢复或其他应用样式。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对容器查询以中间列宽度为依据、四列向两列/单列收敛，且标题缩放有上下限。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查和 Vite 构建通过，产物位于根目录 `dist/frontend/`；浏览器拖拽手感无法实测时如实说明。

### 完成记录（2026-09-28）

- 中间内容容器增加命名 inline-size 查询；Minecraft 统计卡标题以容器单位在 16px 至 20px 之间连续缩放，统计与沙盒说明卡在中间列不超过 920px 时切换为两列、不超过 560px 时切换为单列，实例详情栅格同步收敛。
- `pnpm --filter lfaa-frontend exec vite build` 通过，产物写入根目录 `dist/frontend/`；目标文件 `git diff --check` 通过。构建 CSS 中已核对命名容器查询和 `cqi` 规则。
- 完整命令 `pnpm --filter lfaa-frontend run build` 被现有未提交改动中的 `AiWorkChat.tsx`、`Workbench.tsx` TypeScript 错误阻塞；本任务未修改这两个文件。仓库没有 `scripts/workspace-preflight.mjs`，根脚本也未定义额外 quality/release Gate。
- 未完成浏览器拖拽目视验收；截图能看到卡片文字折行，但无法从静态图确认运行时掉帧或闪烁。

## LFAA-UI-WORKBENCH-REFLOW-STABILITY-01

### 用户目标

修复展开或收起工作台左右菜单、底部终端时中间区域闪屏、抖动和跳动的问题，并覆盖所有共用此布局的页面。

### 当前合同

- `SettingsPage` 与 `ApplicationWorkspace` 共用的 `ResizableWorkbench` 在左右 Dock 宽度动画期间标记布局过渡；Minecraft 中间内容的容器断点暂停到动画结束，避免随每帧宽度变化反复切换卡片列布局。
- 半透明应用侧栏在左右 Dock 开合动画期间暂停背景模糊采样，过渡结束后恢复当前外观偏好；现有拖拽暂停行为保持不变。
- 应用侧栏/底部终端状态变化不应因父工作区重渲染而重新执行 Minecraft 或 AI Work 的整页组件函数；组件自身状态更新仍正常工作。
- 保留工作台开合尺寸、交互、吸附和持久化语义；不改业务数据、API、路由或其他响应式断点。
- 静态核对共享布局覆盖范围与过渡事件收尾；构建和浏览器开合观感待验收。

### 允许修改

- `frontend/src/workbench/ResizableWorkbench.tsx`、`frontend/src/workbench/workbench.css`：跟踪共享 Grid 轨道过渡并暂缓中间内容断点切换。
- `frontend/src/styles/workbench.css`：左右 Dock 开合期间暂停应用侧栏实时背景模糊采样。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/MinecraftWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`：稳定导航回调并避免无关开合状态导致重渲染重页面。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：同步共享布局行为与本次任务记录。

### 完成记录（2026-09-29）

- 共享工作台通过轨道过渡事件标记左右宽度动画；动画期间 Minecraft 内容使用稳定的外层容器作为响应式参照，结束后恢复最终中心宽度对应的断点。应用左右侧栏在同一时段暂停实时背景模糊；拖动期间既有规则保留。
- 稳定应用内导航回调，并对 Minecraft 工作区与 AI Work 聊天使用 `memo`，避免菜单或终端开合导致业务重页面重渲染。
- 本轮未运行构建或自动化检查，亦未进行浏览器目视验收；尚未验证实际帧表现。

## LFAA-SETTINGS-AUTOSAVE-01

### 用户目标

修复设置中心所有已接入账户设置只改内存、刷新后丢失的问题；设置分类、滚动位置及加载体验继续保持稳定。

### 当前合同

- 设置中心中由 `updateSettings` 编辑的服务端账户设置，在控件变更后自动保存；短时间连续变化按类别合并，停止操作后保存最新值。现有“立即保存”操作保留为即时提交和失败重试入口。
- 同一设置类别的并发写入串行收敛到最新修订，旧响应不得覆盖新编辑或其他类别的当前内存值；保存失败时保留本次页面中的编辑值并显示可重试错误。
- `UserSettings` 的 `aiRuntime` 前端键必须映射到服务端现有 `ai-runtime` 路径；不改服务端分类、数据格式、权限或数据库合同。
- 服务端校验白名单必须覆盖前端实际提交且服务层已支持的字段；保持严格拒绝未知字段，发现既有字段漏登记时只补齐该字段的原有合法取值。
- 已确认外观保存失败的根因：前端及服务层都包含 `appearance.sidebarColor`，但 API 的严格 Joi schema 未登记该字段，导致整份外观设置保存请求被拒绝。
- 服务端仍是账户设置的持久化 Owner。浏览器只保留设置分类、分类滚动位置、外观高级设置展开状态和背景目标选择等非敏感界面状态，不复制账户设置或设置草稿。
- AI Provider 密钥、密码、恢复密钥和其他需明确提交的凭据，不进入自动保存队列或浏览器存储；沿用各自已有的明确提交 API。
- 只读状态和未接入分类继续保持说明性，不伪装为可保存设置；快捷键冲突等服务端校验失败必须明确反馈，不能被自动保存绕过。修复前端类型、API schema 和服务层之间的既有字段漂移，不新增账户设置字段或持久化格式。
- 完成标准：所有真实账户设置控件通过统一自动保存路径，刷新后从服务端恢复；前端类型检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：保持所有账户设置编辑使用统一自动保存、错误提示和即时提交路径；保留凭据显式提交边界。
- `frontend/src/api.ts`：保持 `aiRuntime` 到 `ai-runtime` 的路径映射与离页请求行为。
- `server/src/api/routes.ts`：仅补齐与现有前端类型和设置服务一致的遗漏校验字段；保持未知字段拒绝、现有取值限制及服务端权限边界。
- `docs/PROMPTS.md`：维护本任务合同与完成记录。

### 禁止修改

- 不改数据库 schema、设置类别字段、服务端授权或真实业务能力；不重写设置服务。
- 不把任何账户设置、设置草稿、密码、恢复密钥或 Provider Secret 写入浏览器持久存储。
- 不新增依赖，不移除安全校验，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对前端六类账户设置与 API schema / 服务层字段一致，所有账户设置控件统一经过自动持久化路径，短时间连改不会旧值覆盖新值，`aiRuntime` 路径映射有效，秘密字段仍需显式提交。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物位于根目录 `dist/frontend/`；如无法使用已登录浏览器实测保存后刷新，准确记录限制。

### 完成记录（2026-09-28）

- 设置中心全部 21 处 `updateSettings` 控件共用按账户设置类别自动保存路径；300ms 内的连续变化合并写入。同类别请求串行追到最新修订，响应只合并对应类别，避免旧响应覆盖其他类别的编辑。
- 页面离开时冲刷等待中的类别写入，设置 API 请求启用 `keepalive`；保存失败按类别保留错误提示，现有按钮改为“立即保存”并作为手动提交/重试入口。快捷键冲突时暂停写入并提示。
- 修正 `aiRuntime` 客户端键写入服务端已存在的 `/settings/ai-runtime` 路径。背景上传后的选择与背景删除前的引用更新都通过同一持久化路径。
- 设置分类和滚动位置、外观高级区展开状态、背景目标选择按账户保存在浏览器；账户设置值仍只由服务端保存。AI Provider 密钥和恢复密钥保留显式提交，不进入自动保存。
- `pnpm --filter lfaa-frontend run build` 通过，含 TypeScript 检查；Vite 产物写入根目录 `dist/frontend/`。当前没有已登录浏览器会话可完成保存后刷新实测。
- 仓库没有 `scripts/workspace-preflight.mjs` 或 quality/release Gate 脚本，workspace preflight 无法运行；当前目录无 Git 元数据，无法运行 `git diff --check` 或核对 Git 变更状态。

### 补充修复记录（2026-09-29）

- 根因：前端和设置服务均包含 `appearance.sidebarColor`，但 API 的严格 Joi 白名单遗漏该字段；外观控件提交整份分类对象时都会因未知字段返回 400，所以自动保存与“立即保存”一并失败，刷新读回旧值。
- 在 `server/src/api/routes.ts` 为既有 `sidebarColor` 字段补齐服务层已有的 `auto` 或六位十六进制颜色约束；继续拒绝其他未知字段。逐项核对六类账户设置字段后，其他五类与 API schema / 设置服务一致。
- `pnpm --filter lfaa-frontend run build` 和 `pnpm --filter lfaa-server run build` 均通过；`git diff --check` 通过。构建输出分别写入根目录 `dist/frontend/` 与 `dist/server/`。
- 已检查开发 API 健康状态为 200；当前桌面浏览器连接器未返回可用浏览器或标签页，未能在登录态下实际调整 10%、保存并刷新确认。

## LFAA-SETTINGS-BACKGROUND-RENDER-01

### 用户目标

修复外观设置中为“设置中心”选择背景图片后，设置中心实际页面仍显示纯色的问题。

### 当前合同

- 设置中心继续使用账户设置 `appearance.backgrounds.settings` 选择背景；外层 `.workbench-shell` 负责背景图片与遮罩，设置页面内部工作台根容器不得用不透明底色覆盖该背景。
- 背景遮罩滑块同时控制设置正文与设置导航的大面积表面透明度：0% 时不叠加遮罩且两处透出所选壁纸，数值升高时逐步增加主题底色以提高文字对比度。
- “统一侧边栏颜色”只决定设置导航的底色色调；透明度由背景遮罩控制。独立设置卡片保留各自表面以维持文字可读性，其他应用工作区的侧栏行为保持现状。
- 本次只修复设置中心大面积表面的 CSS 遮挡并明确控件说明，不改变背景选择目标、资源映射、自动保存、API、设置数据结构、登录页或其他工作区行为。
- 完成标准：设置中心的内部工作台透出所选背景；前端 TypeScript 检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/components/SettingsPage.css`：仅调整设置中心内部工作台根容器和设置正文表面的背景绘制。
- `frontend/src/components/SettingsPage.tsx`：说明背景遮罩与侧边栏颜色分别控制的视觉属性。
- `frontend/src/components/Workbench.tsx`：将背景遮罩百分比传递给设置中心大面积表面透明度。
- `docs/PROMPTS.md`：维护本任务合同和完成记录。

### 禁止修改

- 不修改设置 API、账户设置 schema、图片资源、登录页或其他工作区的背景样式。
- 不修改侧边栏颜色取值、设置卡片表面、其他工作区侧栏样式、布局或交互；不新增服务端设置字段或依赖。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态确认设置页内部工作台根容器透明；正文和设置导航的不透明度与背景遮罩百分比一致，0% 时不遮挡所选壁纸；统一侧边栏颜色仍提供背景色调，设置卡片表面保持独立。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`。

### 完成记录（2026-09-28）

- 设置页内部工作台根容器透明；正文与设置导航的底色不透明度跟随背景遮罩，0% 时完整透出壁纸，侧栏色调仍由“统一侧边栏颜色”提供，设置卡片保留独立底色。
- 背景遮罩和侧栏颜色说明已区分透明度与色调；高级“半透明侧边栏”说明明确该开关作用于应用导航和工具资源栏。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功；确认生成 CSS/JS 产物包含动态不透明度规则，产物位于 `dist/frontend/`。
- `git diff --check` 对本任务涉及文件通过。仓库没有 `scripts/workspace-preflight.mjs` 或 quality/release 脚本；未进行浏览器目视验收。

## LFAA-SETTINGS-APPEARANCE-DEFAULTS-01

### 用户目标

检查设置中心“外观”中的背景位置、背景遮罩和玻璃模糊控制，保留每类界面按用途独立的样式，只统一确实共用的设置来源，并修正样式缺省值，避免设置值缺失时出现 0% 透明度等意外表现。

### 当前合同

- 外观偏好的 API、账户数据结构、自动保存、背景上传/删除和目标选择持久化行为保持不变；不把所有工作区表面改成相同样式。
- 新账户、缺少对应字段的旧账户及“恢复默认”采用用户截图中的背景遮罩 37%、玻璃模糊 14px；工作台 CSS 动态设置未覆盖时使用同一兜底值。已经保存的账户外观偏好不批量覆盖。
- 背景目标沿用现有六个独立槽位；Minecraft 常规模式与 AI Work 继续共用 `minecraft` 槽位。背景位置选择、预览卡片、上传、删除和当前路由应用关系不改变。
- 背景遮罩、模糊和侧栏自定义颜色各自继续控制现有职责；仅合并确实相同的共享默认值/样式入口。组件特有的卡片、控件、消息和布局样式保留。
- 无背景图时的纯色表面与高级“半透明侧边栏”现有行为保持不变；不改路由、布局、主题色、图片资源、设置 API 或服务端 schema。
- 完成标准：前端与 server 默认值一致；工作区共享 CSS 兜底值与其一致；静态确认背景槽位映射与即时预览/自动保存路径未被改变；前端 TypeScript/Vite 构建通过且产物在根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/styles/workbench.css`：定义工作区外观共享兜底值，供对应页面样式读取。
- `frontend/src/components/module-workbench.css`、`frontend/src/components/SettingsPage.css`、`frontend/src/components/ai-work-chat.css`、`frontend/src/styles/application-workspace.css`：仅将确实共享的背景遮罩/模糊默认值改为使用工作区定义的兜底值；保留组件特有样式。
- `frontend/src/components/Workbench.tsx`、`frontend/src/components/SettingsPage.tsx`、`server/src/modules/settings/service.ts`：让新账户、恢复默认和工作区 CSS 使用同一组外观默认值；不改现有保存协议与设置字段。
- `docs/系统总体架构.md`：同步记录外观设置默认值。
- `docs/PROMPTS.md`：维护本合同和完成记录。

### 禁止修改

- 不改变用户已经保存的外观偏好，不改 API、schema、背景槽位或上传/删除业务逻辑。
- 不重做整套视觉设计，不强制所有面板、卡片或消息共用透明度/背景，不引入新依赖或新增持久化配置。
- 不部署、发布、上传、清理运行数据或提交 Git。

### 验收方式

- 对照 `frontend/src/components/SettingsPage.tsx`、`server/src/modules/settings/service.ts` 与工作台 CSS 中的外观默认值，确认均为遮罩 37%、模糊 14px；核对 CSS 未再把共享遮罩变量的缺省值设为 0%。
- 核对背景位置六个选项仍映射到原有 `appearance.backgrounds` 槽位，Minecraft 常规与 AI Work 仍共享 `minecraft`；选择卡片后仍通过原 `updateSettings` 即时预览并自动保存。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`；对任务文件运行 `git diff --check`。记录未进行的浏览器外观验收。

### 完成记录

- 前端“恢复默认”、server 新账户/缺省设置和工作区 CSS 兜底统一为遮罩 37%、模糊 14px，取自用户截图中的当前外观值；已保存的用户偏好仍由原账户值覆盖，不做批量迁移。
- CSS 的共用设置变量由 `.workbench-shell` 提供默认值；设置页、应用侧栏和聊天输入区消费同一变量，移除分散的 0%/8px 缺省值。组件专用背景、卡片与消息样式保持独立。
- 核对六个背景目标及 `/apps/{应用}/{normal|ai-work}` 路由映射未改变；Minecraft 常规和 AI Work 继续使用 `minecraft` 背景槽，卡片仍即时预览并通过现有自动保存逻辑持久化。
- `pnpm --filter lfaa-frontend run build` 与 `pnpm --filter lfaa-server run build` 均通过，构建产物写入根目录 `dist/frontend/` 与 `dist/server/`；本任务涉及文件 `git diff --check` 通过。
- 尝试读取浏览器进行目视验收时，CUA 返回 `nodeRepl.fetch request failed`，未取得页面状态；因此未验证真实窗口中的背景合成效果和控件交互。

## LFAA-WORKSPACE-BACKGROUND-UNIFICATION-01

### 用户目标

让所选工作区壁纸由同一层绘制，且背景遮罩滑块对设置中心、应用常规模式和 AI Work 的主要画布与导航表面产生一致效果，避免模式切换后透明度控制表现不同。

### 当前合同

- `.workbench-shell` 是工作区壁纸与遮罩的唯一绘制 Owner；应用中间画布不得重复绘制同一图片或遮罩。
- 设置中心、应用导航/工具栏、常规模式主提示表面和 AI Work 输入区等主要表面共用 `--settings-background-surface-opacity`。AI Work 对话画布本身保持透明以显露外壳壁纸，避免父子表面叠加；0% 时受控表面不盖住壁纸，提高百分比时按同一值增加主题底色。
- “统一侧边栏颜色”继续提供侧栏色调，“半透明侧边栏”继续负责其模糊开关；二者不得覆盖背景遮罩对大面积表面透明度的控制。
- 小型操作控件、聊天消息气泡及独立内容卡继续使用自身主题表面以保证可读性；不把壁纸透明度扩大成对所有按钮或语义卡片的强制透明。
- 常规模式和 AI Work 保持现有业务组件、路由、数据及交互不变；只统一外层背景和主要表面透明度。
- 应用背景仍按设置中的工作区位置分别保存；Minecraft 常规与 AI Work 共用 `minecraft` 背景槽，和设置中心背景互相独立。
- 本任务扩展设置中心背景修复范围，覆盖先前合同所述“其他应用工作区侧栏行为保持现状”的限制；不改变背景选择目标、图片资源映射、自动保存、API、账户设置数据结构或登录页。
- 完成标准：静态可确认唯一背景绘制 Owner、主要表面共用同一动态透明度值且常规/AI Work 无固定模式透明度；前端 TypeScript 检查与构建通过，产物位于根目录 `dist/frontend/`。

### 允许修改

- `frontend/src/styles/workbench.css`：保持工作台外壳唯一绘制壁纸，并让应用侧栏主要表面跟随共同透明度。
- `frontend/src/components/module-workbench.css`：移除重复中间背景，统一应用工作区侧栏、顶部栏、常规模式提示区与 AI Work 大面积表面的透明度。
- `frontend/src/components/SettingsPage.css`、`frontend/src/components/SettingsPage.tsx`：保持设置中心与应用工作区对同一遮罩设置的说明一致。
- `frontend/src/components/Workbench.tsx`：为共享工作区提供同一遮罩百分比。
- `docs/系统总体架构.md`、`docs/PROMPTS.md`：同步背景选择位置、应用模式共享规则及本任务完成记录。

### 禁止修改

- 不修改设置 API、账户设置 schema、背景图片选择/存储逻辑、登录页或模式路由/业务组件。
- 不改变消息气泡、独立内容卡和小型操作控件的既有语义表面，不新增变量、依赖、抽象层或后端能力。
- 不部署、发布、上传、清理运行数据或提交 Git。

### 验收方式

- 静态核对页面级工作区壁纸只由 `.workbench-shell` 绘制；`module-center` 不再声明背景图片或遮罩；设置中心和应用的受控主要表面共用同一个 `--settings-background-surface-opacity`，AI Work 画布保持透明，常规模式与 AI Work 不再写独立固定透明度。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物写入根目录 `dist/frontend/`；对本任务文件运行 `git diff --check`。
- 记录未进行的浏览器目视验收，不以静态构建代替真实外观验证。

### 完成记录（2026-09-28）

- 应用工作区的 `.module-center` 与 AI Work 对话画布改为透明，由 `.workbench-shell` 单点绘制壁纸和遮罩；设置导航、应用导航/工具资源栏、常规模式提示表面、AI Work 输入区和中间工具栏统一读取同一表面透明度，清除 AI Work/常规内容表面原有的 34%、58%、72%、76% 固定透明度分叉。无壁纸时原有半透明侧栏 76% fallback 保持不变。
- 侧栏仍保留统一自定义色调和玻璃模糊设置；聊天消息气泡、独立内容卡和小型操作控件保留自身表面。背景位置选择文案明确说明 Minecraft 常规与 AI Work 共用 Minecraft 工作区背景，和设置中心背景独立。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物写入根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- 未进行浏览器目视验收；构建与静态核对未验证实际浏览器合成效果。

## LFAA-REALTIME-SOCKET-01

### 用户目标

参考 GSM3 的 Socket.IO 实时连接，为 LFAA 当前已有的 Minecraft 任务进度、日志及节点/实例状态提供低延迟浏览器更新，并能呈现连接状态与恢复操作。

### 当前合同

- 在 LFAA Manager HTTP 服务上挂载 Socket.IO；Web、Tauri 与 Electron 共用的 Minecraft Renderer 连接同源 Socket.IO 服务。开发环境 Vite 代理 `/socket.io` 并允许 WebSocket 升级。
- Socket 握手复用现有 HttpOnly `lfaa_session` Cookie；服务端使用与 HTTP API 相同的 JWT issuer/audience、活动会话和用户身份检查。不得把会话 Token 放到 URL、`localStorage` 或普通日志中。
- Socket 的活动连接在 JWT 到期、用户登出或通过恢复密钥重置密码时断开；无效或撤销会话不能建立新连接。
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

### 完成记录（2026-09-28）

- 在 server HTTP 服务挂载 Socket.IO 4.8.4；Socket 握手复用 `lfaa_session` Cookie、原有 JWT issuer/audience 和活动会话校验。连接按 JWT 到期、登出或密码恢复失效时关闭。
- Minecraft 页面用 Socket.IO Client 4.8.4 订阅最小 `logs`、`tasks`、`state` 变更范围与可选实例 ID；收到事件及断线恢复后仍通过现有认证 REST API 读取快照。保留原状态与日志轮询作对账，Daemon 仍使用 HTTP。
- Vite 开发代理允许 `/socket.io` WebSocket 升级。前端显示连接/重连状态、自动重连五次，并在中断时提供手动重连。
- 新增隔离临时 `LFAA_DATA_DIR` 的 Socket.IO 集成测试：无 Cookie 与无效 Cookie 被拒绝；有效会话只收到定义的通知字段；真实管理员 REST 创建任务会发出任务变更；撤销会话后当前连接断开且不能重新连接。修正两处既有测试夹具：版本 10 测试数据库补上迁移 v12 所需的实例表；启动任务租约测试明确提供当前实现要求的沙盒能力，原有断言保留。
- 验证通过：`pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-frontend run build`、`pnpm test`（7 项）和 `pnpm run build`；构建产物写入根目录 `dist/`。`git diff --check` 通过。
- 当前仓库未提供 `scripts/workspace-preflight.mjs` 或 `quality:full` / release 脚本。未进行浏览器目视、桌面 WebView 或真实 Windows Daemon 网络验收；这些环境验收仍待执行。

## LFAA-UI-WORKBENCH-SNAP-02

### 用户目标

修复鼠标持续按住拖拽时，左右侧栏从吸附收起反向拉出展开发生突跳、卡顿，提升这段过渡的连贯性。

### 当前合同

- 普通左右栏拖动继续逐帧跟随最新 Pointer；吸附捕获阈值、释放迟滞、松手提交和吸附收起动画保持现状。
- 越过释放迟滞、从吸附态反向展开时，不把视觉列宽从 0 一帧跳到最小宽度；使用有时长上限的逐帧缓动，让宽度连续展开，并在缓动结束后与当前 Pointer 尺寸精确衔接。
- 用户继续移动时始终读取最新 Pointer 目标；缓动结束或再次进入吸附时停止该动画，不留下追赶帧。
- 不改 CSS 网格布局、Pane 内容、默认尺寸、吸附参数、持久化状态或底部面板阻尼。

### 允许修改

- `frontend/src/workbench/ResizableWorkbench.tsx`：仅为左右栏吸附后的反向释放加入短时、有界的宽度缓动；普通拖动仍按 Pointer 逐帧直写。
- `docs/PROMPTS.md`：登记当前任务合同和实际验证结果。

### 禁止修改

- 不改吸附捕获阈值、释放迟滞、默认宽度、普通拖动跟手规则、CSS 自定义属性、底部面板阻尼或既有吸附收起过渡。
- 不改动当前工作区中其他未提交内容，不新增依赖，不清理或覆盖 `dist/`、`data/`，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对反向释放时宽度从 0 连续缓动，动画期间使用最新 Pointer 位置，并在达到统一释放时长后精确回到直接跟手；再次吸附或缓动结束时停止 RAF，Pointer 结束/取消后不再更新尺寸，取消时恢复起始宽度。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建结果；记录浏览器实拖是否完成及任何环境限制。

### 完成记录（2026-09-29）

- 修正吸附态反向越过释放迟滞时从 0 直接跳到最小栏宽的问题：左右栏现在按统一释放时长逐帧缓动，并在动画结束时与最新 Pointer 尺寸精确衔接；若拖回吸附区，立即取消展开缓动。普通拖动、吸附阈值、释放迟滞和收起动画不变。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建均通过，产物位于根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- 未进行浏览器实拖，尚未实测真实鼠标手感。

## LFAA-UI-SIDEBAR-GLASS-STABILITY-01

### 用户目标

修复应用工作区左侧菜单悬停展开预览及鼠标拉伸期间，半透明背景先透底、再恢复模糊的突变，让玻璃侧栏状态连续且操作手感稳定。

### 当前合同

- 悬停预览出现时侧栏从第一帧起保持账户外观设置的透明度与背景模糊；保留现有轻微位移动画，不对整块玻璃侧栏做透明度淡入。
- 拖动应用左侧栏时保持同一背景模糊与透明度，不在 Pointer 按下期间切换视觉效果。
- 不改外观设置值、应用侧栏内容、列宽、吸附阈值、Pointer 跟手、纵向滚动、设置中心行为或现有 reduced-motion 支持。
- 完成标准：静态核对悬停与拖拽状态不再覆盖侧栏的 opacity / backdrop-filter；构建和浏览器交互验收结果如实记录。

### 允许修改

- `frontend/src/components/module-workbench.css`：只调整应用左侧栏悬停预览的显隐过渡及拖拽期间的背景模糊规则。
- `docs/PROMPTS.md`：维护本任务索引、合同和完成记录。

### 禁止修改

- 不修改全局外观偏好、CSS 自定义属性、设置中心、工作台尺寸/吸附算法或其他应用交互。
- 不新增依赖，不改动工作区中与本任务无关的未提交内容，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对悬停预览没有整体 opacity 淡入，左栏拖动期间不再关闭 `backdrop-filter`。
- 运行前端构建并检查产物仍写入根目录 `dist/frontend/`；记录浏览器悬停与实拖是否完成及限制。

### 完成记录（2026-09-29）

- 悬停预览去掉整块容器的透明度淡入，只保留位移显现；左栏 Pointer 拉伸时移除关闭 `backdrop-filter` 的覆盖规则，外观设置的侧栏透明度与模糊不再随交互状态切换。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建均通过，产物位于根目录 `dist/frontend/`；任务文件 `git diff --check` 通过。
- 未进行浏览器悬停和实机拖拽：当前浏览器控制连接返回 `nodeRepl.fetch request failed`，实际鼠标观感仍待验收。

## LFAA-MINECRAFT-CONTROL-CENTER-01

### 用户目标

让 Minecraft 总览成为应用内的运行管理中心，清楚呈现真实节点、实例和任务状态；点击监控卡片可进入对应页面，并在 Minecraft 菜单中补齐控制节点入口与菜单分类。

### 当前合同

- 总览提供真实数据卡片与简明运行状态区；节点、实例、任务和版本卡片都能用鼠标及键盘进入对应的 Minecraft 管理页面。
- Minecraft 二级菜单按“监控”“管理”“环境”三个可访问的分类标签组织；总览/控制节点属于监控，实例/任务属于管理，Java 环境属于环境，选中实例时仍显示其实例子菜单。
- 控制节点页面读取现有受保护 `/minecraft/nodes` 接口，显示心跳上报的在线状态、平台、Daemon 版本、能力、Java 运行环境和最近心跳；不把只读监控伪装成远程接入、删除或命令控制功能。
- 总览状态响应现有经会话认证的 Minecraft Socket.IO 变更推送，并保留每 8 秒 REST 快照对账。无真实值时显示未读取/空状态，不用演示值填充。
- 将 AppContainer 文件、网络、进程边界说明放入控制节点页面；总览只保留是否存在可开服节点及可操作的诊断入口。
- 当前 Daemon 尚未采集 CPU、内存、磁盘或网络吞吐指标，本任务不增加或伪造这些资源指标；它们需由后续 Daemon 监控 Owner 提供真实数据后再接入。
- 完成后更新 Minecraft 菜单和页面范围文档，运行仓库要求的前端构建与适用检查，并注明未做的浏览器/目标主机验收。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/module-workbench.css`：增加 Minecraft 菜单分类标签和控制节点入口。
- `frontend/src/components/MinecraftWorkspace.tsx`、`frontend/src/components/MinecraftWorkspace.css`：重组 Minecraft 总览卡片和运行区，增加真实控制节点只读页面及空/异常状态。
- `docs/PROMPTS.md`、`docs/开发计划.md`、`docs/系统总体架构.md`：登记任务并同步菜单、监控范围与验收状态。

### 禁止修改

- 不改变 Manager/Daemon Owner、节点身份认证、SQLite schema、Daemon 心跳、Socket.IO 事件、Minecraft 任务和 AppContainer fail-closed 语义。
- 不增加远程节点配对、注册、删除、任意主机命令或主机资源采集；不显示未测量的 CPU/内存/磁盘数据。
- 不运行真实 Minecraft 下载、实例创建或开服任务，不读写或清理 `data/`，不部署、发布、上传或提交 Git。
- 不覆盖当前工作区既有的未提交更改；不把本任务扩展到 SteamCMD、AI Work 执行工具或全局应用中心重构。

### 验收方式

- 静态核对所有菜单标签与路由匹配，卡片跳转目标正确；控制节点状态字段与现有 `/minecraft/nodes` 类型一致，缺少 AppContainer Host 时明确显示不可开服原因。
- 运行 `pnpm --filter lfaa-frontend run build` 并核对构建产物仅写入根 `dist/frontend/`；按仓库当前实际存在的脚本执行适用检查，准确记录缺失或未运行的 Gate。
- 如可访问当前已登录浏览器，检查菜单分类、窄列布局、卡片焦点和跳转；不以构建替代真实 Windows Minecraft 开服验收。

### 实现记录（2026-09-29）

- Minecraft 侧栏加入“监控 / 管理 / 环境”分类和“控制节点”路由。总览改为可点击的节点、实例、任务、正式版卡片，并列出真实节点状态和最近任务；节点页读取现有 `/minecraft/nodes` 快照，展示真实心跳、平台、版本、能力和 Java 环境。详细 AppContainer 边界说明从总览移到节点页。
- 状态仍通过既有认证 Socket.IO 变更通知刷新，并保留每 8 秒 REST 对账；主机 CPU、内存、磁盘数据尚无 Daemon 采集来源，未添加模拟指标。
- 已定位截图中不可开服原因：运行中的 Daemon 于 2026-09-28 21:55 启动，Sandbox Host 文件于 22:05 生成；Daemon 只在启动时探测一次，因此该旧进程持续未上报 AppContainer 能力。当前构建的 Sandbox Host `--probe` 返回正确后端与网络能力。重启后的 Daemon 未输出 Host 不可用警告。首次重启时 Manager 尚未监听；随后启动 `pnpm dev:server`，`/api/health` 返回 ready，Daemon 心跳和任务领取接口均返回 HTTP 200，证明节点已重新接入。没有创建或启动 Minecraft 实例。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 与 Vite 构建产物写入根目录 `dist/frontend/`；`git diff --check` 通过。当前仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 也没有 `quality:full` 脚本。
- 浏览器清单读取失败，未进行登录后目视/点击验收；未运行 Minecraft 下载、实例创建或真实开服任务。截图当前实例数为 0，开服前仍需在页面创建实例并由用户明确同意 EULA；Windows Host ACL、网络及实际 Minecraft 启动仍需目标环境验收。

## LFAA-UI-WORKBENCH-SNAP-03

### 用户目标

让设置中心左侧分类栏、应用工作区左右侧栏和底部终端的拖拽拉伸、吸附收起及按住鼠标反向拉出，统一采用已验证有效的侧栏动效。

本合同扩展 `LFAA-UI-WORKBENCH-SNAP-02` 的范围；仅针对本次面板统一，替代其“底部面板阻尼不变”的限制。

### 当前合同

- 设置中心与应用工作区继续共用 `ResizableWorkbench`；左右栏和底部终端由同一套帧处理及动效参数管理，不复制独立动画路径。
- 所有方向的普通拖动按浏览器帧合并后直接跟随 Pointer，不使用连续阻尼追赶；吸附捕获时使用相同固定目标收起过渡，并立即隐藏被收起区域内容。
- 越过释放迟滞反向拉出时，所有方向使用相同的有界缓动曲线与释放时长，从吸附尺寸连续展开，并在结束时精确衔接最新 Pointer 尺寸；再次吸附、释放 Pointer 或取消拖动时停止 RAF 并清理状态。遵循系统减少动态效果偏好，开启时跳过代码驱动的释放缓动。
- 移除底部终端现有的指数阻尼和与逐帧宽高更新冲突的 CSS 行过渡，避免同一列/行被两套动画同时驱动。
- 显式收起/展开入口、布局持久化和面板职责不变；左右栏和底部终端的开合显隐时序统一。保持现有吸附阈值、释放迟滞、默认尺寸与键盘调整；不改变不具备拖拽吸附能力的独立 UI。

### 右侧菜单栏专项复查补充（2026-09-29）

- 桌面右栏的列宽由工作台 Grid 负责；普通拖拽和吸附后的反向释放期间关闭 Pane 自身过渡，吸附捕获只保留一次 Grid 收拢过渡。紧凑/移动布局下右栏是独立 Overlay，由位移过渡负责显隐。
- 当前 DOM 使用 `.lfaa-workbench`，旧 `.module-workspace` 选择器不参与这段交互。右侧工具内容 `.module-context` 在半透明侧栏开启时带有实时 `backdrop-filter`；宽度逐帧变化会持续重采样背景，增加绘制负担。
- 水平拉伸期间暂时关闭应用左导航 `.module-sidebar` 与右侧工具栏 `.module-context` 的背景模糊，结束后恢复用户偏好；不改 Pane 的吸附阈值、宽度计算或既有过渡。

### 允许修改

- `frontend/src/workbench/ResizableWorkbench.tsx`：合并左右栏与底部面板的 Pointer 帧处理及捕获/释放动效；普通拖动直写，吸附反向展开使用同一有限时缓动。
- `frontend/src/workbench/workbench.css`：令底部终端吸附时的内容显隐与左右侧栏一致，移除重复驱动行尺寸的反向 CSS 过渡；保留现有用户未提交样式变更。
- `frontend/src/styles/workbench.css`：水平拖拽时暂停左右应用侧栏的背景模糊采样，空闲时恢复用户设置。
- `docs/PROMPTS.md`：登记本次范围扩展合同和验证结果。

### 禁止修改

- 不调整吸附捕获阈值、释放迟滞、默认面板尺寸、布局模式、持久化数据、业务面板内容或显式开合控制。
- 不新增 CSS 自定义属性、依赖或第二套拖拽状态；不修改设置页或应用页对共享 `ResizableWorkbench` 的业务接线。
- 不覆盖工作区已有未提交内容，不清理或覆盖 `dist/`、`data/`，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对设置与应用工作区复用同一 Owner，左右与底部拖动共用帧调度和缓动，捕获/释放不会同时触发 JS 与 CSS 尺寸动画；中断、结束和再次吸附不会遗留 RAF。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查、Vite 构建及根目录 `dist/frontend/` 输出；运行本任务相关 `git diff --check`。记录浏览器实拖验收情况。

### 完成记录（2026-09-29）

- `SettingsPage` 与 `ApplicationWorkspace` 已确认共用 `ResizableWorkbench`。左右栏和底部终端现在共用 Pointer 帧合并、吸附阈值解析及相同的有限时反向释放缓动；普通拖动直接跟手。移除了底部终端原有指数阻尼和重复 CSS 行尺寸过渡，并让吸附时的终端内容立即隐藏。显式开合保留原状态入口，显隐节奏与侧栏一致；减少动态效果偏好下跳过 JS 缓动。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物写入根目录 `dist/frontend/`；相关文件 `git diff --check` 通过。
- 未进行浏览器实拖，真实鼠标手感待实机确认。

### 右侧菜单栏专项复查完成记录（2026-09-29）

- 静态核对确认桌面右栏的宽度只由 Grid 轨道控制：普通拖拽与反向释放期间禁用 Pane CSS 过渡，吸附捕获只启用一次 Grid 收拢；紧凑/移动布局的右栏 Overlay 只使用位移显隐。旧 `.module-workspace` 规则不匹配当前 `.lfaa-workbench` DOM，不会叠加驱动。
- 修复右侧 `.module-context` 在水平拉伸时仍实时采样背景模糊的问题；拉伸期间同时暂停左右应用侧栏的 `backdrop-filter`，结束或取消后恢复用户偏好。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物写入根目录 `dist/frontend/`；本次相关文件 `git diff --check` 通过。未进行浏览器实拖，真实鼠标手感待实机确认。

## LFAA-UI-SETUP-REMINDER-PERFORMANCE-01

### 用户目标

修复截图中的“完成首次配置”弹窗出现时严重卡顿的问题，让弹窗打开过程流畅，同时保持提醒判断、按钮语义和主题外观。

### 当前合同

- 首次配置提醒沿用现有账户设置总开关、当天暂停记录、缺失配置检查和按钮行为，不改变服务端数据或通知业务语义。
- 提醒显示状态由独立组件持有，避免仅为打开弹窗而重新渲染整个 `Workbench` 子树。
- 移除提醒遮罩上的全屏实时背景模糊；保留 Ant Design 的主题遮罩和现有弹窗淡入效果。弹窗仍挂载在 `.workbench-shell` 内，以继承主题与减少动态效果设置。
- 不新增设置控件、CSS 自定义属性、依赖、接口或存储字段。现有玻璃模糊设置只控制顶栏与半透明侧栏，不用于弹窗遮罩。
- 完成标准：构建通过、代码差异检查通过；记录是否进行浏览器实测。

### 允许修改

- `frontend/src/components/Workbench.tsx`：移除提醒弹窗的本地状态和重复渲染触发点，挂载独立提醒组件。
- `frontend/src/components/SetupReminder.tsx`：承载提醒检查、弹窗状态和既有按钮行为。
- `frontend/src/styles/workbench.css`：删除提醒遮罩的全屏背景模糊规则，并更新样式文件职责说明。
- `docs/PROMPTS.md`：登记本合同与完成记录。

### 禁止修改

- 不改变首次配置提醒的开关、暂缓规则、检查条件、设置中心配置结构或后端持久化。
- 不更改其他通知、全局动效、应用页面、工作台布局、依赖或构建配置；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对提醒状态由独立组件持有、弹窗保留工作台主题容器且遮罩不再执行全屏 `backdrop-filter`。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建，产物位于根目录 `dist/frontend/`；运行 `git diff --check`。
- 如未进行浏览器实测，明确记录实际限制，不以构建结果代替卡顿体验验收。

### 完成记录（2026-09-29）

- 将首次配置检查和弹窗状态移入 `SetupReminder`，不再因弹窗开关重新渲染整个工作台；检查只在账户、日期、提醒开关或是否位于设置页变化时触发。
- 删除提醒遮罩的全屏实时模糊；继续使用 Ant Design 主题遮罩，并保留工作台已有的减少动态效果规则。首次配置总开关与今日暂停行为未变。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物写入 `dist/frontend/`；`git diff --check` 通过。
- 仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 也没有独立 quality/release Gate；未运行测试或浏览器体验测量，因此实际弹窗帧率仍待浏览器实测。

### 复查记录（2026-09-29）

- 用户反馈改动后弹窗仍卡，当前不将问题标记为已修复。
- 用户允许重启本地服务后，检查到前端 `127.0.0.1:5173` 和服务端 `127.0.0.1:3000` 正在监听；`/api/health` 返回 HTTP 200。独立浏览器能加载当前工作台入口，但处于未登录状态，只显示登录页。
- 独立浏览器控制台未见错误；观察到的 `/api/health` 轮询间隔约 15 秒、单次约 3–6 ms。这些证据不足以解释弹窗明显卡顿，也没有采集到弹窗开合的主线程或帧时数据。
- Codex 无法读取用户原有的 Edge 标签页（`nodeRepl.fetch request failed`），所以尚不能核实已登录页面实际加载版本或复现提醒弹窗。待用户刷新原 Edge 页面并触发提醒后，继续对弹窗开合录制性能数据，再依据数据定位和修改根因。

## LFAA-FILE-MANAGER-RECOVERY-01

### 用户目标

修正截图中的文件管理体验：节点离线时页面看起来像空目录，用户看不到有效恢复入口；让节点状态、可执行操作和恢复方式清楚且可控。

### 当前合同

- 文件任务仍只能由报告 `node-filesystem-v1` 且当前在线的 Daemon 执行；离线时禁止读取、写入和其他文件操作，不增加控制端本地文件回退。
- 保留当前选中节点以供排查；如果节点离线，或正在切换节点，不得把未读取状态/其他节点的缓存列表显示为当前目录。内容区应明确显示节点离线、最近心跳（如有）和恢复步骤，并提供不依赖所选节点在线状态的“刷新节点状态”操作。
- 节点列表刷新中应有可见的忙碌状态，失败时显示实际错误。仍可在下拉框中显式切换到其他在线节点；不因定时刷新静默切换文件系统。
- 真正连接并读取目录后，空目录才显示“此目录为空”；无可选节点与离线节点分别呈现。
- 页面沿用工作台主题、强调色、壁纸遮罩透明度和字体设置映射；不新增设置字段、CSS 自定义属性、API 或持久化状态。

### 允许修改

- `frontend/src/components/FileManagerPage.tsx`：区分节点离线与空目录，提供可手动触发的节点状态刷新及最近心跳/恢复说明。
- `frontend/src/components/FileManagerPage.css`：为节点离线状态提供清晰、响应式且沿用工作台主题令牌的布局样式。
- `docs/PROMPTS.md`：登记本合同与完成记录。

### 禁止修改

- 不改文件任务 API、权限、Daemon 能力、节点连接机制或文件路径安全边界。
- 不允许离线节点执行任务，不增加本地磁盘直连、模拟文件列表、自动切换到另一节点或未请求的新设置。
- 不修改其他应用页面、全局主题/壁纸设置、依赖、构建配置或运行数据；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对：离线节点时文件列表不再显示“此目录为空”；手动刷新节点列表可用并反馈加载/错误；离线文件任务仍被前端禁用且服务端继续执行在线能力校验；在线空目录仍显示原空状态。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 检查与 Vite 构建通过，产物仅写入根目录 `dist/frontend/`；核对本次已跟踪改动的 `git diff --check`。
- 记录是否完成浏览器目视和节点上线恢复交互验收；构建结果不代替真实 Daemon 文件操作验收。

### 完成记录（2026-09-29）

- 离线节点和无可管理节点显示独立状态；离线状态展示节点名与最近心跳，并说明启动目标主机 Daemon、刷新状态或切换在线节点的恢复方式。顶部“刷新节点状态”始终可用，手动刷新显示忙碌状态和请求错误，原有 10 秒在线轮询保留。
- 离线、切换节点或切换文件路径时清除当前列表，避免把缓存或其他节点文件误当作当前目录；真正在线读取后才显示“此目录为空”。打开新建、重命名或编辑窗口期间锁定节点选择；客户端同时检查在线状态，目录导航、搜索、编辑和文件操作控件按节点状态启用。
- 未新增设置字段；页面沿用共享主题/强调色、所选工作区背景与 `appearance.overlay` 透明度、界面字体和字号。文本编辑器继续读取已注入的代码字体与字号映射。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物位于根目录 `dist/frontend/`。`git diff --check -- docs/PROMPTS.md` 和两个文件管理源文件的行尾空白检查通过。
- 仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 没有 `quality:full` 脚本；未运行自动化测试。未进行浏览器目视、节点上线恢复交互或真实 Daemon 文件操作验收。

## LFAA-UI-LEFT-PREVIEW-HOVER-STABILITY-01

### 用户目标

修复应用工作区左侧导航收起后，鼠标移入悬停预览会发生上下抖动的问题。

### 当前合同

- 收起状态下，桌面端左侧导航预览固定在工作区标题栏下方；显隐切换不得改变预览的垂直位置或鼠标命中区域。
- 沿用 `LFAA-UI-SIDEBAR-GLASS-STABILITY-01` 中侧栏背景透明度和模糊效果的设置映射，不对承载毛玻璃效果的外层或侧栏整体做透明度淡入；本合同仅取代其中“保留轻微位移动画”的要求。
- 用户补充要求保留柔和的显示过渡：仅对预览侧栏的直接内容项做短暂透明度过渡；外层位置、命中区域和毛玻璃背景保持稳定。
- 沿用外观设置的“减少动态效果”配置；不新增设置项、自定义 CSS 属性或依赖。
- 不改变预览触发按钮、延迟关闭、侧栏尺寸、拖拽和吸附行为，也不改变侧栏内容及列表项 hover 样式。

### 设置中心配置盘点

- `appearance.overlay` 控制壁纸下侧栏底色透明度；`appearance.sidebarColor` 控制自定义侧栏色调；`appearance.blur` 控制玻璃模糊强度，均经 `Workbench` 现有变量映射应用到预览。
- `appearance.advanced.reducedMotion` 控制减少动态效果，并由工作台 `data-reduced-motion` 与共享 CSS 规则处理。
- 本任务不改变以上配置、默认值、持久化或前端映射；移除位置动画后，显隐仍遵循既有 reduced-motion 规则。

### 允许修改

- `frontend/src/components/module-workbench.css`：固定左侧收起预览位置，保留现有背景与显隐延迟。
- `docs/PROMPTS.md`：登记当前任务合同与完成记录。

### 禁止修改

- 不修改设置中心控件、类型、默认值、服务端校验、持久化或 `Workbench` 设置映射。
- 不改变 React hover 事件、预览尺寸、工作台布局、拖拽/吸附逻辑、列表项反馈或其他未提交改动；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对预览不再含垂直位移变换，仅直接内容项做淡入淡出，玻璃背景设置仍由现有共享变量控制，减少动态效果选择器仍生效。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建结果写入根目录 `dist/frontend/`；运行 `git diff --check`。
- 浏览器中移入预览触发按钮、移入预览面板并移出，确认面板不再上下移动或丢失 hover；如无法访问浏览器，记录具体限制。

### 完成记录（2026-09-29）

- 移除左侧收起预览的 `translateY(-14px)` 与 transform 过渡；预览固定在标题栏下方，通过现有 `visibility` 状态显隐，鼠标命中区域不再随上下移动。
- 按用户补充为预览内直接内容项增加短暂 opacity 过渡；承载玻璃背景的外层与侧栏本身不参与透明度动画，减少动态效果偏好继续统一控制过渡时长。
- 保留外观设置的侧栏颜色、背景遮罩透明度、玻璃模糊与减少动态效果映射；未新增配置项或 CSS 自定义属性。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物写入 `dist/frontend/`；本任务涉及文件 `git diff --check` 通过。
- 未完成浏览器悬停验收：CUA 浏览器清单连续返回 `nodeRepl.fetch request failed`。当前仓库也没有 `scripts/workspace-preflight.mjs`，根 `package.json` 没有额外 quality/release Gate。

## LFAA-MINECRAFT-APPCONTAINER-ENV-01

### 用户目标

修复 Minecraft 实例启动时 Windows AppContainer Sandbox Host 无法创建 Java 子进程的问题。截图对应的失败任务日志显示 `CreateProcessW` 返回 Win32 203。

### 当前合同

- 只修复 Rust Sandbox Host 为 Java 子进程构造 Windows Unicode 环境块的行为；筛出 Daemon 原环境中的 `=X:` 驱动器目录项，并以实例目录覆盖实例所在盘符，随后按 Windows 要求排序和终止环境块。
- 保留现有最小环境变量白名单及 Java/System32 PATH；不得继承 Daemon 的任意进程环境、Daemon Token、模型密钥或其他秘密。
- 保持每实例 AppContainer SID、显式网络能力、实例/Java ACL、低完整性标签、受限句柄、Job Object、启动令牌及 fail-closed 行为不变。任何沙盒启动失败仍须拒绝实例启动，不得回退为普通 Java 进程。
- 诊断证据只读来自截图所示最新 Minecraft 启动任务及其日志；不修改、清理或迁移运行数据。
- 不进行真实 Minecraft 启动或下载；构建产物只能写入根目录 `dist/daemon/`。

### 允许修改

- `daemon/sandbox-host/src/main.rs`、`daemon/sandbox-host/Cargo.toml`：仅筛出系统 `=X:` 当前目录项，覆盖实例所在驱动器，并启用 Windows 环境块读取 API；修正 Unicode 环境块排序和终止处理。
- `docs/PROMPTS.md`：登记本合同和实际验证记录。

### 禁止修改

- 不放宽环境变量、可执行文件、命令参数、路径、AppContainer 能力、ACL 或句柄范围；不继承完整 Daemon 环境。
- 不修改前端、server API、SQLite schema、EULA、任务语义、Java 安装文件或实例数据；不运行真实 Minecraft 下载/创建/启动任务。
- 不部署、发布、上传、提交 Git、改版本号或更新日志。

### 验收方式

- 静态核对 Unicode 环境块包含实例工作目录所在驱动器的当前目录项，变量名按 Windows 大小写不敏感排序，并以双 NUL 正确结束；现有白名单没有扩为任意环境继承。
- 运行 `cargo fmt --manifest-path daemon/sandbox-host/Cargo.toml -- --check` 与 `pnpm --filter lfaa-daemon run build:sandbox`；确认 Cargo 产物位于根目录 `dist/daemon/target/`，不在包目录生成构建目录。
- 运行涉及文件的 `git diff --check`。记录未执行的 Minecraft 实例实机启动验收；编译成功不视为 Windows AppContainer 运行成功。

### 故障证据

- 2026-09-29 最新启动任务失败记录为 `Minecraft AppContainer 在启动确认前退出（退出码 1）`；只读任务日志进一步显示 `CreateProcessW` 错误码 203，消息为系统找不到所输入的环境选项。
- [Microsoft `CreateProcessW` 文档](https://learn.microsoft.com/en-us/windows/win32/api/processthreadsapi/nf-processthreadsapi-createprocessw)说明：传入自定义环境块时，系统驱动器当前目录不会自动传递；需要显式提供相应 `=C:` 形式的目录项，并按大小写不敏感 Unicode 顺序排序。[环境变量文档](https://learn.microsoft.com/en-us/windows/win32/procthread/changing-environment-variables)规定环境项排序和双 NUL 终止；[系统错误码文档](https://learn.microsoft.com/en-us/windows/win32/debug/system-error-codes--0-499-)将 203 定义为 `ERROR_ENVVAR_NOT_FOUND`。
- 当前实现传入最小环境块，但没有任何驱动器当前目录项；代码修复仍须维持清洁环境和现有 AppContainer 安全边界。

### 实现记录（2026-09-29）

- Sandbox Host 只从 Daemon 原环境中保留 `=X:` 驱动器当前目录项，并以实例工作目录覆盖相同盘符；继续只传 `PATH`、`SystemRoot`、`TEMP`、`TMP`、`WINDIR` 和这些驱动器目录项，未继承其他 Daemon 环境。所有项按 Windows 大小写不敏感顺序排序，Unicode 环境块以双 NUL 终止。
- `cargo fmt --manifest-path daemon/sandbox-host/Cargo.toml -- --check` 通过；`pnpm --filter lfaa-daemon run build:sandbox` 通过，Windows x64 release 产物位于 `dist/daemon/target/x86_64-pc-windows-msvc/release/lfaa-sandbox-host.exe`；相关文件 `git diff --check` 通过。
- 未运行 Minecraft/Java 实例启动，故 Win32 203 的真实 AppContainer 恢复效果仍待用户 Windows 实例启动验收。环境块遗漏驱动器当前目录项与 203 同属启动环境问题，属于基于官方 API 说明和实际日志的根因判断，尚无真实启动结果确认。
- `Failed to fetch` 为截图时的控制端连接故障；本轮复查时 `/api/health` 直连及经 Vite 代理均返回 HTTP 200，未在当前服务状态复现，因此没有改动 API 或前端连接代码。

## LFAA-AUTH-PASSKEY-01

### 用户目标

为 LFAA 增加截图所示的可选通行密钥登录引导，让用户可以用 Windows Hello、设备 PIN/生物识别或其他兼容验证器更快登录，同时保留当前密码与恢复密钥登录。

### 当前合同

- 通行密钥使用 W3C WebAuthn 公钥凭据。PIN、生物识别和私钥只由浏览器/验证器处理；LFAA 仅接收验证响应并保存公钥凭据数据，不接收或保存设备 PIN、生物特征或私钥。
- 登录支持 discoverable credential，不要求先输入用户名；成功验证后复用现有服务端会话和 HttpOnly Cookie。密码、恢复密钥、会话期限、角色与权限语义保持现状。
- 设置通行密钥与撤销通行密钥均要求当前密码重新验证。每个账户可有多个凭据；凭据按账户隔离，并记录服务端验证所需的凭据 ID、公钥、签名计数器、传输方式及注册/最近使用时间。
- 注册与登录挑战必须随机、短时有效、一次使用、服务端关联用途和账户；验证必须限制到明确配置的 RP ID 与完整 Origin，并要求用户验证。注册只接受当前登录账户；登录以服务端凭据记录确定账户，不信任客户端提供的账户身份。
- 登录界面只在浏览器支持通行密钥且服务端已有凭据时提供入口；验证失败统一返回认证失败，不泄露用户名、凭据或内部验证细节。加入登录速率限制和通用错误处理。
- 首次登录后可显示可跳过的设置引导；“暂时跳过”仅在当前浏览器会话内记忆。账户安全设置提供凭据列表、添加和撤销。引导、登录和设置界面沿用现有工作台主题及适用外观设置，不新增可绕过安全边界的偏好开关。
- `WEBAUTHN_RP_ID` 与 `WEBAUTHN_ORIGIN` 作为部署配置使用：仅开发模式允许明确的 `localhost` 默认值；生产环境未配置或配置不匹配时，通行密钥功能保持不可用，密码登录继续工作。不得从任意 Host/Origin 请求头动态信任 RP 配置。
- 项目外资料核查范围限于 W3C WebAuthn、Microsoft Windows Hello/HTTPS 官方资料及 SimpleWebAuthn 维护者文档/许可证；不引用第三方教程作为实现依据。已核查的来源：
  - W3C Web Authentication Level 3：<https://www.w3.org/TR/webauthn-3/>
  - Microsoft Windows passkeys：<https://learn.microsoft.com/en-us/windows/security/identity-protection/passkeys/>
  - Microsoft ASP.NET passkeys 与 HTTPS / recovery 指引：<https://learn.microsoft.com/en-us/aspnet/core/security/authentication/passkeys/?view=aspnetcore-10.0>
  - SimpleWebAuthn 服务端及浏览器文档：<https://simplewebauthn.dev/docs/packages/server>、<https://simplewebauthn.dev/docs/packages/browser>
  - SimpleWebAuthn 维护仓库许可证与更新记录：<https://github.com/MasterKale/SimpleWebAuthn/blob/master/LICENSE.md>、<https://github.com/MasterKale/SimpleWebAuthn/blob/master/CHANGELOG.md>
  - 已通过 npm 官方元数据核对：`@simplewebauthn/server@14.0.3`、`@simplewebauthn/browser@14.0.0` 均为 MIT；server 14.0.3 延续 14.0.2 的近期认证安全修复，项目 Node 24 满足维护者公布的 Node LTS 22+ 支持线。

### 设置中心配置盘点

- 账户安全数据不属于外观或普通 `user_settings` 偏好；凭据、挑战和撤销状态由认证领域服务与 SQLite 认证表持有，不通过前端偏好或 localStorage 保存。
- 账户设置分类已有账户列表、当前账户和恢复密钥管理；本功能在此分类增加通行密钥列表、添加和撤销操作，不改变现有偏好默认值、持久化映射或账户权限。
- 登录后引导与账户设置界面沿用 `appearance.theme`、`appearance.accentColor` / 模式文字色、字体与字号、对比度、背景、遮罩透明度、模糊及减少动态效果等现有工作台映射；不新增 CSS 自定义属性或设置字段。

### 允许修改

- `.env.example`、`README.md`：说明 WebAuthn RP ID / Origin 部署设置及本地 localhost 使用约束。
- `server/src/config.ts`：校验并暴露可选 WebAuthn RP ID / Origin 配置，未配置时安全禁用通行密钥。
- `server/src/database.ts`：新增版本 24 凭据与短期一次性挑战的 SQLite 迁移，顺接现有版本 23 SteamCMD 迁移。
- `server/src/modules/auth/service.ts`、`server/src/modules/auth/index.ts`、新文件 `server/src/modules/auth/passkeys.ts`、`server/src/api/routes.ts`：实现密码重新验证、通行密钥注册/登录验证、挑战消费、凭据管理和现有会话签发。
- `server/package.json`、`frontend/package.json`、`pnpm-lock.yaml`：按官方维护者资料引入 WebAuthn server/browser 库；锁定已核查的兼容版本。
- `server/test/database-migrations.test.mjs`：只把当前最新迁移版本断言更新为 24，保留现有测试范围。
- `frontend/src/api.ts`、`frontend/src/App.tsx`、`frontend/src/components/AuthView.tsx`：接入浏览器能力检测、通行密钥登录与账户会话建立。
- `frontend/src/components/SettingsPage.tsx`、`frontend/src/components/Workbench.tsx`、新文件 `frontend/src/components/PasskeyManager.tsx`、`frontend/src/components/PasskeySetupPrompt.tsx`：添加账户安全管理和可跳过的首次引导，并使用现有主题/外观映射。
- `docs/系统总体架构.md`、`docs/开发计划.md`：记录认证边界、数据库版本和当前实机验收状态。
- `docs/PROMPTS.md`：登记当前合同、实际验证记录和完成状态。

### 禁止修改

- 不删除或弱化密码/恢复密钥回退、角色授权、会话撤销、登录速率限制及现有认证错误处理。
- 不将 PIN、指纹/面部数据、私钥、JWT、挑战秘密或凭据私有材料发送到日志、设置偏好、URL 或浏览器持久存储；不从请求 Host/Origin 自动扩展信任域。
- 不启用仅通行密钥登录、不改身份模型、账户初始化流程、普通设置 schema、数据库运行数据或其他认证策略。
- 不通过模拟浏览器成功状态替代真实 Windows Hello 验收；不部署、发布、上传或提交 Git。
- 保留工作树已有的未提交修改；只在当前合同列明的文件内做局部调整，不重置或覆盖其他用户改动。

### 验收方式

- 运行 `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server run build`、`pnpm --filter lfaa-frontend run build`；确认构建产物仅写入根目录 `dist/` 对应包目录。
- 静态检查失败路径均不签发会话；挑战过期、复用、跨账户或错误 Origin/RP ID 均拒绝；成功后只签发现有会话 Cookie；凭据列表与撤销严格限定当前账户；日志中不出现密码、PIN、响应正文、公钥以外的凭据秘密或挑战。
- 更新现有 SQLite 迁移版本断言；运行本合同涉及文件的 `git diff --check`。记录 workspace-preflight/quality Gate 是否存在及是否运行，不以构建代替安全行为验证。
- 记录真实 Windows Hello/浏览器注册、passkey 登录、账户切换和 HTTPS 部署验收情况；未实机完成时明确标记待验。

### 实现与验证记录（2026-09-29）

- 服务端通过显式 RP ID/Origin 配置校验并限制认证请求 Origin；挑战绑定用途、账户与 5 分钟期限，验证前一次性消费。成功认证复用现有会话 Cookie；添加/删除凭据需当前密码；数据库迁移为版本 24，以兼容已存在的版本 23 SteamCMD 迁移。
- 登录页只在当前 Origin 匹配、浏览器支持且服务端存在通行密钥时显示入口；账户页可添加、列出和删除通行密钥；工作台显示可跳过且仅在当前会话记忆的设置引导。界面沿用工作台 Ant Design 主题和外观配置，无新增设置项或 CSS 自定义变量。
- 依赖锁定 `@simplewebauthn/server@14.0.3`、`@simplewebauthn/browser@14.0.0`。W3C、Microsoft 与 SimpleWebAuthn 官方/维护者资料按合同所列链接核查。
- server `typecheck` 与 `build` 均通过，产物写入仓库根 `dist/server/`；frontend `build` 未通过，当前解析错误位于工作区已有的 SteamCMD 配置 JSX（`SettingsPage.tsx`，配置分类片段未闭合）。此前同一构建还报告 SteamCMD 配置拆分中的未使用状态/缺失旧变量及 `SetupReminder.tsx` 使用旧 API 字段。第一次完整 TypeScript 检查未报告通行密钥文件错误；当前语法错误使前端完整类型检查无法完成。未改写这些现存 SteamCMD 改动。
- 数据库迁移文件中已有的最新版本断言已从 23 更新为 24；`git diff --check` 通过。当前仓库没有 `scripts/workspace-preflight.mjs`，根 `package.json` 也没有 workspace-preflight 或 quality 脚本，因此对应 Gate 未运行。未运行自动化测试。
- Windows Hello、真实浏览器 Passkey 注册/登录、账户切换及生产 HTTPS 验收未执行，须保留为待验。

## LFAA-PORTABLE-DATA-ISOLATION-01

### 用户目标

同一份 LFAA 源码放在 U 盘等可移动盘上，在不同电脑运行时，各电脑使用独立的数据、数据库、凭据和 Daemon 节点身份，避免后启动电脑覆盖或抢占另一台电脑的节点状态。

### 当前合同

- 仅当 `LFAA_DATA_DIR` 未配置或仍为默认相对路径 `data`，且 Windows 仓库所在卷识别为 `Removable` 时，默认数据目录使用当前 Windows 用户 `%USERPROFILE%\.LFAA\data`。
- 固定磁盘和非 Windows 环境继续默认使用仓库根目录 `data/`；自定义绝对路径或其他相对路径遵循现有语义。可移动盘检测失败时必须报错，不得静默回退到 U 盘共享目录。
- Windows 卷检测脚本通过 Windows PowerShell 5.1 的 `-File` 启动时必须能正确解析；含中文内容的 `.ps1` 文件须使用 Windows PowerShell 5.1 可识别的编码，避免编码解析失败被误报为磁盘检测失败。
- server、Daemon、`scripts/start-dev.ps1` 对默认目录的解析必须一致；Daemon 锁文件也必须定位到同一实际数据根目录。
- 不自动复制、删除、迁移或修改 U 盘现有 `data/`；通过 `LFAA_DATA_DIR` 显式配置的共享目录语义保持不变。
- 设置中心只管理应用内目录；本任务不新增账户设置或 UI 配置，不改变设置中心已有数据。

### 允许修改

- `scripts/resolve-data-directory.mjs`、`scripts/resolve-data-directory.d.mts` 与其 Windows 卷识别脚本：实现可测试的数据根目录解析和 Removable 检测。
- 针对 Windows PowerShell 5.1 编码错误的局部修复仅调整 `scripts/get-project-drive-type.ps1` 的文件编码，不改卷检测逻辑。
- `server/src/config.ts`、`daemon/src/task-runner/minecraft-daemon.mjs`、`scripts/start-dev.ps1`：共用该解析结果。
- `server/test/data-directory.test.mjs`：验证默认、移动盘、显式覆盖和检测失败行为。
- `.env.example`、`README.md`、`docs/系统总体架构.md`、本文件：说明新默认规则与不迁移边界。

### 禁止修改

- 不触碰现有 `data/` 内容、SQLite 数据、节点凭据、Minecraft 实例、Java 安装或备份；不在两台设备间复制或迁移数据。
- 不改变数据库 schema、节点注册/心跳协议、Minecraft 任务语义、设置中心账户设置或用户偏好。
- 不扩大为自动漫游、云同步、备份恢复、数据目录选择 UI 或发布安装器改造。
- 不部署、发布、上传、提交 Git、改版本号或更新日志；不运行真实 Minecraft 任务。

### 验收方式

- 测试固定盘仍解析到仓库 `data/`，可移动盘默认解析到注入的用户主目录，绝对和自定义相对覆盖保持原义，无法检测的移动盘不会回退到共享路径。
- 静态核对 server、Daemon 和 Windows 启动脚本都把解析结果用于数据库/节点数据/Daemon 锁路径。
- 使用 Windows PowerShell 5.1 的实际 `-File` 调用验证卷检测脚本可解析并返回卷类型；确认 Node 数据目录解析器能据此在当前可移动盘解析到本机用户主目录。
- 运行新数据目录单元测试、server build/typecheck、Daemon 脚本语法检查和涉及文件 `git diff --check`；按需要验证 Windows Sandbox Host 构建仍通过。
- 不以本机模拟检测代替两台 Windows 电脑的实际隔离验收；最终记录实际未覆盖的双机验证。

### 故障修复记录（2026-09-29）

- 选项 2 的启动预检调用 `scripts/resolve-data-directory.mjs`。本机 `H:` 被识别为 `Removable`，且 `LFAA_DATA_DIR` 未设置，因此解析器按既定隔离策略调用卷检测脚本；这与 SQLite 数据库无关。
- 根因是 `scripts/get-project-drive-type.ps1` 含中文且为 UTF-8 无 BOM，但启动器使用 Windows PowerShell 5.1 的 `-File` 读取它，导致 PowerShell 解析阶段报错。Node 解析器捕获该失败并显示通用的“无法检测卷类型”错误。
- 为该 PowerShell 脚本添加 UTF-8 BOM；未改卷类型检测逻辑、数据目录策略、数据库 schema 或任何运行数据。
- Windows PowerShell 5.1 `-File` 实际调用返回 `Removable`；Node 解析器原先返回 `%LOCALAPPDATA%\.LFAA\data`，后按用户要求调整为 `%USERPROFILE%\.LFAA\data`；`node --check scripts/resolve-data-directory.mjs` 与相关文件 `git diff --check` 通过。
- 未运行自动化测试或启动三个服务；未完成另一台 Windows 电脑的双机数据隔离验收。

### 用户指定数据路径调整（2026-09-29）

- 按用户要求将可移动盘默认位置从 `%LOCALAPPDATA%\.LFAA\data` 改到 `%USERPROFILE%\.LFAA\data`；当前 H: 的实际解析结果为 `C:\Users\yu\.LFAA\data`。
- 路径调整后 `node --test server/test/data-directory.test.mjs` 通过（6/6），`pnpm --filter lfaa-daemon run build`、Daemon 语法检查、PowerShell 解析及 `git diff --check` 通过。
- 当前 server 构建遇到 `server/src/modules/auth/passkeys.ts:142` 的 TS2352 类型错误；该文件是本次路径调整前出现的未跟踪文件，与数据目录解析无关，本次未修改。

## LFAA-STEAMCMD-CONFIG-INSTALL-01

### 用户目标

修正设置中心把 SteamCMD 专项配置称作“存储配置”并与 Steam/Minecraft 存储目录共用编辑范围的问题；让管理员能清楚地选择 SteamCMD 配置、存储范围和实际安装目标，并可从全局默认配置页启动在线安装。

### 已确认的边界

- SteamCMD 安装模式、SteamCMD 工具目录属于 SteamCMD 专项配置；Steam 游戏目录与 Minecraft 实例根目录属于存储配置，分别编辑、分别保存、分别选择配置范围。
- 在线安装必须独立选择目标 Daemon 节点，不由当前正在编辑的全局默认/节点覆盖范围隐式决定。
- SteamCMD 工具目录和 Steam 游戏目录仍是目标节点 `LFAA_DATA_DIR` 内的安全相对路径；不开放任意绝对路径，不改变节点文件访问安全边界。
- 任务仍由 server 创建并派发，实际下载、解压和首次启动仍由具备条件的在线 Windows x64 Daemon 执行；页面必须明确显示无可用节点、节点离线或能力不足的原因。

### 当前合同

- 设置中心将 SteamCMD 安装方式和工具目录放进独立的“SteamCMD 配置”分类；Steam 游戏目录、Minecraft 实例根目录和未接入的写作目录归“项目与存储”。AI Provider 入口继续由“AI 与模型”拥有。
- SteamCMD 专项配置和 Steam 游戏存储使用不同的全局默认/节点覆盖状态。SQLite 迁移必须保留现有 SteamCMD 安装模式、工具目录和游戏目录值，不移动节点数据文件，不重置用户偏好。
- 在线安装/校验目标节点使用独立选择器。提交任务时按目标节点已保存且生效的配置创建 payload；若当前修改的是相同节点配置，可先保存该配置。无可运行节点时显示明确原因并禁用操作。
- daemon 心跳仍接收合并后的有效 SteamCMD 设置；SteamCMD 安装任务协议、路径校验和 30 秒任务租约保持兼容。
- 不新增账户偏好或外观设置项。继续使用管理员授权、现有工作台主题与减少动态效果偏好；不新增 CSS 自定义属性或依赖。
- 完成标准：配置表单、存储表单和安装目标互不串改；从全局默认配置选择在线节点后可以提交安装/校验任务；数据库升级保留旧值；无在线 Windows x64 Daemon 时页面给出准确提示；构建、迁移检查和差异检查通过，并说明是否完成真实 Daemon 安装验收。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`、`frontend/src/api.ts`：拆分 SteamCMD 专项配置/存储页面与范围状态，增加独立安装目标选择。
- `server/src/database.ts`、`server/src/modules/games/steamcmd/service.ts`、`server/src/api/routes.ts`：把安装配置与 Steam 游戏默认目录分开持久化/保存，并为 Daemon/任务提供合并后的有效设置。
- `server/test/`：验证旧 SQLite SteamCMD 配置无损迁移及配置/存储范围隔离。
- `docs/PROMPTS.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：登记本合同并同步配置 Owner、持久化与当前 SteamCMD 安装状态。

### 禁止修改

- 不改变 Minecraft 实例目录、SteamCMD 工具或 Steam 游戏目录相对于目标节点 `LFAA_DATA_DIR` 的安全边界；不移动现存文件。
- 不绕过管理员授权、节点能力条件、任务队列或 Daemon 校验；不让浏览器直接下载/运行 SteamCMD。
- 不启动或提交真实 SteamCMD 安装任务，不下载 SteamCMD，不修改用户运行数据或节点任务队列。
- 不扩展到 Steam 游戏服务器部署 Runner、实例生命周期、AI 工具、Linux Daemon 或发布流程。
- 不改动与本任务无关的工作区未提交文件，不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对设置导航、设置页状态、REST 保存路径、数据库独立默认/节点覆盖与心跳合并结果；检查全局默认配置可独立发起目标节点任务。
- 使用隔离临时 SQLite 数据验证从当前版本 22 升级后安装配置和 Steam 游戏目录分别保留默认值与节点覆盖值；不触碰当前 `data/`。
- 运行 server typecheck/build、frontend build、daemon 脚本语法检查和相关迁移测试；构建产物只写入根目录 `dist/`。
- 运行 `git diff --check` 并核对本任务变更文件；不把静态构建视为真实 Valve CDN 下载或 Windows Daemon 安装验收。

### 完整实现验证补记（2026-09-29）

- 新增解析器与 server/Daemon 接入后，Windows 可移动盘默认路径跟随项目根目录 `data/`；Windows 固定盘默认使用 `%USERPROFILE%\.lfaa\data`，非 Windows 开发跟随项目根目录。server、Daemon 与启动器共用规则；启动器在检查旧 Daemon 锁之前先注入已解析绝对路径，单独启动前端不做卷检测。
- `node --test server/test/data-directory.test.mjs` 通过（6/6）；`pnpm --filter lfaa-server run build` 通过；`pnpm --filter lfaa-daemon run build` 通过，Sandbox Host 构建输出位于根目录 `dist/daemon/target/`；Daemon 语法检查、PowerShell 5.1 脚本解析、当前卷检测、本机路径解析和 `git diff --check` 均通过。当前可移动盘项目实际解析到项目根目录 `data/`。
- `pnpm --filter lfaa-server run test` 共 12 项，8 项通过、4 项失败。3 项数据库迁移测试分别因迁移夹具缺少 `ai_accounts` 表或 `updated_at` 列失败；1 项实时心跳测试因 SQLite 参数 6 无法绑定失败。这些测试、数据库和心跳实现文件在本任务前已有未提交修改；本任务未修改它们或放宽断言。
- 当前项目根目录的可移动盘 `data/` 保留为唯一活动数据根；SQLite 从版本 25 正常迁移到版本 26，daemon 心跳确认使用该根目录。旧用户 Home 下的项目 `data/` 与当前库有同名账户但账户 ID、节点 ID 不同，AI 密钥加密所用的密钥文件也不同，因此未拼表；旧副本已单独归档，Home 下其他配置、状态、插件和运行时目录保持原样。未在第二台电脑启动本项目，也未运行 Minecraft 实例；双机首次启动后数据库和节点隔离、AppContainer 实际启动仍待实机验收。

## LFAA-UI-WRITING-AI-CENTER-01

### 用户目标

让写作 AI Work 的中间空状态沿用其他应用 AI Work 的共享聊天画布排版，同时遵循设置中心“外观”中适用于该区域的配置。

### 当前合同

- 写作 AI Work 继续复用 `ApplicationWorkspace`、`AiWorkChat` 和共享 `.module-center__content--ai-work`；不新增第二套聊天区、路由、会话状态或业务逻辑。
- 写作欢迎标题、说明和示例问题保留其业务文案；空状态宽度、间距和示例问题列表样式沿用共享 AI Work 版式，不使用写作专属的多行胶囊按钮布局。
- 写作工作区继续读取 `appearance.backgrounds.writing`、主题、强调色、界面/内容字体与字号、背景遮罩、模糊、对比度及减少动态效果等现有设置；不新增设置项、CSS 自定义属性或硬编码主题色。
- 外观页“玻璃模糊”说明应包含当前实际受其控制的 AI Work 输入区和写作上下文卡片；消息画布保持透明，不作为独立模糊表面。
- 不改变消息、输入、Provider、会话、提示词内容、右侧写作上下文、左侧导航、路由或服务端行为。
- 完成标准：静态核对写作空状态复用共享聊天布局和设置令牌；前端 TypeScript 检查及 Vite 构建通过，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。浏览器实际外观切换结果单独记录。

### 允许修改

- `frontend/src/components/ai-work-chat.css`：让写作空状态的说明和示例问题沿用共享 AI Work 排版，并保留外观令牌适配。
- `frontend/src/components/SettingsPage.tsx`：准确说明玻璃模糊设置覆盖的实际 UI 区域。
- `docs/PROMPTS.md`：登记本任务合同并记录完成与验证结果。

### 禁止修改

- 不新增聊天实现、依赖、图片、CSS 自定义属性或设置项；不移除写作专属欢迎文案和提示内容。
- 不修改写作右侧上下文栏、会话导航、AI 服务/API、账户设置值和持久化行为。
- 不部署、发布、上传或提交 Git。

### 完成记录（2026-09-29）

- 写作空状态保留原有标题、说明、图标和示例问题文案；宽度、留白、建议列表和按钮改为沿用其他 AI Work 共用样式，避免写作专属宽幅胶囊布局。
- AI Work 字体、字号、强调色、主题、写作工作区壁纸、遮罩透明度、模糊强度及对比度继续读取现有设置中心配置；未新增设置项或 CSS 自定义属性。外观页的玻璃模糊说明已覆盖聊天画布、输入区、导航栏及写作上下文作品卡片。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。仓库未提供 `workspace-preflight` 脚本或 `quality:full` 命令。
- 当前 CUA 浏览器打开本地路由后停留在登录页，且未提供已有登录标签页；未登录或修改账户外观偏好。设置效果依据源代码映射完成静态核对，登录后的真实主题/壁纸切换目视验收待做。

## LFAA-APP-SETTINGS-SCOPE-01

### 用户目标

保持设置中心现有导航、页面结构和视觉布局，将共用账户偏好与 SteamCMD、Minecraft、写作三种 App 的业务配置按实际 Owner 区分；App 配置分别控制自己的需求，互不串改。

### 当前合同

- 不调整设置中心导航分类、总体页面结构、尺寸、间距、样式或现有分类内容位置；在现有 Minecraft 存储分组中复用 `SettingRow` 提供独立范围控制，并拆分现有编辑范围状态。
- 共用的常规、通知、外观、快捷键、AI Runtime、权限和插件偏好继续由 `user_settings` 按账户保存，并继续供共用工作台或跨 App 能力读取；不复制成每个 App 各一份。
- SteamCMD 安装方式/工具目录、Steam 游戏目录和 Minecraft 实例根目录保留各自业务 API 与持久化 Owner；SteamCMD 配置范围、Steam 游戏存储范围、Minecraft 存储范围和实际 SteamCMD 任务目标互相独立。
- 不改服务端数据格式、默认值、已有数据库数据或用户偏好；现有默认/节点覆盖 API 继续作为持久化依据。
- 当前写作 App 没有已接入的专属偏好项；作品、章节和编辑状态按账户保存，预留的作品路径目前仅作说明。未得到具体写作设置需求前，不新增空配置对象、虚构选项或未接入的控制。
- 不新增 CSS 自定义属性或依赖，不改设置中心现有外观、主题和动效配置。
- 完成标准：切换 Steam 游戏存储范围只更改 Steam 配置草稿；切换 Minecraft 存储范围只更改 Minecraft 配置草稿；保存到各自现有 API 后互不覆盖；保留共享账户偏好和当前 UI 布局。

### 允许修改

- `frontend/src/components/SettingsPage.tsx`：为 Steam 游戏存储与 Minecraft 实例存储分别维护独立的节点范围及草稿状态，继续调用各自现有保存接口。
- `docs/系统总体架构.md`：记录共用账户偏好、App 业务配置和当前写作配置接入状态的 Owner 边界。
- `docs/PROMPTS.md`：登记本合同并记录实际实现与验证结果。

### 禁止修改

- 不调整或重排设置中心导航、分组、页面布局、样式、配色、间距、字号或控件风格；不新增应用设置分类页面。
- 不拆分/迁移现有 `user_settings` 类别，不改变设置 API、数据库 schema、默认值和 SQLite 用户数据。
- 不把 SteamCMD、Minecraft 或写作的业务数据塞进共用账户偏好；不把共用外观、通知、权限等设置复制为 App 配置。
- 不新增写作设置字段、AI 写作行为、作品目录读写或未接入的功能。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对三种 App ID、共享用户设置类别、SteamCMD 配置/存储 API、Minecraft 存储 API 与写作 Owner；确认前端状态和保存函数分别使用各自的范围 ID。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建成功且产物写入仓库根目录 `dist/frontend/`。
- 运行 `git diff --check` 并核对本任务触碰文件；登录后在浏览器分别切换 Steam 与 Minecraft 节点范围的实操验收单独记录。

### 实现与验证记录（2026-09-29）

- 共用账户偏好和三种 App 的配置 Owner 已按现状记录到系统架构文档；常规、通知、外观、快捷键、AI Runtime、权限与插件仍由账户设置保存。SteamCMD 安装/存储与 Minecraft 实例目录继续走各自既有服务端 API 和持久化默认/节点覆盖值。
- 设置页为 Steam 游戏存储和 Minecraft 实例存储分别维护范围节点 ID 与草稿状态；切换 Steam 范围不再改写 Minecraft 草稿，Minecraft 保存使用自己的节点 ID 和节点列表。没有改 API、数据库、默认值或用户数据，也没有重排导航、页面结构或样式。
- 按用户确认，本次未新增写作偏好项；写作作品路径继续显示为未接入说明，不创建目录或启用文件读写。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。仓库中未找到 `workspace-preflight`、`quality` 或 `release` 脚本入口，因此未运行这些 Gate。
- 未登录浏览器进行节点范围切换；实际交互验收待做。本次未运行自动化测试。

## LFAA-UI-WRITING-SIDEBAR-01

### 用户目标

解决写作常规模式左侧同时出现全局导航栏、应用栏和作品/章节目录三列导航的问题。将作品与章节目录放入应用侧栏中应用切换说明下方的空白区域，正文编辑区不再常驻保留独立导航列。

### 当前合同

- 仅调整写作 App 常规模式的导航呈现；作品列表、章节列表、新建/选择/删除/重命名操作、自动保存状态及修订历史继续由现有写作工作区和 API 处理。
- 在写作常规模式的应用侧栏空白区域直接显示现有作品/章节列表，允许继续进行既有选择和创建操作；不在最窄的全局图标轨增加重复入口。
- 写作正文编辑区域改为单列，不再保留常驻的“作品目录”列；不改变应用侧栏、右侧作品信息/AI 上下文、工作台其他面板及其他 App 布局。
- 目录面板继续使用现有主题、表面、侧栏背景色、强调色、字体、字号、遮罩/模糊和减少动态效果令牌；不新增 CSS 自定义属性、设置项、默认值、依赖、服务端接口或数据字段。
- 目录面板需保留语义标签、键盘焦点可见性、窄屏可用性；目录操作不能丢失或改变既有保存状态。
- 完成标准：静态核对红框导航已移入写作应用侧栏空白区域且不再作为编辑页常驻列，其他 App 不显示该面板，现有作品/章节控制仍连接原有处理函数；前端构建和 `git diff --check` 通过。

### 允许修改

- `frontend/src/components/ApplicationWorkspace.tsx`：仅在写作常规模式的应用侧栏空白区域提供目录挂载点。
- `frontend/src/apps/writing/normal/WritingWorkspace.tsx`：将现有作品/章节导航内容挂载到应用侧栏，保持现有业务操作。
- `frontend/src/apps/writing/normal/WritingWorkspace.css`、`frontend/src/components/module-workbench.css`：将编辑区改为单列并让目录面板填充应用侧栏空白区域，复用现有视觉令牌。
- `docs/PROMPTS.md`：登记本任务合同并记录实际实现与验证结果。

### 禁止修改

- 不调整全局栏、应用侧栏、右侧栏或工作台的总体布局、宽度、次序及其他 App 的导航。
- 不新增写作配置选项、作品路径读写能力、后端逻辑、数据库变更、快捷键或依赖。
- 不改变作品/章节业务状态、API、自动保存、修订和账户数据；不改设置中心布局或设置值。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对目录挂载点只在写作常规模式的应用侧栏显示，目录内容通过现有写作业务处理函数运行，编辑区为单列布局且面板消费现有外观令牌。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建通过并且产物位于仓库根目录 `dist/frontend/`。
- 运行 `git diff --check` 并核对本任务触碰文件；登录后选择作品和章节及窄屏交互待浏览器验收。

### 实现与验证记录（2026-09-29）

- 作品/章节列表通过 React Portal 填入写作常规模式应用侧栏中应用切换说明下方的空白区域，复用原有选择、新建、删除、重命名和自动保存逻辑；不向最窄的全局图标轨增加重复入口。正文区改为单列，其他应用和 AI Work 不显示该面板。
- 面板沿用既有主题表面、侧栏颜色、强调色、边框、阴影、字体与字号映射；壁纸遮罩透明度和玻璃模糊继续由原有作品目录样式读取。没有新增 CSS 自定义属性、设置项、API、数据字段或依赖。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查与 Vite 构建成功，产物写入 `dist/frontend/`；`git diff --check` 通过。仓库没有 `scripts/workspace-preflight.mjs` 或 `quality:full` 脚本入口。
- 当前本地页面浏览器核查未完成：Computer Use 浏览器发现返回 `nodeRepl.fetch request failed`，没有打开或操作页面；展开/关闭、作品/章节选择和窄屏交互仍待目视验收。本次未运行自动化测试。

## LFAA-UI-AI-WORK-CANVAS-BACKGROUND-01

### 用户目标

修正带壁纸时 AI Work 中间消息画布被单独加深和模糊的问题，使中间区与工作台其他区域共享 `.workbench-shell` 绘制的同一张完整壁纸和全局遮罩。

### 当前合同

- `.workbench-shell` 继续作为工作区壁纸与全局遮罩的唯一绘制 Owner；AI Work 消息画布保持透明，不再叠加整面主题底色或 `backdrop-filter`。
- AI Work 继续消费当前应用工作区壁纸、主题及共享文字/字体令牌；`appearance.overlay` 继续控制外壳壁纸遮罩和既有独立表面透明度，`appearance.blur` 继续控制顶栏、导航、输入框及写作上下文卡等实际玻璃表面。
- 欢迎标记、示例按钮、消息气泡和输入框等离散控件保留各自的可读表面；不把局部遮罩扩大到整个消息视口。
- 只修正中间消息画布的局部覆盖并更新外观说明；不改变设置项、默认值、账户设置持久化、会话/消息、应用路由或工作台布局。
- 完成标准：静态确认消息画布无整面背景色与模糊，工作台外壳仍绘制背景，输入框等独立表面仍使用共享外观令牌；`pnpm --filter lfaa-frontend run build` 通过，产物位于根目录 `dist/frontend/`，`git diff --check` 通过。登录后真实壁纸和玻璃强度切换单独记录。

### 允许修改

- `frontend/src/components/ai-work-chat.css`：移除消息画布整面遮罩与模糊，并让保留的小型写作控件注释准确描述作用范围。
- `frontend/src/components/SettingsPage.tsx`：准确说明背景遮罩和玻璃模糊的实际覆盖范围。
- `docs/系统总体架构.md`：明确 AI Work 消息画布透出工作台统一壁纸，不额外叠加整面遮罩或模糊。
- `docs/PROMPTS.md`：登记本合同并记录完成与验证结果。

### 禁止修改

- 不增加设置项、CSS 自定义属性、依赖、壁纸资源或新的画布/聊天实现；不写死或重置账户外观偏好。
- 不修改全局背景 Owner、侧栏/右栏布局、聊天语义卡片、消息逻辑、API 或服务端设置存储。
- 不部署、发布、上传或提交 Git。

### 完成记录（2026-09-29）

- 移除了 `.ai-work-chat__messages` 整面主题底色与 `backdrop-filter`；消息画布现在透出 `.workbench-shell` 统一绘制的壁纸和遮罩。欢迎标记、写作示例按钮、消息气泡、顶部栏、导航、输入框及写作上下文卡仍按各自用途保留表面。
- 设置页已说明 `appearance.overlay` 控制工作区整张壁纸及既有独立表面透明度，消息画布不另加局部遮罩；`appearance.blur` 的说明排除消息画布。当前应用壁纸继续按 `appearance.backgrounds` 选择；主题与文字令牌沿用共享映射。前端与 server 默认值仍为遮罩 37%、模糊 14px；未改设置 schema、持久化或账户偏好。
- 静态核对确认消息画布无独立背景色/模糊声明，工作台外壳仍绘制统一壁纸，输入框仍读取 `--settings-glass-blur`，工作台仍映射背景、遮罩和模糊设置。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建成功，产物写入根目录 `dist/frontend/`；本任务文件 `git diff --check` 通过。
- CUA 未能读取当前浏览器状态，登录后真实壁纸与模糊效果目视验收待做；本次未登录或修改账户设置。

## LFAA-WRITING-VOLUME-GROUPING-01

### 用户目标

在写作常规模式现有的左侧作品目录中，按“作品 → 卷 → 章节”组织内容，支持新建卷，并能在指定卷中新建章节。

### 当前合同

- 只扩展现有写作目录的数据与交互；复用账户隔离的 SQLite 写作服务、API 和当前目录挂载点。
- 新增账户作品下的卷数据。新建作品默认生成“第一卷”；版本 27 的已有作品在版本 28 迁移中各生成一个“第一卷”，其原章节全部归入该卷，章节 ID、标题、正文、修订历史和当前编辑位置保持不变。
- 写作工作区返回当前作品的卷列表；章节带所属卷 ID。用户能新建卷，并在某卷下新建章节；章节仍由原章节服务负责选择、自动保存、删除、修订与恢复。已有章节创建接口保持可用，未传卷 ID 时归入该作品第一卷。
- 卷标题由服务端校验并持久化，作品归属由服务端账户校验；不得只在浏览器维护分组或跨账户接受卷 ID。
- 仅在现有左侧作品目录内补充“卷”标题、卷条目及新增控件，沿用既有主题、强调色、字体、字号、背景遮罩、模糊和减少动态效果映射。不新增外观设置或 CSS 自定义属性。
- 严格保持页面总体布局和现有区域位置：不重排或改宽全局栏、应用侧栏、正文编辑区、顶部当前章节工具栏及右侧作品信息栏；不调整其他 App。
- 本阶段不做卷重命名、删除、拖拽排序、章节跨卷移动、导入导出、写作偏好设置或文件路径读写。
- 完成标准：v27 到 v28 的数据迁移不丢失既有写作数据；服务端和前端类型/构建检查通过；目录控件连接真实服务/API；`git diff --check` 通过。

### 允许修改

- `server/src/database.ts`：新增 v28 卷表、章节外键字段、索引和非破坏性旧数据归卷迁移。
- `server/src/modules/writing/service.ts`：维护账户卷、卷查询和卷内章节创建。
- `server/src/api/routes.ts`：校验并接入新建卷及带卷 ID 的章节创建请求，保留旧章节请求兼容。
- `server/test/database-migrations.test.mjs`：覆盖 v27 既有作品/章节/修订/编辑位置迁移及重复启动不重复建卷。
- `frontend/src/api.ts`：同步卷与章节关联类型和创建 API。
- `frontend/src/apps/writing/normal/WritingWorkspace.tsx`、`frontend/src/apps/writing/normal/WritingWorkspace.css`：在当前目录中显示卷分组并提供对应新增操作，复用现有令牌。
- `docs/开发计划.md`、`docs/系统总体架构.md`：同步写作数据模型、Owner 和当前进度。
- `docs/PROMPTS.md`：维护本任务合同、索引与完成记录。

### 禁止修改

- 不改变页面布局、区域宽度/顺序、顶部工具栏、右侧信息栏或其他应用样式。
- 不删改现有作品或章节正文/修订，不更换作品、章节、自动保存、AI Work 上下文的 Owner。
- 不新增写作专属设置、文件读写、卷删除/改名/排序、章节移动、依赖或虚构入口。
- 不重置用户数据库，不部署、发布、上传或提交 Git。

### 验收方式

- 使用临时数据库验证 v27 → v28 后旧作品、章节正文、修订和最近编辑位置仍在，章节指向其新建的“第一卷”，外键检查通过；重复启动不会重复创建卷。
- 运行 `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server test -- test/database-migrations.test.mjs`、`pnpm --filter lfaa-frontend run build` 和 `git diff --check`，核对构建产物位于根目录 `dist/`。
- 静态核对新建卷/卷内新建章节调用真实 API，布局区域未改变；浏览器登录交互单独记录。

### 实现与验证记录

- 新增数据库版本 28 的账户作品卷表和章节 `volume_id`；既有作品各生成“第一卷”，原章节改为关联该卷，章节正文、修订和编辑位置保持原值。新建作品也会创建默认“第一卷”。
- 写作服务与账户认证 API 已支持新建卷和在指定卷下创建章节；旧章节创建请求不传卷 ID 时仍归入该作品的第一卷。服务端校验卷属于请求作品及当前账户。
- 左侧现有作品目录现在按作品、卷、章节显示；“卷”标题提供新建卷入口，每卷提供新建章节入口。仅调整目录内部层级，页面整体布局、顶部工具栏、右侧信息栏和其他 App 未改。
- 目录继续读取既有主题、侧栏颜色、强调色、界面字体/字号、壁纸遮罩与模糊映射；未增加写作专属设置、CSS 自定义属性或硬编码颜色。
- `pnpm --filter lfaa-server run typecheck` 通过；v27→v28 专项迁移测试通过，确认正文、修订、当前章节、卷外键、重复启动和整本作品级联删除。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查通过，构建产物位于根目录 `dist/frontend/`；`git diff --check` 通过。
- 完整 `database-migrations.test.mjs` 还存在历史 v8/v10/v22 夹具未包含当前旧迁移要求的表/列问题（例如 `ai_accounts`、`ai_messages`、任务 `updated_at`），这些测试在到达版本 28 前失败；本次新加的 v27 专项用例单独通过。浏览器登录交互未运行。
- 当前仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 `release` 脚本入口，因此这些 Gate 未运行。

## LFAA-UI-APP-CENTER-NAV-01

### 用户目标

将应用中心入口放到左一，使用户从应用中心进入或切换 SteamCMD、Minecraft、写作 App；左二不再占用空间展示不能直接切换的应用列表。

### 当前合同

- 左一指最窄的全局导航轨；左二指当前 App 的应用侧栏；中间与右侧分别保持当前工作区内容和上下文面板。
- 应用工作区左一增加“应用中心”直达按钮，调用现有 `onApplicationsHome` 回调进入 `/`；现有“返回当前模式首页”的房子按钮语义保持不变。
- 左二移除冗余的“应用中心”行、不可切换的全 App 列表、该列表的搜索入口/状态及说明文字。左二仍保留当前 App 的业务导航、写作作品目录、通知和侧栏控制。
- 应用之间的切换只通过应用中心已有入口完成；不在左一增加各 App 独立切换按钮，不修改应用路由、快捷键、应用状态或服务/API。
- 不改变左一/左二/中间/右侧宽度、顺序、收起行为或主题；新入口沿用全局导航按钮样式与当前主题令牌。不新增设置或 CSS 自定义属性。
- 设置中心与文件页继续复用全局导航轨，但只在应用工作区显示应用中心快捷按钮；其现有返回行为和更多入口保持可用。

### 允许修改

- `frontend/src/components/GlobalNavigationRail.tsx`：在应用工作区左一增加应用中心入口。
- `frontend/src/components/ApplicationWorkspace.tsx`：移除左二无效应用列表和专属搜索状态，保留当前 App 业务菜单。
- `frontend/src/components/module-workbench.css`：清理仅服务于被移除应用列表/搜索的样式。
- `docs/系统总体架构.md`：说明应用切换入口归应用中心、左一可直接返回应用中心、左二承载当前 App 导航。
- `docs/PROMPTS.md`：登记和记录本任务合同、边界及验证。

### 禁止修改

- 不增加左一的 App 快捷切换按钮，不改变当前模式首页与应用中心的不同路由语义。
- 不移动或重排左二业务菜单，不改变中间、右侧、任何栏宽、拉伸/吸附交互或应用工作区默认布局。
- 不改应用中心已有 App 入口、应用权限/状态、数据、设置、API 或快捷键；不新增依赖、配置项或 CSS 自定义属性。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对左一应用工作区按钮执行 `onApplicationsHome`，设置页/文件页不显示该按钮，左一原房子仍调用 `onHome`。
- 静态核对左二不再渲染应用切换列表与应用搜索，当前 App 菜单和写作目录条件仍保留；中间、右侧和面板尺寸计算无改动。
- 运行 `pnpm --filter lfaa-frontend run build` 和 `git diff --check`，并确认构建产物位于仓库根目录 `dist/frontend/`。真实登录后点击和浏览器视觉检查另行记录。

### 实现与验证记录（2026-09-29）

- 左一在应用工作区增加网格图标“应用中心”按钮，直接调用已有 `onApplicationsHome`（当前路由进入 `/`）；房子按钮继续调用 `onHome` 返回当前 App 与当前模式首页。设置页和文件页不显示新增按钮。
- 左二移除了不可切换 App 列表、列表搜索、提示文字和重复的应用中心行；保留通知、收起控制、Minecraft 菜单、写作作品目录、AI Work 会话及当前模式切换。
- 中间、右侧和工作台各栏宽度、顺序及拉伸状态未改。新增入口复用现有导航按钮样式和主题令牌；未触及设置中心配置，也未新增 CSS 变量或依赖。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。本次未新增或运行自动化测试。
- `scripts/workspace-preflight.mjs` 不存在，根 `package.json` 未提供 `quality:full` 或 `release` 脚本；这些 Gate 未运行。登录后点击和浏览器视觉验收未运行。

## LFAA-UI-RECENT-SESSIONS-NAV-01

### 用户目标

启用左一“最近会话”入口，展示现有各 App 的最近 AI Work 会话，并允许从当前任意全局导航页面打开选中的会话。

### 当前合同

- 复用 `loadAiSessions({ archived: false })` 和现有认证 `GET /api/ai/sessions`，按服务端 `updated_at DESC` 返回的次序显示最近 20 条；保留真实加载、空数据和错误/重试反馈。
- 选择会话时复用现有 `lfaa:open-ai-session` 事件，由已挂载的 `Workbench` 更新按 App 隔离的活动会话 ID 并打开所属 App 的 AI Work；消息、会话归属及路由仍由现有服务和工作台处理。
- 最近会话弹层属于全局导航的本地展示状态，每次打开重新请求当前账户未归档会话；不新增会话缓存 Owner、API、数据库字段、持久化或跨账户数据。
- 左一按钮保持原位置和宽度；入口使用现有主题令牌，不改变左二、中间、右侧或其他工作台布局。不新增设置项、CSS 自定义属性或依赖。
- 保持设置页、文件页和应用工作区共用入口可用；弹层支持关闭按钮、点击外部和 Escape 关闭。

### 允许修改

- `frontend/src/components/GlobalNavigationRail.tsx`：启用最近会话按钮，读取和呈现当前账户会话摘要，并通过现有事件打开会话。
- `frontend/src/components/module-workbench.css`：定义最近会话弹层内的条目、元信息、空/错/加载状态及其在左一附近的位置，沿用共享主题令牌。
- `docs/系统总体架构.md`：记录最近会话入口复用的 API、会话事件与状态 Owner。
- `docs/PROMPTS.md`：登记本合同并写入实现和验证记录。

### 禁止修改

- 不改 `server/`、会话 API/数据库/排序语义、AI Work 消息加载、通知逻辑、`Workbench` 的会话状态 Owner 或应用路由。
- 不新增另一套会话状态、模拟会话、归档操作、会话搜索/分页、设置项、依赖或 CSS 自定义属性。
- 不改变左一/左二/中间/右侧宽度、顺序、可调节行为及既有导航按钮语义。
- 不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对按钮可用、打开时请求未归档跨 App 会话、显示服务端排序靠前的 20 条，选择项发出现有事件，且原 Workbench 监听器仍接管打开流程。
- 运行 `pnpm --filter lfaa-frontend run build` 和 `git diff --check`，并确认构建产物在根目录 `dist/frontend/`；真实登录后的 API、选择与返回交互另行记录。

### 实现与验证记录（2026-09-29）

- 左一“最近会话”按钮已启用。每次打开弹层，通过认证 `GET /api/ai/sessions?archived=false` 读取当前账户会话，显示更新时间最新的 20 条；有明确的加载、空数据、错误和重试状态。
- 选择条目会派发既有 `lfaa:open-ai-session` 事件。`Workbench` 原监听器据此恢复对应 App 的活动会话 ID、切换到其 AI Work 并打开会话；会话消息仍由原 App 工作区按需读取。
- 应用工作区、设置页和文件页复用同一入口。弹层可通过关闭按钮、点击外部或 Escape 关闭；样式沿用现有主题令牌，仅定位到历史图标旁，没有修改导航栏宽度或其他工作台区域。
- `pnpm --filter lfaa-frontend run build` 通过，TypeScript 检查和 Vite 构建通过，产物位于根目录 `dist/frontend/`；`git diff --check` 通过。本次未新增或运行自动化测试，浏览器登录态交互未运行。
- 仓库没有 `scripts/workspace-preflight.mjs`、`quality:full` 或 `release` 脚本入口，因此这些 Gate 未运行。

## LFAA-WRITING-AGENT-PLACEMENT-01

### 用户目标

在写作 AI Work 对话中，Agent 理解用户的自然语言写作指令，自主选择当前作品大纲或常规模式当前章节正文，并执行准确的写入操作。

### 当前合同

- 写作上下文向模型提供服务器确定的当前作品/章节身份、当前大纲和正文资料。模型按用户明确指向选择“作品大纲”或“当前章节正文”；目标或写入位置确实含糊时先追问，不猜测、不声称未执行的写入。
- 写作 Agent 提供受限的大纲编辑与章节编辑 Tools；支持追加、前置、按唯一锚点前后插入及明确要求时整体替换。锚点缺失或多次出现时拒绝执行并让 Agent 澄清；不得默默追加到错误位置。
- 所有写入由模型工具调用真实写作业务服务完成；每次写入使用现有的单次审批机制，审批信息展示实际作品/章节、大纲或正文目标、操作和内容摘要。工具执行重新校验目标属于当前账户，并将本次变更保存到对应修订历史。
- 作品大纲作为作品级真实持久数据保存；在已有写作作品目录下增加“大纲”条目，选择后复用中央编辑器查看/编辑，保留大纲修订与恢复。保持工作台左一、左二、中间、右侧布局和分栏尺寸，不重排现有列。
- 普通模式编辑器在切换到 AI Work 前 flush 未保存草稿；AI 工具执行后的内容由已有工作区重新加载读取，避免脏草稿覆盖工具写入。
- 写作工具只处理服务端账户隔离的作品数据，不开放任意本机路径、Daemon 文件操作或 Shell；Provider、模型、Skills 和权限仍由既有 AI 设置与 Runtime 管理。
- 不添加回复旁的手动插入按钮，不把 AI 回复机械地盲目追加到正文；不让模型绕过审批或业务校验；不新增设置项、依赖、CSS 自定义属性或工作台重新布局。

### 允许修改

- `server/src/database.ts`：持久化作品大纲及其修订历史。
- `server/test/database-migrations.test.mjs`：同步当前最新数据库版本断言。
- `server/src/modules/writing/service.ts`、`server/src/api/routes.ts`：实现账户隔离的大纲读写、修订恢复 API，以及 AI 当前写作上下文。
- `server/src/ai/business-tools.ts`、`server/src/ai/runtime.ts`：注册范围受限的写作工具与自然语言目标选择规则。
- `frontend/src/api.ts`、`frontend/src/apps/writing/normal/WritingWorkspace.tsx`、`frontend/src/apps/writing/normal/WritingWorkspace.css`：让“大纲”进入现有作品目录并复用中央编辑器与修订历史。
- `frontend/src/components/ApplicationWorkspace.tsx`、`frontend/src/components/AiWorkChat.tsx`、`frontend/src/components/ai-work-chat.css`、`frontend/src/apps/writing/ai-work/WritingAiContext.tsx`：保留编辑器 flush，去除机械手动插入按钮，说明 Agent 工具写入与审批。
- `README.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：记录作品级大纲数据 Owner、Agent 工具和审批边界。
- `docs/PROMPTS.md`：维护本合同和实现、验证记录。

### 禁止修改

- 不修改工作台布局/分栏尺寸、AI Provider/模型选择、权限策略或其他应用工具；不开放文件路径、Daemon 或 Shell。
- 不添加无审批的写入、跨账户/跨作品任意目标写入、猜测锚点的静默降级或回复按钮式机械追加。
- 不新增设置项、依赖或 CSS 自定义属性；不部署、发布、上传或提交 Git。

### 验收方式

- 静态核对写作 Agent 只获得当前作品范围的两个写工具，模型参数与审批摘要绑定同一目标；越权目标、缺失/重复锚点均拒绝写入。
- 静态核对 schema v29 可在既有 v28 后添加大纲/修订数据，读写与恢复均检查账户和作品归属；Chapter 与 outline 保存都保留最多 50 个修订快照。
- 静态核对普通模式“大纲”条目打开中央编辑区，且栏位布局不变；切换模式前等待当前编辑草稿保存。
- 运行 server 和 frontend 构建及 `git diff --check`；构建产物位于根目录 `dist/` 对应子目录。迁移和浏览器交互按实际执行结果记录，不得暗示未运行的测试通过。

### 实现与验证记录

- 已移除消息旁盲目“插入正文”按钮与前端追加回调。AI Runtime 现在把本轮请求时服务端确认的作品/章节 ID、大纲和正文标记为不可信作品资料；只为该上下文生成大纲与当前章节工具。普通账户可编辑自己的账户隔离写作记录，工具参数和目标 ID 被单次审批绑定；服务层再次检查账户归属。
- `writing_edit_book_outline` 与 `writing_edit_current_chapter` 支持追加、前置、唯一锚点前后插入及明确要求的整体替换。锚点不存在/重复时服务返回错误，不会降级为追加；System Prompt 要求模型在目标/位置不清时先询问，工具结果成功后才允许模型声称已保存。
- 数据库迁移 v29 给作品增加大纲正文和独立修订历史；大纲 API 覆盖保存、读取工作区、列出修订和恢复。大纲在既有作品目录里新增一个条目，中央编辑区复用同一文本编辑器；不改左一/左二/中间/右侧栏位顺序、宽度和布局。
- 常规编辑器为正文和大纲分别自动保存，并在切换文档或模式前 flush 当前草稿。AI Tools 保存时生成对应内容修订，两个内容目标各保留最近 50 个版本。沿用设置中心的活动 Provider/模型、AI Runtime 限额与权限；没有新增设置项。
- `pnpm --filter lfaa-server run build` 通过；`pnpm --filter lfaa-frontend run build` 通过（TypeScript 与 Vite，产物在根 `dist/frontend/`）；`git diff --check` 通过。迁移测试文件的最新版本断言已更新为 29；本轮未运行自动化测试。模型 Provider 的工具兼容性、逐项审批交互和浏览器实机编辑验收未运行。
- 仓库未提供 `scripts/workspace-preflight.mjs`，根脚本也没有 `quality:full` 或 `release` 入口；这些 Gate 未运行。

### 启动错误修正合同（2026-09-29）

- 用户启动日志显示数据文件版本为 29，而程序支持上限仍为 28；同一文件已有 v29 迁移，计划文档也记录了 v29 数据结构。
- 将当前支持上限与最新迁移版本对齐为 29；继续对高于 29 的数据库 fail-closed，不降级、不重置或直接修改运行数据。
- 允许修改 `server/src/database.ts` 的支持版本声明，以及本合同中的验证记录；不扩大到启动器、Daemon 或 UI。
- 核查 server 类型检查、构建和差异格式；不运行自动化测试或启动服务。记录日志中其他错误是否为后端退出后的派生现象。

### 修正记录（2026-09-29）

- 支持版本上限已从 28 对齐到 29；版本高于 29 时原有 fail-closed 检查仍生效。未直接打开或修改用户数据库。
- `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server run build` 和目标文件 `git diff --check` 均通过；构建输出目录由 `server/tsconfig.json` 指向根 `dist/server/`。
- 未运行自动化测试或启动服务。日志中重复的数据库错误是服务端无法启动的根因；Daemon 的 `fetch failed` 与控制端不可用相符。Vite `ECONNABORTED` 和 Node `util._extend` 弃用提示也出现在日志中，但不构成该数据库启动故障的原因，本次未改动它们。

## LFAA-DEEPWRITE-WRITING-SKILLS-01

### 用户目标

参考 DeepWrite 的写作 Skills、提示词和工具协作方式，增强 LFAA 写作 AI Work 对自然语言写作目标的识别和准确落笔能力；结合 LFAA 当前数据模型与权限边界实施，不照搬其他仓库的作品结构。

### 当前合同

- 仅实现 LFAA 当前真实支持的写作目标：账户自己的作品大纲和本轮选中的章节正文。DeepWrite 的人物卡、剧情阶段、素材库、项目技能库等在 LFAA 没有相应持久领域 Owner，当前不新增模拟工具或虚假入口。
- 新增少量由 LFAA 自行编写的内置写作 Skills，Agent 可通过只读 `writing_load_skill` 按需加载；基础提示词说明各 Skill 的适用任务，并要求把 Skill 作为写作方法，不当作作品事实或越权授权。Skill 元数据进入既有 AI 扩展目录。
- 加强写作 System Prompt 对“先讨论/给建议”和“明确要求保存”的区分；明确“大纲/正文”自然语言目标路由、追加默认行为、锚点插入/替换与整篇重写的边界、上下文不可信和工具成功后才可声称已保存。
- 现有大纲和章节工具继续使用请求时锁定的账户目标、写作业务服务、逐项审批及修订历史。补充唯一锚点局部替换能力，锚点缺失或重复一律拒绝，不退化为追加或全文覆盖。
- 不修改左一、左二、中间、右侧等工作台布局、分栏尺寸、导航、样式或设置页；不增加数据库、用户技能库 UI、外部模型依赖、任意路径或 Shell 能力。
- 只参考 DeepWrite 的按需加载、阶段化提示和审阅边界等方法；本次提示词与技能正文为 LFAA 新写，不复制外部源码或提示词文本。DeepWrite 仓库标示 Apache-2.0；如未来直接复用其代码，必须遵循该许可证的保留、声明和分发条件。

### 允许修改

- `server/src/ai/skills/writing-skills.ts`：定义少量 LFAA 内置写作 Skill 的 ID、说明和完整方法内容。
- `server/src/ai/prompts/writing.ts`、`server/src/ai/runtime.ts`：构造 LFAA 写作 Agent 的目标识别、Skill 加载提示和写作边界，并接入现有 Runtime。
- `server/src/ai/business-tools.ts`：加入只读 Skill 加载工具，扩展两个写作工具的唯一锚点替换操作。
- `server/src/ai/plugins/builtin-catalog.ts`：登记内置写作 Skill 元数据。
- `server/src/api/routes.ts`：在既有 AI 活动轨迹中将动态 Skill 加载显示为 Skill 活动。
- `server/src/modules/writing/service.ts`：为大纲/正文写作服务增加唯一锚点局部替换语义。
- `README.md`、`docs/系统总体架构.md`、`docs/开发计划.md`：准确记录能力、调用边界和未接入的领域。
- `docs/PROMPTS.md`：维护本合同和实现、验证记录。

### 禁止修改

- 不改变任何 UI 布局、分栏尺寸、CSS、导航、外观设置或写作常规编辑器的交互。
- 不伪造人物、剧情阶段、素材库或用户技能库的持久化能力；不把对话生成伪装成作品已保存。
- 不增加无需逐项审批的写入，不允许目标 ID 脱离本轮上下文，不开放文件系统路径、Daemon 文件工具或 Shell。
- 不复制 DeepWrite 源码或其提示词原文；不增加依赖、数据库迁移或新的设置项；不提交、部署、发布或上传代码。

### 验收方式

- 静态核对只有写作 App 能看到 `writing_load_skill`；Skill 读取不需要审批且不写数据；非写作 App 不暴露该工具。
- 静态核对写作提示把讨论/建议与明确保存区分清楚，并把“大纲”“正文”“追加”“锚点插入”“锚点替换”“整体重写”映射到现有真实工具；模糊目标先询问。
- 静态核对锚点替换只改唯一精确原文，缺失/重复时不改内容；两种写入仍绑定请求时目标、逐项审批、账户校验和修订历史。
- 运行 server typecheck/build 和 `git diff --check`；确认构建产物仍位于仓库根 `dist/server/`。不运行自动化测试或启动服务。

### 实现与验证记录

- 写作 App 新增 4 个 LFAA 内置 Skill：大纲规划、章节正文写作、精准润色与修改、连贯性审阅。Agent 通过只读 `writing_load_skill` 按需加载完整方法；Skill 元数据加入受信任插件目录，实际工具调用在活动轨迹中归类为 Skill 活动。Skills 仅提供写作方法，不创建作品事实、权限或其他 App 的能力。
- 新增独立写作 System Prompt，明确区分对话建议与保存指令；“大纲”和“当前正文”分别路由到请求时目标，未指定位置时追加，锚点插入/替换要求唯一原文，全文替换必须是用户明确要求。上下文里的指令按作品资料处理，只有真实 Tool 成功后才报告已保存。
- `writing_edit_book_outline` 和 `writing_edit_current_chapter` 增加 `replace_anchor`，对唯一原文片段做局部替换；锚点缺失/重复会拒绝，不降级为追加。保留现有单次审批、账户归属校验、修订历史及当前作品/章节绑定。
- 未复制 DeepWrite 源码或提示词文本；参考其按需加载 Skill、按阶段提供方法与写入需审阅的设计。当前只做大纲和章节正文，不伪造人物卡、剧情阶段、素材库或用户技能库。
- `pnpm --filter lfaa-server run typecheck`、`pnpm --filter lfaa-server run build`、`git diff --check` 均通过；构建由 `server/tsconfig.json` 输出到根目录 `dist/server/`。未运行自动化测试、Provider 工具调用或浏览器交互。

## LFAA-SETTINGS-NOTIFICATION-COMPLETION-SOUND-01

### 用户目标

AI Work 回复完成时，除工作台通知栏和右下角提醒外，播放设置中心“通知”中选择的完成提示音；用户可以在“通知”分类试听或关闭提示音。

### 设置中心配置盘点

- `general.completionNotification` 默认 `unfocused`，控制完成事件是否启用以及浏览器系统通知是否在工作台未聚焦时投递；`never` 时不显示完成通知，也不播放对应音效。
- `general.notificationSound` 默认 `default`，可选 `default`、`subtle`、`off`；前端设置页已提供选项与试听，server `readGeneralSettings` 已做白名单校验并随账户 `general` 设置持久化，前端 `UserSettings` 已映射该字段。
- 不新增设置字段或迁移；完成事件的音效按已保存的 `notificationSound` 执行。工作台聚焦状态只影响浏览器系统通知，不再抑制已有工作台完成提醒的音效。

### 当前合同

- 仅真实 AI Work 流式回复的 `complete` 结果触发完成通知音效；失败、中断、取消不触发完成音效，已有会话问题/审批提醒行为保持不变。
- `completionNotification=never` 时仍关闭完成提醒与音效；其余策略下，只要现有完成通知被加入工作台通知中心，就按 `notificationSound` 播放一次。`notificationSound=off` 时静音。
- 浏览器系统通知仍遵循 `always`、`unfocused` 与 `never` 的既有投递条件；系统通知设为 `silent`，避免与 LFAA 提示音重复。
- 不新增依赖、API、数据库字段或声音资产，不修改通知权限模型和其他通知类别。

### 允许修改

- `frontend/src/shared/notification-runtime.ts`：修正完成音效与浏览器系统通知聚焦条件的耦合。
- `docs/PROMPTS.md`：登记本合同与实际验证记录。

### 禁止修改

- 不修改设置中心已有控件、设置字段名、默认值、服务端持久化与校验逻辑。
- 不修改其他提醒事件、浏览器授权流程、通知内容、音效设计或系统通知策略。
- 不新增后端 API、数据库迁移、依赖、静态音频文件，不运行自动化测试或启动/部署服务。

### 验收方式

- 静态核对 `always` 与 `unfocused` 策略下，完成通知入工作台通知中心时都会遵循 `notificationSound`；`off` 静音，`never` 不通知且不播放；系统通知仍按焦点策略投递。
- 运行 `pnpm --filter lfaa-frontend run build`，确认 TypeScript 与 Vite 构建结果；确认产物位于根 `dist/frontend/`。
- 核对本合同相关文件的差异格式，并记录浏览器/桌面实机音频播放是否验收。

### 实现与验证记录（2026-09-30）

- `notifyAiWorkCompletion` 在完成提醒进入工作台通知中心后，立即按 `general.notificationSound` 播放一次；工作台是否聚焦只决定是否额外投递浏览器系统通知。`completionNotification=never` 仍会关闭完成提醒与音效，`notificationSound=off` 保持静音；设置项、默认值、校验和持久化均沿用现有实现。
- `pnpm --filter lfaa-frontend run build` 通过，包含 TypeScript 检查；Vite 产物写入仓库根目录 `dist/frontend/`。`git diff --check -- frontend/src/shared/notification-runtime.ts docs/PROMPTS.md` 通过。
- 已按仓库规则尝试 `node scripts/workspace-preflight.mjs`，但脚本不存在；根 `package.json` 未定义额外 quality/release Gate。未运行自动化测试或浏览器/桌面音频播放实测。

## LFAA-SETTINGS-CENTER-CLEANUP-01

### 用户目标

归档设置中心审查结论，将导航和配置整理列为后续待办；先完成用户当前安排的架构升级，再依据升级后的架构决策开展设置中心整改。

### 审查记录

- 2026-09-29 对当前 `SettingsPage.tsx` 做静态源码盘点：导航共 31 个入口、5 个分组；16 个入口点击后仅展示待接入说明。未接入的入口、数据/状态页面和真实设置混在同一导航中。
- “通知”设置组同时出现在“常规”和“通知”；“个性化”指回“外观”，“环境”指回“常规”。“已归档的聊天”是会话操作，“开发者”是状态信息，“使用情况和计费”当前只展示 Token 用量且注明不含费用。
- “常规”有 23 个字段；静态检索未发现其中若干字段在设置页面以外的运行时代码引用。`questionNotifications` 有数据字段但没有可操作控件；部分可编辑选项的页面说明注明待接入。
- 导航分组在首次无保存折叠状态时默认全部展开；搜索框按分类名/分组名筛选，不检索具体设置字段。设置项在约 300ms 后自动保存，同时页面仍提供“立即保存”。
- 共用用户设置、AI 账户、外观背景、SteamCMD 工具配置、Steam 游戏存储、Minecraft 实例存储和本机数据根目录由不同 Owner/API 管理。该数据归属拆分是有意设计，后续整改不得混并或重置已有用户值。
- 本记录是代码静态审查结果，不代表浏览器视觉或运行时验收；实现整改前需复核当时的代码和架构决定。

### 后续整改合同

- 本轮只保存审查记录并登记待办；设置中心代码和架构代码均不在本合同的实施范围内。
- 设置中心整改排在当前架构升级之后。架构升级完成并确认新的模块边界后，再确定导航分组、占位功能呈现策略、设置项的运行时消费者、搜索范围和保存交互。
- 整改时复核每项设置的默认值、前端映射、服务端校验和持久化 Owner；未接入真实 Consumer 的项目保持说明或禁用状态，不表现为已经生效。
- 保留账户隔离、AI 密钥保护、主题/字体/字号/颜色/背景/遮罩/模糊/减少动态效果等现有设置语义；不删除、合并或迁移用户数据，除非后续合同明确规定兼容方案并完成无损验证。
- 保留 SteamCMD 工具安装目录、Steam 游戏目录、Minecraft 实例目录和 `LFAA_DATA_DIR` 的独立业务归属及全局默认/节点覆盖边界。

### 后续实施前置条件

- 用户确认架构升级范围与新的 Owner/模块边界。
- 按新架构重新盘点设置页、类型、默认值、服务端校验、API、持久化和实际消费者，并更新本合同及 `docs/开发计划.md` 中的验收标准。
- 代码、数据迁移和浏览器验收由后续独立实施任务决定；本归档任务不运行测试、不改变代码或用户数据。

## LFAA-HARNESS-DSH-PACKAGES-01

### 用户授权与目标

用户明确要求对标 `deepseek-ai/deepseek-harness` 的实际结构，保留全部同名包目录占位，并将当前项目实现迁入职责包；特别指定 `packages/client/ui-chat`、`ui-commands` 等 UI 划分。沿用上游目录名和包名后缀，将项目命名替换为 `lfaa`。用户已授权开始架构重构。

### 实施边界与设置盘点

- 实际迁移源码、开发入口、依赖、构建、两种既有桌面外壳的启动及打包引用；用 Cordis Context、服务、事件和可撤销插件生命周期装配。
- 保留现有产品页面、路由、JSX、文案和 CSS；设置类型、71 项叶子默认值、服务端校验、账户持久化与前端映射沿用原实现。General、Appearance、Shortcuts、AI Runtime、Permissions、Plugins、应用/布局偏好、通知、Provider/模型配置和数据位置均不重置。
- Profile 是配置，Bundle 是普通包的装配补丁；使用上游的包分类，不保留前一版自定义 `harness/kernel` 源码层。目录占位不标为可用功能。
- 数据留在原位置，数据库迁移链、`LFAA_DATA_DIR`、三个权限模式保持原合同。完全权限不增加逐项审批。
- 所有构建和中间产物只进入根 `dist`；每个能力包只清理自己的输出子目录。

### 实际交付与验证

上游 316 个包目录原名保留，62 个实际能力/装配包构建通过；Server、Web、Sandbox Host 和 Tauri debug/release 检查通过。隔离环境核对 HTTP 就绪、动态控制器登记与撤销、共享服务关闭、Daemon 启停、独立桌面运行树、设置持久化和浏览器映射。Electron 未安装打包及实际包内 HTTP/Daemon 运行通过，产物在根 dist。现有用例 17 项中 12 通过、5 失败；迁移前快照复现相同失败。

完整绝对路径、文件职责、迁移前后对应、71 项默认值、验证与未验范围见 [迁移交付记录](harness-migration.md)；全部包状态见 [目录对标清单](harness-packages.md)。真实游戏/模型执行、Windows Hello、安装包和完整产品验收未执行。

## LFAA-HARNESS-CLEANUP-01

- 目标：以 DSH 对标包架构为当前开发入口，落实大模型自主驱动全部已接入 App 和节点的核心，补齐硬编码、新旧实现、临时排查及长期测试的开发规则。
- 执行：发布运行树排除测试支持包；节点执行文件统一为 `packages/host/daemon/src/daemon.mjs`，公开 `lfaa-host-daemon/daemon`，由独立节点 Context 装配；版本读取包清单，卸载取消轮询请求和等待。
- 清理：删除确认的一次性脚本、测试数据、旧架构缓存、失败临时归档与无用中间产物；保留长期测试、必要夹具、用户数据、正式备份和上游占位。每项清理记录绝对路径、数量与实际结果。
- 设置：沿用 Provider/模型、AI Runtime、三种项目权限模式、Shell、应用目录和外观设置；不新增或重置配置，完全权限不增加逐项审批。
- 验证：按实际命令记录构建、源码/编译入口、无密钥节点请求拒绝、轮询取消、锁释放和发布树隔离。临时检查脚本与数据在验证后删除。
- 范围：本轮固定核心与清理执行边界；完整多子 Agent 自主协作、专家独立模型配置和未实现 App Runner 仍需后续代码实施，不能宣称已完成。
- 交付：[逐文件变更、设置、清理和验证记录](harness-cleanup.md)。
## LFAA-HARNESS-CLI-STORAGE-01

用户要求 `npx @yubboo/lfaa web` 与源码 `pnpm install`、`pnpm run build`、`pnpm lfaa web`。用户已明确选择先完成本地启动与打包，暂不发布 npm。最新存储决定为混合：Agent 会话/轨迹 JSONL，配置文件，账户/权限/任务 SQLite；覆盖此前全部 JSON/JSONL 的选择。

设置中心沿用 71 项默认值与既有 UI 映射、Provider/模型、三种权限模式、Shell、应用目录和项目存储配置，不重置用户数据。文件迁移先回读校验与备份，再退役旧权威表；新运行入口不查询旧配置/消息表。全部产物位于根 dist，长期测试保留，临时物删除被自动审核阻挡的实际情况须如实记录。

交付：本地 CLI/发布组装、3 个真实文件存储包、SQLite v31、节点私有路径保护、完整旧库夹具及 30/30 长期回归；活动数据只读核对 7 会话/30 消息/14 用量。完整文件、设置和实际验证见 [交付记录](harness-delivery.md)。早期迁移记录的 62 包及 5 个失败为历史状态，本记录为当前状态。

## LFAA-WRITING-PROMPT-LIBRARY-01

### 用户目标

整理 `C:\Users\Administrator\Documents\易创提示词` 中的写作提示词，优化后加入 LFAA 写作工作区的内置提示词库。

### 设置中心配置盘点

- 写作 AI Work 沿用“AI 与模型”中的活动 Provider、模型与推理参数，以及账户 `aiRuntime.speed`、`requestTimeoutSeconds`、`maxOutputTokens`、`maxModelRequests`、`maxToolCalls`；不在提示词或工具中重复设置这些运行参数。
- 本次不新增写作偏好、模型、权限或外观配置。提示词为只读内置内容，不做用户编辑或持久化；不新增界面，因此没有新增外观样式映射。
- 保存行为继续遵循现有“用户与权限”项目权限模式、写作工具的单次审批、账户归属检查和修订历史。

### 当前合同

- 将来源目录的 14 份写作提示词整理为任务级模板，保留作品简介、剧情分析、设定/大纲润色、取名、妙笔顾问、封面画面描述、建书规划、榜单解读、灵感、竞品拆解、选中文本处理、续写补全、逐章写作和通用小任务。
- 模板按需放在 `packages/document/writing/src/writing-prompt-library.ts`；写作 System Prompt 提供 ID 与用途目录，大模型根据用户目标自主选择是否调用只读 `writing_load_prompt` 加载内容。
- 删除来源中特定应用依赖的 `{{JSON形状}}` 等程序占位符和无法映射至 LFAA 的 JSON 字段；使用 LFAA 当前提供的文本上下文、大纲与当前章节工具，不虚构人物卡、分卷字段、批量生成、榜单数据或封面生成功能。
- 榜单分析和竞品拆解严格依据用户提供的数据/原文；设定扩写将新增想法标为建议；文档内容与已加载提示词都不覆盖系统规则、用户目标或工具权限。
- 仅明确要求保存时调用当前作品的大纲或当前章节工具；建议、分析、样稿及模板加载保持只读。

### 变更文件

- `H:/LFAA/packages/document/writing/src/writing-prompt-library.ts`：定义 14 个经 LFAA 业务边界改写的只读写作模板。
- `H:/LFAA/packages/document/writing/src/prompts.ts`：向写作 System Prompt 加入模板目录及按需读取规则。
- `H:/LFAA/packages/core/tools/src/business-tools.ts`：新增写作专用只读 `writing_load_prompt` 工具并将其限制在 Writing App。
- `H:/LFAA/packages/core/agent-loop/src/execute-turn.ts`：在 AI Work 活动记录中标示提示词加载。
- `H:/LFAA/packages/preset/agent-preset/src/builtin-catalog.ts`、`H:/LFAA/packages/preset/agent-preset/package.json`：将 Prompt 名称和用途登记为 Writing App 内置 AI 扩展元数据，并声明提示词库工作区依赖。
- `H:/LFAA/docs/系统总体架构.md`：记录内置写作提示词的位置、只读加载边界与能力范围。
- `H:/LFAA/docs/PROMPTS.md`：记录任务合同、配置盘点、变更职责和验证结果。

### 实际验证

- `pnpm --filter lfaa-document-writing run build`、`pnpm --filter lfaa-tools run build`、`pnpm --filter lfaa-agent-loop run build` 均通过；产物分别位于根目录 `dist/packages/document/writing/`、`dist/packages/core/tools/`、`dist/packages/core/agent-loop/`。
- `pnpm exec tsc --noEmit --pretty false -p tsconfig.host.json` 通过；目标变更文件的 `git diff --check` 通过。
- 构建产物检查确认提示词库、System Prompt、工具与 Agent Loop 输出均在根目录 `dist/`；未运行自动化测试、Provider 模型调用或浏览器交互。
