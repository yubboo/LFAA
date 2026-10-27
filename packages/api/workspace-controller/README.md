# Workspace Controller

本包提供认证后的项目与文件夹 API。AI Work 的 `workspace` 项目按账户保存项目名称、指令、记忆范围、聊天归属、一个项目主目录和多个可选附加本机源文件夹。创建时由 LFAA 本机 Host 在用户选择的工作区父目录下按项目名新建项目文件夹；该主目录始终保留，编辑只能增删附加源文件夹。`GET /workspace/projects?appId=workspace` 只查本机项目，返回空节点列表，不查询 Daemon 节点表或在线状态。`POST /workspace/projects/local/browse`、项目目录创建、编辑及文件读取均经 LFAA 本机 Host；AI Work 创建 API 拒绝 `nodeId` 和 Daemon 路径。历史节点项目记录不会出现在 AI Work 项目选择器中。Minecraft 的目录选择继续使用其独立节点流程。

`POST /workspace/projects/initialize-default` 实现独立的默认工作区初始化：LFAA 本机 Project Files Host 从操作系统动态解析“文档”位置，在其下创建小写 `lfaa/default-workspace`；不写死盘符/路径，不检查 Daemon 在线状态，也不创建节点任务。首次初始化仍只在账户没有项目与活动/归档会话时创建。迁移 58 前缺少默认身份标记的旧版账户，只通过本机已保存身份定位唯一旧默认路径，再原子清空该项目的 `node_id`；此兼容迁移不连接或等待 Daemon。若既有默认项目登记到其他路径，Controller 只创建规范文件夹并由 Workspace Owner 更新登记；旧目录内容、Session 记录、会话文件及 `.lfaa` 数据保持原样，不复制或移动。SQLite 迁移 60 清除已知默认项目的旧节点绑定，保留项目 ID、路径和内容。默认项目身份单独持久化，移除登记后不自动重建。

控制器校验账户、实际项目与会话来源；AI Work 主目录和附加源文件夹一律由 LFAA 本机 Project Files Host 核验或创建，不查询节点状态、不经 Daemon 适配器。其他显式节点项目才检查节点在线状态并经 Daemon 适配器执行。AI Work 项目创建/编辑可提交 `applicationIds`，Controller 只接受权威 App ID 清单中的业务 App（排除 `workspace`），并由 Workspace Owner 持久化；这些关联仅作为 Agent 领域上下文，不改变当前 `workspace` 能力可见范围、权限、主项目 Owner 或 Host 归属。它不直接访问控制端文件系统，不提供云端节点，也不改变项目权限。项目提供文件夹管理、会话归组和文件上下文，不创建 App 或 Minecraft 实例。登记由 `packages/workspace/workspace` 持久化，会话快照由 Session Owner 持久化；Minecraft 实例和全局管理员文件管理继续由现有 Owner 管理。Wallpaper Engine/DSH Bundle 不属于本控制器或 Daemon 能力。旧项目的空来源标签仅在原登记流程中显式认领，不改写已标记来源。

`POST /workspace/sessions/directory-availability` 仅接受最多 200 个会话 ID；Controller 按认证账户读取 Session 的轻量项目上下文，再调用 Agent Loop 的 `resolveAiSessionWorkspaceContext`，确保检查路径与真实运行 Owner 解析结果一致，不水合完整会话事件日志。新 AI Work 项目只向 LFAA 本机 Project Files Host 检查源目录；页面加载和消息读取不等待目录检查。响应只返回 `available`、`missing` 或 `unknown`，不暴露路径。只有 Host 明确确认路径不存在或不再是目录才返回 `missing`；权限拒绝、超时与 Host 错误都保持 `unknown`。会话解除项目登记不会清除历史快照；若该快照目录仍存在，历史会话仍可正常使用。

本地 Git 路由还要求节点在线并报告 `git-workspace-v1`。显式初始化只在当前已登记目录创建 `.git` 元数据，不自动暂存或提交；stage/unstage 与提交使用项目相对路径，提交仅接受暂存变更，并拒绝提交当前登记子目录之外的暂存文件。分支前缀读取账户 `git` 设置；分支切换/删除只允许仓库根项目，避免通过子目录登记改变仓库其他项目；AI Worktree 的分支名由 Workspace Owner 管理。所有写操作通过 Permission Owner 的显式用户操作授权。恢复和删除只接受账户已登记的工作树，不接收模型/浏览器提供的绝对路径；不提供任意 Git 命令、远端 Git、推送、合并或 PR。GitHub OAuth 仍是只读 API 凭据，不可用于 Git transport。

变更审阅通过 `POST /workspace/projects/:projectId/git/file-diff` 返回单文件 Git 差异；`contextLines` 为 0–1000 的整数并默认为 3，供 Client 按需展开真实未变更上下文。`/files/read` 提供分段 UTF-8 文本读取，`/files/write` 只接受带 SHA-256 的用户主动编辑保存。路由用认证账户、项目 ID 与服务端登记的 `sourceId` 解析对应本机源根，不接受任意绝对路径；不同源目录中的活动变更会回到它自己的根审阅。文件读写由 Project Files Host 校验路径、符号链接、文本类型、2 MiB 上限和并发摘要；编辑器 API 不加入模型 `project-tools` 的操作合同。

以上是可选 `WorkspaceProject` 项目能力，不是 Agent Git 管理器。Agent 本机 Git 仓库由独立的 `packages/api/agent-git-controller` 管理，不依赖本控制器、项目登记或 Daemon 节点。

`POST /workspace/sessions/:sessionId/fork` 只接受消息 ID、目标受管项目 ID 和 App。控制器验证源会话属于当前账户/App 且绑定原始项目，并验证目标 Worktree 的源项目、Daemon 与 App 完全对应；随后由 Agent Loop 使用当前 Provider 整理至完成回答的对话记忆，Session Owner 在创建新 Session 时只保存该记忆与来源关系，并绑定已校验的 Worktree 项目。该接口不接受客户端目录或任意会话上下文，也不复制父消息或重放工具。

## 小鱼共享工作入口（2026-10-14）

workspace 来源代表共享工作，可选择同账户的 Minecraft/旧来源项目；注册 App 标签保留，不改写记录。实际路径/节点/Git/摘要/权限仍由原 Owner 验证。常规 App 的旧专用调用保留来源检查。

构建只写仓库根 dist/packages/api/workspace-controller/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
