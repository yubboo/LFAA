# `lfaa-api-browser-controller`

本机 Browser Owner 的认证 HTTP 适配器。所有路由先通过现有 Authentication Owner，Host 使用当前账户 ID 与 AI Session ID 从内存会话表取出隔离 BrowserContext；设置 Owner 的 `browserUse.enabledProviderIds` 限制已接入提供方，Tabbit 还须满足 `computerControl.enabled`。Agent 是否能发现 Browser Tools 由 `browserUse.enabled` 控制；用户在 Dock 手动预览不受该 Agent 开关限制。不接受客户端绝对路径、Cookie、Browser CDP 地址或任意脚本。导航参数由 Joi 校验，速率限制沿用 API Remote Owner。

页面数据只在当前 Agent Run 与预览台响应中短暂返回；Agent Loop 过滤会话落盘。远程 Web Host 不装配本机浏览器 Controller。构建输出为仓库根 `dist/packages/api/browser-controller/`。
