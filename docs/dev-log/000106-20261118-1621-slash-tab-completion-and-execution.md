# 000106-20261118-1621-slash-tab-completion-and-execution

- 时间：2026-11-18 16:21:00 +08:00
- 任务：为 `/` 斜杠指令与 `@` 提及增加 `Tab` 键自动补全，支持直接键入斜杠指令提交执行，并强化 `计划模式`（`/plan`）分步执行约束

## 变更文件

- `M` [composer-context.ts](file:///e:/lfaa/packages/core/chat/client/composer-context.ts)
  - 强化 `modeId === "plan"` 的上下文指令约束，明确要求先拆分分步实施计划（含每步目标、涉及文件与验证方式）并严格按步执行、逐步汇报。
- `M` [MentionPopover.tsx](file:///e:/lfaa/packages/core/chat/client/components/MentionPopover.tsx)
  - 在 `SlashCommandPopover` 顶部标题增加 `Tab 补全 · Enter 选择` 提示。
- `M` [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)
  - 新增 `handleTabCompleteSlashCommand`：按下 `Tab` 将当前高亮斜杠指令补全为 `/cmd ` 并定位光标至末尾；`@` 提及亦支持 `Tab` 键选中。
  - 在 `handleSubmit` 中直接解析 `/new`、`/clear`、`/settings`、`/plan [内容]` 与 `/goal [内容]`，确保手工输入或 `Tab` 补全后回车/点击发送均可直接生效。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`789ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 输入 `/pl` 弹出指令面板并显示 `Tab 补全 · Enter 选择`，按 `Tab` 后自动补全为 `"/plan "` 且继续键入 `test` 得到 `"/plan test"`。
  - 输入 `/clear` 执行后清空草稿且不发送消息；输入 `/settings` 回车直接跳转设置中心。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
