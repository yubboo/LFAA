# 000092-20261118-1504-session-hover-card-dismiss

- 时间：2026-11-18 15:04:00 +08:00
- 任务：修复会话悬浮信息卡片在鼠标移出后偶发残留在工作区不消失的问题

## 变更文件

- `M` [session-menu-store.ts](file:///e:/lfaa/packages/core/chat/client/session-menu-store.ts)
  - 在 `onRowEnter` 定时器回调中校验 `rowEl.isConnected`，防止已卸载行触发残留卡片。
  - 在 `onRowLeave` 中避免已有 `closeTimer` 时重复重置计时器；新增 `closeHoverCard()` 立即关闭方法。
- `M` [SessionOverlays.tsx](file:///e:/lfaa/packages/core/chat/client/components/SessionOverlays.tsx)
  - 当悬浮卡片打开时挂载全局 `pointermove`、`pointerdown`（capture）、`scroll`（capture）与 `blur` 监听：指针位于会话行与悬浮卡片外部时触发 `onRowLeave` 平滑关闭，点击外部、滚动或失焦时立即调用 `closeHoverCard()`。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`512ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 悬停 `最近` 会话行后 `[data-session-hover-card]` 正常弹出（`count: 1`）；移至工作区 `(600, 400)` 后完全关闭（`count: 0`）。
  - 移入卡片内部 `(425, 430)` 保持显示（`count: 1`），再次移至工作区 `(600, 400)` 后完全关闭（`count: 0`）。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
