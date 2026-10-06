# 插件管理 API

本包提供认证后的能力适配器目录，以及受管理员保护的插件清单、搜索和来源检查路由。`GET /api/capabilities/catalog` 只读展示已登记的能力 Owner、App 范围和生命周期操作，登录用户可查看；插件详细信息与来源操作调用 `lfaa-plugin-manager` 的唯一清单与文件 Owner，并要求管理员身份。安装、启停和移除不经 HTTP 管理路由暴露，只能由 AI Core Tools 在现有 Agent 权限/审批链中调用。

本包不加载第三方代码，也不把插件文件直接公开为静态资源。
