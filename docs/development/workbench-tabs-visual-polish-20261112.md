<a id="lfaa-workbench-tabs-visual-polish-20261112"></a>

# LFAA 工作区标签视觉优化（2026-11-12）

## 用户目标

用户指出 `/work` 顶栏中“新标签页”的当前下划线样式观感不佳，并提供圆角整片式标签作为更合适的参照。后续查看实页截图时又指出选中标签有蓝色外描边，边框叠加显得过多；随后补充最新截图，确认去掉整圈标签边缘又显得太平。最终保留一圈适配主题对比度的中性细边和圆角表面，仅去掉焦点外圈与关闭按钮默认圆底。最新参考还要求标签悬停/键盘聚焦时显示预览卡，浏览器标签可带真实网页缩略图。

## Owner、设置与边界

- 运行入口：Web/Desktop 共用 Client `/work`。
- 标签的动态内容、选中与关闭行为唯一由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 持有；标签几何、局部视觉与预览卡由 `packages/client/ui-workspace/src/css/right-menu.css` 持有。浏览器预览帧复用 Browser Owner 当前可见页的既有实时画面；Electron 原生浏览器缩略图由现有 `NativeBrowserPanel` / native-browser Owner 在显式悬停预览请求时捕获。
- 外观沿用 Settings Owner 的 `appearance.theme`、`appearance.accentColor`，以及启用分主题色时的 `appearance.advanced.modeStyles[theme].accentColor`；Workbench 继续将其映射为共享主题/强调色令牌。
- 不新增或修改设置、标签状态、路由、浏览器数据、会话、权限或持久化；不改变新建、关闭、选择与双击行为。
- 保留当前工作树中其他未提交工作；本任务只在 `ApplicationWorkspace.tsx` 标签区域增加预览内容与浏览器采集请求，不覆盖相邻工作区逻辑。

## 验收条件

1. 选中标签用圆角表面、一圈中性细边与克制的强调色图标区分；不显示鼠标点击后遗留的蓝色焦点外圈。新标签使用浏览器图标。非选中标签保持安静清晰，关闭图标默认轻量且悬停可见操作底色，`+` 仍是独立新建操作。
2. 悬停或键盘聚焦标签时显示预览卡，读取该标签真实标题/类型；浏览器页面地址遵循 `browserUse.showFullUrl`。只有当前选中且可见的 Browser Owner 页面可提供真实缩略图；不可见或尚无网页画面时如实显示无预览状态，不伪造或借用其他标签画面。离开标签后清除临时缩略图，不持久化。
3. 工作区标签仍保持原有 `tablist`、标签选择与关闭语义、可见键盘焦点和键盘操作；标签选择、关闭、双击收放及加号行为不变。预览不新增轮询、订阅、后台截图或持续状态渲染。
4. 桌面和窄分栏/短屏中，长标题按容器收缩并省略，不遮挡右侧终端/上下文按钮或加号，不产生页面横向溢出；浅/深主题和当前强调色继续生效。
5. 只改标签与 Browser Owner 必要的唯一 Owner 文件及其直接回归、包说明、本合同和任务索引。沿用现有 CSS 令牌，不新增自定义属性或动效。
6. 运行标签/预览直接回归、受影响包构建、Client 类型检查、Web 构建与差异空白检查；按仓库规则在 ChatGPT 内置浏览器检查 `/work` 桌面和相关窄分栏/短屏实际页面及关键交互，记录视口、截图与未测边界。

## 实施与验收记录

