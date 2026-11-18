# 000087-20261118-1448-hide-scope-bar-in-active-chat

- 时间：2026-11-18 14:48:00 +08:00
- 任务：进入聊天后（`messages.length > 0`）自动隐藏输入框上方的 `ComposerScopeBar`（此计算机 / 选择项目）

## 变更文件

- `M` [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx)
  - 仅在 `messages.length === 0`（新建空白会话状态）时渲染 `ComposerScopeBar`；进入聊天产生消息后自动隐藏，保持底部输入框紧凑简洁。

## 验证结果

- `pnpm run typecheck`：13 个 tsconfig 全部通过（exit 0）。
- `pnpm --filter @lfaa/app-web run build`（`vite build`）：构建通过（`1.38s`）。
- 内置浏览器实测验收（`http://127.0.0.1:5173/`）：
  - 点击 `新聊天`（空会话态）：`此计算机` 与 `选择项目` 正常显示在输入框上方。
  - 点击已有会话 `项目内测试新会话`（含消息）：输入框上方不再渲染 `此计算机` 与 `选择项目`（DOM 数量均为 `0`）。
  - 控制台报错 `0` 条，网络请求失败 `0` 个（`50/50` 成功），实测截图：[final_step_6.png](file:///C:/Users/Administrator/.gemini/antigravity/brain/6802e411-f569-44da-8e24-b1a6955c35fb/browser_evidence/17f80783-ede3-44cd-a623-3ad9f3c17252/final_step_6.png)。
