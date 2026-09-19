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
