# Dev Log 000043 — 优化侧边栏拖拽拉伸与磁吸折叠跟手流畅度

- **时间**：2026-11-18 01:13:04 +08:00
- **任务编号**：000043
- **关联修复**：消除此前每像素触发整棵 React Shell 重渲染、110–220px 死区僵硬卡顿以及吸附瞬间无缓动跳变的问题。

## 变更文件清单

- `packages/ui/layout/client/sidebar-resize.ts`（81 行）：
  - 在 `[110, 220)` 区间引入弹性阻尼视觉宽度（`visualWidth = 220 - (220 - rawWidth) * 0.3`，并计算 `tension` 驱动轻微淡出提示）代替死区冻结；新增 `SNAP_REOPEN_THRESHOLD_WIDTH = 124` 滞回阈值防止临界抖动；调整 `buildSidebarWidthVars` 在拖拽中将目标侧 CSS 变量控制权交给直接 DOM 更新。
- `packages/ui/layout/client/useSidebarResize.ts`（250 行）：
  - 改用 `requestAnimationFrame` 合帧直接更新根容器 `--left-sidebar-width` / `--right-panel-width` 与 `--left-drag-opacity` / `--right-drag-opacity`，正常拖拽期间零 React 重渲染；仅在跨越磁吸/展开临界态或松手回弹时触发 `data-snap-animating="true"`（200ms），让面板与分割条平滑过渡。
- `packages/ui/layout/client/components/ResizeHandle.module.css`（92 行）：
  - 为 `data-snap-animating="true"` 添加 `190ms cubic-bezier(0.22, 1, 0.36, 1)` 的 `grid-template-columns`、分割条 `left`/`right` 与侧栏 `opacity`/`transform` 联动缓动，同时尊重 `prefers-reduced-motion: reduce`。
- `packages/ui/layout/client/components/WorkbenchShell.tsx`（400 行）：更新 `buildSidebarWidthVars` 参数传递。
- `packages/ui/layout/tests/persistence-lifecycle.test.ts`：补充 `[110, 220)` 弹性压缩与 `124px` 滞回重开单测断言。

## 验证结果

1. **单元测试**：`pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts`（覆盖全部 10 个测试文件）— **26/26 通过**。
2. **类型检查与构建**：`pnpm run typecheck`（12 个工程）与 `pnpm run build`（Vite 构建 `built in 855ms`）通过。
3. **Playwright 真机物理手感验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - 左右两侧拖拽进入 `150px` 阻尼区均实时压缩至 `198.99px`（`opacity: 0.823`），松手后平滑回弹至 `220px`。
   - 拖入 `< 110px` 平滑吸附至 `0px`，不松手回拉至 `280px` / `290px` 顺滑重开，松手折叠后移除手柄并仅可点击顶部按钮重新展开；刷新后 `232.00px` 宽度持久化保持，控制台报错 0。
   - 当前后台 `pnpm lfaa web`（`task-2408`）运行最新构建；未执行 `git commit` / `git push`。
