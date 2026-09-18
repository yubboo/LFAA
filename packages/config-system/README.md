# Config System

## 目录

`packages/config-system`

## 作用

LFAA 配置系统的公开业务边界。v0.0.51 / #2.2 首先只实现 `config-schema`：版本化配置类型、默认值和运行时校验。

## 当前负责

- `LfaaConfig` 根配置契约；
- Config Schema Version 单一事实源；
- App Settings；
- Local / Remote Runtime Mode；
- Model Provider / Model 元数据；
- Account Metadata 与 `credentialRef`；
- Permission Default；
- 默认配置；
- 纯内存运行时校验。

## 当前不负责

- SQLite / Drizzle / Config Storage；
- Migration 执行器；
- API Key / Token / Password 等 Secret 明文；
- Rust Secret Store；
- Config UI；
- Agent / Tool / Policy / Permission 的执行逻辑。

## 对外 API

统一从 `src/index.ts` 导出。包外禁止直接引用内部文件。

## 状态归属

Config Schema 的结构与 Schema Version 只由本包拥有。后续 Storage 只能持久化该 Schema，不得另造第二套配置结构。

## 安全边界

账号配置只允许保存 `credentialRef`。真实 Secret 必须由后续 Rust Secret Broker / OS Credential Store 持有。

## 修改要求

修改前先读取 `AGENTS.md`、`DEVELOPMENT.md`、`docs/PROMPTS.md` 的 #2 当前合同、`docs/MODULES.md` 的 config-system 章节。
