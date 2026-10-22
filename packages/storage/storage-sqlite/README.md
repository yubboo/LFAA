# `lfaa-storage-sqlite`

Control Plane 关系型存储 Owner，按递增、可重复运行的 schema 版本维护账户、权限、配置与其他结构化数据；会话事件正文继续归 JSONL Session Owner。

版本 61 新增 `browser_recent_sites`，主键由账户和规范化 HTTP(S) 来源/路径组成，外键在账户删除时级联清理，按账户和访问时间建立有界查询索引。该表只保存 Browser Owner 接收的站点元数据；最多保留 100 个网址、不会写入查询参数、片段、页面标题/正文或表单内容。Settings Owner 的 `browserUse.recordRecentSites` 决定新增与读取行为。

迁移不得降级数据库、删除现有记录或把编译输出写到包目录。构建只写仓库根 `dist/packages/storage/storage-sqlite/`。
