<a id="lfaa-global-navigation-feature-launcher-20261026"></a>

## LFAA-GLOBAL-NAVIGATION-FEATURE-LAUNCHER-20261026

### 用户问题、目标与入口

- 用户问题及影响：全局导航轨把每个模块都作为独立图标固定纵向排列；功能增加会挤占短屏上的快捷入口、服务状态和账户区，也让主栏难以扩展。
- 当前行为/复现步骤：在 `/work` 或共享模块页查看最左侧 `GlobalNavigationRail`；首页、应用、工作、AI 员工办公室、最近会话、文件、画布、插件、工具和设置均直接排列；现有“更多入口”未收纳办公室和插件等全部模块。
- 期望的用户可见结果：最左栏只保留高频全局入口；低频平台模块统一进入有搜索、分类和内部滚动的“更多功能”菜单，菜单项继续走原路由及回调。应用目录继续使用 Workbench 当前提供的真实清单。
- 运行入口、页面/路由和使用范围：Web/Desktop 共用 Client；主要验收 `/work`，并覆盖一个共享模块路由；桌面、窄分栏和短屏。

### Owner、设置与数据边界

- 真实调用链和唯一 Owner：导航显示与点击意图归 `packages/client/ui-sidebar/src/GlobalNavigationRail.tsx`；路由、应用清单和文件/画布/工具回调由 Workbench 及当前业务 Owner 注入；模块页面仍由 Workbench 懒加载装配。应用权限、模块业务与账户数据不由导航组件处理。
- 相关设置、默认值、读取/持久化：沿用 `general.navigationLayout`（默认 `three-column`，由 DockKit/Workbench 控制栏位布局）、`general.hiddenApplicationNavigationIds`（默认空，仅过滤应用目录可见项）和 `general.showServiceStatus`（默认开启，控制连接状态点）；外观读取现有 Appearance 共享主题、字体、字号、对比度、壁纸材质及减少动态效果映射。本任务不新增、不修改设置或保存用户偏好。
- 账户/项目/节点数据、权限与认证边界：不访问或写入账户、项目、节点数据，不改变认证、应用授权或统一权限流程；功能菜单只呈现由调用方提供的导航行为。

### 修改范围与验收

- 允许修改：`GlobalNavigationRail.tsx`、对应 CSS、`packages/client/ui-sidebar/README.md`、直接导航 UI 回归、本文和 `docs/PROMPTS.md` 索引。
- 禁止改变：应用 Dock/二级导航的交互和清单、原路由与打开回调、全局布局/尺寸偏好、连接状态/账户/快捷键行为、任何业务设置与权限规则；不重启 Minecraft 或其他受管实例。
- 可观察验收条件：常驻主导航不再逐项加入文件、画布、插件、办公室等低频模块；“更多功能”可搜索并分类显示这些现有功能，选中后关闭菜单并走原动作；当前位于已收纳模块时更多入口显示当前页状态；搜索无结果时有清楚的清空操作。桌面、窄栏和短屏下菜单内容、滚动与关闭操作均可达，无横向溢出；主题来自现有 Appearance 令牌。运行直接回归、ui-sidebar 构建、Web 构建及差异检查，并用 ChatGPT 内置浏览器在当前源码工作区 `/work` 和一个模块路由实页验收。

### 实施与验收记录

- 具体方案：常驻主轨保留首页、应用、工作、最近会话和设置；办公室、文件、画布、插件与调用方提供的工具入口合并进“更多功能”。菜单按工作区/管理与工具分组，按名称和说明即时筛选；空结果提供清空操作；当前位于收纳模块时，更多入口和对应菜单项报告当前页。菜单使用现有回调/路由，内部列表独立滚动。
- 变更文件：`packages/client/ui-sidebar/src/GlobalNavigationRail.tsx`（精简常驻入口、功能目录、搜索和当前页语义）；`packages/client/ui-sidebar/src/GlobalNavigationRail.css`（窄视口有界菜单、独立滚动列表及主题令牌样式）；`packages/client/ui-sidebar/README.md`（组件导航合同）；`apps/cli/tests/client-global-navigation-feature-launcher.test.mjs`（固定入口、搜索空态、窄屏菜单布局回归）；`docs/development/global-navigation-feature-launcher-20261026.md`（本合同）；`docs/PROMPTS.md`（任务索引和证据）。
- 设置中心：未新增或修改配置、未改用户偏好。继续使用 `general.navigationLayout`、`general.hiddenApplicationNavigationIds`、`general.showServiceStatus` 的现有 Owner；新菜单从现有 Appearance 共享颜色、字号和焦点令牌读取主题样式。
- 实际验证：`node --test apps/cli/tests/client-global-navigation-feature-launcher.test.mjs` 2/2 通过；`pnpm.cmd --filter lfaa-client-ui-sidebar run build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run build:web` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`，Web 构建指纹与源码一致；`git diff --check` 通过。Web 构建生成于仓库根 `dist/`。
- 实际页面验收：使用当前源码正式 Web 服务 `http://127.0.0.1:3000`，实际路由 `/work` 与 `/agent-office`；内置浏览器默认 1280×720 检查常驻轨和功能菜单，低频入口按分类显示、办公室项及更多入口有活动态，选择办公室后进入 `/agent-office`。在 390×520 检查菜单、搜索空结果和清空操作；菜单实测边界为 x=74、y=65、宽 306、高 390，`documentElement.scrollWidth` 等于 390，没有页面横向溢出。实际当前四项可见，超出后的内部列表滚动由 CSS 与直接回归覆盖；未在浏览器中用更多菜单项制造实际滚动。之后关闭菜单并恢复 1280×720 默认视口。捕获了内置浏览器页面截图供本轮目视验收，CUA 未提供可保存到仓库的截图路径。本次检查的是 3000 当前源码构建，用户原打开的 3100 标签未用于验收。
- 运行服务后续状态：最终健康复核时 `:3000` 已退出；`:3100` 仍由 LFAA Web 监听且健康接口返回 `status=ok, persistence=ready`，但内置浏览器显示“LFAA 需要重新启动”。再次启动 3000 时，运行时因 `storage-domain` 检测到该共享数据目录已被现有 3100 控制端占用而拒绝启动；没有终止这个用户正在使用的服务。当前 3100 页面需按 LFAA 的正常 Web 重启流程更新后才能显示本次导航改动。
- 性能/安全/可维护性证据与未测边界：目录仅包含当前调用方提供的最多五项固定导航行为，不创建新订阅、请求、计时器或持久化；搜索只在输入变化时筛选此短目录。菜单不读取或复制业务数据、认证与权限，只执行既有回调和路由。页面实测没有水平溢出；未做帧时间测量、真实窄设备测试或菜单项目超量后的浏览器滚动手势测试。
- 同步的权威文档及链接：`docs/PROMPTS.md` 任务索引；`packages/client/ui-sidebar/README.md` 导航组件合同。
