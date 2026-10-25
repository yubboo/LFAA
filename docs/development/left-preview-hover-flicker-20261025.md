# LFAA-UI-LEFT-PREVIEW-HOVER-FLICKER-01

## 用户目标

修复 `/work` 中鼠标移入左二栏按钮后，收起侧栏 hover 预览闪烁或被意外收起。用户照片与局部裁图明确指向带 `Ctrl+B` 提示的“切换会话与项目栏”按钮；局部图宽度不代表页面 CSS 视口。

## Owner、设置与边界

- Web/Desktop 共用界面由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 装配；它持有收起预览的 hover/focus 触发和关闭计时。
- 区域尺寸、容器响应式模式与浮层承载归 `packages/client/ui-dockkit/src/ResizableWorkbench.tsx`；预览具体位置和视觉状态归 `packages/client/ui-workspace/src/css/secondary-navigation.css` 与 `src/module-workbench.css`。只在查明根因后修改真实 Owner。
- 复用设置中心 `appearance.overlay`（默认 65）、`appearance.sidebarColor`（默认 `auto`）、`appearance.blur`（默认 14）和 `appearance.advanced.reducedMotion`（默认 `system`）；持久化、校验和 `Workbench` 令牌映射保持原样，不新增或写入设置。
- 不触碰会话、项目、Provider、权限、节点或服务端数据。验收时恢复临时布局状态与临时浏览器视口。

## 当前证据与调查

- 用户后续照片显示鼠标手形停在“切换会话与项目栏”按钮上，悬浮提示为 `Ctrl+B`，另一张显示左二栏浮层出现；目标是鼠标悬停交接，不是点击。照片/裁图证明目标控件和菜单，但本身不能证明闪烁频率或响应式 CSS 视口。
- 内置浏览器 `/work` 的 1275×1240 CSS 视口中，按钮 rect 为 x=78.98、y=7.61、31.995×31.995；预览从 y=47.993 开始，按钮底边 y=39.603，实际间隔 8.389px。旧桥高度约 7.993px，只到 y=47.596，留下约 0.397px 无命中缝；`elementFromPoint` 在按钮底边 +7.9px 命中按钮、+8px 命中标题栏。按钮 `mouseleave` 因此会在指针进入预览前启动 160ms 关闭。这是与用户所说响应式尺寸下 hover 闪烁一致的直接几何证据。
- 原隐藏样式在 260ms 淡出期间提前禁用指针命中；已保留淡出期间命中。另保留计时器身份校验、按钮/预览 `:hover` 兜底与卸载清理，防止已排队的旧关闭回调。
- 本轮新增按钮伪元素命中桥，横向超出按钮左右各 8px；纵向高度为 `max(12px, calc(var(--agent-shell-header-h, 3rem) - 36px))`，在 48px 标题栏下比 8.389px 实际空隙多约 3.606px。修复后桥高度实测 11.995px，按钮底边 +11.5px 仍命中按钮，覆盖原亚像素缝并延伸到预览内。
- 最新构建的 `/work` 实页在 1275×1240、976×952 和 820×520 视口中，按钮下方实际间隔为 8.389px，新增桥为 11.995px；按钮底边 +8px、+8.4px、+11.5px 的命中检查都落在按钮桥，未再命中标题栏。用户给出的窄图是面板裁切，371px 视口模拟不作为用户环境证据。
- 本轮通过仓库正式命令启动 Web，路由为 `http://127.0.0.1:3000/work`；启动器按同数据目录识别并处理了既有 LFAA Web PID 33604。首次 `runtime-build-state web` 为 `[]`，实页加载并完成上述几何检查。之后仓库中其他 Host/Web 源码在构建期间继续变化；Control Plane 构建拒绝登记过期产物，状态转为 `["host","web"]`，`GET /work` 返回 503 重启保护页。当前服务不能作为最新构建实页继续验收；没有再次重启或用过期页面冒充通过。
- 当前 CUA 接口没有纯鼠标移动/悬停操作，Edge 原窗口最小化；没有用点击或拖拽冒充 hover。真实指针从按钮进入浮层及其闪烁频率仍未实测，几何命中检查不能替代该项交互验收。

