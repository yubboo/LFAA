# LFAA Harness 混合存储

## 当前决定

2026-09-30 用户将此前“全部文件权威存储”的选择改为混合存储：Agent 会话/轨迹使用 JSONL，配置使用文件，账户/权限/任务使用 SQLite。这是当前实现合同；旧的全文件转换草稿不参与产品装配。

目录沿用 DSH 的 `storage/storage-json`、`storage/storage-domain`、`session/session-persistence-jsonl`，由普通包及 `bundle/base/cordis.patch.yml` 装配。上游目录对标不等于已实现全部上游功能。

## 权威归属

| 内容 | 权威载体 | 实现与边界 |
|---|---|---|
| 用户分域设置、应用/模式偏好、Provider 配置、Minecraft/SteamCMD 默认目录和节点覆盖 | `<数据根>/storages/configuration.json` | `storage-domain/configuration.ts`；9 个配置域，原子替换，保留账户归属和 Provider 单激活约束 |
| Cordis 可选模块停用覆盖 | `<数据根>/storages/plugin-runtime.json` | `boot/app-boot/plugin-runtime.ts`；`version: 1`、`disabledPluginIds: []` 默认继承 Profile 启用状态；仅管理员可改，系统级共享，启动时读取并在运行中原子写入 |
| 会话头、消息、Agent 活动、真实 Token 用量 | `<数据根>/sessions/<会话 ID SHA-256>/events.jsonl` | `session-persistence-jsonl`；追加变更、同步刷盘、序列与前序校验和、幂等迁移和重放 |
| 账户、登录会话、角色与权限、审批/授权、节点、实例与任务、写作正文/修订、背景图片 | `<数据根>/database/lfaa.sqlite` | `storage-sqlite`；事务、外键、账户与任务业务合同继续有效 |
| 会话头的权限外键与已提交日志修订 | SQLite `ai_sessions` | JSONL 的投影，用于现有审批外键及完整性检查；消息和用量不写回数据库 |
| JWT、节点 Token、Provider 加密密钥 | `<数据根>/credentials/` | 保留原凭据；Provider 密文存入配置文件，明文不下发前端或日志 |
| 节点游戏文件、世界存档、运行环境、节点备份 | 对应节点自己的内容目录 | Daemon 执行；配置改名和存储迁移不移动游戏数据 |

没有安装 PostgreSQL、Cosmos DB、向量数据库或可选全文索引。SQLite 在这个混合方案中承担控制面权威存储，并非仅搜索索引。写作正文继续由现有业务服务和 SQLite 保存；本轮 JSONL 迁移范围是 Agent 会话与轨迹。

## 迁移与恢复

1. SQLite 0–30 的顺序迁移链保留，仅用于真实旧数据升级，不作为新配置/会话的运行入口。
2. 首次把 9 个配置域原样导入 JSON，回读比较；逐会话导入消息、活动和用量，回放并逐记录验证。
3. 生成 `storages/session-migration.json`，保存迁移数量与时间。
4. 退役旧表之前用 `VACUUM INTO` 生成完整 SQLite 恢复副本，放在 `credentials/storage-migration-backups/`。
5. 在 SQLite 事务中删除已经迁入文件的旧权威表，为会话头新增 `jsonl_revision`，提交 `user_version=31`。以后只使用文件配置和 JSONL 会话仓库。

版本 31 是文件存储完成的边界；并行 Agent 任务正在加入版本 32 的通用工作区合同，可在文件迁移完成后继续升级。本轮不覆盖该后续迁移，存储回归按文件权威与日志投影检查，不把整个数据库永久锁定在版本 31。

升级后配置文件或迁移标记缺失会拒绝启动，不能从已经退役的旧表“恢复默认值”。损坏 JSON、日志校验和失败和缺失已提交历史均明确失败。只允许截掉未完成的 JSONL 末行；重启把尚在 streaming 的回复记录为 interrupted。

文件与 SQLite 没有跨介质原子事务：会话事件先刷盘，再提交投影，崩溃后重放文件恢复投影；写入失败停止继续使用旧缓存，要求重启恢复。不要在运行中只替换某个存储文件。完整恢复应停止控制端并从同一时间点的数据树恢复配置、JSONL、SQLite 和凭据；迁移前的 SQLite 恢复副本是旧版回退材料，不能单独覆盖新版活动数据库。

配置和会话文件由单个控制端进程持有写锁；多个 Agent 通过该进程的 API 提交。第二个控制端不能并行写同一根目录；仅确认原 PID 已退出后，在 SQLite 控制事务内回收崩溃遗留锁。远程 Daemon 不直接读写控制端文件或共享 SQLite。

## 设置中心盘点

沿用 General、Appearance、Shortcuts、AI Runtime、Permissions、Plugins、应用/模式与布局偏好、Provider/模型及推理参数、Minecraft/SteamCMD 默认目录和节点覆盖、项目数据根目录配置。现有 71 项叶子默认值和前端映射保持原合同；主题、颜色、字体、字号、壁纸、遮罩、模糊、对比度及减少动态效果仍由原 UI 消费。插件页沿用账户级 `plugins.enabled` 控制 AI Work 是否使用已登记扩展；Cordis 模块启停属于控制端全局运行合同，存入 `plugin-runtime.json`，默认停用列表为空，Profile 锁定项不能被用户覆盖。完全权限模式不增加逐项审批，Shell 读取 `general.integratedShell`。

本次实际回归检查主题/模糊/权限模式持久化、Provider 密文解密与单激活、账户隔离与删除、旧库升级、重启、截断/篡改保护和单写者互斥。没有重新执行浏览器视觉验收，不把服务端持久化测试说成外观验收。
