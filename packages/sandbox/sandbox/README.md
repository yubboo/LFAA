# LFAA 沙箱执行接口

`lfaa-sandbox` 定义由平台插件实现的沙箱服务，并提供 `registerSandboxProvider` 将唯一提供方登记到 Cordis 宿主。调用方提交完整 argv、文件/网络策略、目标主机策略和取消信号；提供方分别回报文件隔离完整度、精确网络策略和网络隔离完整度。任一受限维度缺失、策略不匹配或只返回部分隔离，均以 `SANDBOX_UNAVAILABLE` 失败，不回退为不受限进程。`enforcement: "full"` 只表示文件边界，不能代替 `networkEnforcement`。

受限文件模式默认要求 `networkPolicy: { mode: "none" }`；精确主机/端口 allowlist 要由平台执行器单独证明，当前 Windows 提供方不支持并会拒绝。`danger-full-access` 表示调用方经现有设置明确选择不施加文件和网络沙箱限制。此模式必须保持原始 argv，并对两种隔离分别报告 `"none"`；它不代表本包授予了工具或主机权限。工具调用授权仍由 `packages/interaction/permission-presets` 和目标业务 Owner 执行。

Windows x64 的本机及目标节点提供方由 `packages/sandbox/sandbox-windows-acl` 注册，并调用 `native/system` Sandbox Host 执行 AppContainer/Job Object 边界。Daemon 只在目标节点执行其自身 Provider；控制端不把本机 Provider 代理给远程节点。隔离 Control Plane + Daemon 回归已验证本机源码链上的取消、workspace-write、read-only 和 Host 回执；这不表示第二台真实远程节点或真实模型 Provider 已验收。Linux 与 macOS 目前没有通用 OS Provider，受限模式必须 unavailable。`packages/host/daemon/src/process-control.mjs` 仅管理 Minecraft 及任务进程，不是通用沙箱提供方。
