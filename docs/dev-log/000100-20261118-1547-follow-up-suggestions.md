# 000100-20261118-1547-follow-up-suggestions

- 时间：2026-11-18 15:47:00 +08:00
- 任务：在助手最新已完成回复下方新增 3 条上下文「延伸追问建议」胶囊按钮（点击即追问），并验证此前因并发编辑/HMR 导致的卡顿已恢复正常

## 变更文件

- `A` [follow-up-suggestions.ts](file:///e:/lfaa/packages/core/chat/client/follow-up-suggestions.ts)
  - 新增 `buildFollowUpSuggestions`，结合最近一轮用户提问与助手回复特征（代码块 / 表格 / 列表 / 普通问答）生成 3 条简洁不重复的延伸追问建议。
- `M` [MessageActionBars.tsx](file:///e:/lfaa/packages/core/chat/client/components/MessageActionBars.tsx)
  - 新增 `FollowUpSuggestions` 组件，渲染带右箭头 `→` 的圆角追问胶囊列表。
- `M` [MessageActionBars.module.css](file:///e:/lfaa/packages/core/chat/client/components/MessageActionBars.module.css)
  - 新增 `.followUpList`、`.followUpBtn` 与 `.followUpArrow` 悬停微动效样式。
- `M` [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)
  - 仅在最新一条非流式且非空的助手回复下方渲染 `<FollowUpSuggestions />`，点击后直接调用 `handleSubmit(question)` 发起追问。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`558ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 打开 `火星的气候特点` 会话，最新回复下方正常显示 3 条带 `→` 箭头的延伸追问胶囊。
  - 点击第 2 条追问胶囊 `有没有实际案例或更直观的对比？`，新回复流畅流式输出并完整结束（未出现卡在 `...` 的情况），下方随即更新为新的 3 条追问建议。
  - 控制台报错 `0` 条，网络请求失败 `0` 个。
