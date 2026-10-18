# client/ui-renderer

## 小鱼共享工作入口（2026-10-14）

统一路由归一与认证恢复；根地址、登录恢复和默认首页进入 `/work` 小鱼智能体对话区。专业 App 从全局导航紧凑应用菜单打开，沿用现有应用入口标记与服务端认证/授权。旧工作地址刷新/历史归一。

构建只写仓库根 dist/packages/client/ui-renderer/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

Renderer 持有默认凭据提醒的服务端读取和“稍后再说”确认状态；对话框的当日暂停与关闭总开关由 `ui-settings-general/SetupReminder` 复用本地日期标记和 Settings Owner 保存。Workbench 管理当日暂停期间的提醒排队；Renderer 不会因本地暂停而确认或修改服务端凭据状态。
