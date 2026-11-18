# 000110-20261118-1643-file-listing-typography

- 时间：2026-11-18 16:43:46 +08:00
- 任务：优化多目录/文件列表的生成排版规范与前端行内文件胶囊视觉样式

## 变更文件清单

- 修改：`packages/core/agent/src/agent-loop.ts`
- 修改：`packages/core/chat/client/components/MarkdownContent.tsx`
- 修改：`packages/core/chat/client/components/MarkdownContent.module.css`

## 实现摘要

1. **Agent 输出排版规范（`packages/core/agent/src/agent-loop.ts`）**：
   - 在系统提示词追加 `formatHint`：列举 3 个及以上的目录、文件、配置项或路径时，严禁挤在长句括号中用顿号堆叠；强制优先使用结构化列表、Markdown 表格或树形代码块，并用反引号包裹文件名与目录名。
2. **前端历史文本与行内文件胶囊优化（`MarkdownContent.tsx` / `MarkdownContent.module.css`）**：
   - 新增 `renderPlainTextWithFiles`，自动识别普通文本中的显式文件名（如 `coding-settings.json`、`lfaa.sqlite`、`目录说明.txt`）及连续英文目录/文件枚举（3 项及以上），渲染为柔和的 `.fileChip` 行内胶囊。
   - 柔化 `.inlineCode` 与 `.fileChip` 的边框/背景对比度，适度增加行内间距，并提升 `.root` 行高（`1.75`）与列表项间距（`0.42rem`），消除密集长句的视觉压迫感。

## 验证结果

- 类型检查与构建（`task-3564`）：`pnpm run typecheck`（13 个 tsconfig）+ `pnpm --filter @lfaa/app-web run build`（`vite build`）均以退出码 `0` 通过。
- 重启本地服务 `pnpm lfaa web`（`task-3571`）后通过内置浏览器 E2E 实测（`http://127.0.0.1:5173/`）：
  - 打开历史会话「请列出工作区根目录文件...」，原括号内密集文本中的 18 个目录名与文件名均已自动渲染为清晰的 `.fileChip` 胶囊。
  - 新建会话询问工作区根目录结构，模型输出自动采用「主要文件夹」列表 +「配置文件」Markdown 表格 + 反引号胶囊的清晰排版（共 26 个行内胶囊）。
  - 控制台错误 `0` 条，网络失败请求（`>= 400`）`0` 条。

## 风险与遗留

- 无。
