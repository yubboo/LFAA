# `lfaa-storage-sqlite`

Control Plane 关系型存储 Owner，按递增、可重复运行的 schema 版本维护账户、权限、配置与其他结构化数据；会话事件正文继续归 JSONL Session Owner。

迁移 43 新增 `conversation_memories`，由 Conversation Memory Owner 保存账户隔离、有界的长期记忆。启动时在事务锁内复查版本；若表已存在，只在结构与版本 43 完全一致时补齐版本号，保留原有行；结构不匹配时停止启动，不覆盖数据。

版本 61 新增 `browser_recent_sites`，主键由账户和规范化 HTTP(S) 来源/路径组成，外键在账户删除时级联清理，按账户和访问时间建立有界查询索引。该表只保存 Browser Owner 接收的站点元数据；最多保留 100 个网址、不会写入查询参数、片段、页面标题/正文或表单内容。Settings Owner 的 `browserUse.recordRecentSites` 决定新增与读取行为。

版本 76 为 `writing_books` 增加可空 `directory_name` 和账户内唯一索引，Writing Owner 惰性分配经过跨平台清理的可读作品目录片段。字段不是客户端路径，账户归属和作品关系仍由现有 ID 外键负责；SQLite 迁移只改结构，不触碰用户目录。

版本 77 扩展 `minecraft_tasks.kind`，允许 Minecraft Domain/Jobs 创建节点真实 `server.properties` 只读任务 `properties-read`。迁移重建任务表以更新严格 CHECK 约束，并在同一事务中保留所有任务、索引和外键；`storage-domain` 在 v76 后协调旧库升级。当前数据库打开兼容上限为 79。

迁移不得降级数据库、删除现有记录或把编译输出写到包目录。构建只写仓库根 `dist/packages/storage/storage-sqlite/`。

迁移 62 新增 `steamcmd_servers`，由 `games/steamcmd` 持有服务端配置与派生运行状态；节点文件和进程仍归对应 Daemon。迁移不移动既有 SteamCMD 文件、不重置设置，安装目录按节点与相对目录唯一。历史 `steamcmd_tasks` 表继续承载安装/校验及服务端任务，不复制租约状态机。

迁移 63 为 `lfaa-identity-auth` 的家长控制 Owner 增加普通账户策略、每日 Agent 用量及并发运行预留表。策略只控制 Agent 执行时段和每日上限；运行中租约可结算实际耗时，进程异常退出后在下次预留时按预留上限保守结算。旧库与新库均须由 `storage-domain` 协调器在版本 61 完成后依序执行 62、63。

迁移 64 为 Settings Snapshots Owner 增加账户隔离的压缩资料归档表，保存经版本化校验的账户快照负载、摘要及清单。服务层负责内容上限、校验和读写；schema 不含权限模式、账户密钥或恢复凭据专用字段。旧库与新库均由 `storage-domain` 在版本 63 后依序执行。

迁移 65 为 Identity/Auth Owner 增加本机账户受信关系、一次性邀请摘要与双人确认的恢复请求；用户删除时按外键清理。凭证只保存 SHA-256 摘要，恢复请求由短时效、指定联系人和密码重置事务共同约束。旧库和新库均由 `storage-domain` 在版本 64 后依序执行。

迁移 66 为 DST Master/Caves 双分片增加共享集群 ID、集群目录名和分片类型；重建服务端表时保留旧记录与状态。普通 Steam 服务端仍按节点和安装子目录唯一，SteamCMD Service 另外拒绝大小写不同但指向同一 Windows 路径的新占用；DST 两分片可共享同一路径，但节点/目录/集群/分片组合、集群名与分片 ID 分别受唯一索引约束。现有 `steamcmd_tasks` 继续持有一次安装/更新的租约，不为集群另建任务状态机。

迁移 67 为 AI Host Shell 任务记录设置中心选择的沙箱模式及目标 workspaceRoot；已有任务保留原行，并以兼容默认值完成新字段迁移。迁移 68 新增账户隔离的 `knowledge_library_skill_installations` 元数据表和账户/创建时间索引；Skill 正文与附属文件仍由 Knowledge Library Owner 保存和校验，不把正文复制进 SQLite。数据库打开时最高接受版本为 68，旧库由 `storage-domain` 在版本 67 后依序调用。

迁移 69 只给 `ai_messages` 增加 `attachments_json`（附件 ID 与名称的 JSON 数组，不含字节）；精简夹具没有该表时只推进版本号。该迁移必须像其它版本一样读取当前 `PRAGMA user_version` 并只接受 68→69：不能在模块导入时用导入期快照越过尚未由 `storage-domain` 协调器完成的版本 31–68，否则新库会缺表且启动失败。数据库打开时最高接受版本为 76。

迁移 72 为 `appearance_backgrounds` 增加账户内唯一的 `storage_filename`，并以大小写不敏感的部分唯一索引防止 Windows 同名覆盖。旧行留空并由 Settings Owner 在素材读取时逐图懒迁移；SQLite 继续保存内部背景 ID 与显示名，不保存已迁入用户素材目录的图片字节。

迁移 73 修复历史数据库版本号已越过 70、但 AI Work 项目结构未完整落库的情况：按需补上项目指令/记忆范围字段、项目源目录与项目记忆表，回填尚未登记主目录的本机项目，并保留现有项目、源目录和会话数据。迁移在同一 SQLite 事务中幂等执行；缺少项目基础表或列时停止而不推进版本。

迁移 74 新增账户隔离的 `agent_deliverables` 元数据表，为 Agent Git 项目保存 Agent 明确发布的最终产物索引。文件字节仍保留在项目目录，下载时由 Project Files Owner 校验路径并流式读取；用户删除、解绑对应 Git 仓库时级联清理索引，不复制或删除项目文件。迁移 75 增加 `artifact_kind`，区分 Minecraft 插件、模组和其他交付物；旧记录以 `other` 兼容，不修改原文件或其 Git 状态。

迁移 78 为 `minecraft_instances` 增加初始堆和 JVM 参数 JSON；按原生/AppContainer 已有启动规则回填旧实例 Xms，保留所有实例记录。迁移 79 增加 `jvm_arguments_configured` 来源标记，旧/未配置记录采用 Minecraft Service 的通用推荐参数，显式保存的空列表仍按用户选择保留；迁移只改结构和来源元数据，不启动或停止实例。两次迁移都在事务中执行，数据库打开兼容上限为 79。
