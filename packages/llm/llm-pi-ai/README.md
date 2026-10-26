# 火山方舟 Provider

`src/ark.ts` 聚合标准方舟按量 API 的默认模型目录；标准 API、Agent Plan、Coding Plan 的公开地址由 `lfaa-util-values/src/ark-provider.ts` 唯一维护，Settings Owner 按 Provider 类型选择地址。

LFAA AI Work 当前使用 OpenAI Chat Completions 兼容协议。Agent Plan 与 Coding Plan 是不同的用户席位，设置和模型请求按登录用户隔离；套餐模型名由用户从方舟官方使用配置中填写，并在保存前发送真实模型请求验证。这里不实现套餐模型猜测、普通 `/api/v3/models` 回退或套餐用量目录。

本包不保存密钥、不实现 HTTP 请求，也不拥有账户权限。Provider 账户和实际调用仍分别由 Settings Owner 与 `lfaa-llm` 管理。
