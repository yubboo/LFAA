# 000108-20261118-1634-background-unread-accent-dot

- 时间：2026-11-18 16:34:15 +08:00
- 任务：修复后台生成完成后未自动标记未读及悬浮卡片缺少未读提示的问题，并使未读小点跟随主题强调色

## 变更文件清单

- 修改：`packages/core/agent/src/index.ts`
- 修改：`packages/core/chat/client/chat-store.ts`
- 修改：`packages/ui/layout/client/components/SidebarSectionList.module.css`
- 修改：`packages/core/chat/client/components/SessionHoverCard.module.css`

## 实现摘要

1. **后端运行完成持久化未读状态（`packages/core/agent/src/index.ts`）**：
   - 在 `runSession` 正常完成（`done`）及非手动中止的异常结束时，调用 `this.ctx.memory.updateSession(session.id, { unread: true })` 持久化未读状态。
2. **前端后台运行轮询与未读同步（`packages/core/chat/client/chat-store.ts`）**：
   - 新增 `backgroundRunSessionIds` 与 `backgroundPollTimer`（并在 `dispose()` 中清理）。
   - 在 `openSession` / `startNewChatDraft` 切走正在运行的会话时，将该会话登记到后台轮询列表，每 `1500ms` 查询 `/api/agent/sessions/:id/active-run`；检测到后台生成完成后调用 `refreshMeta()` 刷新会话列表，使左侧栏与悬浮卡片即时显示未读提示。
   - 在 `onFinished` 中仅当 `this.state.activeSessionId === sessionId` 时清除 `unread: false` 并刷新当前会话；当打开带有 `unread` 标记的会话时自动清除未读。
3. **未读小点跟随主题强调色**：
   - 将 `SidebarSectionList.module.css` 与 `SessionHoverCard.module.css` 中 `.unreadDot` 的固定蓝色改为 `background: var(--color-accent, #3b82f6)` 与 `box-shadow: 0 0 0 ... rgb(var(--color-accent-rgb, 59 130 246) / 0.2)`。

## 验证结果

- 类型检查与构建（`task-3474`）：`pnpm run typecheck`（13 个 tsconfig）+ `pnpm --filter @lfaa/app-web run build`（`vite build`）均以退出码 `0` 通过。
- 重启本地服务 `pnpm lfaa web`（`task-3480`）后通过内置浏览器 E2E 实测（`http://127.0.0.1:5173/`）：
  - 新建会话发送提问后立即切走至「你好」，约 `1934 ms` 后后台会话自动在左侧栏显示 `[aria-label="未读"]` 小点；未读小点随当前 `--color-accent: #E66AA8` 渲染为对应强调色与外圈光晕。
  - 悬停该会话行弹出 `[data-session-hover-card]`，正常显示「未读」提示与强调色小点。
  - 点击进入该会话后，生成内容完整显示且未读小点自动清除。
  - 控制台错误 `0` 条，HTTP `>= 400` 请求 `0` 条（切走原流式会话时有 1 次预期的 SSE 客户端主动断开 `net::ERR_ABORTED`）。

## 风险与遗留

- 无。
