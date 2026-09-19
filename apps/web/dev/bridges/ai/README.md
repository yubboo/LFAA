# Web AI 配置 Bridge

本目录只属于 **Web 开发宿主 Adapter**，把浏览器同源设置请求接到 `@lfaa/config-system` 的 Account Service。

## 负责

- `ai-config-bridge.ts`：Vite localhost 路由与脱敏 JSON；
- `account-state-repository.ts`：`.lfaa/state/ai-accounts.json` 账户元数据；
- `rust-secret-store.ts`：构建/调用 `lfaa-secret-broker`，Secret 只通过二进制 stdin 传输；
- `node-http-json.ts`：宿主侧 Provider HTTP JSON 请求。

## 不负责

- Provider Base URL / 模型能力 / 认证业务（归 `packages/config-system/src/settings/ai/providers`）；
- React UI（归 `packages/ui`）；
- Win32 Credential API（归 `crates/secret-store`）；
- 模型推理 Runtime；
- 最终 SQLite Config Storage。

## Secret 规则

浏览器 Secret 只通过 localhost 请求体短暂进入 Host。Windows 下由 Rust Secret Broker 调用 Credential Manager；Secret 不进入 argv、环境变量、日志或普通文件。账户状态 JSON 只允许 `credentialRef`。Provider 远端错误体不直接返回 UI。
