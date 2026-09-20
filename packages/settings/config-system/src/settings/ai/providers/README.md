# AI Provider 配置插件

本目录是 `config-system/settings/ai` 下所有厂商配置插件的唯一归属。

## 当前内置

- `openai/`：OpenAI API Key + ChatGPT/Codex 套餐认证描述。
- `deepseek/`：DeepSeek API Key、官方 Base URL、模型列表。
- `zhipu/`：智谱标准 API / Coding API；不伪造未确认的统一模型列表端点。
- `kimi/`：Kimi/Moonshot 中国与国际开放平台入口。
- `qwen/`：阿里云百炼区域、Workspace 与模型目录规则。
- `xiaomi/`：Xiaomi MiMo 按量 API 与 Token Plan。

## 硬规则

1. 新增 Provider = 新增 `providers/<provider>/plugin.ts` + 注册；禁止在 Core 写 `if provider === ...`。
2. Provider 只描述配置、认证、模型发现和协议能力；模型推理 Runtime 仍属于模型运行域。
3. Secret 明文不进入插件静态配置、普通 Config、日志或 UI 状态。
4. 厂商 API URL 只能出现在对应 Provider 插件或共享 transport，不得写进 UI / App。
5. 兼容 OpenAI 协议只意味着 transport 可复用，不意味着多个 Provider 合并成一个插件。
