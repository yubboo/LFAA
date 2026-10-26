# LFAA-RIGHT-APP-MENU-RESPONSIVE-LAYOUT-20261026

## 用户问题与目标

- 用户提供 `/work` 右侧“应用”视图截图，要求修复应用入口的布局。当前布局把所有应用固定堆成单列；宽栏时内容只占左侧且留下大量空白。
- 根据右侧应用菜单的实际容器宽度排成自适应卡片列；窄栏仍保持单列、文字可读、内容可滚动，选中态、键盘焦点、路由和 App 打开行为保持有效。

## Owner、设置、数据与权限

- Web/Desktop 共用入口：`/work` → `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 的 `ApplicationNavigationPanel`；它复用 `ui-sidebar/SecondaryNavigation` 的应用清单/打开回调。右栏几何由 `ui-dockkit/ResizableWorkbench` 持有，应用菜单专属内容样式由 `packages/client/ui-workspace/src/css/right-menu.css` 持有。
- 设置：沿用 `general.hiddenApplicationNavigationIds`（默认空列表，仅隐藏入口）、`general.navigationLayout`、已保存的 Dock 开合/宽度，以及 Appearance 主题、强调色、字体/字号、对比度、壁纸/遮罩/模糊和减少动态效果令牌；不增加或修改设置，不写入用户布局偏好。
- 数据与权限：不改 App 清单、业务数据、权限、路由或点击回调；所有卡片仍消费现有真实应用导航条目。

## 允许范围与验收

- 允许修改右侧应用菜单专属 CSS、相关长期 UI 回归、`ui-workspace` README、本合同和任务索引；除非视觉实页证明需要，不改 DockKit 几何或业务组件。
- 卡片列数依据内容容器宽度而非全局窗口宽度；宽栏使用多列，约 360px 窄栏降为一列，极窄容器无水平溢出；长内容在右菜单主体滚动，底部账户状态仍可达。
- 保留外观设置令牌、选中状态、悬停与键盘可见焦点；不新增 CSS 变量。
- 运行直接布局回归、Client 类型检查、`ui-workspace` 构建、Web 构建和 `git diff --check`；从当前源码验收 `/work`，检查常用桌面、窄分栏和短屏视口，记录实际宽高、卡片列数、溢出/滚动、账户状态可达性及截图。验收不改变 Dock、外观或其他用户偏好。

## 实施与验证结果

- `packages/client/ui-workspace/src/css/right-menu.css` 将应用入口改为 `auto-fit` 网格，最小卡宽 320px；卡片高度 72px，边框、背景、文字、悬停和选中态沿用 Appearance 令牌。`ui-workspace/README.md` 记录容器宽度自适应行为。
- `apps/cli/tests/client-right-app-menu-layout.test.mjs` 覆盖宽度自适应、主题令牌和短屏滚动容器；三项回归均通过。`pnpm exec tsc --noEmit -p tsconfig.client.json`、`pnpm --filter lfaa-client-ui-workspace run build`、`pnpm run build:web`、`pnpm run build:control-plane` 和 `git diff --check` 均通过；构建指纹检查 `node scripts/runtime-build-state.mjs web` 返回 `[]`。
- ChatGPT 内置浏览器在当前源码 Web 地址 `http://127.0.0.1:5173/work` 实测：默认 1312×1244 视口、右栏 726px 时为双列；2048×1114 视口下将右栏临时展开到 1047px 时为三列；右栏临时收窄到 373px 时为单列；1280×520 短屏、右栏 694px 时为双列，五个入口及底部账户状态均可见。各状态均无横向溢出；菜单 `overflow-y:auto`，短屏滚动容器仍可用。
- `http://127.0.0.1:3000/api/health` 返回 HTTP 200；Control Plane 根页面仍返回 HTTP 503，因此实际页面验收使用健康的当前源码 Vite 地址 5173。此次改动只涉及客户端布局，不改变服务端启动逻辑。
- 截图在本轮内置浏览器验收过程捕获：2048×1114 三列宽栏、373px 窄栏及 1280×520 短屏；浏览器控制层没有提供将截图导出到仓库路径的接口。临时更改的右侧分栏与视口均已恢复，验收结束时分隔条值回到左栏 220px、右栏 726px，浏览器恢复默认 1312×1244 视口。应用入口显隐、路由打开、外观和用户设置未改动。
