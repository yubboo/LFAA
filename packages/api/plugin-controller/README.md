# 插件管理 API

本包提供认证后的能力适配器目录，以及受管理员保护的插件清单、搜索和来源检查路由。`GET /api/capabilities/catalog` 只读展示已登记的能力 Owner、App 范围和生命周期操作，登录用户可查看；插件详细信息与来源操作要求管理员身份。插件页启用/停用按钮调用 `POST /api/plugins/:pluginId/lifecycle`，由 Permission Owner 将本次明确点击识别为单次用户授权，再调用 `lfaa-plugin-manager` 的唯一生命周期 Owner；路由复核目标 App 与来源版本，成功响应来自真实 Runtime 回读。自然语言操作继续由 AI Core Tools 与 Agent Loop 按 `permissions.mode` 执行。`POST /api/plugins/install` 将检查所得固定版本和来源交给同一 Owner 下载、安装并启用；`POST /api/plugins/:pluginId/remove` 绑定当前来源版本并等待停止与文件清理。二者同样校验管理员身份和 Permission Owner 的明确点击授权；自然语言继续使用 AI Core Tools。卸载/启停版本校验在 Owner 串行事务中执行。

本包不加载第三方代码，也不把插件文件直接公开为静态资源。
