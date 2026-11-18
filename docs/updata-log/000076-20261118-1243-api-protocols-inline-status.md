# 000076 更新日志 — 四大 API 协议格式与弹窗原地状态

- **时间**：2026-11-18 12:43:21 +08:00
- **任务编号**：000076

1. 模型配置弹窗的「协议类型」改为真正的 **API 协议格式**：`OpenAI Chat Completions`、`OpenAI Responses API`、`Anthropic Messages`、`Gemini Native generateContent`，切换时自动联动对应 Base URL（如 DeepSeek Anthropic 格式切到 `https://api.deepseek.com/anthropic`），后端按所选协议真实发起请求。
2. 去掉弹窗顶部通知横幅：「获取官方模型」按钮原地显示状态——同步中 / 已同步、连接测试中 / 连接成功 · OK，失败变红并在下方显示错误原因。
