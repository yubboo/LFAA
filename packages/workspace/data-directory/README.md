# 数据根选择与迁移 Owner

账户/控制 Home 默认是 `%USERPROFILE%\\.lfaa`；业务 Data 默认是 `<LFAA_HOME>/data`。数据库、凭据、会话、账户设置和控制配置由 Home 分类目录承载；`LFAA_DATA_DIR` 及设置中心“项目与存储”指向业务 Data 根，承载 `users/`、游戏、运行环境、工具、缓存、临时文件、日志、备份、模型与联机配置。

本包保留旧系统数据目录 API 的只读兼容路由，不再作为另一套数据根设置或迁移入口。业务 Data 根的唯一用户配置由 `packages/settings/settings` 保存到 `<LFAA_HOME>/storages/data-directory.json`；显式部署 `LFAA_DATA_DIR` 覆盖该设置。切换只创建新业务分类并保留旧根，控制端与 Daemon 重启后使用新值；账户数据库、凭据、会话、账户设置和 Profile 不搬迁。

data-layout 由 Home Paths 提供两组明确分类：Home 的账户/控制目录与 Data 的业务目录。插件源码、清单、受控运行适配文件和默认插件私有运行数据由 Plugin Manager/对应 Runtime 放在 `<LFAA_HOME>/profiles/<Profile>`；插件自带存储配置（如果有）由插件 Owner 生效。旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 不作为当前入口；本 Owner 不创建、复制或接管旧目录。独立 DSH Home 由 `DSH_HOME` 控制，不与 LFAA Home 合并；改变 LFAA Data 根不会移动 DSH 数据。业务内容复制、手动核对和 ZIP 操作由 Settings 内容 Owner 实施。定向回归 data-directory、data-directory-settings；[规范](../../../docs/development/file-resources.zh.md)。构建仅写根 dist/packages/workspace/data-directory。
