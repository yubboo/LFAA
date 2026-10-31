# client/ui-layout

认证后默认进入 `/work` 小鱼智能体聊天与代码开发工作区。根地址 `/` 和旧地址 `/desktop` 通过共享路由合同归一到 `/work`；应用切换仍使用 Workbench 现有应用清单和受保护路由。

Workbench 不再显示首次进入向导；既有 `guidedEntryCompleted` 偏好只保留数据兼容，不参与首页选择，也不被此入口改写。

Workbench 在认证后的应用路由上装配 `ui-sidebar-terminal` 的 TerminalManagerProvider，使其跨 App 页面键切换保留当前账户的终端标签；底部面板与 Minecraft 实例控制台只注册显示位置。切换应用工作区或账户时，由共享会话 Owner 关闭对应 PTY 与 SSE，不跨账户保留。

Workbench 将认证后的 `/agent-office` 懒加载到 `ui-workspace`，并复用模块 Shell、当前 Settings Appearance 和账户导航；员工状态和卡片布局由 `AgentOfficePage` 负责，Workbench 只做路由装配。办公室入口不启动或控制 Agent。

`Workbench` 将认证后的 `/plugins` 路由懒加载到 `ui-plugin-manager`，并把它作为独立模块工作区显示。页面的全局导航归 `ui-sidebar`，插件来源/状态展示与动作意图归 `ui-plugin-manager`；Workbench 只装配该页面，不持有插件规则。插件目录工具栏齿轮调用 `openSettings("plugins")` 路由到设置中心现有插件分区，并保留返回来源；设置内容仍归 `ui-settings`。

模块页面的 Shell 高度与滚动边界由 `src/css/module-shell.css` 管理并由 `Workbench.tsx` 引入；模块路由激活时将 `html/body/#root` 限制在动态视口并锁定文档根滚动，内容仍由各自面板滚动，短屏不以最小高度撑开整页。Web 入口默认在 `html/body` 预留稳定滚动槽；模块页内部滚动后会关闭这两层预留，避免窄视口重复扣除宽度、露出右侧画布底色。工作区、文件管理和插件管理的内容样式留在各自 UI 包，不由 Renderer 全局加载。

Workbench 还负责把设置、文件和插件页面的“最近会话”请求送入 `/work`；请求 ID 只在内存中暂存，由 `ApplicationWorkspace` 消费并确认后清除。会话列表、刷新和 Dock 展开仍归工作区 Owner，不由 Workbench 复制。

Workbench 根据现有背景槽读取同名 `appearance.areaEffects`：遮罩和玻璃模糊可在五个工作区区域独立覆盖，未覆盖时逐字段继承全局 Appearance；门户表面、Wallpaper Engine 令牌和刷新首帧缓存共用同一解析值。设置中心区域由 `/settings` 路由识别，不创建新背景槽。

内置 Appearance 背景的 ID 与 Web URL 统一来自 `util/values/src/builtin-backgrounds.ts`；素材放在 `apps/web/public/backgrounds/` 或其静态子目录，Vite 构建到根 `dist/apps/web/`。Workbench 和外观选择器复用同一清单，新增静态文件需登记清单才会成为可选背景。账户上传图继续由认证 API 读取，不进入 Web 静态构建。

共享运行环境页将 Runtime Overview 按当前账户与角色保存在 Client Snapshot Cache；同一身份 30 秒内回访先呈现最近真实设备/环境快照并跳过重复读取，过期快照继续由认证 API 核对。缓存只用于首屏显示，不替代 RuntimeManager 的本机发现、节点心跳和安装前校验；活动环境任务每 3 秒核对一次，下载仍只由用户发起的运行环境任务执行。

Workbench 提供唯一的 `applicationNavigationItems` 工作台入口清单，其中领域应用导航与系统共享能力入口分开表达。`ApplicationWorkspace` 在右侧 Dock 呈现“应用与能力”视图和原工具/资源视图；设置、文件、插件页的全局入口向 Workbench 提交一次性打开请求，进入 `/work` 后由工作区按 `requestId` 先消费并清理请求、再展开右侧视图，防止响应式布局或回调变化重放同一请求。当前视图选择由 Workbench 保持，使入口切换路由后仍留在该视图；左 Dock 只呈现会话与项目。

设置页只在 `/settings`、`/admin/users` 直达路由或用户悬停/聚焦设置导航时预热；工作台空闲时不主动下载整页，避免后台模块加载占用首屏资源。

`/work`、全屏语音入口 `/voice` 与应用 `workspace/ai-work` 路由会在应用工作区模块加载时并行预热 AI 聊天模块，缩短嵌套懒加载形成的首屏等待。预热只在 AI Work 路由触发；失败不阻断模块正常加载，失败 Promise 会清空以便后续重试。

