# 000152｜去重右侧控制职责、最大化面板、嵌入式 Git 审查与窄屏锚点条定位

2026-11-19 17:16 +08:00

- **顶栏按钮职责去重与精准分区（[WorkspaceBar.tsx](file:///e:/lfaa/packages/ui/layout/client/components/WorkspaceBar.tsx)、[RightWorkbenchActions.tsx](file:///e:/lfaa/packages/core/chat/client/components/RightWorkbenchActions.tsx)）**：
  - 代码区面包屑最右按钮保持仅控制「工作区文件树」收起与展开。
  - 桌面常规分栏下，将 `⋮` 会话/工作台菜单与 `概览 (Ctrl+Alt+O)` 放置到中央 `WorkspaceBar` 最右侧（紧贴右侧面板左上缘），右侧面板最右上角仅保留 `最大化 (Ctrl+Shift+M)` 与 `切换侧面板 (Ctrl+Shift+B)`；且隐藏 `WorkspaceBar` 上重复的侧边栏开关（右侧整栏收起时恢复显示以供重开）。
  - 在右侧面板最大化（`.workspace` 隐藏）或窄屏抽屉模式下，`⋮` 与 `概览` 自动回归右侧面板顶栏保证可达。
- **右侧面板最大化与整体收起（[WorkbenchShell.tsx](file:///e:/lfaa/packages/ui/layout/client/components/WorkbenchShell.tsx)、[workbench-service.ts](file:///e:/lfaa/packages/ui/layout/client/workbench-service.ts)）**：新增 `Ctrl+Shift+M` 最大化右侧工作台（占满中央与右侧空间并保留左侧两级导航）与 `Ctrl+Shift+B` 整栏收起/恢复快捷键。
- **概览面板与嵌入式 Git 审查标签（[RightGitReviewPane.tsx](file:///e:/lfaa/packages/core/chat/client/components/RightGitReviewPane.tsx)、[RightWorkbenchPane.tsx](file:///e:/lfaa/packages/core/chat/client/components/RightWorkbenchPane.tsx)）**：`概览` 展示 Git `审查 (+add -del)`、`文件`、`终端`、`扩展`、`子智能体` 与 `后台任务`（支持 `查看全部 / 收起` 与停止运行中任务）；点击 `审查` 在右栏直接打开可关闭的 **`审查 ×`** 标签，集成双栏 Diff 视图、变更文件列表、一键暂存/取消暂存与代码定位跳转。
- **窄屏导航刻度锚点条防遮挡与「回到底部」错位分离（[ChatAnchorBar.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatAnchorBar.module.css)、[ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css)）**：通过 CSS Container Queries（`@container (max-width: 880px)`），聊天区变窄时自动将左侧垂直刻度条切换为位于输入框正上方的横向悬浮胶囊并向上弹出预览卡片；同时将窄屏「回到底部 `↓`」按钮移至输入框右上角外侧上方，与居中横向刻度胶囊彻底错开不重叠。
