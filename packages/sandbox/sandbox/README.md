# LFAA 沙箱执行接口

`lfaa-sandbox` 定义由平台插件实现的沙箱服务，并提供 `registerSandboxProvider` 将唯一提供方登记到 Cordis 宿主。调用方提交完整 argv、目标主机策略和取消信号；提供方返回真实执行 argv、实际模式、隔离完整度及提供方标识。受限执行只接受完整隔离，能力缺失或返回部分隔离均以 `SANDBOX_UNAVAILABLE` 失败，不回退为不受限进程。

`danger-full-access` 表示调用方经授权后明确选择不施加沙箱文件限制。此模式必须保持原始 argv，并报告 `enforcement: "none"`；它不代表本包授予了工具或主机权限。工具调用授权仍由 `packages/interaction/permission-presets` 和目标业务 Owner 执行。

本包是平台实现接口，不包含本机或 Daemon 隔离执行器。`packages/host/daemon/src/process-control.mjs` 当前仅管理 Minecraft 及任务进程，明确不视为通用沙箱提供方。
