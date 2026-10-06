# LFAA Harness 混合存储

## 当前决定

2026-10-06 存储职责按数据类型拆分：账户设置和应用偏好使用账户隔离的原子 JSON；Agent 会话事件继续使用 JSONL；关系型业务数据继续使用同一个 SQLite 数据库；图片、工作流图定义和 Markdown 正文使用账户隔离的文件。各类别仍位于既有 `LFAA_DATA_DIR` 内。用户级安装的既定用户目录默认值、项目/便携运行跟随项目目录的规则、环境变量覆盖与迁移入口均保持不变。本次没有搬迁或合并数据根。旧整份 JSON 只作为旧版本导入/回退材料，不再接收运行期配置写入。

目录沿用 DSH 的 `storage/storage`、`storage/storage-json`、`storage/storage-domain`、`storage/storage-sqlite`、`session/session-persistence-jsonl`。`lfaa-storage-hub` 仅负责具名后端与数据形式注册；JSON、SQLite 适配器由独立插件装配到 `bundle/base/cordis.patch.yml`。上游目录对标不等于已实现全部上游功能。

## 权威归属

| 内容 | 权威载体 | 实现与边界 |
|---|---|---|
| 用户分域设置与应用/模式偏好 | `<数据根>/users/<账户 SHA-256>/settings/settings.json` | `storage-domain/configuration.ts` 是唯一业务 Owner；按账户校验、版本化 JSON、同目录原子替换。设置中心分类、默认值和前端映射不变 |
| Provider 密文、Minecraft/SteamCMD 默认目录和节点覆盖 | SQLite `configuration_records`、`configuration_credentials` | 继续由既有 Configuration Owner 按记录事务写入，保持账户归属、节点约束和 Provider 单激活规则 |
| 背景图片二进制 | `<数据根>/users/<账户 SHA-256>/assets/backgrounds/` | Settings Owner 校验 MIME/尺寸并验证 SHA-256；SQLite `appearance_backgrounds` 保留账户隔离媒体元数据，`image_data` 迁移后为零字节 |
| 工作流图定义 | `<数据根>/users/<账户 SHA-256>/projects/<appId>/workflows/` | `lfaa-workflow` 是唯一 Owner；SQLite 保留账户/App 索引、标题/时间、运行记录与关联，`definition_json` 留 schema 允许的 `{}` 占位值 |
| Markdown 知识/Skill/Prompt 正文 | `<数据根>/users/<账户 SHA-256>/knowledge/<scope>/` | `knowledge-library` 是唯一 Owner；SQLite 保留账户/App/类型/标题/摘要/哈希和项目来源关系，正文列留 schema 允许的单空格标记；读写校验 SHA-256 |
| Cordis 可选模块停用覆盖 | `<数据根>/storages/plugin-runtime.json` | `boot/app-boot/plugin-runtime.ts`；`version: 1`、`disabledPluginIds: []` 默认继承 Profile 启用状态；仅管理员可改，系统级共享，启动时读取并在运行中原子写入 |
| 会话头、消息、Agent 活动、真实 Token 用量 | `<数据根>/sessions/<会话 ID SHA-256>/events.jsonl` | `session-persistence-jsonl`；追加变更、同步刷盘、序列与前序校验和、幂等迁移和重放 |
| 账户、登录会话、角色与权限、审批/授权、节点、实例与任务、写作正文/修订、领域索引/关系和通用插件 KV | `<数据根>/database/lfaa.sqlite` | `storage-sqlite`；事务、外键、账户与任务业务合同继续有效；通用存储 Hub 的具名单元与 KV 记录使用隔离表，不接管上述领域 Owner |
| 会话头的权限外键与已提交日志修订 | SQLite `ai_sessions` | JSONL 的投影，用于现有审批外键及完整性检查；消息和用量不写回数据库 |
| JWT、节点 Token、Provider 加密密钥 | `<数据根>/credentials/` | 保留原凭据；Provider 密文存入 SQLite，明文不下发前端或日志 |
| 节点游戏文件、世界存档、运行环境、节点备份 | 对应节点自己的内容目录 | Daemon 执行；配置改名和存储迁移不移动游戏数据 |

没有安装 PostgreSQL、Cosmos DB、向量数据库或可选全文索引。SQLite 在这个混合方案中承担控制面关系数据权威存储，并非仅搜索索引。写作章节正文和修订继续由现有业务服务和 SQLite 保存；Markdown 知识正文与工作流图正文按领域文件保存；JSONL 权威日志范围是 Agent 会话与轨迹。

## 迁移与恢复

