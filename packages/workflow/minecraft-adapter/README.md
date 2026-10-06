# `lfaa-workflow-minecraft-adapter`

将 Minecraft `Agent` 节点注册到通用 `lfaa-workflow`。运行仍由 `Agent Loop`、Minecraft Business Tools、权限/审批和 Minecraft Host Owner 完成；本包不拥有第二套工具或 Agent Runtime。

该适配器是独立 Cordis 模块，可停用。停用时其节点类型从 Registry 撤销，已保存定义保留且会被标记不可运行；启用后按原版本合同恢复解析。

构建输出由工作区脚本写入根目录 `dist/packages/workflow/minecraft-adapter/`。
