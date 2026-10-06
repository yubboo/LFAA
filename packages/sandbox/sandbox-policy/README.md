# LFAA 沙箱策略

`lfaa-sandbox-policy` 定义单次进程执行的文件限制模式、目标主机和工作区边界。它只校验显式策略，不保存用户偏好，不设置默认工作目录，也不替代 `packages/interaction/permission-presets` 的工具授权与一次性审批。

`read-only`、`workspace-write` 和 `danger-full-access` 表示文件访问限制范围。实际模式必须由未来接入的设置、会话及权限 Owner 明确提供；工作区根目录按目标节点操作系统校验，避免控制端操作系统与执行节点不同造成路径误判。`isSandboxPolicyWidening` 仅用于提示范围变宽，调用方仍须通过权威权限 Owner 完成审批。

本包目前提供可构建、可回归的策略合同；真实本机/Daemon 沙箱执行器及用户设置尚未接入，不表示沙箱隔离已经可用。