1. SQLite 0–30 的顺序迁移链保留，仅用于真实旧数据升级，不作为新配置/会话的运行入口。
2. 旧 SQLite 配置先按原有流程导入临时 JSON 并回读校验；逐会话导入消息、活动和用量，回放并逐记录验证。
3. 生成 `storages/session-migration.json`，保存迁移数量与时间。
4. 退役旧表之前用 `VACUUM INTO` 生成完整 SQLite 恢复副本，放在 `credentials/storage-migration-backups/`。
5. 在 SQLite 事务中删除已经迁入 JSONL 的旧消息/用量表和旧配置表，为会话头新增 `jsonl_revision`，提交 `user_version=31`。保留既有 32–46 顺序迁移。
6. v47 创建配置记录表、加密凭据表和迁移状态表。配置 Owner 校验 JSON 来源、账户/节点关联和每个记录后，在单个 SQLite 事务内导入并写入来源摘要与修订号；成功提交后 SQLite 成为唯一权威写入处。JSON 来源保留不变，启动时不再读取它。
7. v47 运行时按账户将旧 `user_settings`/`user_preferences` 行原子迁入设置 JSON，逐项读回一致后才删除对应 `configuration_records` 行；旧来源与新文件冲突时拒绝覆盖。背景 BLOB、工作流定义、Markdown 正文也在各领域首次访问时迁移并校验，然后把现有 SQL 列改为 schema 允许的占位值；不增加 schema 版本、表或索引。

版本 31 退役旧配置/消息表，版本 32–46 按顺序保留并扩展既有数据；44–46 增加通用工作流、App 作用域与当前节点记录。版本 47 创建结构化配置表和已加密 Provider 凭据表；当前运行时将账户设置/偏好放入用户文件，而 Provider 密文和 Minecraft/SteamCMD 目录配置仍在 SQLite。旧文件迁移逐项校验后才清理对应来源，最高支持数据库版本仍为 47。

v47 配置迁移前来源文件或 v47 状态标记缺失/损坏会拒绝启动，不能从已经退役的旧表“恢复默认值”。迁移完成后，账户设置/偏好来自用户 JSON；Provider 密文和节点目录配置来自 SQLite；遗留整份 JSON 即使损坏也不会覆盖已迁移数据。文件/SQL 双份设置内容不一致、文件损坏或校验失败均明确失败。JSONL 损坏、日志校验和失败和缺失已提交历史均明确失败。只允许截掉未完成的 JSONL 末行；重启把尚在 streaming 的回复记录为 interrupted。

配置、账户与权限共享 SQLite 原子事务；JSONL 会话事件先刷盘，再提交 SQLite 投影，崩溃后重放日志恢复投影。写入失败停止继续使用旧缓存，要求重启恢复。不要在运行中只替换数据库或会话日志。完整恢复应停止控制端并从同一时间点的数据树恢复 SQLite、JSONL、文件资源和凭据；迁移前的 SQLite 恢复副本与旧 JSON 来源是回退材料，不能单独覆盖新版活动数据库。

控制端配置和会话 Owner 由单个控制端进程持有写租约；多个 Agent 通过该进程的 API 提交。SQLite WAL 与 `BEGIN IMMEDIATE` 串行化本机数据库事务；第二个控制端不能并行写同一根目录。仅确认原 PID 已退出后，才能在 SQLite 控制事务内回收崩溃遗留租约。远程 Daemon 不直接读写控制端文件或共享 SQLite。

## 设置中心盘点

沿用 General、Appearance、Shortcuts、AI Runtime、Minecraft Runtime、Permissions、Plugins、应用/模式与布局偏好、Provider/模型及推理参数、Minecraft/SteamCMD 默认目录和节点覆盖、项目数据根目录配置。AI 推理与 Agent 运行参数保存在 `ai-runtime`；Minecraft 默认值和执行时限保存在独立的 `minecraft-runtime`，两者沿用账户隔离。现有 71 项叶子默认值和前端映射保持原合同；主题、颜色、字体、字号、壁纸、遮罩、模糊、对比度及减少动态效果仍由原 UI 消费。插件页沿用账户级 `plugins.enabled` 控制 AI Work 是否使用已登记扩展；Cordis 模块启停属于控制端全局运行合同，存入 `plugin-runtime.json`，默认停用列表为空，Profile 锁定项不能被用户覆盖。完全权限模式不增加逐项审批，Shell 读取 `general.integratedShell`。

本次实际回归检查主题/模糊/权限模式持久化、Provider 密文解密与单激活、账户隔离与删除、旧库升级、重启、截断/篡改保护和单写者互斥。没有重新执行浏览器视觉验收，不把服务端持久化测试说成外观验收。

通用项目目录复用 `general.taskFolder` 作为默认浏览位置；未配置或目标 Daemon 不可访问时，从目标节点报告的 Home 目录开始。项目登记按 `workspace`/`minecraft` App 隔离；v38 之前的目录保持未分配，首次从某个 App 显式使用时才认领，已有跨 App 会话引用的目录需在目标 App 重新登记。项目登记不新增设置字段，Composer 和目录弹窗沿用工作台主题令牌及外观设置映射。
