# `lfaa-tool-workflow`

为模型驱动 Agent 提供当前账户、当前 App 的工作流节点与引擎目录、定义保存、运行跟踪和取消工具。

本包只负责把模型工具合同接到 `lfaa-workflow`。图校验、账户/App 隔离、文件与 SQLite 持久化、运行状态及执行由 Workflow Owner 管理；Minecraft 节点仍委派现有 Agent Loop、Tools、Permission 和 Daemon。写入、执行与取消走 `lfaa-tools` 的统一权限流程。

工作流 Agent 节点的澄清复用当前对话 Run 的问题通道。涉及 Minecraft 开服 EULA 时，运行前明确询问用户；回答同意后才向 Workflow Owner 传递本次确认。父 Run 取消会请求取消工作流，但不会回滚已派发的节点副作用。

此包不添加节点、引擎或权限模式。没有已注册领域节点的 App 不能通过本包执行未知能力。

构建输出由工作区脚本写入根目录 `dist/packages/workflow/tool-workflow/`。
