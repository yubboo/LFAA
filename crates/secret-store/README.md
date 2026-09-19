# secret-store

`crates/secret-store` 是 LFAA 的 OS Secret Broker。

职责：

- Rust 直接对接操作系统 Secret Store；
- Windows 使用 Generic Credential（`CredWriteW / CredReadW / CredDeleteW`）；
- `put` 必须写后回读校验；
- Web / Desktop / CLI 通过稳定 Broker 协议复用，不各写一套 Secret 实现。

边界：

- Secret 只从 stdin 二进制帧进入 Broker；
- 禁止 argv / 环境变量 / URL / 普通文件 / 日志传 Secret；
- TypeScript 只持有 `credentialRef` 和短生命周期明文；
- 当前 v0.0.73 先正式实现 Windows，macOS Keychain / Linux Secret Service 后续在本 crate 增加平台 backend。

二进制入口：`lfaa-secret-broker`。