各业务 App 共用 `Workbench` 四栏布局，聊天与画布分别复用唯一 `AiWorkChat`、`CanvasWorkspace`；`ApplicationWorkspace` 传入当前 App 上下文，画布读取该 App 已登记的节点目录。手动模式保留给领域 App 自己的业务面板。AI 漫剧的 `/apps/aivideo/ai-work`、`/apps/aivideo/canvas`、`/apps/aivideo/normal` 分别对应绑定漫剧上下文的聊天、共享画布与漫剧专属手动工作台；三个入口使用同一 AI Video 项目 Owner，不复制项目数据。

## 小鱼共享工作入口（2026-10-14）

小鱼智能体工作区是系统级目标执行入口，根地址与登录默认入口都落到 `/work`；旧工作路由归一。右侧“应用与能力”视图区分游戏服务、联机管理、写作空间和 AI 漫剧等领域入口，以及所有领域共用的系统画布。SteamCMD 只作为 Steam 游戏服务器的当前实现依赖，不作为产品边界。常规应用页面管理各自领域数据，小鱼 Agent 负责统一目标交互与能力调度。共用工作区只有一个草稿写入器与活动会话选择；旧 App 草稿保留，首次无共享草稿时回读上次 App。通知直接打开共享会话。General 中旧 `defaultMode/defaultStandaloneChat` 字段保持账户读写兼容，不再改变首页。

Workbench 中非审批/澄清类小鱼工作通知通过 `ui-primitives` 的 `NotificationToast` 呈现，Workbench 仍拥有通知状态、打开会话、关闭与 8 秒自动收起；提示音继续由 Client Resources 按 Settings Owner 执行。共享组件只负责统一紧凑布局和单一背景，不改变通知策略、声音或会话数据。

构建只写仓库根 dist/packages/client/ui-layout/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

## 游戏库四栏入口（2026-10-23）

SteamCMD 未验证提示卡片中的操作链接受提示卡可用宽度约束并允许折行，窄中栏下仍完整可见和可操作；窄栏下目标设备选择器与刷新状态按钮在同一行。

运行环境页在窄中栏切换为纵向表单时，自定义 Java 版本和路径输入行按内容高度布局，避免横向表单的 flex 基准拉高控件。

运行环境页的本机 Java 路径通过 `SystemFileLibrary` 的只读本机磁盘浏览选择，服务端仍沿用超级管理员与 `permissions.mode=full_access` 校验；所选路径仅交给 Runtime Manager 在用户点击登记后校验。远端节点不使用本机文件路径，继续由用户填写目标节点路径并在对应 Daemon 验证。

Workbench 将 `/games/*` 全部装配到共享 `ApplicationWorkspace` 四栏 Shell。`/games` 与 `/games/environments` 使用“游戏服务”聚合入口；`/games/minecraft/*` 和 `/games/steamcmd` 保留各自 `ApplicationId` 与专属左二功能菜单，全局应用切换单独由导航轨弹层承载。`GameLibraryPage`、`SteamcmdWorkspace` 是本包的组合适配器；Minecraft 实例/生命周期、Runtime Manager 和 SteamCMD 数据/任务仍归各自领域 Owner。旧 `/apps/{minecraft,steamcmd}/normal/*` 路由映射到 `/games/*`，内部认证和 Agent 工具合同保留。外观沿用 Settings/Appearance 共享令牌，不新增偏好；游戏服务与运行环境分类使用真实中心容器宽度重排卡片、分类入口及操作控件，不依赖全局窗口宽度。运行环境页标题与两条返回入口在页头并列；设备选择、重检和存储操作紧贴其下，窄中栏将返回、重检和存储操作收为有可访问名称的图标按钮，仍保留设备当前值。

SteamCMD 分类读取设置中心已有节点模式与工具目录；默认选中本机控制端时，首次进入分类会选取在线 Windows x64 Daemon。安装、真实校验和完整卸载经 SteamCMD Owner；文件管理入口以账户限定的资源别名打开同一节点的 `steamcmd-runtime` 只读目录。窄容器将这组运行环境操作收为保留可访问名称的图标按钮。

Java 分类使用主版本列表与选中详情的主从布局；筛选、搜索、排序读取设备的真实 Java 目录与实例的 `requiredJavaMajor`，离线状态不计作已安装。详情按真实 Runtime Manager 记录展示版本、来源和路径，安装/登记/校验/更新/卸载仍调用原操作合同；有可用记录时“校验并复用”位于该记录操作行右侧，无可用记录时显示一次下载入口；不生成性能评分或通用兼容结论。容器宽度收窄后列表与详情切为单列，卡片动效继续由 Appearance 的 `general.cardMotionEffect` 和减少动态效果偏好控制。

