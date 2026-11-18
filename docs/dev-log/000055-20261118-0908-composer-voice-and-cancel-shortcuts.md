# Dev Log 000055 — 输入栏右下角语音输入（Ctrl+M）与运行取消（Ctrl+D）快捷交互

- **时间**：2026-11-18 09:08:19 +08:00
- **任务编号**：000055
- **任务目标**：对照 3 张参考图在聊天输入栏右下角实现语音输入按钮（含 `语音输入 Ctrl+M` / 录音中红底三竖条动画波形 + `停止录音 Ctrl+M` 提示与全局快捷键）以及运行中取消按钮（含红方框停止图标与 `取消 (Ctrl+D)` 提示及全局快捷键），同时为 `+` 悬浮提示补全 `role="tooltip"`。

## 变更文件清单

- `e:\lfaa\packages\core\chat\client\components\ComposerRightActions.tsx`（207 行，新建）与 `ComposerRightActions.module.css`（142 行，新建）：
  - 导出纯函数 `mergeDictationTranscript`（合并既有草稿与实时语音识别片段）。
  - 接入浏览器 `SpeechRecognition` / `webkitSpeechRecognition`（不支持或权限/网络受限时停止并提示真实原因，不伪造识别结果）；支持点击麦克风按钮或按 `Ctrl+M` 切换录音态（红底 + 脉冲动画三竖条波形 + `停止录音 Ctrl+M`）。
  - 在 `isRunning` 期间渲染红色停止按钮与 `取消 (Ctrl+D)` tooltip，并监听 `Ctrl+D` 触发 `onStop`。
- `e:\lfaa\packages\core\chat\client\components\ComposerAddMenu.tsx`：将 `+` 按钮悬浮提示改为 `role="tooltip"`。
- `e:\lfaa\packages\core\chat\client\components\ChatWorkspace.tsx`（360 行，未超 400 行上限）与 `ChatWorkspace.module.css`（271 行）：挂载 `ComposerRightActions`，放开有附件芯片时也可发送（`canSend = Boolean(draft.trim() || attachments.length > 0)`），移除已拆出的重复按钮样式。
- `e:\lfaa\packages\core\chat\client\locales.ts`：补充语音输入、停止录音、取消（`Ctrl+D`）及语音错误中英文词条。
- `e:\lfaa\packages\core\chat\tests\chat-lifecycle.test.ts`：补充 `mergeDictationTranscript` 单元测试。

## 验证结果

1. **单元测试**：`pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` — **31/31 通过**。
2. **类型检查与构建**：`pnpm run typecheck`（12 个工程）与 `pnpm run build`（Vite 构建 `built in 714ms`）均以退出码 `0` 通过。
3. **内置浏览器实测验收（`http://127.0.0.1:5173/`，`1440×900`）**：
   - 控制台报错 `0`，网络报错 `0`。
   - 实测验证 `+` 提示 `role="tooltip"`、麦克风悬停提示 `语音输入 Ctrl+M`、点击麦克风及按 `Ctrl+M` 触发录音红底波形态并更新提示为 `停止录音 Ctrl+M`（受限于本地测试容器无语音后台连通性，触发 `network` 错误后正常回退并展示 `语音输入不可用：network`）、以及发送按钮随输入内容禁用/启用。
   - **限制说明**：因本机当前默认模型尚未配置 API Key，发送后立即返回配置提示而未停留在 `isRunning` 运行态，故本次内置浏览器未能抓拍运行中点击 `取消 (Ctrl+D)` 的状态；验收后已关闭临时 Web 服务释放 `5173` 端口。
