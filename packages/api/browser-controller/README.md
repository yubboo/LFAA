# `lfaa-api-browser-controller`

本机 Browser Owner 的认证 HTTP 适配器。所有路由先通过现有 Authentication Owner，Host 使用当前账户 ID 与 AI Session ID 从内存会话表取出隔离 BrowserContext；设置 Owner 的 `browserUse.enabledProviderIds` 限制已接入提供方，Tabbit 还须满足 `computerControl.enabled`。Agent 是否能发现 Browser Tools 由 `browserUse.enabled` 控制；用户在 Dock 手动操作不受该 Agent 开关限制。不接受客户端绝对路径、Cookie、Browser CDP 地址或任意脚本。导航、视口和浏览器动作参数由 Joi 校验；动作合同限于坐标点击、记录路径不超过 128 点/15 秒的手动拖动、最多 2000 字符的用户输入、常用键盘按键与 1–600px 滚动。`includeScreenshot=false` 只省略高成本截图，Client 在动作队列空闲后重新读取同一页面图像；认证路由复用 API Remote 的进程内 IP 窗口，每分钟最多 600 次动作请求。

页面数据只在当前 Agent Run 与浏览器工作区响应中短暂返回；Agent Loop 过滤会话落盘。远程 Web Host 不装配本机浏览器 Controller。构建输出为仓库根 `dist/packages/api/browser-controller/`。
