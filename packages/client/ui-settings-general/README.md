# client/ui-settings-general

持有工作台通用设置界面和首次配置提醒组件。`SetupReminder` 复用共享 Modal，按默认凭据、AI Provider、业务内容目录的顺序逐项显示待处理提醒。状态由 Account、AI Account 与 Project Storage Owners 提供；SteamCMD 游戏安装位置仍在“项目与存储”管理，但不属于首次登录提醒。本组件只排队并导航，不直接修改 Provider、SteamCMD 或业务目录。

账户安全提醒沿用 Settings Owner 的 `general.defaultAdminCredentialReminderEnabled`。“不更改”由程序保存为关闭并保留当前凭据；“更改”只打开安全设置，Renderer 在离开设置路由时重新读取 Account Owner 状态；凭据仍未完成时继续提醒。底部“今日不再提醒”只在浏览器本地按账户和本地日期记录，次日自然恢复；“稍后再说”在当前工作区延后五分钟，不确认服务端安全状态。提醒类别没有单独的设置中心开关；现有 `general.notificationPopupsEnabled` 统一暂停或恢复弹窗。本包不创建账户/凭据状态，不改变认证 API。

AI Provider 和业务内容存储提醒分别使用 Settings Owner 的 `general.aiProviderReminderEnabled`、`general.setupReminderEnabled`；“不更改”由程序保存为关闭当前类别提醒。SteamCMD 游戏安装位置不作为首次登录提醒，仍可在“项目与存储”中单独管理。首次登录类别和版本公告不在通知设置中提供单独开关；既有 `general.notificationPopupsEnabled` 统一暂停或恢复所有弹窗。“今日不再提醒”按账户、类别和本地日期记录；“稍后再说”在当前工作区延后五分钟。活动 AI 账户与 `configured` 内容目录分别由对应 Owner 的真实状态决定是否停止提醒。“去配置”只导航；返回工作区后仍未完成则再次检查并提醒。系统推荐/自定义路径统一由设置中心及其领域 Owner 管理。弹窗不直接写业务存储目录。

组件消费 `ui-layout/Workbench` 传入的账户状态及操作回调；设置类型、默认值、校验和服务端持久化归 Settings Owner。视觉沿用工作台 `general.dialogMotionEffect` 与 Appearance 主题、字体、字号、对比度、壁纸表面透明度/模糊和减少动态效果映射。

`SetupReminder` 在检查和显示期间向 Workbench 报告弹窗占用状态，供不同类型的全局公告顺序展示；不复制发布说明或持久化全局公告状态。
