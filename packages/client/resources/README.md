# Client Resources

本包持有 Client 共享资源协议。`notification-runtime.ts` 管理浏览器通知、提示音、打开会话事件，以及由独立工作区发起的 AI Work 目标事件；目标请求由 Workbench 转交现有 AI Work/Agent Loop，事件本身不执行工具、不保存权限，也不创建并行审批。

插件管理页的安装、启用、停用和卸载意图通过 `requestAiWorkGoal()` 进入小鱼智能体。Agent Loop 仍根据当前用户目标选择 Core Tools；Capability Owner 和 Permission Owner 决定输入、审批、实际操作与回读。此包不持有插件状态或业务执行规则。

构建只写仓库根 `dist/packages/client/resources/`。UI/连接器构建和真实 Agent、浏览器验收分别记录。
