# LFAA Markdown 资料库

本包是账户与 App 隔离的 Markdown 知识、Skill、Prompt 和领域专家资料 Owner。正文以 UTF-8 Markdown 原子保存在 `<LFAA_DATA_DIR>/users/<账户 SHA-256>/knowledge/<scope>/<条目 ID SHA-256>.md`，旁边的元数据文件保存版本、正文 SHA-256 与更新时间。SQLite 保留账户/App/类型/标题/摘要/哈希等索引和项目来源关系；正文列只保留 schema 允许的单空格标记。迁移和读取均校验 SHA-256，缺失或损坏的文件不会返回正文。本地目录只保存到用户本人已登记的 Workspace/Minecraft 项目引用，不复制项目文件。

AI 通过独立能力插件按需搜索和读取。正文不会随每轮请求自动进入模型上下文；搜索只返回少量片段，完整读取有字符上限。所有 Markdown 与项目文件均视为不可信资料，不会获得 Tool、MCP、权限或代码执行能力。

设置中心的 `plugins.enabled` 控制 AI 资料库工具，`permissions.mode` 控制保存审批。GitHub/网页检索沿用当前账户配置的 MCP 服务与 App 范围，不在本包另建联网客户端。
