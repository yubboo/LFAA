<a id="lfaa-workbench-mode-switch-visual-polish-20261112"></a>

# LFAA 工作台聊天/画布切换器样式优化（2026-11-12）

## 用户目标

优化工作台顶栏中间的聊天/画布模式切换控件。当前红框中的图标按钮挤在深色底上，选中态不够清楚；希望它更精致、容易辨认，同时不改变切换功能。

## Owner、设置与边界

- `/work` 及共享 App 工作区的模式装配由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 负责；共享顶栏结构归 `ui-primitives/WorkbenchHeader`，本次控件的局部视觉由 `packages/client/ui-workspace/src/css/center-workspace.css` 独立维护。
- 使用现有账户 Appearance：`appearance.theme` 默认 `system`；`appearance.accentColor` 默认 `#3457d5`，启用分主题色时由 `appearance.advanced.modeStyles[theme].accentColor` 覆盖。主题、强调色和顶栏区域的壁纸遮罩/模糊继续由 Settings/Workbench 的现有映射提供；其余外观偏好与持久化保持原值。
- 不新增或改动设置、权限、会话、路由、模式值、导航逻辑或业务数据；不新增动画或 CSS 自定义属性。

## 视觉与验收条件

- 聊天/画布以及可用时的手动模式仍由同一个 Segmented 控件切换；控件只保留无边框的底轨和单一选中填充，所有选项使用统一圆角，键盘焦点仍清楚可见。
- 在桌面、窄分栏和短屏实际路由中，控件维持在顶栏中间，不遮挡标题或右侧操作，不溢出；各选项仍可操作。浅/深主题及现有强调色继续通过 Appearance 生效。
- 只做 `center-workspace.css` 的局部样式；保留原有 CSS 盒子边界、模式逻辑及所有未提交的并行工作。
- 运行受影响 UI 包构建、Client 类型检查和正式 Web 构建；按仓库要求在 ChatGPT 内置浏览器实测真实页面并记录路由、视口、切换结果、截图和未测边界。

## 实施与验收记录

### 批次 1：模式切换控件视觉层级

- 状态：源码与构建完成；内置浏览器实页检查完成，画布模式的后续数据加载未通过。
- 修改文件：`packages/client/ui-workspace/src/css/center-workspace.css`。外层取消边框和阴影，保留轻微底轨；选中态只用一块淡强调色底；外层、选项和悬停底统一 `10px` 圆角；保留焦点环。模式逻辑、DOM/可访问语义与其余区域未改。
- 源码/构建：`pnpm.cmd --filter lfaa-client-ui-workspace run build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run build:web` 均通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，确认 Web 构建指纹最新。构建产物均位于根目录 `dist/`。未运行测试。
- 内置浏览器：重启正式 Web 后打开 `http://127.0.0.1:3000/work`，1280×720 下工作台真实页面正常加载并完成截图观察；先前窄视口 760×520 的真实页面检查中，页面宽度仍为 760px、无横向溢出，切换器为 81×42px，外层和选中项均为 `10px` 圆角、零边框、无阴影。截图由内置浏览器工具回传，未另存到仓库。之后为同步过期指纹又单独构建并由正式启动器重启 Web，指纹现为 `[]`；没有再次刷新页面，因为工作台重连会再次触发默认项目初始化请求。最终同步构建未引入本任务 CSS 变化。
- 交互及未测边界：真实点击画布模式后 URL 切换至 `/apps/workspace/canvas`，选中态更新；随后页面显示 `Failed to fetch`。服务日志记录 `/api/workspace/projects/initialize-default` 返回 200 后 Web 进程退出。此为页面路由触发的默认项目初始化请求，可能初始化了默认项目；本轮未继续打开画布、未创建节点/素材，也未尝试删除或回滚数据。通过正式 CLI 启动器恢复 Web 后，旧浏览器页重连期间又记录到一次相同接口 200，服务保持运行。未完成画布内容/素材加载验收，也未在其它主题、手机/平板设备或辅助技术中实测。
- 性能与安全：仅变更局部 CSS；没有新增请求、状态、订阅、计时器或动画。未变更认证、权限、设置持久化与数据 Owner。保留 `appearance.theme`、账户强调色（包括分主题色覆盖）及现有顶栏遮罩/模糊映射；没有新增或重置设置。
- UI 技能核对：已读取 Taste Skill、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI。按 UI/UX Pro Max 的紧凑控件建议保留原生可访问控件语义、明确选中态和可见焦点；Audit Skills 的专项扫描支持 Java/.NET/PHP，不覆盖本次 TSX/CSS，不据此声明源码安全审计通过。
