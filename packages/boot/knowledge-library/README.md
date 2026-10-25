# AI Markdown 资料库运行适配器

把 `lfaa-knowledge-library` 的账户资料 Owner 接入现有 AI Tool 注册表，按当前 App 搜索、分页读取、明确请求后保存。用户正文不预载入模型上下文；项目目录搜索经既有 Project Files Tool 与其项目执行位置（LFAA 本机 Host 或明确选择的 Daemon）执行。

工具作为可选扩展注册，遵守设置中心 `plugins.enabled` 与 Agent Loop 的现有风险/审批合同。外部 GitHub 与网页搜索仍由用户配置并核验的 MCP 工具提供，本包不建立第二个联网客户端。

本适配器还把 `lfaa-knowledge-library` Owner 管理的账户共享 Skill 接入现有 `ctx.skills` Registry：仅列出当前 `userId` 的摘要；加载时由 Owner 按安装 ID、名称和内容 SHA-256 回读；附属文本资源仍按 Owner 的相对路径/大小/摘要边界读取，脚本不执行。安装、更新和卸载不归本包处理；本包通过 `lfaa-skill` 依赖及 Base Bundle 的 `skills` 注入复用既有 Skill Registry。
