# `lfaa-api-workflow-controller`

提供认证的 `/apps/:appId/workflows` API。`ApplicationId` 由服务器白名单解析，所有列表/读写/运行/取消都按认证账户和 App 双重隔离；节点目录及引擎列表来自当前已注册插件。

Controller 只承担请求校验和传输。图与运行快照归 `lfaa-workflow`；引擎/节点由其 Cordis Registry 调度；Minecraft 执行适配器继续调用现有 Agent Loop、工具权限和 Daemon Owner。
