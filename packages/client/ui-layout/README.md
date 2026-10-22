# client/ui-layout

`Workbench` 将认证后的 `/plugins` 路由懒加载到 `ui-plugin-manager`，并把它作为独立模块工作区显示。页面的全局导航归 `ui-sidebar`，插件来源/状态展示与动作意图归 `ui-plugin-manager`；Workbench 只装配该页面，不持有插件规则。插件目录工具栏齿轮调用 `openSettings("plugins")` 路由到设置中心现有插件分区，并保留返回来源；设置内容仍归 `ui-settings`。

模块页面的 Shell 高度与滚动边界由 `src/css/module-shell.css` 管理并由 `Workbench.tsx` 引入；工作区、文件管理和插件管理的内容样式留在各自 UI 包，不由 Renderer 全局加载。

Workbench 还负责把设置、文件和插件页面的“最近会话”请求送入 `/work`；请求 ID 只在内存中暂存，由 `ApplicationWorkspace` 消费并确认后清除。会话列表、刷新和 Dock 展开仍归工作区 Owner，不由 Workbench 复制。

Workbench 提供唯一的 `applicationNavigationItems` 应用清单。`ApplicationWorkspace` 在右侧 Dock 呈现“应用”视图和原工具/资源视图；设置、文件、插件页的全局“应用”入口向 Workbench 提交一次性打开请求，进入 `/work` 后展开右侧应用视图。当前视图选择由 Workbench 保持，使应用切换路由后仍留在应用菜单；左 Dock 只呈现会话与项目。

设置页只在 `/settings`、`/admin/users` 直达路由或用户悬停/聚焦设置导航时预热；工作台空闲时不主动下载整页，避免后台模块加载占用首屏资源。

`/work`、全屏语音入口 `/voice` 与应用 `workspace/ai-work` 路由会在应用工作区模块加载时并行预热 AI 聊天模块，缩短嵌套懒加载形成的首屏等待。预热只在 AI Work 路由触发；失败不阻断模块正常加载，失败 Promise 会清空以便后续重试。

## 小鱼共享工作入口（2026-10-14）

小鱼智能体对话区是首页，根地址与登录默认入口都落到 `/work`；旧工作路由归一。左侧紧凑“应用”菜单保留游戏库和各专业 App 的常规入口，沿用已有 App 打开、偏好保存和路由状态。共用工作区只有一个草稿写入器与活动会话选择；旧 App 草稿保留，首次无共享草稿时回读上次 App。通知直接打开共享会话。General 中旧 `defaultMode/defaultStandaloneChat` 字段保持账户读写兼容，不再改变首页。

构建只写仓库根 dist/packages/client/ui-layout/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

工作区现存卡片通过 `lfaa-card-motion` 和 `lfaa-card-motion-list` 注册到共享动效；Workbench 将账户 `general.cardMotionEffect` 映射到根节点，并将 `general.dialogMotionEffect`、减少动态效果偏好及当前 Appearance 主题/强调色/字体字号/对比度/壁纸表面令牌同步到 body，供 Ant Design Portal 的 Modal、确认弹窗和 Popconfirm 读取；弹窗外框、标题/正文/操作区留白和响应式滚动基础归 `ui-theme` 集中维护，业务页面只保留内容布局与必要尺寸。

Workbench 把凭据待处理状态（由 `ui-renderer` 从 Account Owner 读取）传给 `ui-settings-general/SetupReminder`，共享一个 Modal，按默认凭据、AI Provider、业务内容 `data` 目录顺序排队。`general.notificationPopupsEnabled` 是全局弹出通知总开关，关闭时暂停该队列及版本公告，并阻止新增 AI 工作通知和 Toast。通知设置不提供首次登录分类开关；“不更改”由 Settings Owner 保存当前类别的长期关闭状态，当日暂停按账户/类别/日期隔离，“稍后再说”在当前工作区延后五分钟。AI Provider 状态由活动账户决定，业务内容状态读取 `configured`；SteamCMD 游戏安装位置继续由“项目与存储”管理，但不加入首次登录提醒。去配置只导航，返回后按 Owner 的真实状态复查；写入失败保留弹窗并显示错误。各类提醒结束后再展示未确认的版本公告。工作台延续 `.setup-reminder-modal` 局部布局规则，凭据检查完成前及凭据提醒显示期间暂停队列检查，避免双重遮罩。

登录进入时，`Workbench` 仅在认证已成功后由 Renderer 挂载；首轮布局提交可通过 `onAuthTransitionWarmupReady` 通知 Renderer。转场期间根节点保持隐藏、不可聚焦且不可交互，提醒继续暂停；动画结束后复用已挂载的同一 Workbench。

版本公告独立读取构建元数据中的官方发行版本、发布日期和 `update.json` 更新说明；按账户和版本在浏览器本地记录已确认状态，并受 `general.notificationPopupsEnabled` 控制。“我知道了”确认后不再自动显示该版本公告；设置中心“关于与更新”保留当前版本公告，供用户再次查看。Workbench 等提醒队列、通行密钥与桌面更新对话框收起后再展示公告；弹窗提醒不改变更新器下载/安装及强制更新合同。公告使用独立 `.release-announcement-modal` 样式和 Appearance 共享令牌。

壁纸画布仍消费 Settings Owner 的 `appearance.backgrounds` 与 `appearance.wallpaperEngine` 偏好。首帧根据账户启用状态、项目 ID 与已应用的 DSH Profile Client 图选择 Owner，避免刷新时先绘制账户背景再切到插件壁纸；Profile Client 图移除引擎后恢复账户背景，不改写用户保存的偏好。插件拥有活动壁纸画布时，Workbench 将 `--we-accent`、玻璃色/保真度/透明度、模糊、边框和逐面设置映射到 LFAA 共享 Appearance 令牌；插件停用或壁纸未运行时不装配该映射，回到账户 Appearance。Settings、左右侧栏、聊天和浮层分别读取 DSH 的 `data-we-*` 开关及逐面变量；玻璃滤镜沿用插件的模糊、饱和度、亮度和对比度，深色右侧栏沿用 65% 玻璃色权重；不复制插件配置、不增加请求或状态订阅。主题与字体角色继续分别使用 Theme Owner 和受限 DSH Token Bridge。

AI Work 的右栏正在拖动时，Workbench 根据 `ResizableWorkbench` 的 `data-dragging` 状态临时关闭大面积聊天/上下文表面的 `backdrop-filter`，减少 Grid 宽度逐帧变化时的重复背景采样；拖动完成、取消或失焦后由共享交互生命周期立即恢复，不改 Appearance 偏好、表面颜色或透明度。

Workbench 的 `allApplicationNavigationItems` 是内置应用菜单项的单一清单。设置中心的 `general.hiddenApplicationNavigationIds` 仅过滤传给应用菜单的可见项，所有页面仍持有完整清单用于设置展示和恢复；清单变化不更改路由、授权、应用运行状态或安装内容。
