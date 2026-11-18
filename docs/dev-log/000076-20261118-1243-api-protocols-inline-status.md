# 000076 Dev Log — 四大 API 协议格式与模型弹窗原地状态按钮

- **时间**：2026-11-18 12:43:21 +08:00
- **任务编号**：000076
- **状态**：代码、单测、类型检查、构建已通过；**内置浏览器验收未完成**（browser 子代理返回 `RESOURCE_EXHAUSTED (429)` 配额耗尽）。

## 1. 变更文件清单

- `A` `e:\lfaa\packages\core\llm\src\protocol-utils.ts`：`LlmApiProtocol` 校验 `asApiProtocol`、协议推断 `resolveEffectiveProtocol`、`normalizeHttpBaseUrl`、`isDeepSeekEndpoint`、SSE 解析 `iterateSseJsonPayloads`。
- `A` `e:\lfaa\packages\core\llm\src\responses-adapter.ts`：OpenAI Responses API（`/responses`，`instructions`/`input`/`function_call(_output)`/`reasoning.effort`，支持 SSE 与 JSON）。
- `A` `e:\lfaa\packages\core\llm\src\anthropic-adapter.ts`：Anthropic Messages（`/v1/messages`，`x-api-key` + `anthropic-version`，thinking / tool_use / tool_result）。
- `A` `e:\lfaa\packages\core\llm\src\gemini-adapter.ts`：Gemini 原生 `streamGenerateContent?alt=sse`（`x-goog-api-key`、`systemInstruction`、`functionDeclarations`、`thinkingConfig`）。
- `M` `e:\lfaa\packages\core\llm\src\types.ts`：新增 `LlmApiProtocol`，`LlmProfile` / `PublicLlmProfile` / `SaveLlmProfileInput` 增加 `apiProtocol`。
- `M` `e:\lfaa\packages\core\llm\src\index.ts`：`dispatchByProtocol` 按协议分发适配器；持久化与读取 `apiProtocol`；`listRemoteModels` 透传协议。
- `M` `e:\lfaa\packages\core\llm\src\capabilities.ts`：`fetchOfficialModels` 按协议选择模型列表端点与鉴权头（Gemini `x-goog-api-key`、Anthropic 回退 DeepSeek `/v1/models`），兼容 `models/` 前缀与 `displayName`。
- `M` `e:\lfaa\packages\core\llm\src\http-handler.ts`：`/api/llm/profiles`、`/api/llm/models` 接收 `apiProtocol`。
- `M` `e:\lfaa\packages\core\chat\client\chat-types.ts`、`chat-store.ts`：新增 `LlmApiProtocolOption` 并透传。
- `M` `e:\lfaa\packages\core\chat\client\provider-catalog.ts`：`LLM_API_PROTOCOL_OPTIONS`、各品牌 `defaultProtocol` / `protocolBaseUrls`（DeepSeek：Chat/Responses `https://api.deepseek.com/v1`，Anthropic `https://api.deepseek.com/anthropic`）、`inferProtocolForPreset`、`resolveNextBaseUrlForProtocol`。
- `M` `e:\lfaa\packages\core\chat\client\components\ModelProviderModal.tsx`：原「协议类型」三选一改为「API 协议格式」四选一并联动 Base URL；移除顶部 `StatusBanner`，同步 / 测试 / 保存状态改为在「获取官方模型」按钮原地显示（`同步中…` → `已同步 · N 个官方模型`；`连接测试中…` → `连接成功 · OK`；失败显示红色并在模型输入框下给出错误详情），成功态 4 秒自动复位。
- `M` `e:\lfaa\packages\core\chat\client\components\ModelProviderGrid.module.css`：原地状态按钮成功/失败/加载样式与 `errorHint`。
- `M` `e:\lfaa\packages\core\llm\tests\llm-service.test.ts`：新增四协议分发单测。

## 2. 验证结果

- 实测 DeepSeek 真实接口：`POST https://api.deepseek.com/v1/responses` → 200；`POST https://api.deepseek.com/anthropic/v1/messages` → 200（返回 thinking + text）。
- 全量单测：**46/46 通过**（0 失败，`duration_ms 2656.3718`）。
- `pnpm run typecheck`：通过（随后构建已执行）。
- `pnpm --filter @lfaa/app-web run build`：通过（`✓ built in 474ms`）。
- **内置浏览器验收：未执行**（子代理配额 429，提示约 28 分钟后重置）。

## 3. 风险与说明

- Gemini 原生协议与 OpenAI 官方 Responses 仅有 mock 单测，未用真实 Key 实测。
- `pnpm lfaa web`（`task-2146`）运行于 `http://127.0.0.1:5173/`；未执行 git commit/push。
