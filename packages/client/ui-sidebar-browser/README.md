# `lfaa-client-ui-sidebar-browser`

本包是 AI Work 右侧浏览器 Dock 的唯一 UI Owner，由 `lfaa-client-web` Client 装配并通过 Client Module Loader 懒加载 `BrowserPanel`；页面、标签、Agent 同页操作归 `lfaa-browser-use`，认证 API 归 `lfaa-api-browser-controller`。普通 Web 在用户提交网址后自动显示 Browser Owner 当前 Page 的连续实时合成器帧流；通过 SSE 推送帧，Canvas 随右 Dock 实际内容区铺满绘制，ResizeObserver 按容器变化同步 Chromium 视口，坐标点击、拖动、滚动和键盘输入转发到同一 Page。没有启动外部浏览器窗口、`getDisplayMedia`、系统选屏弹窗或定时截图请求。页面隐藏、切换或卸载时立即撤销流、尺寸观察器和输入缓存。远程 Web 不能显示远端 Host 的页面。Electron 桌面由 `window.lfaaDesktop.nativeBrowser` 选择 `NativeBrowserPanel`，网页本体直接由 `apps/desktop-electron` 的 `WebContentsView` 绘制，受限导航/状态 IPC 仍由该桌面 Owner 持有；两种模式不共用第二套 Browser Session。

AI Work 的浏览器是右 Dock 当前新标签页的内容模式，不另建“浏览器”工作区标签。地址栏、后退/前进/刷新按钮和标签条由 `ApplicationWorkspace` 统一显示；输入网址或搜索词后，普通 Web Host 在无窗口隔离 Chromium 中打开真实网页并自动把页面持续推到 Dock；Electron 则直接在 Dock 下方使用现有 `WebContentsView` 内嵌同一真实网页。推荐/最近点击也复用同一标签与 Browser Owner Session。`BrowserPanel` 不绘制 Provider 选择、第二个地址栏、定时截图播放器或第二套标签/导航控件；地址展示遵循 `browserUse.showFullUrl`。

手动浏览通过认证 Browser Dock API 调用本机 Browser Owner，自动选择当前 Host 实际可用的隔离 Edge/Chrome；不要求用户手动接入 Provider，也不修改 Agent 设置。普通 Web 不请求截图 API，而由 Browser Owner 事件推送连续 JPEG 合成器帧，Canvas 只绘制当前页面流，不模拟网页 DOM；用户不需要打开另一浏览器或选择系统共享来源。鼠标、滚动、键盘和输入法事件交给同一 Browser Owner Page。Electron 由 `WebContentsView` 原生处理鼠标、键盘、输入法、滚动与网页渲染。Agent 浏览器总开关开启后，通过相同账户/内置工作区/provider 操作当前 Browser Owner Page；Web 与 Agent 指向同一 Page，Electron 的 Agent Target 是工作区显式选择的同一原生标签。页面标题/地址和有界修订状态在 Dock 同步。登录、网页授权和验证码由用户亲自操作；Agent 不绕过验证。隔离 Edge/Chrome 不读取个人 Profile/Tabbit，不执行任意页面脚本或访问本机文件。页面隐藏时取消帧流并撤销修订等待；Chromium 无窗口运行，Web 页面视口随 Dock 实际内容尺寸变化。

本机 Web 与 Agent 共用 Browser Owner 管理的隔离 Edge/Chrome Page；持续帧流在页面隐藏、卸载或 Session 切换后立即取消。Browser Owner 因服务重启丢失内存 Page 后，Dock 先重新读取 Owner 快照；确认无 Page 且当前工作区标签仍有 URL 时，复用同一 Browser Owner 导航恢复该 URL。恢复只使用 LFAA 当前工作区标签里已有的 URL，不持久化网页正文、Cookie 或 Chromium Context，也不会覆盖已有 Page 或待执行导航。远程 Web Host 没有本机浏览器能力时，按真实 Host 状态提示用户；Agent 是否能用远端 Browser Tools 仍取决于当前主机实际登记能力。Electron 保持应用内原生网页、统一地址栏与 `nativeBrowser` Owner；窗口关闭时清理专用 Session、页面、权限回调和活动下载。浏览器状态读取合并相同账户/内置工作区/Provider 的并发请求，Dock 快照不包含截图或整页正文；页面修订通过可撤销等待器通知，DOM/尺寸变化每页按 750ms 节流。Browser Owner Session ID 是修订号的代际边界：仅同一 Session 内按 revision 丢弃旧响应；Host 重启后新 Session 的低修订快照仍会替换旧页面状态。视觉诊断截图仅限明确调用路径，普通 Browser Dock/Agent 路径不使用。界面继承 Appearance 共享令牌，适配窄 Dock 与短屏。

桌面 `NativeBrowserPanel` 在一次动画帧中合并工作区滚动/布局位置变化，并把主进程 `setBounds` 更新串行化，只保留在途更新之后的最新坐标；不再按固定 160ms 轮询位置。用户在网页内滚动由 Chromium 自身处理，不经过 React 父级截图滚动转发。

`browserUse.searchEngine` 由设置中心的浏览器地址栏控件读取并持久化；地址解析只允许无嵌入凭据的 HTTP(S)，普通文字走所选搜索引擎，localhost/回环开发地址保留 HTTP。当前原生页面的标签数有界，关闭视图和应用时回收页面、权限回调与活动下载。Electron 宿主视口、弹窗、登录、下载和权限仍须在真实桌面端验收后才可标为已通过。

新标签页主页由 `BrowserPanel` 隐藏挂载并回传 Browser Owner 当前已打开的 HTTP(S) 标签；Electron 原生模式回传 `nativeBrowser` 的已打开标签。Web 新标签挂载只检查隔离 Edge/Chrome 是否可用，不提前启动浏览器；真正提交网址时，Browser Owner 才为当前账户/内置工作区创建无窗口隔离页面，实时帧流自动进入右 Dock。工作区不保存第二份网站清单，也不读取历史或书签。点击推荐/最近或提交地址后，工作区通过一次性请求在同一个内容区域显示网页。

手动标签地址变化经 `ApplicationWorkspace` 回传 Browser Owner 形成账户范围的“最近”网站元数据；BrowserPanel 只提交真实 HTTP(S) 标签地址，NativeBrowserPanel 只提交当前 Electron 页面状态，不提交页面标题或正文。是否保存由 `browserUse.recordRecentSites` 控制，Agent 实际页面导航则由 Browser Owner 在受控观察时记录。

构建输出为仓库根 `dist/packages/client/ui-sidebar-browser/`。

2026-10-23：浏览器面板使用账户内稳定工作区标识，无需先建立 AI 会话。空白面板等待 Agent 创建页面并同步真实网址；实时帧流断开后按有界间隔重连，期间保留上一帧，重连与隐藏/卸载都会撤销定时器、SSE、观察器及输入缓存。Web 仍由本机 Chromium 合成器帧驱动 Canvas 和真实页面输入；Electron 仍由原生 WebContentsView 绘制。

BrowserPanel 遵循成功 Agent 活动中的内置 Provider ID：Web 与 Electron 的隔离 Edge/Chrome 都由现有 Browser Owner 帧面板读取同一个 Page；Electron 在 Agent Provider 为 `lfaa-native-browser` 或尚无 Agent Provider 目标时使用原生 `WebContentsView`；若 Agent 明确选择隔离 Edge/Chrome，则继续显示同一 Browser Owner 的页面流。Agent 在原生标签已活动时由真实 Provider 状态优先选择原生 Provider。不创建第二个 Session 或导航请求。
