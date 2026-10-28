# Agent 交付物发布工具

本包仅登记一个 Agent Tool：`deliverables.publish` / `deliverable_publish`。模型明确发布已完成文件时，工具使用当前 Run 注入的本机 Agent Git 仓库和 Project Files Host 检查普通文件、摘要和大小，然后调用 `workspace-changes` Owner 保存索引。Minecraft JAR 可登记为 `minecraft-plugin` 或 `minecraft-mod`，该类型驱动资产库分类；文件字节不进入模型工具结果或 SQLite。Minecraft 专家只在真实构建成功后发布 JAR。

Tool 仅属于 `workspace`，路径必须相对当前 Agent Git 根目录，当前 Run 必须绑定会话和本机 Host 执行器。风险经现有 Permission Owner 归类为写操作；没有新审批流程或额外权限模式。

构建只写仓库根 `dist/packages/deliverables/tool-present/`。
