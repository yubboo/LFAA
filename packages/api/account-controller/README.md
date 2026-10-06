# 账户控制器

`lfaa-api-account-controller` 通过现有 Identity Owner 提供登录、注销、账户管理和通行密钥接口。凭据与登录会话继续由 `packages/identity/auth` 负责，认证闸门由 `packages/credentials/authorization` 提供。

账户自身读取已迁移为 Typert `auth/me` Remote：`src/client-contract.ts` 定义 Host/Client 共用的方法类型，账户插件把方法登记到 `lfaaTypertLoader`，方法只返回当前已认证会话用户，并再次核对输出字段。Client Connection 通过 Gateway 的登录保护路由读取；旧 `GET /auth/me` 已移除，避免保留第二条实现。DeepSeek Platform 登录尚未接入。
