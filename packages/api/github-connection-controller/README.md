# GitHub 连接 API

本控制器只提供 GitHub OAuth Device Flow 和只读资源 API 的认证路由；OAuth/REST 规则、账户凭据和令牌更新由 `packages/integrations/github` 持有，密文由 Settings Owner 持有。所有路由按当前已认证用户 ID 操作，不接收/返回 bearer 或 refresh token。

Device Flow 只把短期用户验证码和 GitHub 验证网址返回浏览器；device code 保存在 GitHub Integration 服务的有界内存中并绑定账户。授权状态使用 GitHub 返回的轮询间隔，不会并发轮询。断开只删除当前账户授权；只有配置 GitHub App Client Secret 时才可同时向 GitHub 请求撤销，响应明确报告远端撤销是否确认。

仓库/Issue/Pull Request 路由仅 GET，列表最多 100 项并按需读取，支持响应断开后取消 GitHub 请求。接口错误只返回稳定错误码与安全说明，不透传 GitHub 错误正文或凭据。构建只写根 `dist/packages/api/github-connection-controller/`。
