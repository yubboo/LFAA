# LFAA 沙箱执行接口

`lfaa-sandbox` 定义由平台插件实现的沙箱服务，并提供 `registerSandboxProvider` 将唯一提供方登记到 Cordis 宿主。调用方提交完整 argv、目标主机策略和取消信号；提供方返回真实执行 argv、实际模式、隔离完整度及提供方标识。受限执行只接受完整隔离，能力缺失或返回部分隔离均以 `SANDBOX_UNAVAILABLE` 失败，不回退为不受限进程。

`danger-full-access` 表示调用方经授权后明确选择不施加沙箱文件限制。此模式必须保持原始 argv，并报告 `enforcement: "none"`；它不代表本包授予了工具或主机权限。工具调用授权仍由 `packages/interaction/permission-presets` 和目标业务 Owner 执行。

Windows x64 的本机及目标节点提供方由 `packages/sandbox/sandbox-windows-acl` 注册，并调用 `native/system` Sandbox Host 执行 AppContainer/Job Object 边界。Daemon 只在目标节点执行其自身 Provider；控制端不把本机 Provider 代理给远程节点。隔离 Control Plane + Daemon 回归已验证本机源码链上的取消、workspace-write、read-only 和 Host 回执；这不表示第二台真实远程节点或真实模型 Provider 已验收。Linux 与 macOS 目前没有通用 OS Provider，受限模式必须 unavailable。`packages/host/daemon/src/process-control.mjs` 仅管理 Minecraft 及任务进程，不是通用沙箱提供方。
