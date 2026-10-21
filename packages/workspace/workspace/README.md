# Workspace 项目目录

本包是 AI Work 项目目录登记的唯一业务 Owner。它按账户与应用保存项目执行位置、规范目录路径、项目标题和登记时间，供当前 App 下的会话选择与分组；支持 `workspace` 和 `minecraft` 两个 App。`node_id = NULL` 表示由 LFAA 本机 Host 管理；只有用户显式关联的节点项目才保存 Daemon 身份。项目 UUID 与路径分开保存，同一账户、App、执行位置上的同一规范目录只登记一次；同一物理目录可由用户分别登记到不同 App。

本包只操作控制端 SQLite 中的登记关系，不浏览、创建或删除主机文件，也不拥有 AI 会话和权限判断。显式节点目录必须先由目标 Daemon 检查并返回规范绝对路径；本机默认工作区由 LFAA Host 的 Project Files Owner 解析和验证。会话项目归属保存在 Session 的 JSONL 记录中；文件访问继续经过登记项目的实际执行位置与当前 AI 权限合同。

SQLite 迁移 38 为项目增加 `app_id`。迁移前的目录保持未分配，只有用户从某个 App 显式使用时才归属该 App；一个目录若仍被其他 App 的历史会话引用，则必须在目标 App 重新登记，不能共享归属。项目仅关联当前 App 的 AI 会话和文件上下文，不会创建新的 LFAA App，也不会创建或管理 Minecraft 游戏实例。

SQLite 迁移 58 为每个账户保留 AI Work 首次默认项目身份，标记不外键引用目录登记，因此用户移除默认项目后仍会记住已初始化，避免自动重建。首次初始化仅在当前账户没有任何项目登记、活动/归档会话历史时创建；默认目录由 LFAA 本机 Host 根据操作系统的“文档”位置动态解析到 `lfaa/default-workspace`，项目登记不保存 Daemon 节点 ID。SQLite 迁移 60 解除已知默认项目的旧节点绑定；旧版账户若在迁移 58 前已创建默认目录、因而没有默认身份标记，首次初始化请求会由 Controller 用受保护凭据确认当前本机节点，再由本 Owner 仅在唯一匹配 `lfaa/default-workspace` 路径且不存在 Worktree 时恢复身份并原子清空节点 ID。候选不唯一、存在本机路径冲突或节点不是当前本机身份时不修改登记；其他显式节点项目不变。既有默认项目登记到错误路径时，Controller 请求本机 Project Files Owner 创建动态解析出的规范文件夹，再由此 Owner 以旧路径做并发保护并更新项目路径登记；旧目录内容以及 Session Owner 的记录都不读取、不复制、不改写。历史 Session JSONL 快照不重写，运行时按 Workspace Owner 当前登记解析默认项目身份。

本包还持久化由 Daemon Git Worktree Owner 创建的隔离工作树身份、源项目、节点和恢复基线（SQLite 迁移 37）。它只登记项目关系，不持有仓库状态或 diff；工作树的创建、恢复或删除必须先通过账户/App/项目校验，再由原节点 Daemon 的固定 Git 操作完成。

Git 分支前缀来自账户设置 `git.branchPrefix`。AI Worktree 从独立临时 Git index 捕获源仓库已跟踪及非忽略未跟踪改动，源目录的 HEAD、索引和文件保持不变。恢复只把 LFAA 管理的工作树重置到登记基线并保留 ignored 文件；删除工作树不删源目录，源仓库里的分支与提交历史保留。本包不处理任意 Git 命令、提交、远端、推送、合并或 Pull Request。

移除普通项目登记只解除账户与目录的关联，主机文件、已存在会话、消息和任务都保留。Minecraft 实例仍由 `packages/games/minecraft` 管理。

## 小鱼共享工作入口（2026-10-14）

项目列表默认按账户共享；app_id 为原登记来源，旧 ID、节点与规范路径保持，消费方不重复创建目录。可选历史来源筛选仍存在；共享工作不再以来源标签排除当前账户项目。

构建只写仓库根 dist/packages/workspace/workspace/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
