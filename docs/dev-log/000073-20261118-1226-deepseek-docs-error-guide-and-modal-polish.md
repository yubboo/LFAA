# 000073 Dev Log — DeepSeek 官方文档对齐、错误码诊断、思考模式工具回传修复与弹窗精简

- **时间**：2026-11-18 12:26:00 +08:00
- **任务编号**：000073

## 1. 变更文件清单

- `M` `e:\lfaa\packages\core\llm\src\capabilities.ts`
  - 新增 DeepSeek 官方 10 类 HTTP 错误码诊断表 `HTTP_ERROR_GUIDE`（`400`、`401`、`402`、`408`、`413`、`422`、`429`、`500`、`503`、`504`）、`extractUpstreamErrorMessage` 与 `formatLlmHttpError(status, rawBody, statusText)`，并在 `fetchOfficialModels` 失败分支接入统一诊断输出。
- `M` `e:\lfaa\packages\core\llm\src\index.ts`
  - 导出 `formatLlmHttpError`。
- `M` `e:\lfaa\packages\core\llm\src\openai-adapter.ts`
  - `buildApiMessages(messages, includeReasoningContent)` 在 DeepSeek Thinking 模式启用时为带 `toolCalls` 的 `assistant` 消息回传 `reasoning_content`；
  - `callOpenAiCompatibleChat` 在 DeepSeek 开启 `reasoning_effort` 时同步附带 `thinking: { type: "enabled" }` 与 `reasoning_effort`，并将 HTTP 非 2xx 报错替换为 `formatLlmHttpError`。
- `M` `e:\lfaa\packages\core\agent\src\agent-loop.ts`
  - 多轮工具循环写入 `conversation` 的 `assistant`（带 `toolCalls`）轮次时完整保留 `reasoningContent`；
  - 在拼装 `contextWindow.recentMessages` 时跳过 `status === "streaming"` 或空内容的 `assistant` 占位消息。
- `M` `e:\lfaa\packages\core\memory\src\session-store.ts`
  - `buildContextMessages` 过滤尚未完成的 `status === "streaming"` 及空内容 `assistant` 占位消息，防止 Agent `startRun` 预先写入的占位记录污染首轮上下文并触发 DeepSeek Thinking 模式的 `400 reasoning_content` 校验错误。
- `M` `e:\lfaa\packages\core\chat\client\components\ModelProviderModal.tsx`
  - 移除 `API Key` 输入框下方冗余的 `当前已保存凭据：...` 提示行（仅保留输入框内 `sk-e****ffa1（留空保持不变）`）；
  - 官方模型快速选择胶囊同时展示官方版本名与真实模型 ID，例如 `DeepSeek-V4.1-Flash (deepseek-flash)` 与 `DeepSeek-V4-Pro (deepseek-v4-pro)`。
- `M` `e:\lfaa\packages\core\llm\tests\llm-service.test.ts`
  - 新增 `formatLlmHttpError 覆盖 DeepSeek 官方 10 类 HTTP 错误码说明` 与 `DeepSeek 思考模式下多轮工具调用必须附带 thinking 与 reasoning_content` 单测。
- `M` `e:\lfaa\packages\core\memory\tests\memory-service.test.ts`
  - 新增 `status === "streaming"` 空 `assistant` 占位消息不进入 `buildContextMessages` 的回归断言。

## 2. 验证结果

- **全量单元测试**：`pnpm exec tsx --test @testFiles` -> **44/44 通过**（0 失败，0 跳过，`duration_ms 2937.8254`）。
- **TypeScript 类型检查**：`pnpm run typecheck`（13 个 tsconfig 工程） -> **通过（exit 0）**。
- **Web 生产构建**：`pnpm --filter @lfaa/app-web run build` (`vite build`) -> **通过（✓ 6706 modules transformed, built in 538ms）**。
- **内置浏览器实测验收（1440×900，`http://127.0.0.1:5173/`）**：
  - `首页 -> 新聊天 -> DeepSeek-V4.1-Flash (deepseek-flash, 高)` 第一轮发送 `请只回复: OK` 正常输出 `OK`（`Agent 循环轨迹 (2)` 全部已完成）；
  - 同会话第二轮发送 `请查看当前工作区顶层有哪几个文件夹，一句话简短回答`，成功触发 Thinking 模式多步工具调用（`list_dir` -> 检查 -> 思考 -> 完成 `Agent 循环轨迹 (5)`），正常回复 10 个文件夹名称，无 `400` 报错；
  - `设置 -> 模型、规则与记忆配置 -> DeepSeek 模型配置` 弹窗内 `API Key` 框无多余底部凭据提示，点击 `获取官方模型`（HTTP `200`）显示 `DeepSeek-V4.1-Flash (deepseek-flash) · 低/高/极高` 与 `DeepSeek-V4-Pro (deepseek-v4-pro) · 低/高/极高`，点击 `测试连接`（HTTP `200`）弹出绿色 `连接成功 · deepseek-flash · OK`；
  - 控制台错误数 `0`，网络请求失败数（>= 400）`0`，最终截图：`final_step_20.png`。

## 3. 风险与说明

- 延续使用 `pnpm lfaa web`（`task-1955`）常驻本地 Web 服务供体验；未执行 `git commit` 或 `git push`；全部日志与报告均只使用脱敏 API Key（`sk-e****ffa1`）。
