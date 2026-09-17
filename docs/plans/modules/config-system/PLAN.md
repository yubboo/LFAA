# config-system PLAN

## 当前状态

```text
planned
```

## 目标版本

```text
v0.02+
```

## 开发目的

建立 LFAA 第一个正式业务模块：配置系统。

## 子模块与顺序

1. `config-schema`
2. `config-storage`
3. `settings`
4. `model-management`
5. `account-management`
6. `permission-settings`
7. `config-ui`
8. tests
9. docs
10. delivery review

## 负责

- App Settings
- Model Provider 配置
- Model 配置
- Account Metadata
- Credential Reference
- Permission Default
- Local/Remote mode 配置
- 配置迁移

## 明确不负责

- 真实 Secret 明文保存
- Agent Loop
- Tool Runtime
- MCP
- Plugin Marketplace
- Knowledge UI

## 依赖

- `@lfaa/domain`
- `@lfaa/protocol`
- 后续 SQLite Repository
- Secret 只存 `credential_ref`

## 验收

- 配置有唯一 Schema；
- 配置可持久化；
- 配置迁移可测试；
- Model/Account/Permission 配置边界清晰；
- UI 与配置业务分离；
- Secret 不进入 SQLite 明文字段；
- 测试完成；
- Progress/Changelog 同步。
