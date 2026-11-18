# 000078 Dev Log — 修复输入栏模型浮窗顶部挤占折行错位

- **时间**：2026-11-18 13:20:22 +08:00
- **任务编号**：000078

## 1. 变更文件清单

- `M` `e:\lfaa\packages\core\chat\client\components\ModelReasoningPicker.tsx`
  - 将原先同处一行的协议短标签移至第二行 `.modelSubHeaderRow` 右侧（与左侧 `当前品牌官方模型` 分栏对齐），第一行 `.modelHeaderRow` 仅保留 `activeProfile.name` 与 `同步官方` 按钮。
- `M` `e:\lfaa\packages\core\chat\client\components\ModelReasoningPicker.module.css`
  - 新增 `.modelSubHeaderRow` 与 `.modelSubHeaderRow .modelGroupLabel`，为 `.modelHeader`、`.iconActionBtn`、`.protocolTag` 增加 `white-space: nowrap` / `flex-shrink: 0`，彻底防止品牌标题与「同步官方」按钮折行错位。

## 2. 验证结果

- **全量单元测试**：`pnpm exec tsx --test @testFiles` -> **46/46 通过**（0 失败，0 跳过，`duration_ms 2848.715`）。
- **TypeScript 类型检查**：`pnpm run typecheck`（13 个 tsconfig 工程） -> **通过（exit 0）**。
- **Web 生产构建**：`pnpm --filter @lfaa/app-web run build` (`vite build`) -> **通过（✓ 6706 modules transformed, built in 496ms）**。
- **内置浏览器实测验收（1440×900，`http://127.0.0.1:5173/`）**：
  - 第一行：`DeepSeek Chat`（`16.79px` 单行高）与 `同步官方`（`20.65px` 单行高）均单行不折行且水平居中对齐（center Y `926.30px`）；
  - 第二行：`当前品牌官方模型`（`15.54px`）与 `Chat Completions` 协议胶囊（`17.53px`）右边缘与第一行 `同步官方` 精确齐平（`1198.48px`），无重叠或横向溢出；
  - 控制台错误 `0`，失败网络请求 `0`，最终截图：`final_step_6.png`。

## 3. 风险与说明

- 常驻 Web 服务 `pnpm lfaa web`（`task-2180`）仍在 `http://127.0.0.1:5173/` 运行；未执行 `git commit` 或 `git push`。
