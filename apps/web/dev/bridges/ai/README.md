# Web AI 配置 Bridge

本目录只属于 **Web 开发宿主 Adapter**，把浏览器同源设置请求接到 `@lfaa/config-system` 的 Account Service。

## 负责

- `ai-config-bridge.ts`：Vite localhost 路由与脱敏 JSON；
- `account-state-repository.ts`：`.lfaa/state/ai-accounts.json` 账户元数据；
- `windows-credential-manager.ts`：Windows Credential Manager Generic Credential；
- `node-http-json.ts`：宿主侧 Provider HTTP JSON 请求。

## 不负责

- Provider Base URL / 认证业务（归 `packages/config-system/src/settings/ai/providers`）；
- React UI（归 `packages/ui`）；
- 模型推理 Runtime；
- 最终 SQLite Config Storage / Rust Secret Broker。

## Secret 规则

浏览器 Secret 只通过 localhost 请求体短暂进入 Host。Windows 下进入 Credential Manager；账户状态 JSON 只允许 `credentialRef`。Provider 远端错误体不直接返回 UI，避免回显请求或凭证信息。