## 验收

- 几何检查已覆盖 1275×1240、976×952、820×520 三个实页视口；浏览器 DOM 命中检查不等同于纯鼠标悬停验收。用户提供的面板局部图不用于推断视口断点。
- 待补的交互验收：在用户提供页面尺寸对应的工作区视口中，纯鼠标移入按钮并停留，预览不闪烁或意外关闭；从按钮移入预览后保持打开，移出预览后正常收起，点击和键盘 focus 行为保持可用；记录鼠标路径、截图和最终布局状态。
- 保持 Appearance 外观令牌和减少动态效果行为；不新增持续观察器、重复订阅或无界计时器。若触及计时器，确保关闭/卸载时清理。
- 执行左二预览直接回归、受影响 Client 包构建、Client 类型检查、正式 Web 构建、`check:workspace` 和 `git diff --check`；检查只证明对应源码/构建边界，不替代内置浏览器交互验收。

## 允许与禁止

- 允许：修复预览触发/关闭竞态所需的最小 Client UI 改动、对应长期回归、`packages/client/ui-workspace/README.md` 中必要的行为说明，以及本合同实施记录。
- 禁止：重做导航/工作台布局、改变栏宽与用户布局偏好、调整设置默认值或服务端设置逻辑、改动 Provider/会话/项目业务、手动终止未知进程、提交/发布/上传。

## 实施与验收记录

- 状态：已按实页响应式几何根因扩展 hover 命中桥，关闭竞态保护保留。直接回归、Client 包构建、Web 构建、最初的 Control Plane 构建、`check:workspace` 和差异检查通过；指纹变更后的 Control Plane 重建被门禁拒绝，当前 Web/Host 产物状态为 stale。更新前已在实页多视口完成 DOM 几何命中检查。纯鼠标悬停事件序列未完成，不能据此宣称整项交互验收通过。
- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：为触发按钮添加专用命中桥 class；关闭回调核验定时器身份并检查指针是否仍在按钮或预览；卸载时清空定时器 ref。
- `packages/client/ui-workspace/src/css/secondary-navigation.css`：淡出期间保留指针命中，并把按钮下方 hover 热区按实际标题栏高度延伸 4px 到预览内部；预览视觉位置和 160ms 关闭等待未改变。
- `apps/cli/tests/client-left-preview-hover-flicker.test.mjs`：回归检查按钮与预览之间命中桥、淡出期间指针命中、`:hover` 兜底、关闭回调身份和卸载清理。
- 验证：直接回归 1/1；Client UI Workspace 包构建通过；正式 Web 构建通过（`tsc --noEmit`、Vite 2294 模块）；初始 Control Plane 构建通过；`check:workspace` 通过（215 包、版本 0.0.13）；目标文件 `git diff --check` 通过。后来 Control Plane 构建因源码在构建期间变化而退出，`runtime-build-state web` 当前返回 `["host","web"]`；没有把失败重建记作通过。仓库没有 `workspace-preflight` 命令，也没有单独的 quality/release 脚本。
- 页面状态与验收边界：正式路由 `/work`；变更前指纹匹配时，在 1275×1240、976×952、820×520 实页视口完成 DOM 几何/命中检查。之后 Host/Web 源码变化使路由进入 503 重启保护，当前无法对最新源码重新加载验收。临时视口 override 已调用 reset。没有执行真实纯鼠标悬停，所以交互序列和悬停截图尚未验收；实际帧时间未测。
- 性能边界：未新增事件监听器、观察器或并行计时器；仍使用单个 160ms 关闭计时器，卸载时清理并使排队回调失效。

## 续查：中心区拖到很窄后的整栏闪烁

