# Dev Log 000040 — 左右侧栏拖拽调宽与半阈值吸附收起

- **时间**：2026-11-18 00:34:24 +08:00
- **任务编号**：000040
- **关联升级**：桌面端四栏工作区 Shell（`@lfaa/ui-layout`）新增左二菜单栏（`section-navigation`）与右侧栏（`context-panel`）左键拖拽拉伸、50% 最小宽度阈值实时吸附收起、未松手拉回即刻恢复、松手固化收起并仅允许点击顶部按钮重新展开、自定义宽度持久化能力。

## 变更文件清单

- **新增**：
  - `packages/ui/layout/client/sidebar-resize.ts`（44 行）：纯函数计算面板最小（`MIN_PANEL_WIDTH = 220`）、最大（`MAX_PANEL_WIDTH = 440`）、中心工作区保留空间（`MIN_CENTER_WIDTH = 360`）、半阈值（`SNAP_THRESHOLD_WIDTH = 110`）吸附收起与宽度钳制逻辑（`computeMaxPanelWidth`、`computeResizeOutcome`）。
  - `packages/ui/layout/client/useSidebarResize.ts`（182 行）：管理左/右分隔条的 `window` 级 `pointermove` / `pointerup` / `pointercancel` / `blur` 监听、光标与选区锁定、未松手阈值往返重开（实时切换 `snappedCollapsed` 而不卸载节点）、松手固化并移除分隔条，以及键盘 `ArrowLeft` / `ArrowRight` 无障碍调宽。
  - `packages/ui/layout/client/components/ResizeHandle.module.css`（55 行）：10px 跨界拖拽热区与悬停/拖拽/吸附强调色指示线，以及拖拽吸附期不卸载节点的隐藏样式规则。
- **修改**：
  - `packages/ui/layout/client/ui-preferences.ts`（168 行）：新增 `LEFT_SIDEBAR_WIDTH_STORAGE_KEY`（`lfaa:left-sidebar-width`）、`RIGHT_PANEL_WIDTH_STORAGE_KEY`（`lfaa:right-panel-width`）、`readPanelWidthPref` 与 `writePanelWidthPref`。
  - `packages/ui/layout/client/locales.ts`（365 行）：新增中英文无障碍分隔条标签 `resizeLeftSidebar`、`resizeRightPanel`。
  - `packages/ui/layout/client/components/WorkbenchShell.module.css`（395 行）：`.shell` 增加 `position: relative;` 支撑绝对定位分隔条。
  - `packages/ui/layout/client/components/WorkbenchShell.tsx`（394 行）：集成 `useSidebarResize`，注入 `--left-sidebar-width` / `--right-panel-width`、同步 `data-resizing` / `data-left-drag-collapsed` / `data-right-drag-collapsed` 属性，并在面板展开态且非窄屏抽屉模式下渲染 `role="separator"` 拖拽手柄；松手折叠后手柄随之卸载，仅可通过顶部展开按钮重开。
  - `packages/ui/layout/tests/persistence-lifecycle.test.ts`（178 行）：新增 `computeResizeOutcome` 与 `ui-preferences` 面板宽度持久化及异常值回归单测。

## 行数与规范检查

- 所有改动文件均满足 `AGENTS.md` §4 小文件上限（`.tsx` / `.module.css` <= 400 行，`.ts` <= 500 行），其中 `WorkbenchShell.tsx` 为 394 行、`WorkbenchShell.module.css` 为 395 行。
- 未修改无关模块，未执行 `git commit` / `git push`（`E:\lfaa` 非 Git 仓库）。

## 验证结果

1. **单元测试**：`pnpm exec tsx --test packages/ui/layout/tests/persistence-lifecycle.test.ts` — 4/4 通过（0 失败，0 跳过）。
2. **类型检查**：`pnpm run typecheck` — 全部 6 个工程通过。
3. **生产构建**：`pnpm run build` — `@lfaa/app-web` Vite 构建成功（`built in 856ms`）。
4. **真机 Playwright 浏览器验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - **左二菜单栏**：
     - 拖拽加宽至 `312.00px` 并在 `page.reload()` 后保持 `312.00px`（0px 误差）。
     - 按住左键向左拖入半阈值以下（`railRight + 70`）触发 `data-left-drag-collapsed="true"` 与视觉隐藏；**不松手**向右拉回 `railRight + 280` 立即解除吸附并展开至 `280.00px`。
     - 拖入阈值以下并**松手（`mouse.up()`）**后，`data-left-open="false"`、`[role="separator"][data-resize-side="left"]` 计数为 `0`（不可拖拽拉开）；点击 `展开左二菜单栏` 按钮后重新展开为 `280.00px` 且手柄恢复。
   - **右侧上下文面板**：
     - 拖拽加宽至 `302.00px` 并在 `page.reload()` 后保持 `302.00px`。
     - 按住左键向右拖入半阈值以下（`shellRight - 60`）触发 `data-right-drag-collapsed="true"` 实时吸附收起；**不松手**向左拉回 `shellRight - 290` 即刻恢复 `290.00px`。
     - 拖入阈值以下并**松手**后，`data-right-open="false"`、`[role="separator"][data-resize-side="right"]` 计数为 `0`；点击 `展开右侧菜单栏` 按钮后重新展开为 `290.00px`。
   - 控制台错误数：0。
   - 测试结束后已将两栏恢复为默认 `232.00px` 展开状态；当前 `pnpm lfaa web` 后台进程（`task-1984`）运行在最新构建上。

## 风险与后续说明

- 在极端窄桌面宽度下通过 `MIN_CENTER_WIDTH = 360` 保护中央工作区不被挤垮；窄屏抽屉断点（`<= 1023px`）保持禁用拖拽。
- 此前关于 `@lfaa/chat` 真实会话数据与 `N 次聊天` 统计的 A1 规划仍待负责人确认归档计数与折叠内子列表展示规则后另行实施。
