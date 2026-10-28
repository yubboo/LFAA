# Agent 工作区产物登记

本包持有当前账户 Agent Git 项目中由 Agent 明确发布的最终产物索引。SQLite 保存会话来源、项目相对路径、Minecraft 插件/模组/其他类型、文件摘要、大小和时间；文件内容留在项目目录，由 Project Files Owner 校验和提供流式下载。本包不扫描猜测输出目录、不复制文件，也不管理 Git 状态。

公开合同：`publishAgentDeliverable`、`listAgentDeliverables`、`getAgentDeliverable`。同一账户、项目和相对路径再次发布时更新原条目。账户删除和 Agent Git 仓库解除登记按数据库外键清理索引，不删除项目中的原文件。

迁移 74 新增索引表，迁移 75 增加资产类型；构建只写仓库根 `dist/packages/deliverables/workspace-changes/`。
