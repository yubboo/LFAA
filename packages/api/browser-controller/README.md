# `lfaa-api-browser-controller`

本机 Browser Owner 的认证 HTTP 适配器。所有路由先通过现有 Authentication Owner，Host 使用当前账户 ID 与内置浏览器工作区 ID 从内存会话表取出隔离 BrowserContext。`/browser/dock/*` 是用户在 LFAA 浏览器工作区手动导航和操作的专用接口，只开放本机隔离 Edge/Chrome，不要求修改 Agent 设置；用户提交地址时才为该账户/内置工作区 启动无窗口隔离 Chromium 上下文，不提前启动空白浏览器窗口。`/browser/sessions/*` 是 Agent/既有受控调用接口，检查 Settings Owner 的 `browserUse.enabled` 主开关。LFAA 内置 Provider 随 Host 自动可用，不检查内置 Provider 连接列表；Tabbit 个人浏览器仍要求用户明确连接并满足 `computerControl.enabled`。Agent 是否能发现 Browser Tools 同样由 `browserUse.enabled` 控制。两类接口委派同一个 Browser Owner 与账户/内置工作区/provider 会话键，不生成第二份页面状态。不接受客户端绝对路径、Cookie、Browser CDP 地址或任意脚本。导航、视口和浏览器动作参数由 Joi 校验；动作合同限于坐标点击、记录路径不超过 128 点/15 秒的手动拖动、最多 2000 字符的用户输入、常用键盘按键与 1–600px 滚动。`includeScreenshot=false` 只省略高成本画面读取，Client 在动作队列空闲后重新读取同一页面；认证路由复用 API Remote 的进程内 IP 窗口，每分钟最多 600 次动作请求。

`/browser/recent-sites` 的 GET/POST/DELETE 只使用认证账户 ID 调用 Browser Owner；Joi 限制网址数量和长度，Owner 再规范化为 HTTP(S) 来源与路径、剥除查询和片段、检查记录开关并执行账户条数上限。此独立路由服务 LFAA Browser Dock 手动访问，因此不要求 `browserUse.enabled` 或 Agent Provider 连接开关；它不能读取系统个人浏览器历史或页面正文。

`DELETE /browser/recent-sites/item` 使用相同认证和写入速率限制，仅删除请求 URL 规范化后的当前账户单条记录；`DELETE /browser/recent-sites` 仍清除当前账户全部记录。用户在设置中心管理自己的历史，不读取其他账户数据。

`/browser/credentials` 只返回 Browser Vault 的条目元数据；密码和联系信息写入/删除仍绑定认证账户并委派 Browser Owner 与 Credentials Owner，密文载荷不经普通设置或列表 API 返回。`/browser/credentials/*/autofill` 只允许已登记的 LFAA 内置 Provider，Browser Owner 会重新校验记录归属、当前页面来源和可唯一匹配的输入字段，不提交表单。`DELETE /browser/data` 清理当前账户的 Browser Owner 页面 Cookie、权限、缓存、站点数据和最近网站记录；Electron 原生 Session 的浏览数据与下载历史另由受信 Desktop IPC 清理。

页面数据只在当前 Agent Run 与浏览器工作区响应中短暂返回；Agent Loop 过滤会话落盘。远程 Web Host 不装配本机浏览器 Controller。构建输出为仓库根 `dist/packages/api/browser-controller/`。

2026-10-23：`/browser/providers` 在认证账户范围内标记 `activeInWorkspace`，便于 Agent 选择用户已经打开的内置 Provider。空白 Dock 的 `/wait` 长连接可等待同一账户内置 Page 创建，断开时取消监听；手动浏览仍不要求启用 Agent 浏览器开关。
