# 000091-20261118-1501-project-row-toggle-expand

- 时间：2026-11-18 15:01:00 +08:00
- 任务：将侧栏项目行点击行为改为展开/收起子会话列表，不再切换中间工作区至空目录项目详情页

## 变更文件

- `M` [NavigationGroups.tsx](file:///e:/lfaa/packages/ui/layout/client/components/NavigationGroups.tsx)
  - 新增 `projectExpanded` 状态与 `toggleProjectExpanded`，点击项目行时仅切换该项目下属子会话的展开/收起（`aria-expanded`），不再调用 `onOpenProject` 跳转中间工作区。
  - 点击项目行「新建聊天」按钮时自动将该项目设为展开态，确保新会话立即可见。
- `M` [SidebarSectionList.tsx](file:///e:/lfaa/packages/ui/layout/client/components/SidebarSectionList.tsx)
  - 为 `SidebarItemConfig` 增加 `expanded?: boolean` 并在 `.itemMain` 上透传 `aria-expanded`。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`498ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 在 `项目内测试新会话` 聊天页面中点击 `app1` 项目行：`aria-expanded="false"`，子会话（`项目内测试新会话`、`你好`）收起隐藏，中间工作区保持正常聊天页面未跳转。
  - 再次点击 `app1` 项目行：`aria-expanded="true"`，子会话重新展开显示，中间工作区仍保持正常聊天页面。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