- 用户补充：中间区域拖拽到很小时出现，截图中左二栏文字被挤成竖排。按同一合同续查，单批修复布局宽度回写与 hover 预览，完成定向回归/构建后实页验收。
- 源码发现：DockKit 同时用两个 effect 回写同一 leftWidth；静态下限夹取与中心区动态预算夹取在 dynamicMax 小于 left.min 时互相覆盖。受控 setter 随 leftWidth 改变而重建，两个 effect 持续重跑。收起左栏且中心吸附后，右 Dock 填满剩余预算，使隐藏左栏 dynamicMax 可为 0，进一步污染 hover 预览宽度。
- 修复范围：仅 DockKit 宽度协调、长期回归、包 README 和本合同/索引；维持所有外观设置及权限/数据边界。不新增设置或持续订阅。验收需证明受约束宽度在重复提交后稳定，收起侧栏保留预览宽度，正常拖动仍保护中心区。

### 本次续修实施与验收

- 文件：`E:/lfaa1/lfaa/packages/client/ui-dockkit/src/ResizableWorkbench.tsx` 合并静态/动态宽度协调 effect，收起/Overlay 左栏跳过 Grid 剩余预算；`E:/lfaa1/lfaa/apps/cli/tests/client-left-preview-hover-flicker.test.mjs` 执行真实尺寸协调 effect，覆盖不足最小值、收起后 0 预算、Overlay 和正常宽度，模拟 12 次父组件渲染并要求最多一次宽度回写；`E:/lfaa1/lfaa/packages/client/ui-dockkit/README.md` 记录协调行为；`E:/lfaa1/lfaa/docs/PROMPTS.md` 更新索引；`E:/lfaa1/lfaa/docs/development/left-preview-hover-flicker-20261025.md` 记录续修证据。其余既有工作未回退。
- 设置：无新增/修改，沿用 `appearance.overlay`、`appearance.sidebarColor`、`appearance.blur`、`appearance.advanced.reducedMotion` 及共享令牌；没有设置持久化/校验/映射改动。隔离默认主题实页使用原有令牌，没有改真实账户偏好。
- 验证：`node --test apps/cli/tests/client-left-preview-hover-flicker.test.mjs apps/cli/tests/client-workbench-responsive.test.mjs` 27/27；`pnpm.cmd run build:web` 通过，含 Client TypeScript 检查与 Vite 2294 模块；`pnpm.cmd --filter lfaa-client-ui-dockkit run build` 通过，输出均在根 dist；`pnpm.cmd run check:workspace` 215 包通过；目标文件 `git diff --check` 通过。首次 pnpm PowerShell shim 因执行策略拒绝，改用 pnpm.cmd 后通过。没有独立 workspace-preflight/quality/release 命令，本轮不重复构建未变化的 Host。
- 正式服务：核验 3000 监听 PID 45936 为源码 CLI，没有终止或重启它。当前源码 `node scripts/runtime-build-state.mjs web` 返回 `[]`。从当前 checkout 的正式 `apps/cli/bin/lfaa.mjs web --no-local-daemon` 启动隔离 Home/data（`dist/.tmp/hover-flicker-home`），实页路由为 `http://127.0.0.1:31372/work`。首次因继承外部 data 变量被存储独占锁拒绝，没有绕过锁；显式指定隔离 Home/data 后启动成功。
- 内置浏览器 1173×925：真实拖拽右分隔条将中心从约 643px 拖到约 305px，左二保持 200px；收起左栏后中心可保持 300px，键盘聚焦切换按钮显示 200px 完整预览。双击右侧新标签收起中心后，`data-center-collapsed=true`，左栏展开宽度及隐藏预览仍为 200px，没有归零。拖拽操作未直接触发完全吸附，该边界由双击同一正式折叠入口覆盖。
- 内置浏览器 820×520：Compact 模式中心 300px、预览 200px，document 无横向溢出，短屏左栏底部可见；临时视口已 reset。截图：[桌面](../../dist/.tmp/hover-flicker-desktop.png)、[窄分栏短屏](../../dist/.tmp/hover-flicker-narrow.png)。
- 性能：真实 effect 重复提交回归证明连续 12 次渲染最多一次回写，消除两个约束相互覆盖导致的持续更新；没有新增监听、订阅、RAF 或计时器。没有帧时间/长任务量化；认证、权限及业务数据 Owner 未改。
- 边界：浏览器工具没有纯鼠标移动/hover 接口，聚焦预览与拖拽检查不替代纯 hover。未测真实 Electron/WebView、用户项目长列表、亮色/高对比度/减少动态组合及设备帧时间；纯 hover 交互仍待验。
- 清理：已停止本轮 31372 隔离服务，校验绝对路径位于当前 checkout 的 `dist/.tmp/` 后删除本轮隔离 Home/data；仅保留两张验收截图。真实 3000 服务未重启，最终 HTTP 检查 `/work` 返回 503 构建更新保护；需要通过正式菜单安全重启后使用本次构建，不能仅刷新。

