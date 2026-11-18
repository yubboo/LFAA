# 000084-20261118-1435-unified-model-picker-pill

- 时间：2026-11-18 14:35:10 +08:00
- 任务：将输入栏模型与推理强度选择胶囊合并为单一整体按钮，推理强度调节仅保留在模型弹窗内

## 变更文件

- `M` [ModelReasoningPicker.tsx](file:///e:/lfaa/packages/core/chat/client/components/ModelReasoningPicker.tsx)
  - 将原拆分的 `.modelBtn` 与 `.reasoningBtn` 合并为单一整体 `<button type="button" className={styles.triggerPill}>`，统一使用一个 `HoverTip`（`选择模型` / `Select model`）。
  - 移除独立悬浮提示 `选择推理强度 Ctrl+Shift+M` 以及 `Ctrl+Shift+M` 快捷键直达逻辑，确保推理强度调节仅能通过主弹窗内的「`推理强度：...`」入口进入 `StepSliderPopover`。
- `M` [ModelReasoningPicker.module.css](file:///e:/lfaa/packages/core/chat/client/components/ModelReasoningPicker.module.css)
  - 移除 `.modelBtn`、`.reasoningBtn`、`.tooltipHint`、`.kbdBadge` 拆分样式，新增 `.modelLabel`、`.reasoningLabel`、`.chevronIcon` 统一内部排版样式。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`500ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 确认底部模型胶囊仅包含 1 个 `<button>`，悬停右半区（`高 v`）仅显示单一 `选择模型` 提示，不再出现 `选择推理强度 Ctrl+Shift+M`。
  - 点击胶囊右半区打开主模型弹窗（含 `推理强度：高` 入口），点击该入口正常切换至推理强度滑块弹窗（`StepSliderPopover`）。
  - 控制台错误 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
