# client/ui-settings-account

本包持有账户设置界面与登录/账户安全提示。账户身份、凭据状态、通行密钥可用性与写入仍由 Account Owner 提供；Client 只展示状态并调用其已认证 API。

`PasskeySetupPrompt` 的自动弹出受账户 `general.notificationPopupsEnabled` 控制；关闭总开关只隐藏提示，不读取或改写通行密钥状态。用户主动进入安全设置后，通行密钥注册、密码验证和凭据操作继续按 Account Owner 与 Permission Owner 的既有合同执行。

视觉消费 Appearance 共享令牌及减少动态效果偏好。构建只写仓库根 `dist/packages/client/ui-settings-account/`；认证、真实账户与浏览器验收分别记录。
