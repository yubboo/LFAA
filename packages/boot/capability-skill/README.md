# LFAA 项目 Skill 安装适配器

`lfaa-capability-skill` 是通用能力路由下的 `skill` 类型 Owner 适配器。它通过 GitHub 官方仓库 API 检索候选，将检查固定到 commit 与源码归档 SHA-256，选择仓库内单个 `SKILL.md` 目录（Skill 位于仓库根时包含其全部子目录），并通过现有 `project_file_operation` 原子创建到当前项目 `.agents/skills/<name>/`。本机项目由 LFAA Host 执行；显式远程项目才由对应 Daemon 执行。

Skill 内容只作为不可信文本安装；来源脚本不会执行。检查会静态列出常见脚本文件、来源声明的最低 Node 主版本、`package.json` 中依赖名和 script 名称，以及后台进程、浏览器远程调试/CDP、任意页面脚本执行、本机文件路径和用户目录持久化的文本线索，并把这些信息标为“仅来源声明/静态线索，未执行、需核验”放进检查与安装审批摘要。扫描只揭示来源文本中出现的标记，不证明行为存在或安全，也不证明目标执行环境、脚本、依赖或外部服务可运行。当前仅接受每项目 Skill 目录至多 128 个、合计不超过 8 MiB 的 UTF-8 文本文件。安装后由通用能力核心再次调用项目文件 Owner `discover_skills`，按 Skill 名称与安装路径回读确认；`ready` 只表示 SKILL.md 已真实发现、可按需加载，不表示其脚本/依赖/浏览器等外部运行时已通过连通验证。项目目标来自当前会话关联项目，检查和安装之间项目、执行位置或路径变化会被拒绝。

安装沿用当前 Agent Run 的 AbortSignal，并传递至 GitHub HTTP/Git 快照下载；固定快照返回后和项目文件 Owner `create_tree` 提交前再次检查取消，避免取消后的迟到下载结果写入项目。一次性检查凭证已由通用 Registry 消费，取消后应重新检查；若 Owner 已完成原子写入，则按实际项目文件清单恢复，不将已提交状态报告为回滚。

当前不提供更新、覆盖、启停和删除；已存在同名 Skill 时 Owner 拒绝覆盖。此适配器不表示 Prompt、Tool、MCP 或 Minecraft 模组类型已经接入。
