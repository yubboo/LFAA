# `lfaa-workflow-dag-engine`

提供工作流核心的默认确定性 DAG 执行引擎。它只负责按依赖顺序调度已注册节点、收集 typed port 输出、报告节点状态；不包含 App 业务、Agent、Tools、权限、审批或 Daemon 执行实现。

引擎通过 `registerWorkflowEngine` 注册，Cordis Owner 卸载时自动撤销。工作流文档只保存稳定 `engineId`；未安装或未启用对应引擎时保留定义并报告不可运行。

构建输出由工作区脚本写入根目录 `dist/packages/workflow/dag-engine/`。
