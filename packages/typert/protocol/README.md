# Typert 协议

`lfaa-typert-protocol` 定义 Remote 方法、插件贡献、调用上下文、稳定错误码和 JSON 边界规则。它是协议库，不持有路由、认证、授权或业务数据。

Host 适配器必须从真实认证会话创建调用上下文，并在调用业务 Owner 前执行该 Owner 要求的授权；注册定义还必须提供逐方法 `authorize`。协议注册成功不代表某个方法已对网络开放。

当前实现覆盖一元请求/响应和生命周期类型；输入与输出除节点数、深度、键数及单字段长度外，还限制组合后的 JSON 到 4 MiB。Web Profile 的 `auth/me` 已由 API Gateway、账户插件与 Client Connection 真实消费。TypeScript 自动分析、流式 Remote、生成 Host/Client 工件、其余 REST/Socket API 迁移仍未接入，不得标为 Typert 能力已完成。
