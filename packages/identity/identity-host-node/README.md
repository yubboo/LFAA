# @lfaa/identity-host-node

Node 本地 Identity Provider。将身份长期真值保存到 `LFAA_HOME/state/identity`，使用 scrypt 保存密码散列，AuthSession 只持久化 token 哈希。

本包不设置 HTTP Cookie，不渲染 UI，不管理 AI Provider Credential。
