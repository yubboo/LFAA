# 000111-20261118-1702-project-git-init-and-edited-files-linkage

- 时间：2026-11-18 17:02:56 +08:00
- 任务：实现项目对话自动初始化 `.git`、文件编辑行级增删统计与撤销/查看变更联动，并在 `app1` 中实测生成贪吃蛇 `snake.html`

## 变更文件清单

- 修改：`packages/core/memory/src/types.ts`
- 修改：`packages/core/chat/client/chat-types.ts`
- 修改：`packages/core/tools/src/builtin-tools.ts`
- 修改：`packages/core/agent/src/agent-loop.ts`
- 修改：`packages/core/agent/src/index.ts`
- 修改：`packages/core/chat/src/git-service.ts`
- 修改：`packages/core/chat/src/git-http-handler.ts`
- 修改：`packages/core/chat/src/index.ts`
- 修改：`packages/core/chat/client/coding-settings-client.ts`
- 修改：`packages/core/chat/client/components/MessageActionBars.tsx`
- 修改：`packages/core/chat/client/components/MessageActionBars.module.css`
- 修改：`packages/core/chat/client/components/ChatWorkspace.tsx`
- 修改：`packages/core/chat/client/index.tsx`

## 实现摘要

1. **项目对话自动初始化 `.git`（`packages/core/agent/src/index.ts`）**：
   - 新增 `ensureProjectGitRepo(rootPath)`：当用户在绑定项目中发起对话（`projectId` + `workspaceRoots[0]`）时，若项目目录尚未建立 `.git` 仓库则自动执行 `git init`、配置本地 `user.name`/`user.email`（缺失时补全）并创建首个基线提交（`HEAD`），确保项目开箱即受 Git 管理。
2. **文件写入/编辑行级变更统计**：
   - 在 `packages/core/tools/src/builtin-tools.ts` 为 `write_file`、`edit_file` 增加 `countLineDiff`，通过 `metadata` 返回 `added`/`removed` 行数；经 `agent-loop.ts` 写入 `AgentStepTrace`（`addedLines` / `removedLines`）。
3. **文件撤销接口与 `EditedFilesCard` 联动**：
   - 在 `git-service.ts` 与 `git-http-handler.ts` 新增 `revertGitFiles` 与 `POST /api/git/revert-files`（已跟踪文件 `git checkout HEAD --`，未跟踪新建文件安全删除）。
   - 升级 `EditedFilesCard`（`MessageActionBars.tsx` / `MessageActionBars.module.css`）：展示 `已编辑 N 个文件` 与总 `+X -Y`、每行文件 `+A -B`、`撤销` 按钮、`查看变更` 按钮（直达 `codeReview` 内置 Git 与代码审查工作台）以及超过 3 个文件时的展开/收起切换。

## 验证结果

- 类型检查与构建：`pnpm run typecheck`（13 个 tsconfig）+ `pnpm --filter @lfaa/app-web run build`（`vite build`）均以退出码 `0` 通过。
- 内置浏览器 E2E 实测（`http://127.0.0.1:5173/`，在「小鱼 Agent」绑定项目 `app1`）：
  - 发起对话要求在根目录创建 `snake.html` 后，助手成功生成 `D:\Documents\LFAA\app1\snake.html`。
  - `EditedFilesCard` 正确显示 `已编辑 1 个文件`、`+542 -0`、`撤销`、`查看变更` 及文件行 `snake.html +542 -0`。
  - 验证 `app1` 已自动初始化 `.git`（分支 `main`，`提交历史 (1)`，`工作区变更 (1)` 显示 `?? snake.html`）；并已将 `查看变更` 跳转目标优化为直达 `codeReview` 工作台。
  - 控制台错误 `0` 条，网络失败请求（`>= 400`）`0` 条。

## 风险与遗留

- 无。
