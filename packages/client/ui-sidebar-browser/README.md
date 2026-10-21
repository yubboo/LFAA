# `lfaa-client-ui-sidebar-browser`

本包是 AI Work 右侧浏览器 Dock 的唯一 UI Owner，由 `lfaa-client-web` Client 装配并通过 Client Module Loader 懒加载 `BrowserPanel`；真实会话与页面数据归 `lfaa-browser-use`，请求经认证的 `lfaa-api-browser-controller`。没有单独保存浏览器会话、个人浏览器凭据或设置。

AI Work 右 Dock 浏览器工作区。仅依赖 Client Connection 的认证 API；以独立提供方标签展示同一 Host Session 的页面截图、可见文本、可访问控件和有限 JSON。图片表面捕获人的点击、键盘/输入法文字、鼠标拖动、滚轮和触屏纵向滑动，按截图显示尺寸映射到真实 Browser Session；高频文字与滚动串行派发，暂缓中间截图，并在动作空闲后读取新画面。登录、网页授权和验证码由用户亲自操作；Agent 不绕过验证。指针为普通箭头。LFAA 隔离 Edge/Chrome 通过观察页面区尺寸调整同一 Browser Session 的视口，图片保持原始宽高比；Tabbit 是用户个人浏览器，不调整其视口。该包不执行页面脚本、不访问本机文件；默认隔离浏览器不读取个人 Profile。用户明确连接 Tabbit 后才读取标签摘要；再选择精确标签后才读取页面正文和截图。账户级 `browserUse.enabledProviderIds` 由设置中心维护；Agent 修改它后由能力设置失效事件同步到 Workbench；`browserUse.enabled` 只控制 Agent 工具，不阻止用户直接操作。轮询会在会话初始没有页面时继续查询有限修订号，使 Agent 新建的同 Session 页面能被 Dock 发现。地址栏遵循 `browserUse.showFullUrl`。

当当前 AI Session 有效时，浏览器工作区与 Agent 共享相同账户、Session 和浏览器提供方；否则提示先进入会话。Provider 由 Host 返回真实检测结果，未接入的浏览器不会伪装为可用。界面继承 Appearance 共享令牌，适配窄 Dock 与短屏。

构建输出为仓库根 `dist/packages/client/ui-sidebar-browser/`。