- 状态：标签表面和按需预览已实现；Browser Owner 真缩略图已覆盖 Web/Electron 两条现有显示路径；桌面与 820×520 窄分栏已实页检查。390×740 检查发现预览卡超出视口，已加 480px 以下视口贴边规则。用户新增截图指出约 430px 窄面板中的多标签条宽度布局仍异常，定位到后置 `max-width: 280px` 覆盖每标签 `min(42%, 280px)` 的收缩上限；现已移除冲突规则并加入回归。两项响应式样式已通过工作区包构建，但因整站 Web 构建被共享工作区 `AiWorkChat.tsx` 语法错误阻断，最新窄栏截图场景尚未重建或实页复验。
- 实施：`right-menu.css` 将选中标签保留为圆角表面和适配 Appearance 对比度的中性细边，图标沿用强调色；去掉鼠标点击后的外层蓝色焦点圈，键盘焦点仍可见；关闭按钮默认轻量、悬停显示操作底色，新空白页使用浏览器图标。标签悬停或键盘聚焦展示标题、类型和地址；只在标签当前选中、地址与 Browser Owner 活动页一致且右栏可见时发起一次预览请求。Web 复用当前帧 Canvas 缩至 360×203 内且 JPEG 不超过 512 KiB；Electron IPC 经现有受信任前端校验，只捕获仍可见的活动 WebContents，返回后再次核对标签与可见状态并使用相同上限。缩略图仅存在于当前卡片状态，关闭即清除；不增加后台请求、轮询或数据持久化。窄屏修正将卡片限制在视口左右 12px 内。
- 设置与持久化：沿用 Settings Owner 的 `appearance.theme`（默认 `system`）、`appearance.accentColor`（默认 `#3457d5`）；`appearance.advanced.separateModes` 默认 `false`，启用时读取当前主题对应 `modeStyles[theme].accentColor`（默认浅/深主题均为 `#3457d5`）。Workbench 将主题和当前强调色映射为共享 CSS 令牌；无设置控件、校验、持久化或既有偏好修改。
- 文件职责：`packages/client/ui-workspace/src/ApplicationWorkspace.tsx`（标签实际标题、预览卡触发与 Browser Owner 请求）；`packages/client/ui-workspace/src/css/right-menu.css`（标签表面、预览卡和窄屏定位）；`packages/client/ui-sidebar-browser/src/BrowserPanel.tsx`、`NativeBrowserPanel.tsx`（Web/Electron 请求接收和临时截图回传）；`apps/desktop-electron/src/native-browser-workspace.mjs`、`main.mjs`、`preload.cjs`（Electron 活动页有界缩略图及受信 IPC）；`packages/client/connection/src/api.ts`（桥接类型）；`apps/cli/tests/client-workbench-tabs-appearance.test.mjs`、`apps/desktop-electron/tests/native-browser-workspace.test.mjs`（样式与采集边界回归）；三个受影响包 README、本合同及 `docs/PROMPTS.md`（Owner、边界与验收记录）。
- 定向回归：`node --test apps/cli/tests/client-workbench-tabs-appearance.test.mjs` 当前通过 3/3，覆盖标签外观、窄容器标签宽度上限和预览；`node --test apps/desktop-electron/tests/native-browser-workspace.test.mjs` 通过 12/12；工作区布局用例“中心列拖动越过下限阈值后吸附收起，标签仍可显式切换”通过 1/1。完整 `client-workspace-app-tabs.test.mjs` 此前为 8/10，两项旧断言分别与当前 `openWorkspaceUtility` 过滤 `project-file` 及 `/apps/minecraft/ai-work` 路由实现不一致；本轮未改动它们。
- 静态检查与包构建：`git diff --check` 通过；`lfaa-client-connection`、`lfaa-client-ui-sidebar-browser`、`lfaa-client-ui-workspace` 包构建通过，含最后窄屏 CSS 调整后的 `lfaa-client-ui-workspace` 再构建通过。整站 `pnpm.cmd run build:web` 在 Client 类型检查阶段被未修改的共享文件 `packages/client/ui-chat/src/AiWorkChat.tsx` 当前内容阻断：该 164 字节文件只有一行 CSS 声明，TypeScript 报 TS1435/TS1127/TS1128/TS1005。它此前含其他未提交工作，本轮未覆盖或恢复该共享改动。最新 `node scripts/runtime-build-state.mjs web` 返回 `["host","web"]`；最后窄屏 CSS 尚未进入整站构建，不能声称整站构建或最终窄屏页面验收通过。
- 内置浏览器：以当前 checkout 的正式入口 `pnpm.cmd lfaa web --no-local-daemon` 启动；启动器确认数据目录所有者 PID 36656 为 LFAA Web 后结束旧进程并重新启动，`/api/health` 返回 `status=ok, persistence=ready`，随后内置浏览器实际打开 `http://127.0.0.1:3000/work`。`1280×720`：观察到标签圆角中性边框、空白页浏览器图标；键盘聚焦后预览卡出现，显示真实标签标题/类型与“当前标签暂无网页画面”，未为验收导航或写入最近访问。`820×520`：页面宽度 820、标签条内容宽度与滚动宽度均为 115，截图未见横向溢出，预览卡可见。`390×740`：旧构建的预览卡右缘到 470px、页面宽度变为 481px，确认越界；随后新增视口贴边规则并通过 CSS 回归与包构建，但共享文件语法错误阻止重新构建/重启，因此该修复的真实手机视口结果仍待验。截图留存在本轮内置浏览器工具输出，未导出本地文件。
- 性能与安全：预览只由悬停/键盘聚焦触发一次，不建立轮询、订阅、观察器或计时器；图片有宽高/字节上限并在卡片关闭时清除，不写磁盘或账户历史。Electron 捕获前后校验页面活动与可见状态，IPC 继续受主进程现有前端来源校验。没有量测帧时间/CPU；未做真实 Electron 桌面页面验收。
- 最新窄栏实页状态：当前内置浏览器 `/work` 显示 1052×869，右上下文栏处于收起状态，无法在不改变其已保存展开偏好的情况下复现用户附图中的两标签右栏。未临时切换该偏好；因此约 430px 场景的最后修正仍仅有 CSS 回归和工作区包构建证据。
- UI 技能核对：已读取 Taste Skill、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI。按 Operate 型工作区表面保留现有颜色/字形和主题令牌，以无描边圆角标签表面替代单一底边指示和重复边框；不增加动效。Audit Skills 的目标语言范围不覆盖本次 TypeScript/CSS，不据此声明专项安全审计通过。
