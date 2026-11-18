# Dev Log 000068 — 修复代码审查工作台左右分栏、提交框与 Diff 区域横向滚动条及路径截断溢出 Bug

- **编号**：000068
- **时间**：2026-11-18 11:18:29 +08:00
- **任务名**：`fix-code-review-horizontal-overflow`
- **状态**：已完成修复、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 根因分析与修复方案

1. **盒模型与 CSS Grid 隐式轨道撑宽溢出**：
   - `.panelCard`、`.fileRow` 与 `.textarea` 缺少 `box-sizing: border-box` 及显式 `min-width: 0` / `grid-template-columns: minmax(0, 1fr)`；在超长相对路径或长文本提交草案填入时，`.fileRow`（`width: 100%` + 左右 padding）与 `.commitArea` 触发横向溢出，导致左侧列表容器出现横向滚动条并把文件名前端与提交输入文字顶出可视区域。
2. **Diff 预格式化文本不换行溢出**：
   - `.diffBox` 原使用 `white-space: pre` + `overflow-x: auto`，超长代码行也会产生横向滚动条；已统一改为 `white-space: pre-wrap; overflow-wrap: anywhere; overflow-x: hidden; box-sizing: border-box`。
3. **长路径文件名可读性优化**：
   - 调整列表项为「文件名主显示 + 淡色父路径截断提示」，确保长路径下核心文件名（如 `StorageSettingsView.module.css`、`composer-context.ts`）始终优先完整显示且右侧 `暂存` 按钮严格对齐容器右缘。

---

## 2. 实际变更清单

- [CodeReviewView.module.css](file:///e:/lfaa/packages/core/chat/client/components/CodeReviewView.module.css)（315 行，低于 400 行强约束阈值；含工作台两栏布局与着色 Diff 样式）：补充 `box-sizing: border-box`、`min-width: 0`、`grid-template-columns: minmax(0, 1fr)`、`overflow-x: hidden`、`.diffBox` 自动换行与 `.fileDirHint` 样式。
- [CodeReviewListPane.tsx](file:///e:/lfaa/packages/core/chat/client/components/CodeReviewListPane.tsx)（174 行）：将变更清单的文件名与目录拆分渲染，防止超长路径吞没文件名。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test` 覆盖全部 11 个测试文件 | **41/41 通过**（`duration_ms 2964.8727`） |
| TypeScript 类型检查 | `pnpm run typecheck`（13 个工程） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 1.83s`） |
| 内置浏览器实测 | `browser` 子代理访问 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0/50） |

- 实测核验（`browser` 子代理 `457a1a01-6e9e-4648-b812-74fcf0c12c50`）：
  - 在 `工作区变更 (130)`、`提交历史 (3)` 与 `审查报告 (1)` 三个标签页执行横向滚轮滚动测试（`scrolled: false`）及容器包围盒检测，左右两栏 `.panelCard`、`.textarea` 与 `.diffBox` 均无横向滚动条、无路径越界裁剪；最终截图见 [final_step_22.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/457a1a01-6e9e-4648-b812-74fcf0c12c50/final_step_22.png)。
- Web 服务 `pnpm lfaa web`（`task-1506`）已保持后台运行。
