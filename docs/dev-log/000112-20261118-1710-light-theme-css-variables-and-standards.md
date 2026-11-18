# 000112-20261118-1710-light-theme-css-variables-and-standards

- 时间：2026-11-18 17:10:21 +08:00
- 任务：将浅色/深色双主题与 CSS 变量规范写入开发规范，并修复浅色模式下悬浮卡片、操作菜单、模型配置弹窗与变更卡片的硬编码暗色问题

## 变更文件清单

- 修改：`AGENTS.md`
- 修改：`docs/standards/AI-Agent-Development-Standards.md`
- 修改：`packages/core/chat/client/components/SessionHoverCard.module.css`
- 修改：`packages/core/chat/client/components/SessionActionMenu.module.css`
- 修改：`packages/core/chat/client/components/ModelProviderGrid.module.css`
- 修改：`packages/core/chat/client/components/MessageActionBars.module.css`
- 修改：`packages/core/chat/client/components/StepTraceList.module.css`

## 实现摘要

1. **固化双主题与 CSS 变量强制规范**：
   - 在 `AGENTS.md` 新增 `§2.2 浅色/深色双主题与 CSS 变量规范（强制）`，在 `docs/standards/AI-Agent-Development-Standards.md` 新增 `§3.4`，明确禁止写死暗色/亮色十六进制或 RGBA 兜底值（如 `#111216`、`rgba(24, 25, 30, 0.96)`、`rgb(255 255 255 / 0.14)`），要求统一使用 `@lfaa/ui-theme` 语义变量（`--color-surface`、`--color-panel`、`--color-line`、`--color-active`、`--color-ink`、`--color-muted`、`--color-accent`、`--color-accent-rgb`），并在交付前同步实测深色与浅色主题。
2. **清理硬编码暗色兜底**：
   - `SessionHoverCard.module.css` & `SessionActionMenu.module.css`：将 `var(--glass-card-bg, rgba(24, 25, 30, ...))` 改为 `var(--glass-card-bg, var(--color-surface))`，边框与分隔线改为 `var(--color-line)`，悬停态改为 `var(--color-active)`。
   - `ModelProviderGrid.module.css`：将输入框、下拉框及模型芯片中失效的变量回退 `var(--color-bg, #111216)` 与硬编码白色边框替换为 `var(--color-panel)` 与 `var(--color-line)`，聚焦/激活态联动 `var(--color-accent)` 与 `var(--color-accent-rgb)`。
   - `MessageActionBars.module.css` & `StepTraceList.module.css`：将暗色半透明背景与边框改为 `var(--color-surface)` / `var(--color-panel)` / `var(--color-line)`，并为浅色模式下的增删统计色（`.diffAdd` / `.diffDel`）补充 `:global(:root[data-resolved-theme="light"])` 高对比度适配。

## 验证结果

- 类型检查与构建（`task-3754`）：`pnpm run typecheck`（13 个 tsconfig）+ `pnpm --filter @lfaa/app-web run build`（`vite build`）均以退出码 `0` 通过。
- 内置浏览器浅色模式实测（`http://127.0.0.1:5173/`，`data-resolved-theme="light"`）：
  - 会话悬浮卡片 `[data-session-hover-card]` 正常呈现浅色表面背景与清晰深色文字，不再出现黑底黑字。
  - `DeepSeek 模型配置` 弹窗中的输入框、协议切换胶囊及模型列表胶囊均呈现浅色背景与深色文字，不再出现黑底输入框。
  - 控制台错误 `0` 条，网络失败请求（`>= 400`）`0` 条。

## 风险与遗留

- 无。
