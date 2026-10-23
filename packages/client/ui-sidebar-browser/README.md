# `lfaa-client-ui-sidebar-browser`

本包是 AI Work 右侧浏览器 Dock 的唯一 UI Owner，由 `lfaa-client-web` Client 装配并通过 Client Module Loader 懒加载 `BrowserPanel`；Web 页面由 `lfaa-browser-use` 的真实浏览器会话加载，并将网页画面和用户输入同步到当前区域，请求经认证的 `lfaa-api-browser-controller`。Electron 桌面装配时由 `window.lfaaDesktop.nativeBrowser` 选择 `NativeBrowserPanel`，网页本体由 `apps/desktop-electron` 的 `WebContentsView` 承载，受限导航/状态 IPC 仍由该桌面 Owner 持有；两种模式不共用第二套 API 会话。

AI Work 的浏览器是右 Dock 当前新标签页的内容模式，不另建“浏览器”工作区标签。地址栏、后退/前进/刷新按钮和标签条由 `ApplicationWorkspace` 统一显示；输入网址或搜索词后，只替换新标签页主页内容，网页直接显示在该地址栏下方的同一个区域。推荐/最近点击也复用同一标签与 Browser Owner Session。`BrowserPanel` 不再绘制 Provider 选择、第二个地址栏或第二套标签/导航控件，只负责将 Browser Owner 网页画面呈现在该区域并回传打开标签。浏览主页期间 BrowserPanel 隐藏显示但保持标签状态读取；打开页面后才显示网页。地址展示遵循 `browserUse.showFullUrl`。

手动浏览通过认证 Browser Dock API 调用本机 Browser Owner，自动选择当前 Host 实际可用的隔离 Edge/Chrome；不要求用户手动接入 Provider，也不修改 Agent 设置。Web 以变化唤醒的实际网页画面显示当前浏览器，并将点击、键盘/输入法文字、鼠标拖动、滚轮和触屏纵向滑动转发到真实 Browser Session；动作进行中暂缓重复读取画面，页面变化或动作结束后更新。Agent 浏览器总开关开启后，通过相同账户/AI Session/provider 自动共用同一 Browser Owner 页面；Agent 总开关和操作权限仍归原有 Settings 与 Permission Owner。登录、网页授权和验证码由用户亲自操作；Agent 不绕过验证。隔离 Edge/Chrome 不读取个人 Profile/Tabbit，不执行页面脚本或访问本机文件。主页隐藏时停止视口调整与持续更新等待；用户首次导航时由 Browser Owner 建立会话。

Web 当前页面由实际 Browser Owner 会话加载并可通过 Dock 操作；地址栏提交后原地替换主页。隔离 Chromium 在主文档提交后就返回导航结果；网页仍在加载时继续显示加载状态，首次出现有内容的 DOM 画面即刷新 Dock，不等待所有图片和第三方资源结束。真正空白的中间帧不会覆盖上一张有效画面。点击、键盘、滚动等用户动作先发到现有页面，动作响应不等待截图；页面画面随后异步更新。页面自身持续变化的通知按每页 750ms 节流；Dock 对整页 JPEG 再做最多约每 120ms 一次的请求节流，并合并并发快照读取，减少连续滚动期间的截图排队和重复 Base64 传输。刷新间隔由 `browser-frame-interval.ts` 单独计算并接受长期回归。Agent 页面读取仍为结构化数据，不等待或传输截图。内置浏览器由 LFAA 自动提供，Host 实际不可用时会在网页内容区提示原因。桌面原生页面使用现有 Electron `nativeBrowser` Owner 与工作区统一地址栏，用户关闭应用后清除网页数据；没有网站历史/下载管理器。Agent 同页附着自动使用当前选中页面，并继续遵循 Agent 浏览器开关和统一权限模式。界面继承 Appearance 共享令牌，适配窄 Dock 与短屏。

桌面 `NativeBrowserPanel` 在一次动画帧中合并滚动/布局位置变化，并把主进程 `setBounds` 更新串行化，只保留在途更新之后的最新坐标；不再按固定 160ms 轮询位置。Web Browser Owner 的整页 JPEG 不经过主题颜色/遮罩叠加，网页截图显示本身维持不透明。

`browserUse.searchEngine` 由设置中心的浏览器地址栏控件读取并持久化；地址解析只允许无嵌入凭据的 HTTP(S)，普通文字走所选搜索引擎，localhost/回环开发地址保留 HTTP。当前原生页面的标签数有界，关闭视图和应用时回收页面、权限回调与活动下载。Electron 宿主视口、弹窗、登录、下载和权限仍须在真实桌面端验收后才可标为已通过。

新标签页主页由 `BrowserPanel` 隐藏挂载并回传 Browser Owner 当前已打开的 HTTP(S) 标签；Electron 原生模式回传 `nativeBrowser` 的已打开标签。Web 新标签挂载并确认隔离 Edge/Chrome 可用后，会先预启动浏览器进程，继续不创建页面、会话上下文或网站请求；真正提交网址时复用预热进程并按当前账户/AI Session 创建隔离页面。工作区不保存第二份网站清单，也不读取历史或书签。点击推荐/最近或提交地址后，工作区通过一次性请求在同一个内容区域显示网页。

手动标签地址变化经 `ApplicationWorkspace` 回传 Browser Owner 形成账户范围的“最近”网站元数据；BrowserPanel 只提交真实 HTTP(S) 标签地址，NativeBrowserPanel 只提交当前 Electron 页面状态，不提交页面标题或正文。是否保存由 `browserUse.recordRecentSites` 控制，Agent 实际页面导航则由 Browser Owner 在受控观察时记录。

构建输出为仓库根 `dist/packages/client/ui-sidebar-browser/`。
