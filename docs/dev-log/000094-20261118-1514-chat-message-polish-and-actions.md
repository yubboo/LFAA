# 000094-20261118-1514-chat-message-polish-and-actions

- 时间：2026-11-18 15:14:00 +08:00
- 任务：全面优化聊天消息界面细节与交互（多行块注释着色、用户消息气泡与操作栏、助手回复操作栏、已编辑文件折叠卡片及回到底部悬浮按钮）

## 变更文件

- `M` [markdown-parser.ts](file:///e:/lfaa/packages/core/chat/client/markdown-parser.ts)
  - 新增 `tokenizeCodeLines`，跨行追踪 `/* ... */` / `/** ... */` 块注释状态，使 JSDoc 等多行注释整段完整着色。
- `M` [MarkdownContent.tsx](file:///e:/lfaa/packages/core/chat/client/components/MarkdownContent.tsx)
  - `CodeBlockCard` 切换为调用 `tokenizeCodeLines`。
- `A` [MessageActionBars.tsx](file:///e:/lfaa/packages/core/chat/client/components/MessageActionBars.tsx)
  - 新增 `UserMessageActions`（时间戳 + `复制消息` + `编辑消息`）、`AssistantMessageActions`（`复制回复` + `评价回复` + `朗读` + `···` 更多菜单含「`分支到新聊天`」与记忆引用统计 + 时间戳/模型名）、`EditedFilesCard`（已编辑文件折叠汇总卡片）及 `formatDayDivider`。
- `A` [MessageActionBars.module.css](file:///e:/lfaa/packages/core/chat/client/components/MessageActionBars.module.css)
  - 消息操作栏、毛玻璃更多菜单及文件变更卡片样式。
- `M` [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)
  - 集成顶部时间分割线、用户/助手消息操作栏、已编辑文件卡片及滚动远离底部时的居中「回到底部」悬浮按钮。
- `M` [ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css)
  - 调整 `.userBubble` 为柔和梅红气泡并支持深浅主题自适应；新增 `.dayDivider` 与 `.scrollBottomBtn`。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`496ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 顶部居中展示时间分割线 `今天 14:56`。
  - TypeScript 代码块内多行 JSDoc 注释（`@param` / `@returns` / `@throws` / `@example`）全部命中 `tok_comment` 着色（16 个注释 span）。
  - 悬停用户消息气泡显示时间戳与 `复制消息` / `编辑消息` 按钮。
  - 助手回复底部展示 `复制回复`、`评价回复`（点击 `aria-pressed="true"`）、`朗读`、`更多操作`（`···` 弹出 `分支到新聊天` 与 `0 条记忆引用`）、时间戳与 `deepseek-flash`。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
