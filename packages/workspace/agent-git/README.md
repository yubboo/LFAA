# Agent Git Workspace Owner

本包独立管理 LFAA 本机 Agent 的 Git 仓库元数据与 AI Session 绑定。仓库可在多个 Agent 会话间复用；每个会话只绑定一个自动关联的已登记仓库。目录身份来自 Session 所选 `WorkspaceProject` 的当前登记路径；它不依赖 Daemon 节点或业务 App 项目执行 Git 操作，也不保存远端 Git 凭据。

仓库的真实目录和 Git 状态由本机 `lfaa-host-git` 校验/执行；本包只持久化账户隔离的仓库元数据和会话关系。调用方必须先通过 Session Owner 验证会话账户归属，再调用绑定接口。仓库注册表不保存秘密，也不执行初始化、暂存或提交；`git init` 只由 Agent 首次获准文件写入的 Tool 在同一权限结果内触发。

构建只写仓库根 `dist/packages/workspace/agent-git/`。
