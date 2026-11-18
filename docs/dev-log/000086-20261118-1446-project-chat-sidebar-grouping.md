# 000086-20261118-1446-project-chat-sidebar-grouping

- 时间：2026-11-18 14:46:00 +08:00
- 任务：修复项目内点击新聊天后会话错误进入「最近」分组的问题，将项目归属会话缩进展示在对应项目下方

## 变更文件

- `M` [workbench-domains.ts](file:///e:/lfaa/packages/ui/layout/client/workbench-domains.ts)
  - 更新 `buildChatRecentItems`：新增 `existingProjectIds` 参数，过滤掉已归属现有项目的聊天会话，仅保留独立会话（及项目已被移除的孤儿会话）在「最近」分组中展示。
- `M` [SidebarSectionList.tsx](file:///e:/lfaa/packages/ui/layout/client/components/SidebarSectionList.tsx)
  - 为 `SidebarItemConfig` 增加 `nested` 与 `hideIcon` 可选字段，支持项目下属子会话的无图标缩进渲染。
- `M` [SidebarSectionList.module.css](file:///e:/lfaa/packages/ui/layout/client/components/SidebarSectionList.module.css)
  - 新增 `.itemNested` 缩进样式（`padding-left: 1.7rem`）。
- `M` [NavigationGroups.tsx](file:///e:/lfaa/packages/ui/layout/client/components/NavigationGroups.tsx)
  - 新增 `toSessionSidebarItem` 与 `toProjectWithChatsItems` 辅助函数，在「置顶」、「自定义分区」和「项目」分组中将每个项目关联的未归档聊天会话作为缩进子行直接展开渲染在对应项目下方，并复用统一的会话悬停卡片、双击重命名与 `···` 操作菜单。
- `M` [NavigationSidebar.tsx](file:///e:/lfaa/packages/ui/layout/client/components/NavigationSidebar.tsx)
  - 透传 `activeChatSessionId` 与 `onSelectChatSession` 至 `NavigationGroups`。
- `M` [WorkbenchShell.tsx](file:///e:/lfaa/packages/ui/layout/client/components/WorkbenchShell.tsx)
  - 向 `buildChatRecentItems` 传入 `existingProjectIds`，向 `NavigationSidebar` 传入 `activeChatSessionId` 与 `onSelectChatSession`。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`508ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 在 `项目` 分组中悬停 `app1` 并点击项目行「新建聊天」按钮发送消息 `项目内测试新会话`。
  - 确认新生成的会话 `项目内测试新会话` 与已有项目会话 `你好` 均直接缩进展示在 `app1` 下方（无前导图标），且不再出现在 `最近` 分组中。
  - 控制台报错 `0` 条；截图：[final_step_22.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/6cd48160-96b5-4e10-81be-eeedca9df9b1/final_step_22.png)。
