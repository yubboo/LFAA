# 000080 Dev Log — 聊天会话行悬停快捷操作、右侧悬浮信息卡与「⋮」完整菜单

- **时间**：2026-11-18 13:37:51 +08:00
- **任务编号**：000080

## 1. 变更文件清单

- `M` `e:\lfaa\packages\core\memory\src\types.ts`、`session-store.ts`、`index.ts`：新增会话 `unread?: boolean` 持久化与 `forkSession`（复制完整历史消息生成分支会话）。
- `M` `e:\lfaa\packages\core\chat\src\index.ts`、`http-handler.ts`：新增 `forkSession`、`POST /api/chat/sessions/:id/fork`，并在 `PATCH /api/chat/sessions/:id` 支持 `sectionId` 与 `unread` 更新。
- `M` `e:\lfaa\packages\ui\layout\src\index.ts`、`client/navigation.ts`、`client/workbench-domains.ts`、`client/workbench-service.ts`：扩展 `WorkbenchChatProvider<TContent>`（行悬停进入/离开、菜单互斥、行操作渲染、浮层渲染）及 `WorkbenchChatSessionSummary.unread`。
- `M` `e:\lfaa\packages\ui\layout\client\components\SidebarSectionList.tsx`、`SidebarSectionList.module.css`、`NavigationGroups.tsx`、`NavigationSidebar.tsx`、`WorkbenchShell.tsx`：未悬停显示相对时间（`刚刚`、`1h`、`1d`）与未读蓝点；悬停切换为快捷操作按钮，并挂载 `chatProvider.renderSessionOverlays`。
- `M` `e:\lfaa\packages\core\chat\client\chat-types.ts`、`chat-store.ts`、`index.tsx`：新增 `updateSessionMeta`、`forkSession`、`exportSessionMarkdown` 与 `?sessionId=...` 新窗口打开支持，并在 `chatClientPlugin` 注入 `SessionMenuStore`、`SessionRowActions`、`SessionOverlays`。
- `A` `e:\lfaa\packages\core\chat\client\session-menu-store.ts`
- `A` `e:\lfaa\packages\core\chat\client\components\SessionRowActions.tsx`、`SessionRowActions.module.css`
- `A` `e:\lfaa\packages\core\chat\client\components\SessionHoverCard.tsx`、`SessionHoverCard.module.css`
- `A` `e:\lfaa\packages\core\chat\client\components\SessionActionMenu.tsx`、`SessionActionMenu.module.css`
- `A` `e:\lfaa\packages\core\chat\client\components\SessionOverlays.tsx`
- `M` `e:\lfaa\packages\core\chat\tests\chat-lifecycle.test.ts`：补充 `unread`、`sectionId` 与 `forkSession` 断言。

## 2. 验证结果

- **全量单元测试**：`pnpm exec tsx --test @testFiles` -> **46/46 通过**（0 失败，0 跳过，`duration_ms 2559.2121`）。
- **TypeScript 类型检查**：`pnpm run typecheck`（13 个 tsconfig 工程） -> **通过（exit 0）**。
- **Web 生产构建**：`pnpm --filter @lfaa/app-web run build` (`vite build`) -> **通过（✓ 6706 modules transformed, built in 497ms）**。
- **内置浏览器实测验收（1440×900，`http://127.0.0.1:5173/`）**：
  - 未悬停行右侧显示相对时间（`1h` / `2h` / `刚刚`）；
  - 悬停行切换为 `归档对话`、`置顶`、`更多操作 (⋮)` 图标，且左侧栏右侧弹出悬浮信息卡片（标题、`Outside of 项目` / 所属项目、`更新于 ...`）；
  - 点击 `⋮` 完整弹出 `重命名 (Alt+Ctrl+R)`、`置顶 (Alt+Ctrl+P)`、`标记为未读 (Ctrl+Shift+U)`、`项目`、`分区`、`分叉`、`分享`、`复制`、`在新窗口中打开`、`归档 (Ctrl+Shift+A)`、`永久删除` 共 11 项菜单；
  - 实测点击 `标记为未读` 返回 HTTP `200`，再次悬停确认会话行蓝点与右侧悬浮卡片 `未读` 状态同步显示；
  - 控制台错误 `0`，HTTP >= 400 失败请求 `0`，最终截图：`final_step_10.png`。

## 3. 风险与说明

- 常驻 Web 服务 `pnpm lfaa web`（`task-2363`）仍在 `http://127.0.0.1:5173/` 运行；未执行 `git commit` 或 `git push`。
