# #20 开发日志分层规范

- **主编号：** #20
- **名称：** 开发日志分层规范
- **最新变更：** #20.1
- **状态：** active
- **关键词：** 日志、索引、命名、中文、归档、历史
- **当前文件：** `docs/logs/development/active/0020-dev-logs.md`

## 当前结论

Development Log 不允许只保留最新主编号。

当前规则：

1. 所有真实存在的主编号都必须在 `INDEX.md` 中可直接找到；
2. 当前仍生效的任务放 `active/`；
3. 已交付或历史任务放 `archive/`；
4. 原 Prompt / Progress / Changelog / Release 不删除；
5. 同一主编号的新修正继续使用 `#NN.x`；
6. 被替代的旧子版本必须保留并指向当前 active；
7. 主编号从 #1 开始，不能出现无记录缺号。

## 最新变更

### #20.1 历史编号迁移

修复 #20.0 的不足：

- #1 - #19 已逐条纳入 Development Log；
- #2 因仍是当前主业务模块，放入 `active/`；
- #1、#3 - #19 放入 `archive/`；
- #20.0 自身保存为历史快照；
- `INDEX.md` 现在可以直接搜索每一个主编号；
- Dev Log Check 增加主编号连续性检查。

## 影响范围

- `docs/logs/development/INDEX.md`
- `docs/logs/development/active/`
- `docs/logs/development/archive/`
- `docs/standards/DEV_LOGS.md`
- `scripts/dev-log-check.mjs`
- `DEVELOPMENT.md`
- `AGENTS.md`

## 验证结果

- #1 - #20 均能在 Development Log 索引中找到；
- #2、#20 为 active；
- #1、#3 - #19 为 delivered history；
- #20.0 已保留，可与 #20.1 直接对比；
- 原历史来源文件仍全部存在；
- Governance / Import / Dev Log Check 通过。

## 历史索引

| 版本 | 状态 | 路径 |
|---|---|---|
| #20.0 | superseded | `archive/0020-dev-logs/0020.0-dev-logs.md` |
| #20.1 | active | `active/0020-dev-logs.md` |
