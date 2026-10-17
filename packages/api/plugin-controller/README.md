# 插件管理 API

本包提供认证后的能力适配器目录，以及受管理员保护的插件清单、搜索和来源检查路由。`GET /api/capabilities/catalog` 只读展示已登记的能力 Owner、App 范围和生命周期操作，登录用户可查看；插件详细信息与来源操作要求管理员身份。插件页启用/停用按钮调用 `POST /api/plugins/:pluginId/lifecycle`，由 Permission Owner 将本次明确点击识别为单次用户授权，再调用 `lfaa-plugin-manager` 的唯一生命周期 Owner；路由复核目标 App 与来源版本，成功响应来自真实 Runtime 回读。自然语言操作继续由 AI Core Tools 与 Agent Loop 按 `permissions.mode` 执行。`POST /api/plugins/inspect` 可接收一次性 NPM registry，返回固定来源类型、位置、版本与摘要。手动 `POST /api/plugins/install` 要求提交相同 registry、固定来源和期望摘要；Permission Owner 授权后以 NDJSON 流回传 Plugin Manager 实际阶段，最终仅登记插件，不自动启动 Runtime。UI 的“立即启用”随后调用生命周期路由，仍由同一 Permission Owner 复核。流中断不取消已经进入原子安装事务的 Host 写入，界面会明确区分缺失结果与安装失败；不会把空响应当成成功。`POST /api/plugins/:pluginId/remove` 绑定当前来源版本并等待停止与文件清理。安装、启用、卸载均校验管理员身份和 Permission Owner 的明确点击授权；自然语言继续使用 AI Core Tools。卸载/启停版本校验在 Owner 串行事务中执行。

本包不加载第三方代码，也不把插件文件直接公开为静态资源。
