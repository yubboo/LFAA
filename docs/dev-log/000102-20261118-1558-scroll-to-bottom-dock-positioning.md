# 000102-20261118-1558-scroll-to-bottom-dock-positioning

- 时间：2026-11-18 15:58:00 +08:00
- 任务：将「回到底部 `↓`」按钮移入 `.composerDock` 内相对居中悬浮定位，确保精准对齐输入区上方、不破坏主网格行高并在回到底部后自动消失

## 变更文件

- `M` [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)
  - 将 `button[aria-label="回到底部"]` 移入 `.composerDock` 容器内渲染，并将出现阈值调整为距底部超过 `48px`。
- `M` [ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css)
  - 为 `.composerDock` 添加 `position: relative`，将 `.scrollBottomBtn` 改为 `position: absolute; left: 50%; bottom: calc(100% + 0.55rem); transform: translateX(-50%);` 精准居中悬浮于输入区正上方。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`645ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 在 `火星的气候特点` 会话底部时，`button[aria-label="回到底部"]` 数量为 `0`。
  - 向上滚动聊天区后，按钮出现并精确居中于输入框正上方（按钮水平中心 `771.79px`，与输入框中心 `771.79px` 完全重合）。
  - 点击按钮后平滑滚动回底部，按钮自动卸载消失（`count: 0`）。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
