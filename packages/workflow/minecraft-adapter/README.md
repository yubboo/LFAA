# `lfaa-workflow-minecraft-adapter`

将 Minecraft `Agent` 节点注册到通用 `lfaa-workflow`。运行仍由 `Agent Loop`、Minecraft Business Tools、统一 Permission Owner 和 Minecraft Host Owner 完成；本包不拥有第二套工具或 Agent Runtime。工作流包含开服/部署工具时，Workflow Tool 在同一次权限摘要说明接受 Minecraft EULA 与所选核心许可；本包只校验 `eulaAccepted` 授权标记并传给节点 Agent，不另行询问用户。

该适配器是独立 Cordis 模块，可停用。停用时其节点类型从 Registry 撤销，已保存定义保留且会被标记不可运行；启用后按原版本合同恢复解析。

构建输出由工作区脚本写入根目录 `dist/packages/workflow/minecraft-adapter/`。
