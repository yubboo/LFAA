# client/ui-sidebar

## 小鱼共享工作入口（2026-10-14）

全局导航在小鱼智能体工作区、文件、插件和设置页面共用。插件入口位于最左侧导航轨，导航到独立 `/plugin-manager` 工作区；DSH Host 保留 `/plugins` 作为只读资源包路由。首页房子返回 `/work` 或页面来源；全局“应用”按钮在应用工作区展开左侧 Dock 内的共享 `SecondaryNavigation`，文件、插件和设置页面仍使用紧凑应用弹出菜单。两种入口都消费同一 Workbench 应用清单并调用现有路由 Owner。连接状态点消费 `general.showServiceStatus`；最近会话在共用小鱼中打开，不为每个 App 建工作入口。

`SecondaryNavigation` 是设置与业务工作区共用的二级菜单呈现组件。调用方提供分组、当前项与选择回调并持有唯一状态；组件统一提供滚动、分组折叠、当前项反馈和键盘移动，不读取设置或执行业务导航。侧栏尺寸、拖动、吸附、收起与响应式 Overlay 继续由 `lfaa-client-ui-dockkit/ResizableWorkbench` 持有。

构建只写仓库根 dist/packages/client/ui-sidebar/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
