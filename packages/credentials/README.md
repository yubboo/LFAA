# packages/credentials

LFAA v0.0.100 capability family。这里按长期 Owner 聚合相关 package；family 本身不是运行时 package，也不因为规划就创建空实现。

当前 package：

- `credentials`
- `credentials-native`

通用规则：业务实现归 package；跨 package 只通过公开 `@lfaa/*` 接口；新增 package 必须有真实实现、当前 Consumer 与明确 Owner。详细职责见根 `ARCHITECTURE.md` 和 `docs/MODULES.md`。