工作区现存卡片通过 `lfaa-card-motion` 和 `lfaa-card-motion-list` 注册到共享动效；Workbench 将账户 `general.cardMotionEffect` 映射到根节点，并将 `general.dialogMotionEffect`、减少动态效果偏好及当前 Appearance 主题/强调色/字体字号/对比度/壁纸表面令牌同步到 body，供 Ant Design Portal 的 Modal、确认弹窗和 Popconfirm 读取；弹窗外框、标题/正文/操作区留白和响应式滚动基础归 `ui-theme` 集中维护，业务页面只保留内容布局与必要尺寸。

Workbench 把凭据待处理状态（由 `ui-renderer` 从 Account Owner 读取）传给 `ui-settings-general/SetupReminder`，共享一个 Modal，按默认凭据、AI Provider、业务内容 `data` 目录顺序排队。`general.notificationPopupsEnabled` 是全局弹出通知总开关，关闭时暂停该队列及版本公告，并阻止新增 AI 工作通知和 Toast。通知设置不提供首次登录分类开关；“不更改”由 Settings Owner 保存当前类别的长期关闭状态，当日暂停按账户/类别/日期隔离，“稍后再说”在当前工作区延后五分钟。AI Provider 状态由活动账户决定，业务内容状态读取 `configured`；SteamCMD 游戏安装位置继续由“项目与存储”管理，但不加入首次登录提醒。去配置只导航，返回后按 Owner 的真实状态复查；写入失败保留弹窗并显示错误。各类提醒结束后再展示未确认的版本公告。工作台延续 `.setup-reminder-modal` 局部布局规则，凭据检查完成前及凭据提醒显示期间暂停队列检查，避免双重遮罩。

登录进入时，`Workbench` 仅在认证已成功后由 Renderer 挂载；首轮布局提交可通过 `onAuthTransitionWarmupReady` 通知 Renderer。转场期间根节点保持隐藏、不可聚焦且不可交互，提醒继续暂停；动画结束后复用已挂载的同一 Workbench。

版本公告独立读取构建元数据中的官方发行版本、发布日期和 `update.json` 更新说明；按账户和版本在浏览器本地记录已确认状态，并受 `general.notificationPopupsEnabled` 控制。“我知道了”确认后不再自动显示该版本公告；设置中心“关于与更新”保留当前版本公告，供用户再次查看。Workbench 等提醒队列、通行密钥与桌面更新对话框收起后再展示公告；弹窗提醒不改变更新器下载/安装及强制更新合同。公告使用独立 `.release-announcement-modal` 样式和 Appearance 共享令牌。

壁纸画布仍消费 Settings Owner 的 `appearance.backgrounds` 与 `appearance.wallpaperEngine` 偏好。首帧根据账户启用状态、项目 ID 与已应用的 DSH Profile Client 图选择 Owner，避免刷新时先绘制账户背景再切到插件壁纸；Profile Client 图移除引擎后恢复账户背景，不改写用户保存的偏好。插件拥有活动壁纸画布时，Workbench 将 `--we-accent`、玻璃色/保真度/透明度、模糊、边框和逐面设置映射到 LFAA 共享 Appearance 令牌；插件停用或壁纸未运行时不装配该映射，回到账户 Appearance。Settings、左右侧栏、聊天和浮层分别读取 DSH 的 `data-we-*` 开关及逐面变量；玻璃滤镜沿用插件的模糊、饱和度、亮度和对比度，深色右侧栏沿用 65% 玻璃色权重；不复制插件配置、不增加请求或状态订阅。主题与字体角色继续分别使用 Theme Owner 和受限 DSH Token Bridge。

AI Work 的右栏正在拖动时，Workbench 根据 `ResizableWorkbench` 的 `data-dragging` 状态临时关闭大面积聊天/上下文表面的 `backdrop-filter`，减少 Grid 宽度逐帧变化时的重复背景采样；拖动完成、取消或失焦后由共享交互生命周期立即恢复，不改 Appearance 偏好、表面颜色或透明度。

Workbench 的 `allApplicationNavigationItems` 是内置应用菜单项的单一清单。设置中心的 `general.hiddenApplicationNavigationIds` 仅过滤传给应用菜单的可见项，所有页面仍持有完整清单用于设置展示和恢复；清单变化不更改路由、授权、应用运行状态或安装内容。

游戏库 `/games/steamcmd` 的 `SteamcmdWorkspace` 复用 SteamCMD Client Connection 展示真实服务端状态和任务。DST 向导创建共享安装的 Master/Caves 集群，并将配置目录作为一次性位置请求交给 File Manager；UI 不接收、缓存或写入 `cluster_token.txt` 内容，也不把 Daemon PID 存为本地偏好。
