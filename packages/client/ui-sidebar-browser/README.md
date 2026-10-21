# `lfaa-client-ui-sidebar-browser`

本包是 AI Work 右侧浏览器 Dock 的唯一 UI Owner，由 `lfaa-client-web` Client 装配并通过 Client Module Loader 懒加载 `BrowserPanel`；真实会话与页面数据归 `lfaa-browser-use`，请求经认证的 `lfaa-api-browser-controller`。没有单独保存浏览器会话、个人浏览器凭据或设置。

AI Work 右 Dock 浏览器面板。仅依赖 Client Connection 的认证 API；以独立提供方标签展示同一 Host Session 的页面截图、可见文本、可访问控件和有限 JSON，并将用户点击映射到当前截图视口坐标。该包不执行页面脚本、不访问本机文件；默认隔离浏览器不读取个人 Profile。用户明确连接 Tabbit 后才读取标签摘要；再选择精确标签后才读取页面正文和截图。账户级 `browserUse.enabledProviderIds` 由设置中心维护；`browserUse.enabled` 只控制 Agent 工具，不阻止用户直接预览。地址栏遵循 `browserUse.showFullUrl`。

当当前 AI Session 有效时，预览台与 Agent 共享相同账户、Session 和浏览器提供方；否则提示先进入会话。Provider 由 Host 返回真实检测结果，未接入的浏览器不会伪装为可用。界面继承 Appearance 共享令牌，适配窄 Dock 与短屏。

构建输出为仓库根 `dist/packages/client/ui-sidebar-browser/`。
