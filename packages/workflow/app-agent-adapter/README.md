# `lfaa-workflow-app-agent-adapter`

为已登记的非 Minecraft App 各自注册 `<appId>.agent` 工作流节点。每个节点只读取当前 App 经 Permission/Settings 过滤后的 `AiBusinessTool` 目录，并通过 Agent Loop 执行；节点选择项不是授权，参数、风险、审批和结果继续归属原工具与 Owner。Minecraft 保留独立节点适配器及其 EULA 处理。

未启用时保留已保存图与未知节点配置，工作流 API 返回真实不可运行状态；本包不拥有工作流、Agent、工具或 App 业务数据。

构建输出写入仓库根目录 `dist/packages/workflow/app-agent-adapter/`。
