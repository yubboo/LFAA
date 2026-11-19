# UPDATA-000134｜全品牌与套餐多协议支持、本地部署修复及输入栏同步全覆盖

- **多协议支持**：火山方舟（含 Agent Plan / Coding Plan）、通义千问（含 Token / Coding Plan）、智谱（含 GLM Coding Plan）、MiniMax（含 M Plan）、硅基流动、OpenRouter、xAI Grok 与本地部署均支持按官方端点切换协议格式（OpenAI Chat / Responses / Anthropic Messages）。
- **本地部署优化**：新增 Ollama (11434)、LM Studio (1234)、vLLM (8000)、llama.cpp (8080) 快捷预设，支持免 Key 调用 Anthropic Messages 协议，修复未启动本地服务时直接抛出裸 `fetch failed` 与误显示占位模型标签的问题。
- **输入栏同步全覆盖**：聊天输入栏模型选择浮窗现对所有已配置模型（普通 API、官方套餐、本地部署）开放「同步官方 / 同步本地」按钮。
