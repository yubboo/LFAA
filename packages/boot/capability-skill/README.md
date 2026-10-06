# LFAA 项目 Skill 安装适配器

`lfaa-capability-skill` 是通用能力路由下的 `skill` 类型 Owner 适配器。它通过 GitHub 官方仓库 API 检索候选，将检查固定到 commit 与源码归档 SHA-256，选择仓库内单个 `SKILL.md` 目录，并通过现有 `project_file_operation` / Daemon 文件任务原子创建到当前项目 `.agents/skills/<name>/`。

Skill 内容只作为不可信文本安装；来源脚本不会执行。当前仅接受每项目 Skill 目录至多 128 个、合计不超过 8 MiB 的 UTF-8 文本文件。安装后由通用能力核心再次调用 Daemon `discover_skills`，按 Skill 名称与安装路径回读确认；发现后标记为目标项目 Agent 可按需读取。项目目标来自当前会话关联项目，检查和安装之间项目/节点/路径变化会被拒绝。

当前不提供更新、覆盖、启停和删除；已存在同名 Skill 时 Owner 拒绝覆盖。此适配器不表示 Prompt、Tool、MCP 或 Minecraft 模组类型已经接入。
