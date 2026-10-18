# client/ui-settings-general

持有工作台通用设置界面和首次配置提醒组件。`SetupReminder` 复用共享 Modal，以单一标题和简洁说明展示首次配置与账户凭据提醒；首次配置只检查 AI Provider 与业务内容存储。SteamCMD 配置集中在“项目与存储”，不通过首次配置 Modal 提醒。

账户安全提醒沿用设置中心 `general.defaultAdminCredentialReminderEnabled`。关闭按钮保存该设置，成功后才关闭提示；“今日不再提醒”只在浏览器本地按账户和本地日期记录，与首次配置类别隔离，次日自然恢复；“稍后再说”只清除当前登录会话中的提醒状态，下次登录仍从 Account Owner 读取未完成的安全状态。本包不创建账户/凭据状态，不改变认证 API，也不改写其他提醒偏好。

AI Provider 提醒使用 `general.aiProviderReminderEnabled`；业务内容存储提醒使用既有 `general.setupReminderEnabled`。两个类别分别按当前用户和本地日期暂停；“不再提醒”只关闭当前提醒类别，“稍后再说”只收起本次显示。`general.notificationPopupsEnabled` 仍是全局弹出通知总开关。

组件消费 `ui-layout/Workbench` 传入的账户状态及操作回调；设置类型、默认值、校验和服务端持久化归 Settings Owner。视觉沿用工作台 `general.dialogMotionEffect` 与 Appearance 主题、字体、字号、对比度、壁纸表面透明度/模糊和减少动态效果映射。
