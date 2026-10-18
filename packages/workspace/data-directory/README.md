# 数据根选择与迁移 Owner

系统数据默认直接使用本机 LFAA Home（`%USERPROFILE%\\.lfaa`）；路径解析由 home-paths 唯一实现。账号、Provider、会话、设置和 SQLite 分别保存在 Home 的系统分类目录，不额外创建 `system-data` 子目录。该 Owner 只管理系统数据状态；游戏、小说和漫剧业务内容位置由 Settings 内容 Owner 单独管理，Windows 默认 `<LFAA_HOME>/data`。本包不迁移系统数据，也不提供业务内容复制、核对或归档。

系统数据根由启动配置解析。设置中心的内容位置选择不能修改 `LFAA_DATA_DIR`，也不能搬迁账户、AI Provider、会话、用户设置或 SQLite。业务内容迁移仅由 `packages/settings/settings` Owner 负责。

data-layout 仍为控制端与各 Daemon Owner 提供其所需的分类路径；这不表示本机业务内容迁移要复制整个系统根。插件源码、清单、受控运行适配文件和默认插件私有运行数据由 Plugin Manager/对应 Runtime 放在 `<LFAA_HOME>/profiles/<Profile>`；插件自带存储配置（如果有）由插件 Owner 生效。旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 不作为当前入口；本 Owner 不创建、复制或接管旧目录。历史根只供对应业务 Owner 回读，真实数据不由本包擅自整理。独立 DSH Home 由 `DSH_HOME` 控制，不与 LFAA Home 合并；单改 `LFAA_DATA_DIR` 不会移动 DSH 数据。系统根迁移接口保持禁用；业务内容的复制、手动核对和 ZIP 操作由 Settings 内容 Owner 实施。定向回归 data-directory、data-directory-settings；[规范](../../../docs/development/file-resources.zh.md)。构建仅写根 dist/packages/workspace/data-directory。
