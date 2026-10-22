# `lfaa-storage-domain`

持有 Control Plane 结构化配置、事务边界与数据库迁移协调。SQLite 提供 schema 和关系约束；本包负责旧文件/SQLite 迁移状态、设置记录读写与有序升级。

版本 31 是旧文件存储迁移协调点。对新库及旧数据，`retireLegacyFileTables()` 必须先完成会话与配置迁移，之后依序运行版本 32–61；浏览器最近网站表版本 61 只能在版本 60 的工作区迁移完成后创建。不要在 `storage-sqlite` 导入时越过尚未完成的版本 31，也不要单独修改 `user_version`。

最近网站本体归 Browser Owner；本包只负责按账户保存 `browserUse.recordRecentSites` 设置并协同 SQLite schema 版本。构建只写仓库根 `dist/packages/storage/storage-domain/`。
