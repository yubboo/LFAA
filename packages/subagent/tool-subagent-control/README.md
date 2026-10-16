# lfaa-tool-subagent-control

Control Plane 第一方子任务列表、结果与取消工具。`lfaa_list_subagents` 返回本账户活动句柄及当前会话持久化摘要；`lfaa_get_subagent_result` 按来源会话读取真实结果，wait=true 等待现有任务，不重复派发；取消等待只撤销读者监听。`lfaa_cancel_subagent` 继续通过原权限 Owner 执行危险取消。

查询校验账户和父会话来源；终态结果由 Session 提供，丢失执行器的未完成记录报告中断，不重放。列表不带答案正文，结果遵守 Session 有界存储合同。注册可撤销，等待撤销 AbortSignal 监听；不复制状态库或权限。coreManaged 不受第三方开关隐藏，用户权限与范围不变。

依赖见 package.json，注入 lfaaTools/lfaaSubagents/lfaaSessions，base Bundle 装配。构建只写根 `dist/packages/subagent/tool-subagent-control/`；直接回归见 `apps/cli/tests/subagent-background.test.mjs`，真实模型/CLI/桌面证据见合同。