## 续查：其他页面与响应式变化时预览误显示

- 用户补充 `/apps/connectivity/normal`：鼠标停在内容区时左二菜单仍显示，怀疑响应式布局使预览在非触发位置出现。截图中指针落点在预览面板的覆盖范围内；它能说明浮层覆盖了内容区，但不能单独证明最初的打开事件来自鼠标。
- 源码确认 `ApplicationWorkspace` 的预览除按钮/浮层 `onMouseEnter` 外，还由按钮 `onFocus` 无条件打开；程序化焦点或非键盘焦点可在指针不在按钮时触发展示。`leftPreviewOpen` 也未在 App、页面分区和 `metrics.mode` 变化时清空，旧状态可跨路由/响应式重排保留。DockKit 继续只承担区域几何与 Overlay 装配，问题由 `ApplicationWorkspace` 的预览状态 Owner 修复。
- 修复：按钮仅在 `:focus-visible` 时用键盘焦点打开；关闭判断保留触发器/浮层 hover 和预览内键盘焦点，焦点离开预览后由浮层 `onBlur` 收起；`aria-expanded` 反映临时预览显示状态。App、mode、section 或容器布局模式变化时用 `useLayoutEffect` 清理计时器并关闭旧预览。未改持久化左栏开合偏好、CSS 令牌或服务端数据。
- 设置与数据：沿用 `appearance.overlay`、`appearance.sidebarColor`、`appearance.blur`、`appearance.advanced.reducedMotion` 和现有工作区栏宽/开合偏好；没有新增设置，也未改写偏好值。无会话、项目、Provider、权限或服务端数据操作。
- 回归与构建：`node --test apps/cli/tests/client-left-preview-hover-flicker.test.mjs` 2/2；`pnpm.cmd --filter lfaa-client-ui-workspace run build`、`pnpm.cmd run build:control-plane`、`pnpm.cmd run build:web` 均通过。Web 构建包含 `tsc --noEmit` 与 Vite 2299 模块；所有产物位于根 `dist/`。官方 `pnpm.cmd run lfaa web --no-local-daemon` 重启后，`runtime-build-state web` 为 `[]`，`/apps/connectivity/normal` HTTP 200；目标文件 `git diff --check` 通过。
- 内置浏览器验收：实际路由 `http://127.0.0.1:3000/apps/connectivity/normal`，视口 1173×925，容器模式 Desktop。初始按钮未聚焦、`aria-expanded=false`、预览 `aria-hidden=true` 且 `visibility:hidden`；键盘 Tab 聚焦到触发按钮时预览显示、`aria-expanded=true`，截图在本轮对话中；继续 Tab 到“刷新状态”后预览淡出结束，`aria-expanded=false`、`aria-hidden=true`、`opacity:0`、`visibility:hidden`。这在鼠标未移动的键盘交互下验证了非指针打开路径与关闭路径。
- 未测范围：当前 CUA 浏览器工具没有纯鼠标 move/hover 方法，不能完成用户物理鼠标经过和离开触发区的交互验收；工具也不能可靠设置窄/短视口，因此本次新焦点/响应式修正未在 Compact、Mobile 或短屏实测。旧批次 820×520 几何检查仍是旧实现证据，不替代本次最终代码验收。不得据此宣称真实鼠标 hover 闪烁已完全实测。

