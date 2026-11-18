# 000097-20261118-1534-remove-native-sidebar-title-tooltip

- 时间：2026-11-18 15:34:00 +08:00
- 任务：移除侧栏项目行与会话主行上的浏览器原生 `title` 提示，避免悬停时弹出白底原生气泡遮挡自定义悬浮卡片

## 变更文件

- `M` [SidebarSectionList.tsx](file:///e:/lfaa/packages/ui/layout/client/components/SidebarSectionList.tsx)
  - 当列表项已绑定自定义悬停卡片交互（`item.onMouseEnter`）时省略 `title` 属性，不再触发浏览器原生白底文字提示。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`758ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 检查侧栏全部 13 个项目/会话主按钮（`app1`、项目内子会话及 `最近` 会话），确认 `getAttribute("title") === null`。
  - 悬停 `木星的气候特点` 会话行，确认仅显示自定义 `[data-session-hover-card]` 悬浮卡片，无原生 `title` 气泡弹出。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
