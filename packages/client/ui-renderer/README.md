# client/ui-renderer

## 小鱼共享工作入口（2026-10-14）

统一路由归一与认证恢复；根地址、登录恢复和默认首页进入 `/work` 小鱼智能体对话区。专业 App 从全局导航紧凑应用菜单打开，沿用现有应用入口标记与服务端认证/授权。旧工作地址刷新/历史归一。

构建只写仓库根 dist/packages/client/ui-renderer/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

Renderer 从 Account Owner 读取默认凭据待处理状态，并在用户离开设置路由后重新读取；修改仍未完成时提醒继续出现。`ui-settings-general/SetupReminder` 管理按账户/本地日期隔离的当日暂停、当前工作区五分钟稍后重试，以及由 Settings Owner 保存的内部“不更改”标记。设置中心不提供凭据提醒开关。Renderer 不会因本地暂停或稍后重试而确认或修改服务端凭据状态。
