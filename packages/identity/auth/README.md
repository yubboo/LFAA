# `lfaa-identity-auth`

账户、认证凭据、角色与恢复流程的唯一 Identity Owner。公开服务以已认证账户 ID 为边界，不接受调用方自行声明的账户角色。

`account-agent-usage.ts` 管理普通成员账户的 Agent 使用策略。管理员可以设置 IANA 时区、每周七天允许时段和每日累计分钟数；成员只能读取自己的策略与用量。管理员不能把策略应用到管理员或超级管理员账户。Agent Loop 在 Provider 首次请求前取得事务预留，并用同一个租约限制本轮模型与工具运行；结束时写入实际持续时间，达到窗口或额度时中止运行。每日用量不修改 `permissions.mode`，也不创建第二种审批流程。

SQLite 表和版本迁移归 `storage-sqlite`，有序迁移调用归 `storage-domain`。使用偏好无策略时默认关闭限制；没有策略时现有账户行为保持不变。时区、时段或用量记录损坏时拒绝开始受限运行，不静默放宽。

构建只写仓库根 `dist/packages/identity/auth/`。
