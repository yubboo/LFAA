# 000095-20261118-1526-topbar-session-title-and-auto-summary

- 时间：2026-11-18 15:26:00 +08:00
- 任务：将顶部导航栏标题绑定为当前会话名称（空白态显示「新聊天」），实现根据用户提问自动提炼简洁语义标题，并修复新建会话首条消息原子写并发 `404` 问题

## 变更文件

- `M` [WorkbenchShell.tsx](file:///e:/lfaa/packages/ui/layout/client/components/WorkbenchShell.tsx)
  - 在 `activeView === "workspace"` 时优先将顶部 `WorkspaceBar` 标题绑定为当前活跃聊天会话的 `title`（空白新聊天显示 `新聊天`），不再固定显示 `首页`。
- `M` [session-store.ts](file:///e:/lfaa/packages/core/memory/src/session-store.ts)
  - 新增 `generateConciseSessionTitle`：自动剔除寒暄语与指令前缀（如 `请用 N 句话`、`请不要调用工具` 等）及尾随约束，提炼出简短清晰的主题标题（中文不超过 16 字 / 英文不超过 24 字符）。
  - 将 `writeSession` 升级为「临时文件 + `rename`」原子写入，消除高并发下读取到半截 JSON 导致的瞬时 `404` 竞态。
- `M` [chat-store.ts](file:///e:/lfaa/packages/core/chat/client/chat-store.ts)
  - 首条消息发送拉取 `detail.session` 后同步更新 `sessions` 列表，使侧栏与顶部标题栏无需刷新即可实时更新为新生成的语义标题。

## 验证结果

- `pnpm --filter @lfaa/memory test`：通过。
- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`602ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`，已重启 `pnpm lfaa web`）：
  - 点击 `新聊天` 顶部显示 `新聊天`；切入 `项目内测试新会话` / `你好` 时顶部实时切换为对应会话名称。
  - 新建聊天发送 `请用 2 句话简短介绍一下木星的气候特点，不要调用工具。`：无 `404` 报错，回复立即流式输出至主工作区；无需刷新页面，侧栏与顶部标题栏同步实时更新为 `木星的气候特点`。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
