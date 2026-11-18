# 000099-20261118-1541-message-weekday-timestamp

- 时间：2026-11-18 15:41:00 +08:00
- 任务：为用户消息与助手回复底部时间戳统一补充星期前缀（当天消息亦显示如 `星期三 15:25`）

## 变更文件

- `M` [MessageActionBars.tsx](file:///e:/lfaa/packages/core/chat/client/components/MessageActionBars.tsx)
  - 调整 `formatMessageTimestamp`，移除 `sameDay` 时省略星期的分支，统一输出 `${WEEKDAYS_ZH[d.getDay()]} ${hh}:${mm}`（英文输出 `Mon/Tue/... hh:mm`）。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`640ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 在 `木星的气候特点` 会话中确认用户消息下方与助手回复底部时间戳均显示为 `星期三 15:25`（顶部日分割线保持 `今天 15:25`）。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
