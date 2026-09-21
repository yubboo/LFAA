# @lfaa/identity

LFAA 本地实例身份领域契约。这里定义 User / Role / Permission / AuthSession、First Run 初始化与 Identity Host 接口。

- 第一个账号只能通过 First Run 创建，并固定获得 `super_admin`。
- Login Session 使用 `AuthSession` 命名，禁止与 Workspace Session 混用。
- Password/Token 明文不属于本包公共状态。
- Role 是 Permission 集合；业务代码禁止依赖 `if (role === ...)` 作为最终授权依据。
