# Agent Git Controller

为认证 Agent 会话提供本机 Git 仓库关联、绑定、状态、差异与本地 Git 操作 API。首次关联从 Session 快照中的项目 ID 查询 Workspace Owner，校验账户、App 和节点身份，再由本机 Git Host 解析当前已登记项目目录；浏览器不提交任意绝对路径。该关联仅登记 Git 元数据，不创建 `.git`。Agent 首次获准在项目目录中创建或写入文件时，项目文件 Tool 才在同一次授权操作中对非仓库目录执行 `git init`。该链路不要求 Daemon 在线；远端 Daemon 项目不会绑定成本机仓库。

Session Owner 校验会话账户归属；Workspace Owner 提供 Agent 当前选择的项目目录；Agent Git Workspace Owner 持久化账户隔离的仓库元数据与会话关系；Git Host 执行固定 Git 操作。当前会话可管理 remote、fetch、干净工作区快进 pull、当前分支 push 和发布分支。HTTPS 用户名/token 由本 Controller 通过 `lfaa-credentials` 加密记录按账户隔离；凭据写入和同步均经 `permissions.mode` 与 Permission Owner，秘密不返回 Client。SSH remote 可登记但不会执行同步。用户无需手动添加仓库或点击初始化。

构建只写仓库根 `dist/packages/api/agent-git-controller/`。
