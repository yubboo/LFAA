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

`core/AiAccountService` 已通过 Host Ports 完成 API Key / Token Plan 账户闭环。Windows Web 开发宿主使用 Credential Manager；普通账户状态只保存 `credentialRef`。OpenAI ChatGPT 套餐登录仍由后续 Codex App Server Adapter 接入，不在 API Key 流程中伪装完成。
