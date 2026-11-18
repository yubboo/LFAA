# 000101-20261118-1554-mention-cursor-and-slash-commands

- 时间：2026-11-18 15:54:00 +08:00
- 任务：修复 `+` 菜单触发 `@` 后光标错位到符号前方的问题，并完整实现 `/` 斜杠操作指令检索与执行

## 变更文件

- `M` [composer-context.ts](file:///e:/lfaa/packages/core/chat/client/composer-context.ts)
  - 新增 `extractTrailingSlashQuery`、`SlashCommandEntry`、`buildSlashCommands` 与 `filterSlashCommands`（支持 `/plan`、`/goal`、`/new`、`/clear`、`/settings`）。
- `M` [ComposerAddMenu.tsx](file:///e:/lfaa/packages/core/chat/client/components/ComposerAddMenu.tsx)
  - 新增 `onTriggerSlash` 回调，将 `+` 菜单中的「`操作`」由原先误绑的 `@` 切换为触发 `/` 斜杠指令面板。
- `M` [MentionPopover.tsx](file:///e:/lfaa/packages/core/chat/client/components/MentionPopover.tsx)
  - 新增 `SlashCommandPopover` 组件，复用统一毛玻璃列表样式渲染斜杠指令。
- `M` [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)
  - 新增 `focusTextareaAt(pos)`（在 `requestAnimationFrame` 内调用 `focus()` + `setSelectionRange(pos, pos)`），确保通过 `+ -> 提及 / 操作` 插入 `@` 或 `/` 后光标精确位于符号之后。
  - 集成 `slashTrigger` 实时检索、`ArrowUp` / `ArrowDown` / `Enter` / `Escape` 键盘导航及指令执行。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`934ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 点击 `+ -> 提及`：输入框插入 `@` 并打开 `@` 提及浮层，直接键入 `x` 得到 `@x`（确认光标位于 `@` 之后而非之前）。
  - 点击 `+ -> 操作`：输入框插入 `/` 并打开 `斜杠操作指令` 浮层（含 `/plan`、`/goal`、`/new`、`/clear`、`/settings`），直接键入 `p` 得到 `/p`（光标位于 `/` 之后）；点击 `/plan` 后成功挂载 `计划模式` 标签并清空 `/`。
  - 直接输入 `/go` 精准过滤出 `/goal`（`长期目标`），按 `Escape` 正常收起。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
