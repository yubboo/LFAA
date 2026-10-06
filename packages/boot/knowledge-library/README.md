# AI Markdown 资料库运行适配器

把 `lfaa-knowledge-library` 的账户资料 Owner 接入现有 AI Tool 注册表，按当前 App 搜索、分页读取、明确请求后保存。用户正文不预载入模型上下文；项目目录搜索经既有 Project Files Tool 与 Daemon 执行。

工具作为可选扩展注册，遵守设置中心 `plugins.enabled` 与 Agent Loop 的现有风险/审批合同。外部 GitHub 与网页搜索仍由用户配置并核验的 MCP 工具提供，本包不建立第二个联网客户端。
