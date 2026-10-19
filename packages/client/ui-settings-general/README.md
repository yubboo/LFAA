# client/ui-settings-general

持有工作台通用设置界面和首次配置提醒组件。`SetupReminder` 复用共享 Modal，以单一标题和简洁说明展示首次配置与账户凭据提醒；首次配置只检查 AI Provider 与业务内容存储。SteamCMD 配置集中在“项目与存储”，不通过首次配置 Modal 提醒。

账户安全提醒沿用 Settings Owner 的内部标记 `general.defaultAdminCredentialReminderEnabled`。“不更改”由程序保存为关闭并保留当前凭据；该标记不在设置中心提供用户开关。“更改”只打开安全设置，Renderer 在离开设置路由时重新读取 Account Owner 状态；凭据仍未完成时继续提醒。底部“今日不再提醒”只在浏览器本地按账户和本地日期记录，次日自然恢复；“稍后再说”在当前工作区延后五分钟，不确认服务端安全状态。本包不创建账户/凭据状态，不改变认证 API，也不改写其他提醒偏好。

AI Provider 提醒使用 Settings Owner 的内部标记 `general.aiProviderReminderEnabled`；业务内容存储提醒使用 `general.setupReminderEnabled`。设置中心不向用户显示这两个标记，也不显示凭据提醒或类别当日暂停开关；“不更改”才会由程序保存关闭对应标记。“今日不再提醒”继续按账户、类别和本地日期记录；“稍后再说”在当前工作区延后五分钟。活动 AI 账户及 `configured` 内容目录分别由对应 Owner 的真实状态决定是否停止提醒。“去配置”只导航；返回设置路由后仍未完成则再次检查并提醒。系统推荐/自定义路径统一由设置中心和项目存储 Owner 管理。弹窗不直接写业务存储目录。`general.notificationPopupsEnabled` 仍是用户可配置的全局弹出通知总开关。

组件消费 `ui-layout/Workbench` 传入的账户状态及操作回调；设置类型、默认值、校验和服务端持久化归 Settings Owner。视觉沿用工作台 `general.dialogMotionEffect` 与 Appearance 主题、字体、字号、对比度、壁纸表面透明度/模糊和减少动态效果映射。

`SetupReminder` 在检查和显示期间向 Workbench 报告弹窗占用状态，供不同类型的全局公告顺序展示；不复制发布说明或持久化全局公告状态。
