# LFAA 沙箱策略

`lfaa-sandbox-policy` 定义单次进程执行的文件限制模式、独立网络策略、目标主机和工作区边界。网络策略为 `none`、精确 `allowlist`（DNS 主机名与端口）或 `unrestricted`；受限文件模式默认 `none`，`danger-full-access` 默认 `unrestricted`。allowlist 拒绝通配符、IP 字面量、尾点和重复目标。它只校验显式策略，不保存用户偏好，不设置默认工作目录，也不替代 `packages/interaction/permission-presets` 的工具授权与一次性审批。

`read-only`、`workspace-write` 和 `danger-full-access` 表示文件访问限制范围，不能推导网络边界。`lfaa-sandbox` 要求执行提供方分别回报文件限制和网络策略/执行状态；allowlist 请求只有提供方确认严格匹配时才可运行。实际文件模式必须由权威设置、会话及权限 Owner 明确提供；工作区根目录按目标节点操作系统校验，避免控制端操作系统与执行节点不同造成路径误判。`isSandboxPolicyWidening` 仅用于提示文件限制范围变宽，调用方仍须通过权威权限 Owner 完成审批。

当前 Windows AppContainer 提供方只执行无网络策略，尚不支持域名 allowlist；缺少对应 egress 执行能力时必须失败关闭。真实本机/Daemon Provider 的平台覆盖和用户设置接入状态以 `docs/系统总体架构.md` 为准，本包中的网络策略类型不表示域名限制已经可用。
