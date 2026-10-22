# Client UI Primitives

本包持有共享基础控件、状态组件和通用 SVG 图标。`ServiceStatus` 使用 `checking`、`online`、`offline` 真实状态提供统一文案；登录页可选用 `compact` 展示为可聚焦的小圆点，悬停或聚焦时以不参与布局计算的浮层显示状态文字。`WorkbenchIcon` 只负责绘制；图标的业务名称、可访问性文案、路由与点击操作由调用页面持有。共享图标集合包含 `arrowRight` 发送方向图标，不增加状态或样式配置。

`SettingRow` 可选暴露稳定 DOM id，供同一设置页的定向导航定位，不负责路由、持久化或业务开关。主题颜色和字号从 `ui-theme` 的共享令牌继承；本包不持有领域业务规则或持久化数据。构建只写仓库根 `dist/packages/client/ui-primitives/`。
