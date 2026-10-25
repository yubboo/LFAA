<a id="lfaa-compact-application-center-anchor-20261025"></a>
# 278-Compact 应用工作区中心区锚点修正（2026-10-25）

## 目标与 Owner

- 用户指出 `/apps/connectivity/normal` 响应式截图中红框所圈的整个中心主内容区域偏右；不是只调整标题、卡片的内边距。
- 让 Compact 普通应用在左二导航可见时仍复用现有悬浮预览，不让左二 Dock 宽度推动中心区。中心区左边界应保持在左一全局轨之后；桌面恢复原有已保存开合状态。
- 入口：`ApplicationWorkspace` 装配的普通应用路由；开合/预览状态由 `packages/client/ui-workspace/src/ApplicationWorkspace.tsx` 管理，面板几何继续由 `packages/client/ui-dockkit/src/ResizableWorkbench.tsx` 管理，预览继续复用同一个 DockKit pane 与 `.module-sidebar`。

## 设置、数据与边界

- 沿用 `general.navigationLayout`、已有 Dock 宽度/开合偏好和 Appearance 的主题、颜色、字体字号、对比度、壁纸、遮罩、模糊及减少动态效果映射；不新增/重置设置。响应式收起时把原开合值保存在现有临时恢复 ref 中，不覆盖持久偏好，回到 Desktop 后恢复。
- 不触碰会话、应用、Provider、认证、权限、服务端或用户业务数据。鼠标悬停预览仍由现有触发器与同一左栏处理；不新增监听器、订阅、请求、计时器或动画。
- 允许修改 `ApplicationWorkspace`、直接回归、`ui-workspace/README.md`、本合同与索引；如架构事实需要同步，仅更新普通应用 Compact 左栏与中心锚点说明。禁止复制菜单、改 DockKit 对其他 Surface 的响应式行为、写死用户偏好或改右栏语义。

## 验收

- 代表性 Compact 容器下，左二菜单显示时以现有预览层覆盖，中心区左边界不随左二栏宽变化；未显示菜单时不占用中心宽度。首次直接在 Compact 视口加载与桌面缩窄进入 Compact 的结果一致。
- Desktop 中既有左二开合偏好保持不变；响应式恢复时回到切换前值。中心内容没有横向溢出，联机服务卡片仍按真实中心容器宽度换列。
- 跑左预览/响应式直接回归、ui-workspace 构建、Web 构建；按仓库要求在 ChatGPT 内置浏览器实际路由验证 Desktop 与 Compact，并记录坐标、交互、截图和未测边界。构建、DOM 几何与键盘焦点不冒充真实鼠标 hover 或帧时间测量。

## 实施与验证记录

- 状态：源码修复、定向回归、正式构建与内置浏览器实页验收完成；真实鼠标移动和帧时间未测。
- 基线：正式路由 `http://127.0.0.1:3000/apps/connectivity/normal`；内置浏览器当前偏好为左二收起。源码中 Compact 普通应用仍把左二作为占宽 Dock，且 mount 时的 layout effect 跳过首次响应式处理；首次在窄窗口加载会让 Dock 把中心区推右。
- 实施：首次加载也按 `${layoutMode}:${workspaceMode}` 应用响应式布局；Compact 普通应用临时收起左二并复用同一悬浮预览，保存原开合值供 Desktop 恢复；原设置布局同步保留临时收起状态，并对相同开合值跳过 React 状态更新。没有新增设置或改变用户偏好。
- 回归与构建：`node --test apps/cli/tests/client-left-preview-hover-flicker.test.mjs` 3/3 通过；`lfaa-client-ui-workspace` 构建、`build:control-plane`、`build:web` 均通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。Web 构建产物写入根 `dist/`，并在产物更新后按正式入口重启服务。
- 实页：ChatGPT 内置浏览器 `http://127.0.0.1:3000/apps/connectivity/normal`。Compact 945×1015：键盘聚焦同一预览触发器后，预览为 x=64、宽 200px，中心区与内容区仍为 x=65、宽 859.4px；页面 scrollWidth=935px，没有横向溢出。中心区保持在预览下方且未随预览右移的截图留在本轮内置浏览器工具记录中。Desktop 1280×900：中心区 x=65、宽 1194px，scrollWidth=1270px。Mobile 390×720：中心区 x=48、宽 322px，scrollWidth=380px、无横向溢出。最终恢复内置浏览器原始 472×508 视口。
- 未测边界：当前内置浏览器账户保存的是左二收起偏好，未改偏好来模拟用户截图里的已展开 Dock；通过键盘焦点打开预览核对覆盖时的几何，真实鼠标 hover 闪烁与帧时间测量仍未验。运行页面的已有主题、字号、颜色、对比度、壁纸、遮罩、模糊、减少动态效果配置继续生效。
