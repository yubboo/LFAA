# `lfaa-browser-use`

本机 Browser Owner：在受支持的 LFAA Windows/macOS 本机 Profile 中按需启动隔离的系统 Edge/Chrome 会话，提供有界页面观察、截图、导航与语义交互。它不读取系统浏览器 Profile，不继承用户 Cookie；每个 LFAA 账户/会话使用独立 BrowserContext，关闭后销毁内存态页面与上下文。远程 Web Host 不会获得本机浏览器工具。

Tabbit 是单独的个人浏览器适配器，通过当前账户安装目录中的稳定 LocalAgent CLI 创建有界任务；只有用户在预览台选中 Tabbit，或当前请求明确要求 Tabbit 时才读取标签摘要/连接所选标签。其他个人 Chrome/Edge Profile、Firefox 与其他 AI 浏览器尚无此 Browser Adapter；用户明确要求控制本地浏览器时，仍可使用已登记的通用 Windows CUA 工具，且该画面目前不镜像进本预览台。

模型通过 LFAA `lfaa_tools_list/load` 选择真实登记的 Browser 工具。账户设置 `browserUse.enabled`（默认关闭）控制 Agent 是否可发现这些工具；`browserUse.enabledProviderIds`（默认空）限定可用提供方。隔离 Edge/Chrome 只使用 LFAA 新建的临时上下文，不要求开启电脑操控；连接 Tabbit 个人会话须由用户显式选择，并同时启用既有 `computerControl.enabled`。所有 Agent 动作仍走唯一 Permission Owner 与 `permissions.mode`，不在浏览器包建立第二套审批。`browserUse.showFullUrl` 仅控制客户端地址展示。

由 `profileContext`、`lfaaTools` 装配；配套认证 API 由 `lfaa-api-browser-controller` 暴露给共享 Client。Chromium 启动使用系统已安装浏览器，不自动下载内核。导航仅接受 HTTP(S)，页面请求拒绝私网目标（本轮直接输入的本机预览源仅放行完全相同的 Origin），阻止 Service Worker；会话有并发和空闲时限。工具发现与执行均复核 Agent Browser Use 开关、账户连接提供方和当前 Host 的真实可用性；Tabbit 额外复核电脑操控设置。取消隔离浏览器操作时关闭 BrowserContext，取消 Tabbit 操作后在当前有限操作结束时发送 `finish` 并回收 CLI 会话。构建输出为仓库根 `dist/packages/browser-use/browser-use/`。
