# Credentials

## 作用

`@lfaa/credentials` 是 LFAA 唯一通用凭据契约。模型配置、插件、MCP、外部 Harness 和未来 App Pack 都只能引用这里定义的 `credentialRef`，不得各自建立 Secret 存储。

## 边界

- 配置、Manifest、日志和 UI 安全视图只保存/展示 `credentialRef` 与 `CredentialInfo`，不保存 Secret 明文。
- `CredentialStorePort.get()` 只允许宿主/业务执行路径按操作读取；UI 不得获得该 Port。
- 当前 Windows Provider 是 Rust Secret Broker + Windows Credential Manager；其他平台未实现时不得退化为普通文件明文持久化。
- Secret 禁止进入 argv、普通环境变量、项目 JSON、`.lfaa` 可同步资源、Git 或诊断日志。

## 角色

这是 Capability Seam 的 **Service Definition**。OS Credential Store 属于 Provider；AI 配置与插件执行属于 Consumer。
