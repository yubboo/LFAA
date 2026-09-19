# AI Settings Domain

AI 服务配置业务的唯一父域。

```text
core/
→ Account / Auth / Model / SecretRef / Provider Registry 的稳定配置领域

providers/
→ 每家厂商独立配置插件

transports/
→ 只有多个 Provider 确实共享的配置期传输能力才允许建立
```

本目录禁止 React / DOM / App 宿主代码。模型推理 Runtime 不属于本目录。

## Web-first 当前实现

`core/AiAccountService` 已通过 Host Ports 完成 API Key / Token Plan 与宿主管理 Subscription 的统一账户闭环。普通 API Key / Token Plan 只保存 `credentialRef` 并继续通过 Rust Secret Broker；OpenAI ChatGPT 套餐通过通用 `AiManagedAuthPort` 接入 Codex App Server，账户使用 `credentialRef = null`，Config System 不读取或保存 ChatGPT Token。
