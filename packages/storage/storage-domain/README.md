# `lfaa-storage-domain`

持有 Control Plane 结构化配置、事务边界与数据库迁移协调。SQLite 提供 schema 和关系约束；本包负责旧文件/SQLite 迁移状态、设置记录读写与有序升级。

`user_preferences` 仍保存在现有账户配置记录中；`guided_entry_completed` 是可选布尔字段，旧记录缺失时由 Preferences Owner 视为 `false`。不新增 SQLite 表或 schema 版本。

版本 31 是旧文件存储迁移协调点。对新库及旧数据，`retireLegacyFileTables()` 必须先完成会话与配置迁移，之后依序运行版本 32–73；浏览器最近网站表版本 61 只能在版本 60 的工作区迁移完成后创建。SteamCMD 服务端表为版本 62，账户 Agent 使用控制为版本 63，账户资料快照为版本 64，受信联系人与恢复请求为版本 65，DST Master/Caves 集群字段为版本 66，AI Host 沙箱策略为版本 67，账户共享 Skill 安装表为版本 68，AI 消息附件引用为版本 69，ChatGPT 式项目结构为版本 70，项目 App 关联为版本 71，账户背景图片可读文件名为版本 72；依赖表都必须在浏览器最近网站迁移后调用。版本 69 只给 `ai_messages` 增加 `attachments_json`（附件 ID/名称，不含字节），表不存在时只推进版本。版本 72 只给 `appearance_backgrounds` 添加按账户唯一的 `storage_filename`，缺表时只推进版本。版本 73 幂等补齐 v70 项目 schema 的历史缺口，并回填尚未登记源目录的本机项目；其调用发生在版本 70–72 迁移之后。已迁入用户文件的设置在重复启动时以实际 SQLite 投影为准，不得把进程内合并的文件设置误判为待迁移 SQL 行。不要在 `storage-sqlite` 导入时越过尚未完成的版本 31，也不要单独修改 `user_version`。

最近网站本体归 Browser Owner；本包只负责按账户保存 `browserUse.recordRecentSites` 设置并协同 SQLite schema 版本。构建只写仓库根 `dist/packages/storage/storage-domain/`。

Agent 使用限制策略、时段与每日额度由 Identity/Auth Owner 校验和消费；本包仅负责按顺序执行 SQLite 迁移，不实现账户策略或配额规则。

账户资料快照由 Settings Snapshots Owner 创建、校验、读取和删除；表按 `user_id` 隔离，快照归档字节由该 Owner 进行压缩、摘要核对及大小限制。本包只建立表和索引。

受信联系人关系、一次性邀请摘要和经确认的恢复请求由 Identity/Auth Owner 校验；本包只建立账户外键、短期凭证摘要字段与查询索引。

`user_settings` 分类白名单包含 `mini`；配置记录仍按 `(user_id, category)` 隔离，不引入 Mini 窗口运行状态或额外设置表。

通用 `configuration_records.user_id` 允许 `null` 表示 system scope；`ai_accounts` 的系统 Provider 与模型记录使用该 scope，由 Settings Owner 校验并管理，账户凭据和账户设置的原有归属不变。SQLite 行键仍以 `table_name + record_key` 唯一，不靠用户外键区分 system 配置。
