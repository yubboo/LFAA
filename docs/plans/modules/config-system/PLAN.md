# config-system PLAN

## 当前状态

```text
planned
```

## 目标版本

```text
v0.0.2+
```

## 开发目的

建立 LFAA 第一个正式业务模块：配置系统。

## 子模块与顺序

0. `web-workbench-shell`（用户要求的本地 UI 验证前置，不拥有 Config 事实状态）
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

## 开发前置硬门禁

- 真实 TypeScript typecheck、测试和 build 不得使用成功占位命令；
- Node.js 依赖和 workspace 命令只允许 pnpm；
- Config Schema 必须版本化且只有一个事实源；
- Migration 必须事务化、可重复验证，并具有失败恢复方案；
- SQLite 写入必须定义原子性、并发和损坏恢复策略；
- API Key / Token 不得进入普通配置、日志、Trace、错误信息或模型上下文；
- 配置读写和迁移必须在进入实现前定义可量化性能预算。

## 验收

- 配置有唯一 Schema；
- 配置可持久化；
- 配置迁移可测试；
- Model/Account/Permission 配置边界清晰；
- UI 与配置业务分离；
- Secret 不进入 SQLite 明文字段；
- 测试完成；
- 安全、性能和质量门禁通过。


## UI 前置任务边界

`web-workbench-shell` 只负责提供：

- Vite 本地 Web 开发入口；
- 三栏工作台框架；
- Resizable / Collapse UI；
- `.lfaa` 开发期只读资源刷新。

它不实现 Config Schema / Storage，不改变 Config System 的状态 Owner。