## 续查：复用唯一左栏实例

- 用户反馈前一轮后仍能复现，并要求沿用原来的菜单样式。检查 `/apps/connectivity/normal` 后确认不是多处重复 `.module-left-preview` 规则，而是 `ApplicationWorkspace` 同时构造 `left` 与 `leftPreview` 两个 `ApplicationSidebar`；折叠时 DockKit 左窗格隐藏，独立 `overlay` 再挂载第二份菜单。当前隔离实页 DOM 也观察到两个 `.module-sidebar`，按钮 `aria-expanded=false` 时它们分别位于隐藏窗格与隐藏浮层。
- 目标：删除第二份 `ApplicationSidebar` 与独立 overlay 容器，让 DockKit 已有左窗格在折叠时由 hover 状态定位成预览；展开时仍用同一窗格布局。内容、菜单样式与组件本地状态只保留一份。保留 click、键盘、响应式和现有设置语义，不改用户持久化的开合偏好。
- 实施：`ApplicationWorkspace` 只构造一个 `ApplicationSidebar`；把既有 DockKit 左 pane 在折叠态加上预览定位类，并把 hover/focus 事件接到该菜单根节点。移除单独 `overlay` 和第二个 sidebar，不再复制菜单内容、本地状态或订阅。原有菜单外观继续由 `.module-sidebar` 控制。
- 设置沿用上一节列出的外观与工作区偏好；没有改写开合偏好或服务端数据。`node --test apps/cli/tests/client-left-preview-hover-flicker.test.mjs` 2/2、`pnpm.cmd --filter lfaa-client-ui-workspace run build` 及 `git diff --check` 通过。
- 当前验收阻塞：第一次 `pnpm.cmd run build:web` 检测到构建期间源码指纹变化；稳定后重试，TypeScript 被本轮未改的 Canvas 工作区错误阻断，包括 `packages/client/ui-workspace/src/client/index.ts` 引用不存在的 `CanvasHome.js`，以及 `ui-layout/Workbench.tsx`、Canvas 组件类型错误；直接 Vite 构建也在相同缺失导入处停止。构建指纹仍为 `["host","web"]`，正式路由 HTTP 503，故没有对这批新代码声称完成内置浏览器验收，也未重启旧产物。需要修复当前 Canvas 构建阻塞后才能重新跑正式 Web 并在 `/apps/connectivity/normal` 实测。
- 未测范围：浏览器控制工具无纯鼠标移动/hover 方法，真实鼠标命中与离开仍待实测；当前工作区 Web 构建受上述 Canvas 错误阻断，窄/短视口也未对新代码实测。静态源码回归和包组装不替代这些页面证据。
- 最新截图纠正：唯一左 pane 已处于 DockKit Grid 第 2 列，再设置 `left: var(--lfaa-leading-width)` 会把常驻导航栏宽度加第二次。已改为 `left: 0`，并在回归中断言不再叠加该宽度；正式 Web 被上述 Canvas 构建问题阻断，尚未实页复核最终位置。

## 最新位置修正与实页复验（2026-10-25）

