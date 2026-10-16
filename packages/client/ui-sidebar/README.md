# client/ui-sidebar

## 小鱼共享工作入口（2026-10-14）

全局导航在小鱼智能体工作区、文件、插件和设置页面共用。插件入口位于最左侧导航轨，导航到独立 `/plugin-manager` 工作区；DSH Host 保留 `/plugins` 作为只读资源包路由。首页房子返回 `/work` 或页面来源；紧凑“应用”菜单保留游戏库与全部专业 App 常规入口，调用现有路由 Owner。连接状态点消费 `general.showServiceStatus`；最近会话在共用小鱼中打开，不为每个 App 建工作入口。

构建只写仓库根 dist/packages/client/ui-sidebar/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
