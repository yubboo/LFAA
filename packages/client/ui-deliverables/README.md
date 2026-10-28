# 资产库界面

本包呈现当前会话绑定的 Agent Git 项目产物；有 Minecraft 插件/模组 JAR 时突出显示直接下载卡片，模型、贴图、资源文件和其他交付物按已登记类型/扩展名归类。通过 Client Connection 的认证 API 检查和下载原文件。`ui-workspace` 只提供当前会话项目绑定、右侧菜单入口和面板容器；无绑定时不回退显示其他仓库。样式使用 Appearance 共享令牌，页面不猜测编译状态。

构建只写仓库根 `dist/packages/client/ui-deliverables/`。
