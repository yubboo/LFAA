# LFAA-WORKSPACE-TOPBAR-ICON-CONTROLS-20261029

<a id="lfaa-workspace-topbar-icon-controls-20261029"></a>

## 目标与 Owner

把共享 `ApplicationWorkspace` 顶栏拥挤的模式和操作从文字按钮改为图标控件，减轻一整排控件的视觉重量。唯一 UI Owner 是 `packages/client/ui-workspace` 的 `ApplicationWorkspace` 与 `center-workspace.css`；通用图标绘制归 `packages/client/ui-primitives` 的 `WorkbenchIcon`。模式状态、导航、Git、语音、终端、上下文栏仍使用各自既有 Owner。

## 设置与边界

- 不新增设置；继续使用 Appearance 的共享主题令牌与字号/对比度映射。
- `general.showServiceStatus`（默认 `true`）继续决定服务状态点是否展示；`general.showBottomPanelControl`（默认 `true`）继续决定底部终端入口是否展示。
- `general.navigationLayout` 继续控制工作区栏布局；模式仍固定在顶栏可用宽度中心，不增加用户偏好。
- 不改聊天/画布/手动的路由、选中状态、快捷键、Git 状态、连接状态、面板开合或任何数据归属。

## 实施范围

- 聊天、画布、手动模式在 Segmented 中显示语义清晰的图标；保留真实文本作为屏幕阅读器名称并提供悬停提示。
- 语音、服务状态、Git 变更、Git 摘要、底部终端与上下文栏采用图标按钮/状态点；按钮保留 `aria-label`、提示、选中状态、键盘焦点与快捷键。
- 保留当前三列顶栏及中心锚点、应用/会话标题截断、窄容器的第二行模式布局和主题映射。
- 新增通用对话气泡图标由 UI Primitives 提供；图标组件只负责绘制，不承载路由或业务状态。

## 验收与验证

- 直接回归覆盖模式图标的三项文案/图标语义、独立中心槽与图标按钮的可访问名称合同。
- 客户端类型检查、UI Workspace 与 UI Primitives 构建、正式 Web 构建和构建运行指纹检查通过。
- 在 ChatGPT 内置浏览器当前 checkout 正式服务中查看 `/work`：记录实际视口与中心容器宽度；桌面和窄分栏验证图标行无拥挤/横向溢出、模式仍居中、标题截断，点击模式与 Git/面板入口保持原交互。
- 构建或静态断言不能代替实页；未运行的范围如实列为未验。

## 变更文件职责

- `packages/client/ui-workspace/src/ApplicationWorkspace.tsx`：共享工作区顶栏模式图标与原操作按钮装配。
- `packages/client/ui-workspace/src/css/center-workspace.css`：仅限定中心顶栏的紧凑图标几何、悬停/焦点和模式项尺寸。
- `packages/client/ui-primitives/src/WorkbenchIcon.tsx`：新增可复用对话图标绘制。
- `packages/client/ui-primitives/README.md`：记录新增共享图标及其职责边界。
- `apps/cli/tests/client-app-workspace-four-column.test.mjs`：覆盖图标语义、可访问名称与中心模式组合同。
- `docs/PROMPTS.md`：任务索引与验收状态。
- `docs/development/workspace-topbar-icon-controls-20261029.md`：本任务 Owner、设置、实施和验收记录。

## 分批记录

### B1：共享顶栏图标化

- 状态：图标实现、定向回归、类型检查与 Web 构建通过；新构建的正式内置浏览器页面未能启动，实页验收受 SQLite 版本不兼容阻断。
- 改动：模式分段改为聊天气泡、网格、编辑图标，隐藏真实模式文本保留屏幕阅读器名称和 hover 标题；语音、Git、终端、上下文使用 30px 图标控件；服务状态保留真实状态点与动态提示。Git/面板选中态、原 `aria-label`、快捷键和路由回调未改。新增图标只提供通用 SVG 绘制，不含业务状态。没有新增订阅、计时器、请求或持续动效；图标本身减少了顶栏可见文本与控件横向宽度，本轮未测帧时间。
- 设置：继续读取 Appearance 共享主题令牌与字号映射；服务点仍由 `general.showServiceStatus` 控制，终端入口仍由 `general.showBottomPanelControl` 控制，布局继续由 `general.navigationLayout` 决定；未新增或修改设置值。
- 直接回归通过：`node --import tsx --import ./apps/cli/register-package-loader.mjs --import ./apps/cli/tests/isolated-test-environment.mjs --test --test-name-pattern="App 模式组固定在顶栏中心列" ./apps/cli/tests/client-app-workspace-four-column.test.mjs`（1 项通过，覆盖三个图标与模式文案、中心槽及按钮图标化规则）。`git diff --check` 通过。
- 构建通过：`pnpm.cmd --dir packages/client/ui-primitives build`、`pnpm.cmd --dir packages/client/ui-workspace build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run build:web`；正式 Web 菜单又按当前源码重建了 Control Plane 与 Web，`node scripts/runtime-build-state.mjs web` 输出 `[]`。所有构建产物位于根 `dist/`。
- 内置浏览器：改动前在 `http://127.0.0.1:3000/work`、1280×720 查看基线，截图确认顶栏模式、语音、连接、Git、终端和上下文文字挤在同一行。新 Web 产物首次加载前出现“LFAA 需要重新启动”；执行用户已授权的当前 Web 安全重启后，官方菜单停止 PID 56612 并重建 Control Plane/Web，启动失败：共享数据库 `C:\Users\yu\.lfaa\database\lfaa.sqlite` 版本为 76，当前 checkout 程序只支持到版本 75。启动日志报告回收已退出 PID 的配置写锁，数据库兼容检查拒绝降级；没有进行数据库 schema 升级或降级。新构建页面因此没有实际渲染，不能记录桌面或窄分栏通过，也没有新界面截图。
- 随后工作区中另外几处外观设置源码发生更新，本轮未改动这些文件；为对账最新工作区，重新执行 `pnpm.cmd run build:control-plane` 与 `pnpm.cmd run build:web`，两项通过且 `node scripts/runtime-build-state.mjs web` 为 `[]`。这些完整当前源码产物仍无法启动，因为数据库版本不兼容。
- 当前阻断：完整 Web 启动未成功，原 PID 56612 已由正式菜单停止；需要先恢复与数据库版本 76 匹配的 LFAA 源码/运行环境，才能继续正式浏览器验收。没有迁移、复制或回滚真实数据库，也未用静态页代替正式页面。
- 未测：新构建在内置浏览器中的图标视觉状态、模式切换交互、Git/终端/上下文按钮交互、窄分栏与手机短屏、键盘焦点渲染、对比度实页核对、帧时间和真实设备。
