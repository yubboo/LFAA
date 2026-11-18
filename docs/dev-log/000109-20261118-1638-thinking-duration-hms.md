# 000109-20261118-1638-thinking-duration-hms

- 时间：2026-11-18 16:38:23 +08:00
- 任务：将思考字数提示替换为时/分/秒计时显示

## 变更文件清单

- 修改：`packages/core/memory/src/types.ts`
- 修改：`packages/core/chat/client/chat-types.ts`
- 修改：`packages/core/agent/src/index.ts`
- 修改：`packages/core/chat/client/components/StepTraceList.tsx`
- 修改：`packages/core/chat/client/components/ChatWorkspace.tsx`

## 实现摘要

1. **契约与后端耗时记录**：
   - 在 `ChatMessageRecord`（`@lfaa/memory`）与 `ChatMessageItem`（`@lfaa/chat/client`）新增可选字段 `reasoningDurationMs?: number`。
   - 在 `packages/core/agent/src/index.ts` 的 `runSession` 中记录 `runStartedAt`，在存在思考内容时计算并持久化 `reasoningDurationMs`。
2. **前端时/分/秒格式化与流式实时计时（`StepTraceList.tsx` / `ChatWorkspace.tsx`）**：
   - 新增 `formatThinkingDuration(ms, isZh, minOneSecond)`，按需格式化为 `X 秒`、`X 分 Y 秒`、`X 时 Y 分 Z 秒`（英文为 `Xs` / `Xm Ys` / `Xh Ym Zs`）。
   - 流式生成中每秒刷新计时，状态胶囊显示 `已思考 X 秒`；完成后摘要按钮显示 `思考了 X 秒`（历史无 `reasoningDurationMs` 的消息回退使用步骤时间戳差值估算），不再显示“多少字”。

## 验证结果

- 类型检查与构建（`task-3524`）：`pnpm run typecheck`（13 个 tsconfig）+ `pnpm --filter @lfaa/app-web run build`（`vite build`）均以退出码 `0` 通过。
- 重启本地服务 `pnpm lfaa web`（`task-3530`）后通过内置浏览器 E2E 实测（`http://127.0.0.1:5173/`）：
  - 历史会话「火星的气候特点」4 轮回复分别显示 `思考了 23 秒`、`思考了 29 秒`、`思考了 5 秒`、`思考了 25 秒`（不再出现“字”）。
  - 新建会话发送提问后，流式状态胶囊实时显示 `已思考 0 秒`，完成后摘要按钮显示 `思考了 1 秒`。
  - 控制台错误 `0` 条，网络失败请求（`>= 400`）`0` 条。

## 风险与遗留

- 无。
