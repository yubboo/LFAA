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

## 性能与资源预算

- Config Schema 实现前必须在 Plan 固定配置读写、启动加载和 Migration 的数据规模与 P95 预算；
- SQLite 必须定义 WAL、busy timeout、事务、并发写和损坏恢复策略；
- 性能回归超过 Plan 阈值时不得进入 `deliverable`。

## 项目资源作用域

- Skills、Experts、Plugins、Extensions、MCP 只从当前项目 `.lfaa/` 解析；
- Config System 不读取或创建用户级全局 LFAA 资源目录；
- `.lfaa/` 只保存项目资源元数据与非 Secret 内容。

## 第三方来源与归属

- 新增依赖、迁移工具或参考实现时必须记录作者、来源、许可证和修改内容；
- LFAA 自有新组件遵守 `@lfaa/*` / `lfaa-*` 命名与作者“二鱼”的归属规范。

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

从 `v0.0.2` 开始迭代。
