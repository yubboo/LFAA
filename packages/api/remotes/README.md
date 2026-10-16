# api/remotes

## 小鱼共享工作入口（2026-10-14）

共享 API 输入合同：可选关联只接受有界 App/能力 ID 引用，不接收正文或权限变更。

构建只写仓库根 dist/packages/api/remotes/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

实际验收发现心跳合同漏登 node-filesystem-instance-v1 和 node-filesystem-game-storage-v1，已与真实 Daemon 声明对齐；未知能力仍拒绝，未放宽通配字符串。
