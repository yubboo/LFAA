# 本机 Git Host

本包是 LFAA 本机 Control Plane 的 Git 命令 Owner。它只接收 API 层从已登记仓库解析出的目标，按固定操作枚举调用 Git，不经目标项目 Daemon，也不接受任意 Git 参数。Agent 会话使用 Workspace Owner 当前登记的项目目录自动关联 Git 元数据；首次获准文件写入时由项目文件 Tool 在同一授权结果内调用此包的固定 `initialize` 操作，对非仓库目录执行一次 `git init`。查看摘要、聊天和目录选择都不会改动项目目录。Git 状态、分支和差异读取始终按完整仓库根执行。

受管 AI Worktree 与临时 Git index 位于配置的 `LFAA_DATA_DIR`，与源仓库隔离。包不持有账户、会话、权限或持久化凭据；认证/授权由 API 与 Permission Owner 负责。只接收 API 从 `lfaa-credentials` 按账户读取的短期 HTTPS 用户名/token，在当前 Git 子进程环境中使用；显式清空机器级 credential helper 并禁止认证重定向。SSH remote 可登记但暂不执行同步。仅提供 fetch、干净工作区快进 pull、当前分支 push、发布分支及 remote 管理，不支持强制推送或 Pull Request。

构建只写仓库根 `dist/packages/host/git/`。
