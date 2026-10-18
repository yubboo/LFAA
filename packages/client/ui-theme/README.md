# 共享前端主题

本包拥有跨组件样式：`tokens.css` 定义共享设计令牌，`base.css` 定义文档基础样式，`common.css` 集中定义共享状态、已注册卡片动效及 Ant Design Modal/确认弹窗的表面、滚动边界与动效，`responsive.css` 提供跨页面断点。Modal 默认读取 Appearance 的主题、字体/字号、颜色、壁纸表面透明度和模糊；页面业务内容布局仍归各页面/组件样式文件。

共享样式由 `packages/client/ui-renderer/src/render.tsx` 集中导入一次。普通卡片在卡片元素添加 `lfaa-card-motion`、在直接卡片列表添加 `lfaa-card-motion-list`，由 `ui-layout` 的工作台根节点消费账户常规设置。Ant Design Modal 与确认弹窗自动消费 body 上的 `data-lfaa-dialog-motion-effect`；特殊页面仍可通过专属类覆盖。卡片与弹窗共用 `util/values` 的效果目录，各自独立选择；用户或系统的减少动态效果偏好始终优先。

`dsh-wallpaper-appearance.ts` 是固定 Wallpaper Engine Client 的 Appearance 兼容层：活动 DSH 画布时把插件运行时的强调色、可读性地板、玻璃色/透明度/模糊/边框及逐面变量映射为 LFAA 共享令牌；聊天直接消费插件生成的 `--we-chat-glass-fill`，侧栏、设置面和浮层按 DSH 的逐面混色权重与滤镜呈现。插件停用或画布不活动时由 Workbench 不装配该覆盖，账户 Appearance 自然生效。它仅读取 DSH Client 在 body 上已公布的 CSS 令牌，不复制插件设置、不请求数据、不增加观察器；`ctx.theme` 的偏好和受限颜色/字体角色仍由 `dsh-theme-bridge.ts` 单独适配。当前 LFAA 没有面向用户任意主题包的 Theme Registry、选择持久化或完整语义令牌校验；第三方主题包不能借 Wallpaper Engine 的专用桥接进入 Client。

`appearance-theme-bootstrap.ts` 为刷新首帧缓存主题偏好与当前路由的内置壁纸遮罩；画布缓存只允许公开图片路径，并与账户 `appearance.overlay` 同步。`apps/web/index.html` 在样式和 React 到达前用同主题色与透明度绘制壁纸，工作台挂载后交由 `appearance.theme`、`appearance.overlay` 与现有表面 `appearance.blur` 令牌继续呈现。Wallpaper Engine 独占画布时不缓存 LFAA 壁纸。

源码由 Web/Client 组合装配，不代表包单独可运行。构建产物只写仓库根 `dist/packages/client/ui-theme/`。
