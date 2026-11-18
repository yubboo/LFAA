# 000085-20261118-1440-unified-confirm-dialog

- 时间：2026-11-18 14:40:00 +08:00
- 任务：抽离共享 `ConfirmDialog` 二次确认弹窗组件，统一「永久删除会话」与「移除项目」确认框视觉与交互

## 变更文件

- `A` [ConfirmDialog.tsx](file:///e:/lfaa/packages/ui/primitives/client/ConfirmDialog.tsx)
  - 新增共享 `ConfirmDialog` 组件（`role="alertdialog"`、无标题分割线、圆角关闭按钮、液态玻璃卡片、柔和暗红确认按钮）。
- `A` [ConfirmDialog.module.css](file:///e:/lfaa/packages/ui/primitives/client/ConfirmDialog.module.css)
  - 统一样式抽离至 `@lfaa/ui-primitives/client`。
- `M` [index.tsx](file:///e:/lfaa/packages/ui/primitives/client/index.tsx)
  - 导出 `ConfirmDialog` 与 `ConfirmDialogProps`。
- `M` [RemoveProjectDialog.tsx](file:///e:/lfaa/packages/workspace/workspace/client/components/RemoveProjectDialog.tsx)
  - 改为复用 `@lfaa/ui-primitives/client` 的 `ConfirmDialog`。
- `D` `packages/workspace/workspace/client/components/RemoveProjectDialog.module.css`
  - 删除被 `ConfirmDialog.module.css` 替代的重复样式文件。
- `M` [package.json](file:///e:/lfaa/packages/workspace/workspace/package.json)
  - 为 `@lfaa/workspace` 添加 `"@lfaa/ui-primitives": "workspace:*"` 依赖。
- `M` [SessionOverlays.tsx](file:///e:/lfaa/packages/core/chat/client/components/SessionOverlays.tsx)
  - 将「永久删除会话」确认弹窗由 `ModalDialog` 切换为复用 `@lfaa/ui-primitives/client` 的 `ConfirmDialog`，使其与「移除项目」弹窗保持完全一致的视觉与交互体验。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`550ms`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`，已重启 `pnpm lfaa web` 刷新工作区依赖）：
  - 「永久删除会话」弹窗与「移除项目」弹窗均使用完全一致的 `ConfirmDialog`（`role="alertdialog"`、无标题分割线、圆角 `×` 按钮、浅灰说明文字、柔和暗红填充警示按钮）。
  - 控制台错误 `0` 条，网络请求失败 `0` 个（`50/50` 成功）。
