# lfaa-subagent

Control Plane 的子 Agent 驱动注册与活动任务 Owner。Manager 持有实际驱动和有界运行句柄，提供 start/listRuns/getRun/cancelRun；不实现模型循环、领域业务或第二套账户/权限。预取消不派发驱动，取消后的返回不得记成成功，驱动失败转换为真实结果。

句柄按账户隔离，最多追踪 64 项，槽位满时只淘汰终态记录；Driver 随 Cordis 生命周期登记/撤销，close 请求停止活动任务并清空句柄。模型/工具/数量/深度预算由原 Agent Loop 委派入口决定。进程内与外部驱动的可用性分别验收，登记不等于 CLI 已安装。

依赖与入口见 package.json，默认 base Bundle 装配；tool-subagent/control 消费此服务。Manager 从 `lfaaWin32Process` 接收进程树停止能力，并传给外部驱动；子 Agent 取消不自建进程管理器。持久化来源/结果归 Session Owner，Manager 句柄不冒充重启恢复。没有新增设置。构建只写根 `dist/packages/subagent/subagent/`。直接回归见 `apps/cli/tests/subagent-background.test.mjs` 与 `apps/cli/tests/subagent-process-control.test.mjs`；真实模型、CLI、桌面及性能证据见任务合同。
