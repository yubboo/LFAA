# Client UI Primitives

本包持有共享基础控件、状态组件和通用 SVG 图标。`ServiceStatus` 使用 `checking`、`online`、`offline` 真实状态提供统一文案；登录页可选用 `compact` 展示为可聚焦的小圆点，悬停或聚焦时以不参与布局计算的浮层显示状态文字。`WorkbenchIcon` 只负责绘制；图标的业务名称、可访问性文案、路由与点击操作由调用页面持有。共享图标集合包含 `arrowRight` 发送方向图标，不增加状态或样式配置。

`SettingRow` 可选暴露稳定 DOM id，供同一设置页的定向导航定位，不负责路由、持久化或业务开关。主题颜色和字号从 `ui-theme` 的共享令牌继承；本包不持有领域业务规则或持久化数据。构建只写仓库根 `dist/packages/client/ui-primitives/`。

SettingsSwitch 通过受控的 checked 与 onChange 保持原有开关语义，点击时只在 1/2 间轮换组件本地动画 key，让滑块节点重新播放一次 Jelly Toggle；不新增计时器、订阅或偏好写入路径。轨道颜色、滑块移动与拉伸、hover/press 反馈由 ui-theme/common.css 呈现，并沿用 Workbench 的减少动态效果映射。

Three.js `0.186.1` 与 `@types/three` `0.186.0` 作为共享空间视觉组件的依赖登记在本包。依赖接入本身不代表已有产品页面使用 3D；后续页面只能消费本包封装的共享场景组件，不能直接创建独立 renderer。新场景按需导入 Three.js、遵循 Appearance/减少动态效果设置，并在不可用时保留主题驱动的 CSS 后备与真实 HTML 控件。
