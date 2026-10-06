# API Gateway

`lfaa-api-gateway` 将第一方 API 控制器作为 Cordis 路由贡献挂载到现有 Control Plane。贡献随插件 Fiber 注册和撤销；HTTP 承载、会话认证与错误响应继续归现有 Gateway、WebServer 和 Authorization Owner。

## Typert Remote

Gateway 的 `/api/typert/:namespace/:method` 只接受登录会话中的 JSON 一元调用。Gateway 校验路由标识和外层请求结构，把真实账户会话、请求 ID 与客户端断连信号交给 `lfaa-typert-registry`。方法仍须执行自己的 `authorize`、输入解析和输出解析；Gateway 不提供匿名 Remote、业务授权替代或独立 Socket 服务。

当前账户插件的 `auth/me` 是首个接入方法。其余 REST/Socket API、流式 Remote、自动工件发现和类型生成仍在 P0 待办中。
