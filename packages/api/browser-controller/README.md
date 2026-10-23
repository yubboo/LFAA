# `lfaa-api-browser-controller`

本机 Browser Owner 的认证 HTTP 适配器。所有路由先通过现有 Authentication Owner，Host 使用当前账户 ID 与 AI Session ID 从内存会话表取出隔离 BrowserContext。`/browser/dock/*` 是用户在 LFAA 浏览器工作区手动导航和操作的专用接口，只开放本机隔离 Edge/Chrome，不要求修改 Agent 设置；其中 `/browser/dock/prewarm` 只在真实可用性核验后预启动本机浏览器进程，不创建网页或 BrowserContext。`/browser/sessions/*` 是 Agent/既有受控调用接口，检查 Settings Owner 的 `browserUse.enabled` 主开关。LFAA 内置 Provider 随 Host 自动可用，不检查内置 Provider 连接列表；Tabbit 个人浏览器仍要求用户明确连接并满足 `computerControl.enabled`。Agent 是否能发现 Browser Tools 同样由 `browserUse.enabled` 控制。两类接口委派同一个 Browser Owner 与账户/Session/provider 会话键，不生成第二份页面状态。不接受客户端绝对路径、Cookie、Browser CDP 地址或任意脚本。导航、视口和浏览器动作参数由 Joi 校验；动作合同限于坐标点击、记录路径不超过 128 点/15 秒的手动拖动、最多 2000 字符的用户输入、常用键盘按键与 1–600px 滚动。`includeScreenshot=false` 只省略高成本画面读取，Client 在动作队列空闲后重新读取同一页面；认证路由复用 API Remote 的进程内 IP 窗口，每分钟最多 600 次动作请求。

`/browser/recent-sites` 的 GET/POST/DELETE 只使用认证账户 ID 调用 Browser Owner；Joi 限制网址数量和长度，Owner 再规范化为 HTTP(S) 来源与路径、剥除查询和片段、检查记录开关并执行账户条数上限。此独立路由服务 LFAA Browser Dock 手动访问，因此不要求 `browserUse.enabled` 或 Agent Provider 连接开关；它不能读取系统个人浏览器历史或页面正文。

页面数据只在当前 Agent Run 与浏览器工作区响应中短暂返回；Agent Loop 过滤会话落盘。远程 Web Host 不装配本机浏览器 Controller。构建输出为仓库根 `dist/packages/api/browser-controller/`。
