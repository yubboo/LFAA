# #2 配置系统

## 主模块

`config-system`

## 任务目标

按照 LFAA 开发规范，逐步完成配置系统，先完成整个配置系统达到可交付，再进入其他业务模块。

## 背景

LFAA 需要同时支持：

- 通用 Settings；
- Model Provider；
- Model；
- 多账号；
- API/OAuth/Local/官方允许的 Subscription Auth；
- Permission 默认策略；
- Local/Remote 配置；
- Secret Reference。

## 允许修改

- `docs/modules/config-system/**`
- `docs/plans/modules/config-system/**`
- `docs/progress/modules/config-system/**`
- 配置系统未来新增的明确 package/feature
- 如必须修改公共 Protocol，先在 Plan 记录

## 禁止修改

- Agent Loop
- Tool Runtime
- Knowledge
- MCP
- DSH Compatibility
- Subagent
- 无关 UI

## 状态所有权

配置事实状态必须由 Config Domain/Repository 唯一拥有。

React UI 只消费配置 ViewModel，不拥有配置事实真值。

## 开发顺序

1. Config Schema
2. Config Storage
3. Settings Domain
4. Model Management
5. Account Management
6. Permission Settings
7. Config UI
8. Tests
9. Optimization
10. Delivery

未经 Plan 记录，不跳步骤。

## 安全约束

- API Key/Token 不得明文存入普通 SQLite 配置表。
- 只保存 Credential Reference。
- Provider Adapter 不得把 Secret 写入日志。
- UI 不直接读取 Secret。

## 验收条件

- Schema 唯一；
- Storage 可迁移；
- Model/Account/Permission 清晰分层；
- UI 与业务状态分离；
- 测试通过；
- Progress/Changelog 完整；
- 状态达到 `deliverable`。

## CHANGELOG 编号

`#2 配置系统`

## 版本目标

从 `v0.02` 开始迭代。
