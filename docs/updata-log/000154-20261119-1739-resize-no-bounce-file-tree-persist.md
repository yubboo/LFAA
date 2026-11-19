# 000154｜右侧面板拖拽定格无回弹、文件树随文件联动及全状态持久化

2026-11-19 17:39 +08:00

- **右侧栏拖拽精准定格不回弹（[sidebar-resize.ts](file:///e:/lfaa/packages/ui/layout/client/sidebar-resize.ts)）**：修正 `buildSidebarWidthVars` 在 `rightWide` 模式下使用 `max(${rightWidth}px, clamp(30rem, 46vw, 52rem))` 覆盖用户拖窄宽度的问题。现只要用户拖拽过右侧面板，松手与刷新均严格按已保存像素宽度定格（拉在哪就在哪，不再回弹）。
- **「文件+工作区树同出」与「纯浏览器隔离」（[RightWorkbenchPane.tsx](file:///e:/lfaa/packages/core/chat/client/components/RightWorkbenchPane.tsx)）**：
  - 将文件树显隐独立为 `fileTreeOpen`（默认开启），查看或点击文件时代码视图与「工作区」文件树一同展示，面包屑横跨两者且支持独立开关。
  - 切换到内置浏览器或 Git 审查标签页时自动隔离隐藏工作区文件树，保证「浏览器就浏览器」纯净全宽视口；切回文件标签页后文件树随即恢复呈现。
- **右侧工作台与文件树全状态持久化（[workbench-persist.ts](file:///e:/lfaa/packages/core/chat/client/workbench-persist.ts)、[chat-store.ts](file:///e:/lfaa/packages/core/chat/client/chat-store.ts)、[RightFileTreePane.tsx](file:///e:/lfaa/packages/core/chat/client/components/RightFileTreePane.tsx)）**：
  - 按会话持久化已打开文件标签页、当前激活标签/舞台（文件/浏览器/审查）、浏览器最后访问 URL、`fileTreeOpen`、辅助栏开关以及工作区文件树的已展开目录，并在刷新挂载时优先用同步恢复的 `activeSessionId` 请求文件快照与宿主机浏览器标签，实现整页刷新零 404 无缝恢复。
