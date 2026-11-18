# Dev Log 000057 — 修复语音输入 `network` 报错，实现本机离线 WAV 录音识别降级与提示条可关闭优化

- **编号**：000057
- **时间**：2026-11-18 09:27:47 +08:00
- **任务名**：`offline-voice-dictation-fallback`
- **状态**：已完成修复、单元测试、类型检查、构建与内置浏览器实测验收

---

## 1. 问题根因

在用户反馈截图中，点击输入栏右下角「语音输入（`Ctrl+M`）」按钮后立即弹出 `语音输入不可用: network`：

1. Chromium 内置 `SpeechRecognition` / `webkitSpeechRecognition` 强依赖 Google 云端语音服务；在国内网络或离线/本地环境中会立即触发 `onerror("network")`，导致语音输入彻底不可用。
2. 原输入区提示文案 `.contextNotice` 为无边距纯文本，缺少直观卡片样式与手动关闭按钮。

---

## 2. 实际变更清单

### 2.1 `packages/core/chat`（Host 离线转写、Client WAV 录音与降级交互）

- 新增 [speech-service.ts](file:///e:/lfaa/packages/core/chat/src/speech-service.ts)（158 行）：实现 `assertValidWavBuffer`（44 字节 RIFF/WAVE 头与 15 MB 上限校验）与 `transcribeWavAudio`（在 Windows 通过 PowerShell + `System.Speech.Recognition.SpeechRecognitionEngine` + `DictationGrammar` + `RecognizeAsync(Multiple)` 离线识别 WAV 录音，零外网请求）。
- 修改 [index.ts](file:///e:/lfaa/packages/core/chat/src/index.ts)：为 `ChatService` 增加 `transcribeAudio` 方法并导出 `assertValidWavBuffer`、`transcribeWavAudio`。
- 修改 [http-handler.ts](file:///e:/lfaa/packages/core/chat/src/http-handler.ts)：新增 `POST /api/chat/transcribe` 接口（支持最大 21 MB JSON 请求体并校验 `audioBase64` / WAV 头）返回 `{ text, engine }`。
- 新增 [local-speech.ts](file:///e:/lfaa/packages/core/chat/client/local-speech.ts)（183 行）：实现 `downsampleTo16kPcm`（16kHz 单声道 Int16 重采样）、`encodePcm16ToWav`、`uint8ArrayToBase64`、`startLocalMicrophoneWavRecorder`（基于 `AudioContext` + 零增益节点防止回声）与 `formatSpeechErrorMessage`（统一本地化权限/设备/忙线等友好提示）。
- 新增 [useVoiceDictation.ts](file:///e:/lfaa/packages/core/chat/client/useVoiceDictation.ts)（263 行）：封装语音听写 Hook；当 `SpeechRecognition` 缺失或触发 `"network"` / `"service-not-allowed"` 时，记录 `sessionStorage` 偏好并自动无感切换至本机 WAV 录音 + `/api/chat/transcribe` 离线识别，不再暴露原始 `network` 错误。
- 修改 [ComposerRightActions.tsx](file:///e:/lfaa/packages/core/chat/client/components/ComposerRightActions.tsx)（106 行）与 [ComposerRightActions.module.css](file:///e:/lfaa/packages/core/chat/client/components/ComposerRightActions.module.css)：接入 `useVoiceDictation`，补充识别中禁用态样式（`.micBtn:disabled`）与状态 Tooltip。
- 修改 [ChatWorkspace.tsx](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.tsx) 与 [ChatWorkspace.module.css](file:///e:/lfaa/packages/core/chat/client/components/ChatWorkspace.module.css)：将 `.contextNotice` 升级为带边框背景与 `关闭提示`（`IconX`）按钮的内联状态条。
- 修改 [locales.ts](file:///e:/lfaa/packages/core/chat/client/locales.ts)：补充中英文离线录音、识别中、无语音、权限不足、无麦克风、设备忙与关闭提示词条。
- 修改 [chat-lifecycle.test.ts](file:///e:/lfaa/packages/core/chat/tests/chat-lifecycle.test.ts)：新增 `本地 16kHz WAV 编码、错误映射与 /api/chat/transcribe 离线语音识别` 单元测试（含 Windows SAPI 合成音频实时离线转写验证）。

---

## 3. 验证记录

| 检查项 | 命令 / 方式 | 结果 |
| --- | --- | --- |
| 全部单元测试 | `pnpm exec tsx --test packages/core/*/tests/*.ts packages/ui/*/tests/*.ts packages/workspace/*/tests/*.ts` | **33/33 通过**（`duration_ms 1343.1491`） |
| TypeScript 类型检查 | `pnpm run typecheck`（12 个 tsconfig） | **exit code 0** |
| Web 生产构建 | `pnpm run build`（`vite build`） | **exit code 0**（`✓ built in 434ms`） |
| 内置浏览器实测验收 | `browser` 子代理实测 `http://127.0.0.1:5173/`（`1440x900`） | **通过**（控制台 error = 0，网络失败 = 0） |

内置浏览器实测细节：
1. 悬停右下角麦克风按钮正常显示 `语音输入 Ctrl+M`。
2. 点击「语音输入」后未再出现 `语音输入不可用: network`，自动进入本机离线录音并展示内联状态条：`正在本地录音（离线识别），再次点击麦克风或按 Ctrl+M 停止并识别...`。
3. 点击状态条右侧 `关闭提示`（`×`）按钮可立即关闭提示条；再次点击「停止录音」完成 `POST http://127.0.0.1:5173/api/chat/transcribe`（HTTP `200 OK`，`application/json`）并返回识别文本插入草稿后恢复待机态。
4. 验收完成后已清空输入框并终止后台 `pnpm lfaa web`（`task-656`）释放 `5173` 端口；未执行 `git commit` / `git push`。
