# @lfaa/llm-openai-compatible

OpenAI-compatible 文本模型 Host Adapter。它负责把 LFAA 已解析的模型绑定、账户连接信息和执行 Hint 转成 `/responses` 或 `/chat/completions` 请求，并只向上返回脱敏后的文本/错误语义。

## 边界

- 属于 `packages/llm/` capability family；不是 Web App 代码。
- 不读取账户文件，不读取 Secret，不拥有 Session，也不发 Runtime Event。
- `agent-controller` 负责 Run 生命周期；本包只负责一次模型调用。
- ChatGPT/Codex 套餐仍由官方 Harness Adapter 承担，不伪装成 API Key Provider。
