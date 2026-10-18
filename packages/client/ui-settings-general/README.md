# client/ui-settings-general

持有工作台通用设置界面和首次配置提醒组件。`SetupReminder` 复用共享 Modal，以单一标题和简洁说明展示首次配置与账户凭据提醒；首次配置条件来自现有 AI、SteamCMD 和内容存储 Owner。`general.notificationPopupsEnabled` 关闭时隐藏两类提醒；各类别开关、当日暂停及内容存储选择沿用现有存储合同，不被总开关重置。

账户安全提醒沿用设置中心 `general.defaultAdminCredentialReminderEnabled`。关闭按钮保存该设置，成功后才关闭提示；“今日不再提醒”只在浏览器本地按账户和本地日期记录，与首次配置提醒的暂停标记隔离，次日自然恢复；“稍后再说”继续调用 Account Owner 的原确认回调。本包不创建账户/凭据状态，不改变认证 API，也不改写其他提醒偏好。

组件消费 `ui-layout/Workbench` 传入的账户状态及操作回调；设置类型、默认值、校验和服务端持久化归 Settings Owner。视觉沿用工作台 `general.dialogMotionEffect` 与 Appearance 主题、字体、字号、对比度、壁纸表面透明度/模糊和减少动态效果映射。
