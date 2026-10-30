# LFAA Minecraft 实例配置页标题与标签栏间距收紧（2026-10-30）

<a id="lfaa-minecraft-instance-config-spacing-20261030"></a>

## 用户问题、目标与入口

- 用户指出附件红框中的留白太多、标题区与实例导航隔得过宽。
- 当前实页入口：`/games/minecraft/instance/:instanceId/{overview,configuration}`；实例详情由同一 Minecraft 页面 Owner 承载。
- 目标：让实例页标题、操作状态和实例导航成为紧凑的一组；保留导航与配置内容之间原有距离及全页其余排版。
- 源码现状：Minecraft 工作区通用纵向 `gap` 至少为 22px，页头和实例导航是直接子项，因此被同一通用区块间距分开。

## Owner、设置与数据边界

- 页面与样式唯一 Owner：`packages/client/ui-minecraft`，入口组件 `MinecraftWorkspace.tsx`。
- 数据 Owner：Minecraft API/Daemon 继续提供真实实例状态和节点 `server.properties` 快照；本任务不改变其读取或保存链路。
- 设置中心：没有控制这段页面间距的设置。保留既有 Appearance 主题、字号/字体、强调色、背景不透明度与模糊映射；不新增设置、不读写或重置用户偏好。
- 权限与安全：不改变认证、角色、节点隔离、Permission Owner 或实例操作；实页验收只读页面与导航，不保存配置、不启动/停止实例、不连接终端。

## 修改范围与验收

- 允许修改：Minecraft 页面顶部结构与样式、受影响包说明、本合同和 `docs/PROMPTS.md` 索引/记录。
- 禁止改变：设置、用户数据、服务端读取/保存、实例生命周期、权限、路由语义和其他工作区区块间距。
- UI 技能：已读取 Taste Skill 与 App Screens、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI。沿用 Minecraft 现有 Operate 界面视觉；通过明确顶部父容器体现信息与导航的分组，内部与窄视口换行行距使用 8px；实例标题与副标题共用一行，无副标题时不保留空行，以维持各实例标签的同高标题区。保持容器响应式与既有 Ant Design 控件，不新增动效。Audit Skills 当前覆盖 Java/.NET/PHP，不覆盖 TSX/CSS，本任务不声明专项安全扫描。
- 可观察结果：桌面及窄分栏/短屏实页中，标题/状态操作到实例导航的空带缩小；导航到配置正文的距离保持；标题、状态、操作和导航无遮挡/横向溢出；原导航及真实字段可见且行为不变。
- Web 验收：从当前 checkout 经正式菜单启动 Web，在 ChatGPT 内置浏览器打开真实实例概览/配置路由，检查桌面、窄分栏短屏与手机视口并记录截图证据；不改设置、不提交配置、不触发实例副作用。

## 实施与验收记录

- 状态：完成。包与正式 Web 构建、构建指纹核对及内置浏览器实页验收通过。
- 方案：新增 `.minecraft-page-top` 父容器收拢页头、状态提示和实例导航，内部间距 8px；实例标题与副标题同处一行，隐藏占位与真实副标题不再撑高标题区。窄视口中页头控制项换行时行距同步收紧至 8px。其后配置内容仍由工作区通用间距分隔。调整日志页/控制台页的容器子选择器以保持原 flex 高度行为。
- 设置与性能：未新增或修改 Settings 配置；保留已映射的 Appearance 令牌。只改变静态布局，没有新增请求、订阅、观察器、计时器或动画。
- 文件：`packages/client/ui-minecraft/src/MinecraftWorkspace.tsx`（顶部区域分组）；`packages/client/ui-minecraft/src/MinecraftWorkspace.css`（8px 页头/导航组距和换行行距、日志/控制台容器布局适配）；`packages/client/ui-minecraft/README.md`（记录顶部/正文间距合同）；`docs/PROMPTS.md`（任务索引与实施证据）；`docs/development/minecraft-instance-config-spacing-20261030.md`（任务合同与验收记录）。
- 构建与指纹：`pnpm --filter lfaa-client-ui-minecraft run build` 通过；正式菜单重建 Control Plane/Harness 与 Web 均通过；启动后 `runtime-build-state.mjs web` 与 `host` 均返回 `[]`，`/api/health` 为 `ok`。未新增或运行自动化测试。
- 页面与截图：ChatGPT 内置浏览器验收 `/games/minecraft/instance/45f694c3-fbf3-447c-a848-80c6a5c5724c/overview`、`/games/minecraft/instance/45f694c3-fbf3-447c-a848-80c6a5c5724c/configuration`。1280×720 桌面两路由标题区到标签栏为 8px；760×640 窄分栏短屏检查副标题/操作换行后间距为 8px；390×845 手机概览无横向溢出（`scrollWidth = clientWidth = 390`）。页面从概览切换至配置并返回，导航正常；配置仍显示 62/62 项、0 项待保存，未触碰字段。截图证据已由内置浏览器实页截图记录。
- 性能与未测边界：仅静态结构与 CSS 调整，无新增运行时工作、请求、订阅、观察器、计时器或动效；未测真实帧时间、物理设备与屏幕阅读器。Web 重启后配置页首轮读取短暂出现 `Failed to fetch`，点击现有“刷新状态”后恢复连接，真实配置完整显示且 0 项待保存。最终概览页再次刷新后控制端仍连接，但当前节点显示离线；本轮没有对 Daemon 或 Minecraft 实例执行操作，此状态与间距实现无关，节点运行状态未能实测确认。
