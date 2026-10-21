# Workspace Controller

本包提供认证后的共享工作项目目录 API：`workspace` 按账户有界列出和搜索全部来源项目，旧 `minecraft` 专用调用保留来源筛选；返回实际具备项目文件能力的 Daemon 节点，委托 Daemon 浏览/检查/新建一级目录，登记/改名/移除真实项目并切换空闲会话的项目归属。默认工作区由 LFAA 本机 Host 管理，不关联 Daemon 节点。显式节点项目的文件操作仍路由到登记节点。支持 Git 节点时，还提供真实 Git 状态、显式初始化、本地变更暂存/撤销暂存/提交、历史/分支读取、分支创建/切换/删除及受管 Worktree 创建/恢复/删除路由。

`POST /workspace/projects/initialize-default` 实现默认工作区初始化：LFAA 本机 Project Files Host 从操作系统动态解析“文档”位置，在其下创建 `lfaa/default-workspace`；不写死盘符或本机路径，也不查询或依赖 Daemon 在线状态。首次初始化仍只在账户没有项目与活动/归档会话时创建。迁移 58 前已存在、因此缺少默认身份标记的旧版账户，会在此请求中经受保护凭据确认本机节点后尝试恢复：Workspace Owner 仅在该本机身份下恰有一个 `lfaa/default-workspace` 候选、没有 Worktree 和本机路径冲突时，原子登记默认身份并清空该项目 `node_id`；多候选、远端身份或冲突均不修改数据。若既有默认项目登记到其他路径，Controller 只创建规范文件夹并由 Workspace Owner 更新项目路径登记；旧目录内容、Session 记录、会话文件及 `.lfaa` 数据保持原样，不复制或移动。SQLite 迁移 60 清除已知默认项目的 `node_id`，保留项目 ID、路径和内容，不改变其他项目绑定。默认项目身份单独持久化，移除登记后不自动重建。桌面选中的任意显式节点目录仍经过同一 Daemon 检查和规范路径登记；Web 与远程节点继续使用节点目录浏览 API。

控制器校验账户、实际项目与会话来源、节点在线状态和 `project-files-v1` 能力；共享调用允许同账户的历史来源记录，专用调用保留相应来源检查。本机默认项目文件操作直接交给 LFAA Host 的 Project Files Owner；显式节点项目才检查节点在线状态并经 Daemon 适配器执行。它不直接访问控制端文件系统，不提供云端节点，也不改变项目权限。项目提供文件夹登记、会话归组和文件上下文，不创建 App 或 Minecraft 实例。登记由 `packages/workspace/workspace` 持久化，会话快照由 Session Owner 持久化；Minecraft 实例和全局管理员文件管理继续由现有 Owner 管理。Wallpaper Engine/DSH Bundle 不属于本控制器或 Daemon 能力。旧项目的空来源标签仅在原登记流程中显式认领，不改写已标记来源。

本地 Git 路由还要求节点在线并报告 `git-workspace-v1`。显式初始化只在当前已登记目录创建 `.git` 元数据，不自动暂存或提交；stage/unstage 与提交使用项目相对路径，提交仅接受暂存变更，并拒绝提交当前登记子目录之外的暂存文件。分支前缀读取账户 `git` 设置；分支切换/删除只允许仓库根项目，避免通过子目录登记改变仓库其他项目；AI Worktree 的分支名由 Workspace Owner 管理。所有写操作通过 Permission Owner 的显式用户操作授权。恢复和删除只接受账户已登记的工作树，不接收模型/浏览器提供的绝对路径；不提供任意 Git 命令、远端 Git、推送、合并或 PR。GitHub OAuth 仍是只读 API 凭据，不可用于 Git transport。

变更审阅通过 `POST /workspace/projects/:projectId/git/file-diff` 返回单文件 Git 差异；`/files/read` 提供分段 UTF-8 文本读取，`/files/write` 只接受带 SHA-256 的用户主动编辑保存。三条路由均从认证账户、App 项目登记和目标 Daemon 解析真实根目录，不接受任意绝对路径。文件读写继续由 `project-files-v1` 执行器校验路径、符号链接、文本类型、2 MiB 上限和并发摘要；编辑器 API 不加入模型 `project-tools` 的操作合同。

以上是可选 `WorkspaceProject` 项目能力，不是 Agent Git 管理器。Agent 本机 Git 仓库由独立的 `packages/api/agent-git-controller` 管理，不依赖本控制器、项目登记或 Daemon 节点。

`POST /workspace/sessions/:sessionId/fork` 只接受消息 ID、目标受管项目 ID 和 App。控制器验证源会话属于当前账户/App 且绑定原始项目，并验证目标 Worktree 的源项目、Daemon 与 App 完全对应；随后由 Agent Loop 使用当前 Provider 整理至完成回答的对话记忆，Session Owner 在创建新 Session 时只保存该记忆与来源关系，并绑定已校验的 Worktree 项目。该接口不接受客户端目录或任意会话上下文，也不复制父消息或重放工具。

## 小鱼共享工作入口（2026-10-14）

workspace 来源代表共享工作，可选择同账户的 Minecraft/旧来源项目；注册 App 标签保留，不改写记录。实际路径/节点/Git/摘要/权限仍由原 Owner 验证。常规 App 的旧专用调用保留来源检查。

构建只写仓库根 dist/packages/api/workspace-controller/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
