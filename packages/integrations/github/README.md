# GitHub 账户连接

`lfaa-github-integration` 持有 GitHub App Device Flow、用户授权令牌更新/撤销及只读仓库、Issue、Pull Request API 适配。它不拥有 GitHub 应用注册；控制端通过 `LFAA_GITHUB_APP_CLIENT_ID` 配置公开 Client ID，可选 `LFAA_GITHUB_APP_CLIENT_SECRET` 仅留在服务端，用于主动断开时撤销远端授权。

凭据使用 `lfaa-credentials` 中 `lfaa-github-integration/github` 的账户记录；Settings Owner 继续以 AES-256-GCM 加密持久化。本包不在客户端、日志或 API 响应暴露 access/refresh token。连接账户独立隔离，OAuth Device Flow 临时代码只存进程内，最长 15 分钟、每账户单飞并在卸载时清理。

GitHub App 必须启用 Device Flow，并将 Repository permissions 的 Metadata、Issues、Pull requests 设为 Read-only。API 仅列出当前授权用户可访问的仓库及其 Issues/PR，不写仓库或创建/修改/评论。无 Client ID 时接口返回真实未配置状态。没有客户端 secret 时可清除本地密文，但远端撤销需用户到 GitHub 的 Authorized GitHub Apps 页面操作。

工作端 API 由 `lfaa-api-github-connection-controller` 认证并适配。服务和客户端列表按需读取、支持中止，无周期轮询；浏览器仅在用户启动授权时按 GitHub 指定间隔轮询设备授权状态。构建输出只写仓库根 `dist/packages/integrations/github/`。
