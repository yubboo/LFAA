# 共享前端主题

本包拥有跨组件样式：`tokens.css` 定义共享设计令牌，`base.css` 定义文档基础样式，`common.css` 集中定义共享状态、卡片动效和 Ant Design Modal/确认弹窗统一的表面、标题、内容、操作区、窄屏滚动与动效，`responsive.css` 提供跨页面断点。对话框使用一致的 14px 圆角、边框、阴影和紧凑留白，标题、正文及按钮跟随 Appearance 字体与字号；壁纸表面透明度/模糊、主题颜色和减少动态效果也继续从共享令牌读取。业务包可保留内容所需的宽高和专属内部布局，但不重复定义外框样式。

共享样式由 `packages/client/ui-renderer/src/render.tsx` 集中导入一次。普通卡片在卡片元素添加 `lfaa-card-motion`、在直接卡片列表添加 `lfaa-card-motion-list`，由 `ui-layout` 的工作台根节点消费账户常规设置。Ant Design Modal、确认弹窗和 Popconfirm 自动消费 body 上的 `data-lfaa-dialog-motion-effect`；单个 Modal 可在 `rootClassName` 使用 `lfaa-dialog-motion--fluid`、`--fade`、`--lift` 或 `--none` 覆写共享效果。卡片与弹窗共用 `util/values` 的效果目录，各自独立选择；弹窗入场只变换位置/缩放并保持内容不透明，静态模式使用无可见变化的 64ms 动画发出 rc-motion 完成事件，避免 Modal/Popconfirm 离场后残留遮罩；用户或系统的减少动态效果偏好仍沿 Workbench 映射生效。

`dsh-wallpaper-appearance.ts` 是固定 Wallpaper Engine Client 的 Appearance 兼容层：活动 DSH 画布时把插件运行时的强调色、可读性地板、玻璃色/透明度/模糊/边框及逐面变量映射为 LFAA 共享令牌；聊天直接消费插件生成的 `--we-chat-glass-fill`，侧栏、设置面和浮层按 DSH 的逐面混色权重与滤镜呈现。插件停用或画布不活动时由 Workbench 不装配该覆盖，账户 Appearance 自然生效。它仅读取 DSH Client 在 body 上已公布的 CSS 令牌，不复制插件设置、不请求数据、不增加观察器；`ctx.theme` 的偏好和受限颜色/字体角色仍由 `dsh-theme-bridge.ts` 单独适配。当前 LFAA 没有面向用户任意主题包的 Theme Registry、选择持久化或完整语义令牌校验；第三方主题包不能借 Wallpaper Engine 的专用桥接进入 Client。

`appearance-theme-bootstrap.ts` 为刷新首帧缓存主题偏好与当前路由的内置壁纸遮罩；画布缓存只允许公开图片路径，并与账户 `appearance.overlay` 同步。`apps/web/index.html` 在样式和 React 到达前用同主题色与透明度绘制壁纸，工作台挂载后交由 `appearance.theme`、`appearance.overlay` 与现有表面 `appearance.blur` 令牌继续呈现。Wallpaper Engine 独占画布时不缓存 LFAA 壁纸。

`login-appearance.ts` 只缓存已确认的登录页外观白名单并按用户名隔离，AuthView 仅在输入用户名匹配时使用；登录背景沿用当前设备的内置图片 ID，不保存上传图片或插件设置。账户 Appearance 仍由 Settings Owner 持久化，账号不匹配或缓存损坏时回到 `DEFAULT_USER_SETTINGS.appearance`。

共享卡片列表最多为前六张卡片播放入场效果，第二至第六张之间每项错开 40ms；Minecraft 任务列表使用这一共享样式。效果只在现有 `general.cardMotionEffect` 启用时播放，并遵循 `appearance.advanced.reducedMotion` 与系统减少动态效果偏好。

源码由 Web/Client 组合装配，不代表包单独可运行。构建产物只写仓库根 `dist/packages/client/ui-theme/`。

共享 SettingsSwitch 的 Jelly Toggle 由 common.css 实现：轨道颜色与滑块位置约 350ms 过渡，内部滑块沿点击方向拉伸后回弹；按压反馈仅缩放控件，动效只改变 transform 与轨道颜色。它读取 Workbench 映射的 appearance.advanced.reducedMotion，不创建新的偏好，也不持有开关值或保存行为。
