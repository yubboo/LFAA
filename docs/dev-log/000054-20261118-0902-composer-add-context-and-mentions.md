# Dev Log 000054 — 输入栏 + 添加上下文菜单与 @ 提及扩展浮层

- **时间**：2026-11-18 09:02:51 +08:00
- **任务编号**：000054
- **任务目标**：对照 5 张参考图实现聊天输入栏左下角 `+` 按钮（含「添加文件等内容 @」悬浮提示与「添加上下文」菜单）以及 `@` 触发的分组上下文检索浮层（添加 / LFAA 对话 / 插件）。

## 变更文件清单

- `e:\lfaa\packages\core\chat\client\composer-context.ts`（148 行，新建）：
  - 定义 `ComposerAttachment`、`MentionEntry`，实现 `extractTrailingMentionQuery`、`buildMentionEntries`、`filterMentionEntries` 与 `buildContextualMessage`（将附件文件、文件夹、引用历史对话及 `目标` / `计划模式` 指令干净拼装入发送消息）。
- `e:\lfaa\packages\core\chat\client\components\ComposerAddMenu.tsx`（240 行，新建）与 `ComposerAddMenu.module.css`（153 行，新建）：
  - 实现 `+` 圆形按钮、悬浮提示条（`添加文件等内容 @`）以及「添加上下文」弹层（支持浏览器选择多文件/文件夹读取、触发 `@ 提及` / `操作`，并对未接入的 `浏览器` / `云端硬盘 Set up` 展示诚实未接入提示）。
- `e:\lfaa\packages\core\chat\client\components\MentionPopover.tsx`（96 行，新建）与 `MentionPopover.module.css`（88 行，新建）：
  - 渲染可滚动 `@` 分组列表浮层（`添加`：`文件和文件夹`、`在项目中使用`、`目标`、`计划模式`；`LFAA 对话`：来自 `store.sessions` 的真实历史会话；`插件`：未接入状态诚实标注），支持鼠标与键盘上下/回车/Esc 选择。
- `e:\lfaa\packages\core\chat\client\components\ComposerScopeBar.tsx`：新增 `openProjectSignal` 支持从 `@` 菜单直接唤醒项目选择浮层。
- `e:\lfaa\packages\core\chat\client\components\ChatWorkspace.tsx`（371 行，核心交互状态与提交流程集中于工作区，未超 400 行上限；纯函数与弹层已拆分至 `composer-context.ts`、`ComposerAddMenu.tsx`、`MentionPopover.tsx`、`ComposerScopeBar.tsx`、`PermissionModePicker.tsx`）与 `ChatWorkspace.module.css`（299 行）：
  - 在输入框内部上方渲染可移除上下文芯片条，监听 `@` 实时过滤与键盘导航，挂载 `ComposerAddMenu`。
- `e:\lfaa\packages\core\chat\client\locales.ts`：补充 `+` 菜单与 `@` 浮层中英文词条。
- `e:\lfaa\packages\core\chat\tests\chat-lifecycle.test.ts`：新增 `extractTrailingMentionQuery`、`filterMentionEntries` 与 `buildContextualMessage` 单元测试。

## 验证结果

1. **单元测试**：`pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` — **30/30 通过**。
2. **类型检查与构建**：`pnpm run typecheck`（12 个工程）与 `pnpm run build`（Vite 构建 `built in 1.11s`）均以退出码 `0` 通过。
3. **内置浏览器实测验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - 控制台报错 `0`，网络报错 `0`。
   - 实测验证 `+` 悬浮提示（`添加文件等内容 @`）、「添加上下文」菜单及 `云端硬盘 Set up` 未接入提示、点击 `提及` 与输入 `@目标` 触发过滤、键盘回车/点击附加 `计划模式` 与 `目标` 标签芯片及移除按钮，以及 `@` 内点击 `在项目中使用 · 选择绑定项目` 联动打开项目选择浮层；验收后已关闭临时 Web 服务释放 `5173` 端口。
