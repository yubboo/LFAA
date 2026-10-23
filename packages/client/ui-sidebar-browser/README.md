# `lfaa-client-ui-sidebar-browser`

本包是 AI Work 右侧浏览器 Dock 的唯一 UI Owner，由 `lfaa-client-web` Client 装配并通过 Client Module Loader 懒加载 `BrowserPanel`；Web 页面由 `lfaa-browser-use` 的真实浏览器会话加载，并将网页画面和用户输入同步到当前区域，请求经认证的 `lfaa-api-browser-controller`。Electron 桌面装配时由 `window.lfaaDesktop.nativeBrowser` 选择 `NativeBrowserPanel`，网页本体由 `apps/desktop-electron` 的 `WebContentsView` 承载，受限导航/状态 IPC 仍由该桌面 Owner 持有；两种模式不共用第二套 API 会话。

AI Work 的浏览器是右 Dock 当前新标签页的内容模式，不另建“浏览器”工作区标签。地址栏、后退/前进/刷新按钮和标签条由 `ApplicationWorkspace` 统一显示；输入网址或搜索词后，Web Host 在受管、可见、隔离的 Chromium 窗口打开真实网页，右 Dock 显示该 Page 的标题、地址和状态；Electron 则直接在 Dock 下方使用现有 `WebContentsView` 嵌入同一真实网页。推荐/最近点击也复用同一标签与 Browser Owner Session。`BrowserPanel` 不绘制 Provider 选择、第二个地址栏、截图播放器或第二套标签/导航控件；地址展示遵循 `browserUse.showFullUrl`。

手动浏览通过认证 Browser Dock API 调用本机 Browser Owner，自动选择当前 Host 实际可用的隔离 Edge/Chrome；不要求用户手动接入 Provider，也不修改 Agent 设置。普通 Web Dock 不截图、不模拟网页像素、不转发坐标、滚轮或键盘；用户在受管 Chromium 窗口中直接使用原生网页和浏览器交互。Electron 由 `WebContentsView` 处理原生鼠标、键盘、输入法、滚动与网页渲染。Agent 浏览器总开关开启后，通过相同账户/AI Session/provider 操作当前 Browser Owner Page；Web 的窗口和 Agent 指向同一 Page，Electron 的 Agent Target 是工作区显式选择的同一原生标签。页面标题/地址和有界修订状态在 Dock 同步。登录、网页授权和验证码由用户亲自操作；Agent 不绕过验证。隔离 Edge/Chrome 不读取个人 Profile/Tabbit，不执行任意页面脚本或访问本机文件。页面隐藏时撤销修订等待；本机窗口尺寸由操作系统/Chromium 决定，不由 Dock 尺寸反复重置。

本机 Web 与 Agent 共用 Browser Owner 管理的可见 Edge/Chrome Page，Web Dock 只显示真实页面元数据，不请求 JPEG，也不会因视口变化触发浏览器 resize。远程 Web Host 没有本机窗口时，按真实 Host 能力提示用户；Agent 是否能用远端 Browser Tools 仍取决于当前主机实际登记能力。Electron 保持应用内原生网页、统一地址栏与 `nativeBrowser` Owner；窗口关闭时清理专用 Session、页面、权限回调和活动下载。浏览器状态读取合并相同账户/Session/Provider 的并发请求，页面修订通过可撤销等待器通知；DOM 变更每页按 750ms 节流。可选视觉诊断截图仍由 Browser Owner 限制大小，普通 Web Dock/Agent 路径不使用。界面继承 Appearance 共享令牌，适配窄 Dock 与短屏。

桌面 `NativeBrowserPanel` 在一次动画帧中合并工作区滚动/布局位置变化，并把主进程 `setBounds` 更新串行化，只保留在途更新之后的最新坐标；不再按固定 160ms 轮询位置。用户在网页内滚动由 Chromium 自身处理，不经过 React 父级截图滚动转发。

`browserUse.searchEngine` 由设置中心的浏览器地址栏控件读取并持久化；地址解析只允许无嵌入凭据的 HTTP(S)，普通文字走所选搜索引擎，localhost/回环开发地址保留 HTTP。当前原生页面的标签数有界，关闭视图和应用时回收页面、权限回调与活动下载。Electron 宿主视口、弹窗、登录、下载和权限仍须在真实桌面端验收后才可标为已通过。

新标签页主页由 `BrowserPanel` 隐藏挂载并回传 Browser Owner 当前已打开的 HTTP(S) 标签；Electron 原生模式回传 `nativeBrowser` 的已打开标签。Web 新标签挂载只检查隔离 Edge/Chrome 是否可用，不提前启动空白浏览器窗口；真正提交网址时，Browser Owner 才为当前账户/AI Session 创建可见、隔离的临时浏览器配置与页面。工作区不保存第二份网站清单，也不读取历史或书签。点击推荐/最近或提交地址后，工作区通过一次性请求在同一个内容区域显示网页。

手动标签地址变化经 `ApplicationWorkspace` 回传 Browser Owner 形成账户范围的“最近”网站元数据；BrowserPanel 只提交真实 HTTP(S) 标签地址，NativeBrowserPanel 只提交当前 Electron 页面状态，不提交页面标题或正文。是否保存由 `browserUse.recordRecentSites` 控制，Agent 实际页面导航则由 Browser Owner 在受控观察时记录。

构建输出为仓库根 `dist/packages/client/ui-sidebar-browser/`。
