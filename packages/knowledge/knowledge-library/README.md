# LFAA Markdown 资料库

本包是账户与 App 隔离的 Markdown 知识、Skill、Prompt 和领域专家资料 Owner。正文以 UTF-8 Markdown 原子保存在 `<LFAA_DATA_DIR>/users/<账户 SHA-256>/knowledge/<scope>/<条目 ID SHA-256>.md`，旁边的元数据文件保存版本、正文 SHA-256 与更新时间。SQLite 保留账户/App/类型/标题/摘要/哈希等索引和项目来源关系；正文列只保留 schema 允许的单空格标记。迁移和读取均校验 SHA-256，缺失或损坏的文件不会返回正文。本地目录只保存到用户本人已登记的 Workspace/Minecraft 项目引用，不复制项目文件。

AI 通过独立能力插件按需搜索和读取。正文不会随每轮请求自动进入模型上下文；搜索只返回少量片段，完整读取有字符上限。所有 Markdown 与项目文件均视为不可信资料，不会获得 Tool、MCP、权限或代码执行能力。

`searchKnowledgeLibrary()` 是异步 Owner 合同：按账户/App 与类型筛选最多 128 条记录，逐篇异步回读正文文件并校验 SHA-256，再按标题、说明和正文关键词/中文 bigram 排序，最多返回 4 条片段。读取有界且不并发打开整库文件；搜索结果不替代正文文件，也不绕过篡改校验。Agent Tool 装配层负责 `await` 搜索结果，不在模型上下文中预载入完整资料。

GitHub Agent Skill 安装使用本 Owner 的账户级共享存储与 `knowledge_library_skill_installations` 元数据表；文件位于同一用户哈希目录下的 `knowledge/skills/<安装 ID 哈希>/`，而不写入当前项目。Skill Registry 的账户 Provider 按 `userId` 发现清单并按需读取 `SKILL.md` 与受限文本资源。Owner 固定来源 commit 和归档摘要、逐文件记录 SHA-256；最多每账户 128 条、每条 128 个文件、总计 5 MiB、单文件 2 MiB。按安装 UUID 和当前账户精确卸载，只清理该条目的哈希目录；同名不覆盖。项目目录中的 Skill 仍由项目 Skill Provider 按既有优先级发现。

设置中心的 `plugins.enabled` 控制 AI 资料库工具，`permissions.mode` 控制保存审批。GitHub/网页检索沿用当前账户配置的 MCP 服务与 App 范围，不在本包另建联网客户端。
