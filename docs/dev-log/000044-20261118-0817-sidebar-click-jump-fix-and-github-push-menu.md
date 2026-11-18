# Dev Log 000044 — 修复侧边栏分割条点击误移位并在 lfaa.bat 菜单新增一键强推 GitHub

- **时间**：2026-11-18 08:17:01 +08:00
- **任务编号**：000044
- **关联修复**：
  1. 修复点击左右侧边栏分割条（不拖拽仅单击）时，因 React `style` diff 误删 `--left-sidebar-width` / `--right-panel-width` 导致宽度瞬间跳回默认 `clamp(...)`、且缺少拖拽启动阈值与指针捕获的问题。
  2. 在 `lfaa.bat` 调用的 `scripts/lfaa.ps1` 中新增菜单项 `4`，支持一键初始化/关联远程仓库并强制推送至 `https://github.com/yubboo/LFAA.git`。

## 变更文件清单

- `e:\lfaa\scripts\lfaa.ps1`：新增 `Invoke-Git` 与 `Push-ForceToGitHub`，并在菜单新增选项 `4`（一键强制推送到 `https://github.com/yubboo/LFAA.git` 的 `main` 分支；自动处理未初始化 `.git`、缺失 `user.name`/`user.email` 提示配置、绑定/更新 `origin`、`git add -A`、`git commit` 与 `git push --force -u origin <branch>:main`）。
- `e:\lfaa\scripts\README.md`：补充菜单选项 `4` 的用途说明。
- `e:\lfaa\packages\ui\layout\client\components\WorkbenchShell.module.css`：拆分为 `--left-sidebar-base-width` / `--right-panel-base-width` 与 `--left-sidebar-width: var(--left-drag-width, var(--left-sidebar-base-width))` / `--right-panel-width: var(--right-drag-width, var(--right-panel-base-width))`。
- `e:\lfaa\packages\ui\layout\client\sidebar-resize.ts`：新增 `DRAG_THRESHOLD_PX = 3`、`hasExceededDragThreshold` 与 `computeKeyResizeWidth`；`buildSidebarWidthVars` 改为持久输出基础宽度变量，不再因进入拖拽态而移除变量。
- `e:\lfaa\packages\ui\layout\client\useSidebarResize.ts`（298 行）：仅在水平位移达到 `3px` 阈值后才激活拖拽态与 `col-resize` 光标；改用相对 `startClientX` 增量计算 `rawWidth` 消除手柄边缘点击跳变；引入 `setPointerCapture` / `lostpointercapture` 防止鼠标移出窗口后卡死拖拽态；通过 `useLayoutEffect` 在 React 提交持久化基础宽度后清理 `--left-drag-width` / `--right-drag-width`。
- `e:\lfaa\packages\ui\layout\client\components\WorkbenchShell.tsx`：更新 `buildSidebarWidthVars` 调用参数。
- `e:\lfaa\packages\ui\layout\tests\persistence-lifecycle.test.ts`：补充 `buildSidebarWidthVars` 与 `hasExceededDragThreshold` 单元测试。

## 验证结果

1. **PowerShell 语法校验**：`[System.Management.Automation.Language.Parser]::ParseFile("e:\lfaa\scripts\lfaa.ps1", ...)` 输出 `PS1_SYNTAX_OK`。
2. **单元测试**：`pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` — **27/27 通过**。
3. **类型检查与构建**：`pnpm run typecheck`（12 个工程）与 `pnpm run build`（Vite 构建 `built in 480ms`）均以退出码 `0` 通过。
4. **未执行说明**：未在本机实际执行菜单项 `4`（`git init` / `git commit` / `git push --force`），仅完成脚本实现与语法检查；`apps/web` 当前工作区未检测到本地监听 Playwright 包，未在真实浏览器中自动点击回归。
