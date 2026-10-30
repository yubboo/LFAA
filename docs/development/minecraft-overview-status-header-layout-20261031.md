# Minecraft 总览页连接状态与同步时间位置调整

<a id="lfaa-minecraft-overview-status-header-layout-20261031"></a>

## 用户目标与可观察结果

- 在 `/games/minecraft` 总览页，将“控制端已连接”与“同步于…”从标题下方的混合操作行移至标题区域最右侧，按用户图二的标题栏对齐。
- “新建服务器”“刷新状态”及必要的重连操作仍可到达；不丢失现有真实状态、刷新行为或标题说明。
- 桌面、窄分栏和手机视口均无重叠、横向溢出或不可达操作。

## 入口、Owner 与边界

- 真实入口是 Web/Desktop 共用 Client 的 `/games/minecraft`，Minecraft 总览标题与操作由 `packages/client/ui-minecraft/src/MinecraftWorkspace.tsx` 呈现，样式由同包 `MinecraftWorkspace.css` 唯一维护。
- 连接状态继续读取当前 `realtimeStatus`；同步时间继续读取现有 `lastRefreshedAt`。不新建请求、缓存或状态，也不改变刷新/重连动作。
- 共享 Workbench 只承载页面；不改路由、控制端 API、Socket、实例数据或节点能力。

## 设置、权限与数据边界

- 不新增设置项；继续沿用 Settings 提供的字体、字号、颜色与 Appearance 令牌。此位置调整不改变 `general.showServiceStatus`、服务状态读取或用户偏好。
- 继续使用当前认证和 Permission Owner；实页验收只读状态，不触发实例启停、刷新写入、设置保存或文件操作。

## 可观察验收

- 正式 Web `/games/minecraft` 标题左侧显示标题/说明，连接状态和同步时间位于标题区域最右侧；页面操作仍可用。
- 内置浏览器覆盖常用桌面和一处窄分栏/短屏视口；组件不交叠，页面无横向溢出，状态文案和关键按钮可读、可操作。
- 直接相关回归、Minecraft UI 包构建、Client 类型检查和 Web 构建通过；构建只写仓库根 `dist/`。
- 记录真实路由、视口、实际状态、截图与未测边界；不以静态截图代替真实页面验收。

## 实施与验收记录

- 状态：完成。
- 目标布局：标题/说明在左，连接状态与同步时间独立靠右；新建、刷新等动作留在可适应容器宽度的操作区。
- 回归、类型与构建：Minecraft UI 定向回归 6/6、Minecraft UI 包构建、Client 类型检查及根 `dist/` Web 构建通过。
- 正式 Web 实页：ChatGPT 内置浏览器在 `http://127.0.0.1:3000/games/minecraft` 与实例概览路由检查；桌面 1440×900，窄分栏 820×520，手机宽高 390×844、390×520、360×640、320×640。标题区状态与同步时间在窄宽度下保持可读；页面纵向可滚动、无横向文档溢出；实例文件入口及返回实例路由正常。
- 设置：未新增设置项，沿用已有外观与 Workbench 布局设置；实页验收未保存或重置用户偏好。
