# `lfaa-storage-sqlite`

Control Plane 关系型存储 Owner，按递增、可重复运行的 schema 版本维护账户、权限、配置与其他结构化数据；会话事件正文继续归 JSONL Session Owner。

版本 61 新增 `browser_recent_sites`，主键由账户和规范化 HTTP(S) 来源/路径组成，外键在账户删除时级联清理，按账户和访问时间建立有界查询索引。该表只保存 Browser Owner 接收的站点元数据；最多保留 100 个网址、不会写入查询参数、片段、页面标题/正文或表单内容。Settings Owner 的 `browserUse.recordRecentSites` 决定新增与读取行为。

迁移不得降级数据库、删除现有记录或把编译输出写到包目录。构建只写仓库根 `dist/packages/storage/storage-sqlite/`。

迁移 62 新增 `steamcmd_servers`，由 `games/steamcmd` 持有服务端配置与派生运行状态；节点文件和进程仍归对应 Daemon。迁移不移动既有 SteamCMD 文件、不重置设置，安装目录按节点与相对目录唯一。历史 `steamcmd_tasks` 表继续承载安装/校验及服务端任务，不复制租约状态机。
