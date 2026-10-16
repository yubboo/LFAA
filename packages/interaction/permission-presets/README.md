# Permission Owner

本包是 AI Tool 操作授权、单次审批、记忆授权及撤销的唯一 Owner。它读取 Settings Owner 中的 `permissions.mode`，按账户、App、工具版本、风险和稳定目标范围授权；不执行工具，也不决定插件、文件或节点的业务规则。

自然语言动作通过 `authorizeAiTool`、`requestAiToolApproval`、`decideAiToolApproval` 和 `consumeAiToolApproval` 完成审批闭环。应用内显式操作通过 `authorizeExplicitUserAction` 校验登录用户、可执行状态、App 范围及稳定目标；对应页面上的启用/停用按钮点击构成该项单次授权，不创建 Agent Run 或聊天消息。两种入口最终调用同一领域 Owner，应用入口不另建审批存储或业务执行器。

运行位置为 Server Host；设置归 `lfaa-settings`，审批与记忆归 SQLite，Agent Loop 和认证 Controller 是调用方。危险级别及稳定目标范围由受信任调用者提供，来源材料不能自行扩大权限。审批记录只保存目标哈希与有限摘要，不保存完整参数或秘密。数据库写入使用事务；撤销记忆时递增 generation，使待处理审批不能复活旧授权。

长期回归位于 `apps/cli/tests/` 的授权、Agent Runtime 与相关业务 Controller 测试。启停、撤销、错误与账户隔离由 Permission Owner 回归覆盖；源码和构建成功不代表浏览器或真实 Runtime 已验收。
