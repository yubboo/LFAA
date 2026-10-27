# Workspace 项目目录

本包是项目登记的唯一业务 Owner。AI Work（`workspace`）项目按账户保存名称、项目目录、指令、记忆范围和附加本机源文件夹；创建时由 LFAA 本机 Project Files Host 在用户选择的工作区父目录下新建同名项目文件夹，并将其作为不可移除的项目主目录。附加本机文件夹可选。项目自身不绑定 Daemon。SQLite 迁移 70 增加 `workspace_project_sources`、项目指令、项目记忆范围和独立的项目会话记忆；每个登记目录有稳定 ID，供工具与文件审阅关联准确的根目录。`minecraft` 继续使用原有显式节点项目流程。旧版 AI Work 节点项目记录保留作历史兼容，但不从 AI Work 的新项目搜索和选择结果中返回。

本包只操作控制端 SQLite 中的登记关系，不浏览、创建或删除主机文件，也不拥有 AI 会话和权限判断。Controller 调用 LFAA 本机 Project Files Host 核验项目父目录和附加源目录，并由该 Host 在所选父目录下创建项目文件夹、返回规范路径。本包保存项目主目录、附加源目录和零到多个已登记业务 App 的关联；迁移 71 的 `workspace_project_applications` 只提供 Agent 项目领域背景，不改变 `app_id`、工具可见范围、权限或 Host。Session Owner 持久化会话的项目归属；Conversation Memory Owner 在迁移 70 新表保存仅限项目的记忆；文件访问继续经过登记项目的源根和当前 AI 权限合同。

SQLite 迁移 38 为项目增加 `app_id`。迁移前的目录保持未分配，只有用户从某个 App 显式使用时才归属该 App；一个目录若仍被其他 App 的历史会话引用，则必须在目标 App 重新登记，不能共享归属。项目仅关联当前 App 的 AI 会话和文件上下文，不会创建新的 LFAA App，也不会创建或管理 Minecraft 游戏实例。

SQLite 迁移 58 为每个账户保留 AI Work 默认工作区身份；默认目录由 LFAA 本机 Host 根据操作系统的“文档”位置动态解析到小写 `lfaa/default-workspace`，项目登记不保存 Daemon 节点 ID。公开只读函数 `getDefaultWorkspaceProjectPath(userId)` 解析已登记默认项目的本机路径，不初始化或改写目录。SQLite 迁移 60 解除已知默认项目的旧节点绑定；更早的旧版默认目录只通过本机保存的身份确认唯一候选，再原子清空节点字段，不连接在线 Daemon。既有默认项目登记到其他路径时，Controller 请求本机 Project Files Owner 创建规范默认目录，再由本 Owner 以旧路径做并发保护并更新登记；旧目录内容以及 Session 记录都不读取、不复制、不改写。历史 Session JSONL 快照不重写，运行时按 Workspace Owner 当前登记解析默认身份。首次初始化只在当前账户没有项目与会话历史时创建；移除默认登记后不会自动重建。

本包还持久化由 Daemon Git Worktree Owner 创建的隔离工作树身份、源项目、节点和恢复基线（SQLite 迁移 37）。它只登记项目关系，不持有仓库状态或 diff；工作树的创建、恢复或删除必须先通过账户/App/项目校验，再由原节点 Daemon 的固定 Git 操作完成。

Git 分支前缀来自账户设置 `git.branchPrefix`。AI Worktree 从独立临时 Git index 捕获源仓库已跟踪及非忽略未跟踪改动，源目录的 HEAD、索引和文件保持不变。恢复只把 LFAA 管理的工作树重置到登记基线并保留 ignored 文件；删除工作树不删源目录，源仓库里的分支与提交历史保留。本包不处理任意 Git 命令、提交、远端、推送、合并或 Pull Request。

移除普通项目登记只解除账户与目录的关联，主机文件、已存在会话、消息和任务都保留。Minecraft 实例仍由 `packages/games/minecraft` 管理。

## 小鱼共享工作入口（2026-10-14）

项目列表默认按账户共享；app_id 为原登记来源，旧 ID、节点与规范路径保持，消费方不重复创建目录。可选历史来源筛选仍存在；共享工作不再以来源标签排除当前账户项目。

构建只写仓库根 dist/packages/workspace/workspace/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
