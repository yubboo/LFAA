# 画布顶栏重复切换项精简（2026-10-28）

<a id="lfaa-canvas-toolbar-deduplication-20261028"></a>

## 目标与 Owner

- 用户问题：画布顶栏同时显示应用工作模式、工作流/自由画布、生成/画布三组分段控件，视觉上重复堆叠；用户要求移除附件图二所示的后两组顶栏布局。
- 目标：顶栏只保留聊天/画布/手动主模式；工作流/自由画布与生成/画布选择迁入现有“更多画布操作”菜单，保留原有切换行为与当前状态反馈。
- 入口：`/apps/<app>/canvas[/:projectId]`；`ui-layout/Workbench` 装配 `ApplicationWorkspace`，后者注入工作流面板及 App 身份，`ui-workspace/CanvasWorkspace` 唯一维护画布顶栏和模式切换展示。
- UI Owner：`packages/client/ui-workspace/src/CanvasWorkspace.tsx` 与同包 `canvas-workspace.css`；包 README 说明公开行为。工作流、画布项目和生成能力仍由原领域 Owner 维护，本轮不改变数据/执行 Owner。

## 设置、数据与权限

- 复用设置中心 `canvas.defaultMode`（默认生成）作为打开画布时的初始内容模式；Appearance 主题、颜色、字体字号、背景遮罩/模糊及减少动态效果继续由 Workbench 共享映射提供。此次不新增设置，不修改现存偏好。
- 顶栏菜单交互只更新当前页面已有的 `applicationCanvasView` 与 `mode` 状态，不持久化设置、不写画布/工作流数据、不调用 Provider 或 Agent 工具。
- App 作用域、Canvas/Workflow 所有权、统一 Permission Owner 和服务端认证/校验均不变。

## 修改范围与验收

- 允许：从顶栏移除两组次级分段控件；在现有更多操作菜单中提供等价选择和当前项反馈；更新受影响包 README、任务索引与本合同。
- 禁止：删除或重写 Canvas/Workflow/生成能力；改写默认设置、账户、项目、节点、素材、工作流或权限数据；新建并行状态/设置 Owner。
- 观察条件：常用桌面、窄分栏/短屏顶栏均只显示一组主模式分段控件；“更多画布操作”中可在工作流与自由画布间切换，并在自由画布中切换生成与普通画布；项目内容和已有数据不因菜单操作被修改。
- 直接检查：ui-workspace 包构建、Client 类型检查及正式 Web 构建；依仓库 UI 规则在当前源码服务的 ChatGPT 内置浏览器检查实际画布路由、桌面及窄/短屏视口、菜单切换与控制台错误。

## 实施与验收记录

- 实施：移除顶栏的“工作流/自由画布”与“生成/画布”两组分段控件；在“更多画布操作”中以两个平铺分组提供同样的切换项和当前项勾选。工作流选项仅在 App 提供工作流面板时出现；菜单在切换后收起。`canvas.defaultMode`、画布与工作流数据、App 作用域均未改。
- 构建与静态检查：`pnpm.cmd --filter lfaa-client-ui-workspace run build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run build:web`、`pnpm.cmd run build:control-plane` 均通过；产物位于根 `dist/apps/web/` 与 `dist/apps/control-plane/`，最终 `node scripts/runtime-build-state.mjs web` 返回 `[]`；`git diff --check` 通过。构建有既有大 chunk 警告，无失败。
- 实页验收：最终构建已由当前仓库服务提供，ChatGPT 内置浏览器打开 `http://127.0.0.1:3000/apps/workspace/canvas`；`/api/health` 返回 `status: ok`、`persistence: ready`。桌面视口实测 1423×1245、手机视口 390×640、短屏 390×480，均目视确认顶栏只留主工作模式；390px 下 `documentElement.scrollWidth` 与 `body.scrollWidth` 都为 390px。菜单中工作流/自由画布、生成/画布选项均可见；实际切换工作区和画布模式后菜单收起、内容随切换变化，结束时恢复自由画布与生成模式。浏览器错误日志为 0。截图证据由本轮内置浏览器截图留存于会话记录。
- 数据边界：路由加载时产品自动请求 `POST /api/workspace/projects/initialize-default` 并返回 200。该 Owner 的初始化接口会在账户没有项目和活动/归档会话时创建默认工作区；本轮未确认是否因此新增/登记项目，也未尝试删除或回滚。菜单切换没有保存画布/工作流或发起 Provider/Agent 操作；没有修改设置中心偏好。
- 未实测：真实手机/平板设备、读屏与键盘操作、帧时间；这些不影响本轮对顶栏去重和菜单切换的已验收结论。
- 变更文件：`packages/client/ui-workspace/src/CanvasWorkspace.tsx`（移除重复控件、更多操作菜单分组和当前项反馈）；`packages/client/ui-workspace/src/canvas-workspace.css`（顶栏与窄屏布局注释）；`packages/client/ui-workspace/README.md`（说明次级模式选择入口）；`docs/PROMPTS.md`（任务状态）；本合同（Owner、边界与验收记录）。

## 后续复测合同：AI 漫剧模式切换黑屏（2026-10-28）

- 用户反馈：切换 AI 漫剧模式时中间内容黑屏；附件显示聊天、画布、手动主模式及右侧工具面板展开状态。
- 当前运行入口：`http://127.0.0.1:3000/apps/aivideo/normal`。本次实测嵌入视口为 1048×925；清新构建后从 Canvas 切回 Chat 仍复现黑屏：DockKit 按容器实际宽度进入 Mobile，右侧 Overlay 打开时 `common-responsive.css` 将整个中心区设为 `visibility:hidden`。控制台错误为 0，路由正确。
- 修改 Owner：`ui-layout/Workbench` 负责将 `/apps/aivideo/normal` 解析为手动面板、`ui-workspace/ApplicationWorkspace` 负责三种主模式入口；`AiVideoCanvasWorkspace` 持有手动内容，Canvas 页面仍由 `CanvasWorkspace` 持有。`ui-dockkit` 负责响应式几何及 Overlay 覆盖范围，不复制 App 模式规则。
- 按用户提供的仓库级架构硬规则，AI 漫剧也保留聊天、画布、手动三种模式。统一 App 聊天/画布合同中“AI 漫剧仅两模式、删除手动入口”的旧目标由本补充修订；不改变 AI Video 与 Canvas 数据 Owner。
- 设置：不新增、不修改设置中心配置或偏好；沿用既有 Appearance 与 Canvas 设置。验收不发送聊天、不调用 Provider/Agent 工具、不保存或删除项目数据。
- 验收：依次切换聊天、画布、手动；在 1048×925 下确认右侧工具展开时中心可见、模式状态正确；另检查 390×640 窄视口与遮挡/滚动；记录路由、截图与未测边界。源码、类型和 Web/控制端构建与内置浏览器实页结果分别报告。
- DockKit 修复批次：右侧 Overlay 仅遮挡自身几何范围，中心未覆盖区域保持可见和可交互；左侧 Overlay 的既有行为不变。直接检查 DockKit 包构建，随后在内置浏览器回归 1048×925、390×640 及一处短屏视口，并确认遮挡区、中心可见区和溢出状态。
- 实施与实页结果：待完成。

