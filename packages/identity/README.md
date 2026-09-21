# Identity capability family

LFAA 实例级身份与访问控制 Owner。负责 First Run Super Admin、用户、角色、权限、AuthSession 与本地身份持久化；不负责 AI Provider Credential、Workspace Session、App Pack 业务数据。

依赖方向：`@lfaa/identity` → `@lfaa/identity-host-node` → `@lfaa/identity-controller`，浏览器展示由 `@lfaa/identity-ui` 消费公共契约。
