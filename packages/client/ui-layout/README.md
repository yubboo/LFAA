# client/ui-layout

`Workbench` 将认证后的 `/plugins` 路由懒加载到 `ui-plugin-manager`，并把它作为独立模块工作区显示。页面的全局导航归 `ui-sidebar`，插件来源/状态展示与动作意图归 `ui-plugin-manager`；WorkBench 只装配该页面，不持有插件规则。

设置页只在 `/settings`、`/admin/users` 直达路由或用户悬停/聚焦设置导航时预热；工作台空闲时不主动下载整页，避免后台模块加载占用首屏资源。

## 小鱼共享工作入口（2026-10-14）

小鱼智能体对话区是首页，根地址与登录默认入口都落到 `/work`；旧工作路由归一。左侧紧凑“应用”菜单保留游戏库和各专业 App 的常规入口，沿用已有 App 打开、偏好保存和路由状态。共用工作区只有一个草稿写入器与活动会话选择；旧 App 草稿保留，首次无共享草稿时回读上次 App。通知直接打开共享会话。General 中旧 `defaultMode/defaultStandaloneChat` 字段保持账户读写兼容，不再改变首页。

构建只写仓库根 dist/packages/client/ui-layout/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

工作区现存卡片通过 `lfaa-card-motion` 和 `lfaa-card-motion-list` 注册到共享动效；Workbench 将账户 `general.cardMotionEffect` 映射到根节点，并将 `general.dialogMotionEffect`、减少动态效果偏好及当前 Appearance 主题/强调色/字体字号/对比度/壁纸表面令牌同步到 body，供 Ant Design Portal 的 Modal、确认弹窗和 Popconfirm 读取；弹窗外框、标题/正文/操作区留白和响应式滚动基础归 `ui-theme` 集中维护，业务页面只保留内容布局与必要尺寸。

Workbench 协调默认凭据安全提醒与首次配置提醒的先后顺序。凭据待处理状态由 `ui-renderer` 从 Account Owner 读取；Workbench 将状态交给 `ui-settings-general` 的 `SetupReminder`，各提醒共用同一 Modal。`general.notificationPopupsEnabled` 是用户可配置的弹出通知总开关，关闭时隐藏首次配置、凭据与通行密钥提醒，并阻止新增 AI 工作通知和 Toast。默认凭据、AI Provider 与业务内容存储的“不更改”操作由程序通过 Settings Owner 关闭对应内部标记；设置中心不暴露这些类别开关及类别当日暂停开关。业务内容存储的“去配置”只导航，由 Project Storage Owner 的 `configured` 状态决定之后是否继续提醒；AI 由活动账户状态决定。底部统一提供按账户/日期记录的“今日不再提醒”和当前工作区五分钟后重试的“稍后再说”；完成配置后各自状态检查自动停止提醒。AI Provider 与业务内容存储仍使用 `general.aiProviderReminderEnabled` 和 `general.setupReminderEnabled` 内部标记；写入失败保留弹窗并显示错误。三个关键提醒只使用 `workbench.css` 中 `.setup-reminder-modal` 的局部布局规则，其他 Modal 样式仍由各自 Owner 独立维护。SteamCMD 不进入首次配置提醒队列。凭据检查完成前及凭据提醒显示期间暂停首次配置提醒检查，避免并行请求和双重遮罩。

登录进入时，`Workbench` 仅在认证已成功后由 Renderer 挂载；首轮布局提交可通过 `onAuthTransitionWarmupReady` 通知 Renderer。转场期间根节点保持隐藏、不可聚焦且不可交互，提醒继续暂停；动画结束后复用已挂载的同一 Workbench。

版本公告独立读取构建元数据中的官方发行版本、发布日期和 `update.json` 更新说明；按账户和版本在浏览器本地记录已确认状态，并受 `general.notificationPopupsEnabled` 控制。“我知道了”确认后不再自动显示该版本公告；设置中心“关于与更新”保留当前版本公告，供用户再次查看。Workbench 等首次配置、凭据、通行密钥与桌面更新对话框收起后再展示公告；其独立 `.release-announcement-modal` 样式使用 Appearance 共享令牌，正文滚动而标题与确认操作保持可见，不复用设置提醒或桌面更新对话框样式。

壁纸画布仍消费 Settings Owner 的 `appearance.backgrounds` 与 `appearance.wallpaperEngine` 偏好。首帧根据账户启用状态、项目 ID 与已应用的 DSH Profile Client 图选择 Owner，避免刷新时先绘制账户背景再切到插件壁纸；Profile Client 图移除引擎后恢复账户背景，不改写用户保存的偏好。插件拥有活动壁纸画布时，Workbench 将 `--we-accent`、玻璃色/保真度/透明度、模糊、边框和逐面设置映射到 LFAA 共享 Appearance 令牌；插件停用或壁纸未运行时不装配该映射，回到账户 Appearance。Settings、左右侧栏、聊天和浮层分别读取 DSH 的 `data-we-*` 开关及逐面变量；玻璃滤镜沿用插件的模糊、饱和度、亮度和对比度，深色右侧栏沿用 65% 玻璃色权重；不复制插件配置、不增加请求或状态订阅。主题与字体角色继续分别使用 Theme Owner 和受限 DSH Token Bridge。
