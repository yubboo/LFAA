# 000077 Dev Log — 按品牌过滤协议选项、防重复刷新与输入栏实时联动

- **时间**：2026-11-18 13:17:49 +08:00
- **任务编号**：000077

## 1. 变更文件清单

- `M` `e:\lfaa\packages\core\chat\client\provider-catalog.ts`
  - 为 `ModelProviderPreset` 增加 `supportedProtocols` 声明（例如 DeepSeek 仅展示 `openai-chat`、`openai-responses`、`anthropic-messages` 三种真实协议，不混入 Gemini；OpenAI/Claude/Gemini 各自展示自身支持的协议；其余标准 OpenAI 兼容服务商展示单协议；`custom` 保留四协议全集）；
  - 在 `LLM_API_PROTOCOL_OPTIONS` 增加 `shortLabel` 与 `getProtocolShortLabel` 导出。
- `M` `e:\lfaa\packages\core\chat\client\components\ModelProviderModal.tsx`
  - 使用 `provider.supportedProtocols` 过滤弹窗内的「API 协议格式」按钮列表；
  - 新增 `initKeyRef` 记录当前已初始化弹窗标识，仅在弹窗首次打开或切换提供商时初始化表单和触发官方模型预拉取，防止点击「保存」或「测试连接」后因 `profile` 引用更新导致表单/状态被重复重置或触发多余网络请求。
- `M` `e:\lfaa\packages\core\chat\client\components\ModelReasoningPicker.tsx`
  - 在首页底部输入栏右下角模型选择浮窗顶部（当前品牌名称旁）实时展示当前激活的协议短标签（如 `Chat Completions`、`Responses API`、`Anthropic`、`Gemini Native`），与设置中心修改保持实时联动一致。
- `M` `e:\lfaa\packages\core\chat\client\components\ModelReasoningPicker.module.css`
  - 新增 `.modelHeaderMeta` 与 `.protocolTag` 样式。

## 2. 验证结果

- **全量单元测试**：`pnpm exec tsx --test @testFiles` -> **46/46 通过**（0 失败，0 跳过，`duration_ms 4267.8638`）。
- **TypeScript 类型检查**：`pnpm run typecheck`（13 个 tsconfig 工程） -> **通过（exit 0）**。
- **Web 生产构建**：`pnpm --filter @lfaa/app-web run build` (`vite build`) -> **通过**。
- **内置浏览器实测验收（1440×900，`http://127.0.0.1:5173/`）**：
  - 打开 `DeepSeek 模型配置` 弹窗：顶部无独立通知横幅；`API 协议格式` 仅单行展示 `OpenAI Chat Completions`、`OpenAI Responses API`、`Anthropic Messages`（无 Gemini）；
  - 切换至 `Anthropic Messages` 后 `Base URL` 自动切换为 `https://api.deepseek.com/anthropic`，点击 `获取官方模型` 原地变更为 `已同步 · 2 个官方模型`，点击 `测试连接` 原地变绿 `连接成功 · OK`；
  - 点击 `保存` 返回首页后打开输入栏模型浮窗，顶部 `DeepSeek Chat` 旁实时同步为 `Anthropic`；切回 `OpenAI Chat Completions` 并保存后，输入栏浮窗同步切回 `Chat Completions`；
  - 控制台错误 `0`，失败网络请求 `0`（50/50 请求全部成功）。

## 3. 风险与说明

- 常驻 Web 服务 `pnpm lfaa web`（`task-2180`）仍在 `http://127.0.0.1:5173/` 运行；未执行 `git commit` 或 `git push`。
