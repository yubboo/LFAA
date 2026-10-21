# LFAA 项目 Skill 安装适配器

`lfaa-capability-skill` 是通用能力路由下的 `skill` 类型 Owner 适配器。它通过 GitHub 官方仓库 API 检索候选，将检查固定到 commit 与源码归档 SHA-256，选择仓库内单个 `SKILL.md` 目录，并通过现有 `project_file_operation` 原子创建到当前项目 `.agents/skills/<name>/`。本机项目由 LFAA Host 执行；显式远程项目才由对应 Daemon 执行。

Skill 内容只作为不可信文本安装；来源脚本不会执行。检查会静态列出常见脚本文件及 `package.json` 中依赖名和 script 名称，并把“仅复制、不执行/不安装”放进安装审批摘要。静态清单不证明这些脚本、依赖或外部服务可运行。当前仅接受每项目 Skill 目录至多 128 个、合计不超过 8 MiB 的 UTF-8 文本文件。安装后由通用能力核心再次调用项目文件 Owner `discover_skills`，按 Skill 名称与安装路径回读确认；`ready` 只表示 SKILL.md 已真实发现、可按需加载，不表示其脚本/依赖/浏览器等外部运行时已通过连通验证。项目目标来自当前会话关联项目，检查和安装之间项目、执行位置或路径变化会被拒绝。

当前不提供更新、覆盖、启停和删除；已存在同名 Skill 时 Owner 拒绝覆盖。此适配器不表示 Prompt、Tool、MCP 或 Minecraft 模组类型已经接入。
