# `lfaa-browser-use`

本机 Browser Owner：在受支持的 LFAA Windows/macOS 本机 Profile 中按需启动隔离的系统 Edge/Chrome 会话，提供有界页面观察、截图、导航与语义交互。它不读取系统浏览器 Profile，不继承用户 Cookie；每个 LFAA 账户/会话使用独立 BrowserContext，关闭后销毁内存态页面与上下文。远程 Web Host 不会获得本机浏览器工具。

Tabbit 是单独的个人浏览器适配器，通过当前账户安装目录中的稳定 LocalAgent CLI 创建有界任务；只有用户在浏览器工作区选中 Tabbit，或当前请求明确要求 Tabbit 时才读取标签摘要/连接所选标签。其他个人 Chrome/Edge Profile、Firefox 与其他 AI 浏览器尚无此 Browser Adapter；用户明确要求控制本地浏览器时，仍可使用已登记的通用 Windows CUA 工具，且该画面目前不镜像进本工作区。

模型通过 LFAA `lfaa_tools_list/load` 选择真实登记的 Browser 工具。账户设置 `browserUse.enabled`（默认关闭）控制 Agent 是否可发现这些工具；`browserUse.enabledProviderIds`（默认空）限定已接入提供方。`lfaa_browser_list_providers` 返回当前 Host 的真实可用状态；用户明确要求使用内置隔离 Edge/Chrome 时，`lfaa_browser_set_provider_connection` 通过同一 Settings Owner 更新该偏好，断开时关闭相关隔离会话。隔离 Edge/Chrome 不要求开启电脑操控；Tabbit 个人会话仍须用户明确选择、接入并启用既有 `computerControl.enabled`。所有 Agent 动作仍走唯一 Permission Owner 与 `permissions.mode`，不在浏览器包建立第二套审批。

Agent Browser Tools 通过 `BrowserSessionManager.createRunAdapter` 绑定可信账户、LFAA Session、Agent Run 与取消信号；同一 Run 复用高层动作适配器，Agent Loop 的 `onRunDispose` 会使其失效并移除登记。适配器只委派现有 Browser Owner 导航、观察、点击、普通文本输入、受限按键、滚动和 Tabbit 操作，不返回 `Page`、CDP/WebSocket、进程或本机 Profile 句柄。长期隔离 BrowserContext 继续按账户/LFAA Session 归属，不因普通 Run 结束自动关闭；Run 取消沿既有操作路径取消并回收当前 BrowserContext。该内部适配器尚不运行第三方 Skill 脚本或 Web Access Proxy。`browserUse.showFullUrl` 仅控制客户端地址展示。

当前会话绑定本机工作区时，`lfaa_browser_open_workspace_file` 可将工作区内 HTML/HTM 交给 Project Files Owner 建立仅监听回环的短期只读服务，并在相同 Browser Session 中打开；相对资源从同一工作区根目录读取，路径越界、数据目录与远程 Daemon 项目均拒绝。服务随 Browser Session 关闭或过期回收，不启动 Shell/Python。LFAA 隔离 Edge/Chrome 会按右侧 Dock 的可见页面区调整当前页视口；Tabbit 个人会话保留用户浏览器自己的视口尺寸。Dock 人类输入通过真实 Page 键盘、受限快捷键、滚轮/触屏滚动以及有界鼠标拖动转发到同一 Session；用户手动输入不作为 Agent 填表工具，不读取或返回敏感字段值。登录、网页授权及验证码需要用户在页面中手动完成，不尝试绕过；输入、滚动和拖动动作结束后由 Dock 获取同一页面的新画面；Agent Tools 仍保留完整页面快照合同。

由 `profileContext`、`lfaaTools` 装配；配套认证 API 由 `lfaa-api-browser-controller` 暴露给共享 Client。Chromium 启动使用系统已安装浏览器，不自动下载内核。导航仅接受 HTTP(S)，页面请求拒绝私网目标（本轮直接输入的本机预览源仅放行完全相同的 Origin），阻止 Service Worker；会话有并发和空闲时限。工具发现与执行均复核 Agent Browser Use 开关、账户连接提供方和当前 Host 的真实可用性；Tabbit 额外复核电脑操控设置。取消隔离浏览器操作时关闭 BrowserContext，取消 Tabbit 操作后在当前有限操作结束时发送 `finish` 并回收 CLI 会话。构建输出为仓库根 `dist/packages/browser-use/browser-use/`。