- 用户截图指出菜单整体右移。原因是唯一左 pane 已由 Grid 放在常驻主导航轨之后，预览 CSS 又加了一次主导航宽度。当前规则使用 `left: 0`；不再重复偏移。
- ChatGPT 内置浏览器实际路由 `http://127.0.0.1:3000/apps/connectivity/normal`，临时视口 `1280×720`，模式 `desktop`。Grid 首列宽 `63.99px`，唯一 `.module-left-preview` 的 x 坐标也是 `63.99px`、宽 `200px`；初始 `aria-expanded=false`、`visibility:hidden`。通过 Tab 聚焦到触发器后，预览变为可见且 `aria-expanded=true`，x 仍为 `63.99px`，截图显示左二菜单紧贴主导航，没有额外空带。该检查确认了实际显示位置及键盘聚焦路径。
- 截图由内置浏览器 CUA 实际捕获并以内联图像返回；当前接口没有本地图片导出路径，本轮没有生成新的截图文件。
- 恢复内置浏览器默认视口后，实际路由为同一页面、`725×780`、模式 `mobile`；菜单只有一个实例，桌面 hover 预览 pane 在移动模式不装配，页面 `scrollWidth=715px`，无横向溢出。临时视口覆盖已重置。
- 当前 CUA 浏览器 API 没有纯鼠标移动/hover 操作。鼠标从触发器经过命中桥进入预览、连续停留是否还闪烁，仍未通过物理鼠标实测；键盘显示和 DOM 坐标证据不能替代该项验收。没有通过点击或拖拽冒充 hover。
- 最终代码验证：`node --test apps/cli/tests/client-left-preview-hover-flicker.test.mjs` 2/2；`pnpm.cmd --filter lfaa-client-ui-workspace run build` 通过；`pnpm.cmd run build:web` 通过（TypeScript 检查及 Vite 2301 modules，产物仅写根 `dist/`）；正式 `pnpm.cmd run lfaa web --no-local-daemon` 服务已从当前源码重启，`node scripts/runtime-build-state.mjs web` 返回 `[]`，功能路由 HTTP 200；本任务文件 `git diff --check` 通过。之前 Canvas 构建失败/503 是更早状态，已由这次成功构建与实页加载取代。
- 设置沿用 `appearance.overlay`、`appearance.sidebarColor`、`appearance.blur`、`appearance.advanced.reducedMotion` 和既有工作区宽度/开合偏好；没有新增设置，也没有更改持久化偏好或业务数据。没有新增订阅/请求/长期计时器；关闭计时器的身份校验与卸载清理仍由定向回归覆盖。帧时间和长任务未测。

## 追加修正：只在指定展示位置打开（2026-10-25）

- 用户明确要求：指针进入左侧其他区域时左二菜单不能自行出现；应只在顶部栏“切换会话与项目栏”展示触发位置打开。
- 根因：`ApplicationSidebar` 把 `onMouseEnter` 绑在整个 `.module-sidebar` 根节点，预览 pane 在淡出期间仍可命中，导致侧栏主体区域也能调用 `openLeftPreview`。顶部按钮本身已有独立的 `onMouseEnter` 与键盘可见焦点入口。
- 修复：移除左栏根节点及其 props 的 `onPreviewMouseEnter`，仅保留顶部指定按钮打开；左栏 `onMouseLeave`、预览 `:hover/:focus-within` 延迟关闭保护和按钮到预览的窄连接命中区保留。指针进入侧栏主体不会从收起状态触发展开；打开后仍可把指针移入菜单操作。
- 设置仍沿用 `general.navigationLayout`、已有 Dock 宽度/开合偏好及 Appearance 配置；无新增设置、偏好写入或业务数据变化。
- 验证：定向回归 4/4、`lfaa-client-ui-workspace` 构建与 `pnpm.cmd run build:web` 通过；运行时指纹为 `[]`，正式 Web 服务经 LFAA 启动器重启。内置浏览器 `/games` 945×1015 Compact 初始预览收起，键盘聚焦顶部触发按钮后预览显示，中心区仍为 x=65；实页截图留在本轮内置浏览器工具记录中，视口重置后页面回到 `/games`。
- 未测：CUA 浏览器仅提供点击/拖拽，没有纯鼠标移动接口；真实鼠标从左侧非触发区经过、以及实际 hover 闪烁频率未实测，不用键盘焦点结果代替鼠标验收；帧时间未测。
