# LFAA Agent 默认模型

`lfaa-agent-default-model` 是随基础 Bundle 装载的必需插件。它从设置中心读取活动/显式指定账户的非秘密元数据，并通过 `lfaa-credentials` 按当前账户 ID 读取密钥；没有配置的引用会明确返回未配置，不回退到其他账户。

账户状态、Provider 能力和 AES-GCM 密文仍唯一归属 `packages/settings/settings`。本包不缓存账户或密钥，也不增加设置项。凭据来源卸载后模型解析不可用；具体调用仍只发生在控制端 Agent Run 内，密钥不会进入浏览器、会话消息或日志。
