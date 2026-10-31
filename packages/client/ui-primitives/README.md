# Client UI Primitives

本包持有共享基础控件、状态组件和通用 SVG 图标。`WorkbenchHeader` 统一工作区的左侧切换入口、页面标题、中间模式槽和右侧操作槽；只负责结构、外观令牌和容器响应式排布，开合状态、路由、按钮行为与模式数据由调用页面持有。`ServiceStatus` 使用 `checking`、`online`、`offline` 真实状态提供统一文案；登录页可选用 `compact` 展示为可聚焦的小圆点，悬停或聚焦时以不参与布局计算的浮层显示状态文字。`WorkbenchIcon` 只负责绘制；图标的业务名称、可访问性文案、路由与点击操作由调用页面持有。共享图标集合包含 `arrowRight` 发送方向图标和 `chat` 对话气泡图标，不增加状态或样式配置。

`NotificationToast` 是 Minecraft 操作通知与 Workbench 小鱼工作通知共用的提示卡外壳，统一负责单一表面背景、信息/图标/操作链接、右上角关闭按钮和可选底部倒计时布局。通知内容、真实状态、计时器、关闭与跳转行为、提示音仍由调用方及其既有 Owner 持有；组件不创建请求、计时器或持久化设置，样式沿用共享主题和减少动态效果映射。

`SettingRow` 可选暴露稳定 DOM id，供同一设置页的定向导航定位，不负责路由、持久化或业务开关。主题颜色和字号从 `ui-theme` 的共享令牌继承；本包不持有领域业务规则或持久化数据。构建只写仓库根 `dist/packages/client/ui-primitives/`。

SettingsSwitch 通过受控的 checked 与 onChange 保持原有开关语义，点击时只在 1/2 间轮换组件本地动画 key，让滑块节点重新播放一次 Jelly Toggle；不新增计时器、订阅或偏好写入路径。轨道颜色、滑块移动与拉伸、hover/press 反馈由 ui-theme/common.css 呈现，并沿用 Workbench 的减少动态效果映射。

Three.js `0.186.1` 与 `@types/three` `0.186.0` 由本包管理；`DirectorDeskStage` 是共享 3D 导演台场景 renderer，供 `ui-workspace` 的系统画布导演台编辑器按需加载。它绘制程序化白模演员/场景块、网格和相机预览，处理场景拖动、相机观察、容器尺寸与 WebGL 资源清理；业务对象、选中状态和持久化仍归调用页面及画布 Owner。主题颜色读取现有 Appearance 令牌，`canvas.snapToGrid` 控制场景对象吸附；WebGL 不可用时保留可访问提示和真实 HTML 控件。其他页面通过本包场景组件消费 3D 能力，不自行创建 renderer。

`LightRays` 适配 React Bits `@react-bits/LightRays-JS-CSS`（JavaScript + CSS 变体）并按 LFAA 的 TSX/共享 CSS 习惯改写；使用本包已有 Three.js `0.186.1` 的单一 `WebGLRenderer`、单画布与 `setAnimationLoop` 渲染片元着色器。绘制像素总量最多 1.25M；页面隐藏、容器离屏或启用减少动态效果时暂停连续循环，卸载时释放材质、几何体和 renderer，WebGL 不可用时显示 CSS 光线后备。背景色读取 Workbench 的 `--settings-accent` 与主题，不新增依赖。光线用途和开关由业务 Owner 控制，本包只负责 renderer；版权、MIT + Commons Clause 与无担保声明见 [第三方声明](THIRD-PARTY-NOTICES.md)。上游页面：[React Bits LightRays](https://www.reactbits.dev/backgrounds/light-rays)；上游代码按用户提供的组件快照集成，未运行 shadcn CLI 或新增外部包。组件随 LFAA 应用使用，不单独销售、许可或再分发。
