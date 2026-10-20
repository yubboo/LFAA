# client/ui-sidebar

## 小鱼共享工作入口（2026-10-14）

全局导航在小鱼智能体工作区、文件、插件和设置页面共用。插件入口位于最左侧导航轨，导航到独立 `/plugin-manager` 工作区；DSH Host 保留 `/plugins` 作为只读资源包路由。首页房子返回 `/work` 或页面来源；Workbench 工作区的全局“应用”按钮打开右侧 Dock 的应用视图，设置页、插件管理页和文件管理页通过一次性打开请求进入 `/work` 并展开该视图。入口消费同一 Workbench 应用清单并调用现有路由 Owner。连接状态点消费 `general.showServiceStatus`；“最近会话”必须由调用方提供独立回调：AI Work 页面展开既有左二 Dock，工作区外由 Workbench 传递一次性打开请求后进入 `/work` 并展开 Dock。应用与会话入口分属左右 Dock，均使用各自的唯一清单和 Owner，不复制状态；“工作·小鱼智能体”只负责进入工作区。选择会话继续沿用原工作区会话操作，不为每个 App 建工作入口。

`SecondaryNavigation` 是设置与业务工作区共用的二级菜单呈现组件。调用方提供分组、当前项与选择回调并持有唯一状态；组件统一提供滚动、分组折叠、当前项反馈和键盘移动，不读取设置或执行业务导航。侧栏尺寸、拖动、吸附、收起与响应式 Overlay 继续由 `lfaa-client-ui-dockkit/ResizableWorkbench` 持有。

全局“应用”菜单接收 Workbench 的完整应用清单及按 `general.hiddenApplicationNavigationIds` 过滤后的可见清单。工作区右侧“应用”视图消费可见清单与现有路由/应用打开回调；左二只负责 AI Work 草稿、会话和项目。设置分类只控制导航入口显隐，不改变应用权限、路由或实例状态；所有隐藏时显示设置入口提示，不生成替代应用。

构建只写仓库根 dist/packages/client/ui-sidebar/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
