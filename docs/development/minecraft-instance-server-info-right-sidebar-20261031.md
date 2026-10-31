# Minecraft 实例服务器信息右侧栏

<a id="lfaa-minecraft-instance-server-info-right-sidebar-20261031"></a>

## 用户目标与可观察结果

- 用户希望在 Minecraft 实例概览的右侧栏新增“服务器信息”，可查看并复制该实例真实服务器地址、名称和目录，以及核心、模式、端口、世界等实例事实。
- 所有字段随选中实例的最新数据变化；不得使用截图示例值、默认值或从节点名猜连接地址。没有权威数据时明确显示未登记/尚未读取，地址没有来源时不提供复制按钮。
- 本模块只在 `/games/minecraft/instance/:instanceId/overview` 显示；切换实例、账户或离开概览后不得残留旧数据。

## 入口、Owner 与数据

- 运行入口：Minecraft 实例详情的 `overview` 页面右侧栏。
- `packages/client/ui-minecraft` 负责读取当前已装配实例快照、格式化真实 `server.properties` 节点快照，并提供只读复制操作；实例名、核心名/版本/构建来自 Minecraft Owner 现有 `MinecraftInstance` API。
- 游戏模式、服务端口和世界名仅从 `serverProperties.fileSnapshot` 的真实节点条目读取，并显示节点观测时间。概览首次进入且无文件快照时，管理员复用现有认证、能力检查和 Minecraft 只读 `properties/read` 任务链读取一次；不写配置。离线、无能力、未授权、未读取或失败均不以默认值补齐。
- 可分享玩家地址只读取 `ConnectivityOverview.routes` 中当前账户、`sourceAppId=minecraft` 且 `targetId` 等于当前实例 ID 的真实 `playerAddress`；按路线真实状态标注。路线由 `packages/network/game-connectivity` 唯一持有；不得把 `127.0.0.1`、节点显示名、空的 `server-ip` 或端口拼成公网/玩家地址。
- 实例物理目录通过 `packages/games/minecraft` 已有的 `getMinecraftInstanceShellDirectory()` 解析，由 Minecraft Controller 新增管理员只读 endpoint 返回；不从设置路径、实例名或本机环境在浏览器重建。目录字段受管理员授权约束。
- 右侧布局由 `packages/client/ui-workspace` 按窄实例上下文装配；Minecraft UI 是事实解析与展示 Owner。仅当当前账户、角色、App 和具体 overview 路由均匹配时才挂载。

## 设置、权限与边界

- 不新增或修改设置。沿用 Settings Owner 的 Appearance 主题、强调色、字体/字号、对比度、遮罩/模糊、减少动态效果，以及工作区右侧栏显隐/宽度偏好。
- 实例数据及 server.properties 读取沿用既有 Minecraft 认证、管理员授权、节点能力和任务结果；路径 endpoint 仅管理员可用；联机路线沿用当前账户隔离 API。
- 复制使用浏览器真实 Clipboard API；只有写入成功才反馈已复制，失败明确反馈，不伪造成功。
- 不启停/重启服务，不写 server.properties，不变更用户设置，不创造网络路线，不猜测公共/局域网 IP；不新增轮询、订阅或长列表。

## 可观察验收条件

- overview 右栏随路由实例切换，服务器名与核心字段来自对应实例；服务器属性由节点快照提供并标注观测时间；目录由授权 API 返回；玩家地址只显示实际绑定的当前账户路线。
- 点击地址或目录复制真实完整字符串，浏览器 Clipboard 成功才出现成功反馈；复制失败保留明确错误。无路线时不显示伪造地址/复制按钮；成员不读取或看到物理路径。
- 返回实例列表/切换 App/账户后移除实例信息；慢响应不得覆盖后续选择；属性读取失败、节点离线、数据未加载均有真实状态提示。
- 完成 Client 类型检查、Minecraft UI / Workspace / Connection 包构建、Minecraft Controller/Control Plane 与正式 Web 构建，差异检查；不运行自动化测试。
- 在 ChatGPT 内置浏览器检查实际实例 overview 桌面、窄分栏和短屏视口，目视核对动态字段、复制交互、换实例与无路由状态；不触发开服、配置写入或用户偏好变化。任务合同记录截图、交互和未测边界。

## UI 方向与性能边界

- 沿用 `packages/client/ui-minecraft/DESIGN.md` 的层级、共享令牌和容器响应式规则；信息卡片只显示有来源的项目，长地址/目录换行，复制按钮仍可触达。不加新主题令牌、动效或依赖。
- 六项必需 UI Skills 已在本轮 LFAA UI 工作上下文读取；本次保持当前 Operate 型密集管理界面的克制信息层级。Audit Skills 的 Java/.NET/PHP 覆盖不包含 TSX/CSS，不声明对本次前端代码的专项扫描结论。

## 实施与验收记录

- 状态：完成。
- 已改动：Connection 增加可取消的联机路线读取和管理员实例目录读取；Minecraft Controller 为目录解析增加认证管理员只读路由；Minecraft UI 将当前实例快照、节点配置观测、匹配联机路线和授权目录组合为概览右栏模块，并提供真实剪贴板复制及手动刷新；Workspace 仅在匹配的实例概览路由装配该模块。
- 已复用：Appearance/Workbench 现有主题与右侧栏偏好；Minecraft 既有只读 `properties/read` 任务及能力/角色检查；Connectivity Owner 当前账户路线 API；Minecraft Owner 的 `getMinecraftInstanceShellDirectory()`；没有新增设置或写入操作。
- 已运行：Client 与 Host `tsc --noEmit`、Connection/Minecraft UI/Workspace/Controller/Minecraft Domain 能力包构建、正式 Control Plane 与 Web 构建，以及全仓 `git diff --check` 均通过；最终 `node scripts/runtime-build-state.mjs web` 为 `[]`，`http://127.0.0.1:3000` 返回 200。未运行自动化测试。
- ChatGPT 内置浏览器实页：最终正式菜单安全重启后重新加载 `/games/minecraft/instance/bd7c58bb-a1e1-4d20-b7f6-d66f23841e2d/overview`，确认模组 1.16.5 的 CatServer build79、世界 `world`、端口 25566、真实实例目录及节点观测时间；当前账户未登记该实例玩家连接路线，页面如实显示未登记且不提供假地址。点击真实目录复制按钮后出现“已复制到剪贴板”。
- 切换 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/overview` 后，核对名称 xiaoyu-e2e-paper1122-20261026、Paper 1.12.2 build 1620、世界 `world`、端口 25565、该实例自己的目录及独立快照时间；返回服务器列表时详情右栏卸载，再进入第二实例时信息切换为其真实值。未创建或修改连接路线。
- 响应式实页：桌面 1280×720、窄分栏 820×640、手机短屏 390×520 均可滚动查看完整信息；长目录在右栏换行，复制入口可达。`document.documentElement.scrollWidth` 与视口宽度在 820、390 两种尺寸均相等。临时视口覆盖已重置。
- 未测：非管理员账号访问路径接口、实际已登记玩家地址的复制、物理手机/平板、帧时间和屏幕阅读器。验收未启停实例、写入服务器配置或改动用户偏好。浏览器实页截图已在本轮内置浏览器验收记录中采集。
- 菜单启动记录：首次 Web 构建被共享源码在构建期间变化的指纹保护中止；随后重新构建成功。运行中的服务曾检测到构建产物在启动后更新，按用户此前授权再次安全重启。最终再次核对指纹为 `[]`，重新载入页面没有“需要重新启动”提示。
