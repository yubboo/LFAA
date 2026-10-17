# 数据根选择与迁移 Owner

首次未配置使用系统账户 .lfaa/data；默认根解析仍由 home-paths 唯一实现。设置中心提供默认 `.lfaa/data`、推荐的项目/桌面安装根 `data`、自定义三种选择。GET 返回 currentDirectory、defaultDirectory、recommendedDirectory 与 selection，推荐位置由此 Owner 推导；客户端不能另猜一份路径。

设置中心仅在用户显式保存选择时调用本 Owner；允许自定义根切回默认或推荐，但不会自动覆盖已有选择。推荐动作使用本 Owner 的推荐路径并走同一迁移校验；历史根不叫 data 时，保留当前目录仍使用原路径。记录待迁移位置不等于已经切换。实际复制由完整启动器在停止后执行，核验成功才换根，保留源数据，不覆盖非空目标或合并目录。目标/源码围栏、链接、活动实例/任务、只读部署环境与原超级管理员授权继续生效。

根选择只负责一个可迁移的 LFAA 用户数据根，分类目录由 data-layout 唯一派生。控制端或本机 Daemon 首次启动和切换到新根后会自动补齐数据库、用户、会话、凭据、游戏/环境、工具、插件运行私有数据、缓存、日志、备份、模型、连接与存储等空目录，不创建账户、作品或游戏实例。Profile 插件包与受控运行适配文件由 Plugin Manager 放在 `<LFAA_HOME>/plugins`，不随用户数据根迁移。迁移有系统复制、手动复制后清单/SQLite 核验采用、ZIP 安全导入三种方式；变更只记录请求，完整停止服务后才执行，源目录保留，目标已有内容不会被复制覆盖。历史分类根只作已有作品/环境回读，真实数据不由本包擅自整理。独立 DSH Home 由 `DSH_HOME` 控制，不与 LFAA 根合并为同一个目录，以免同名 Profile、Session、Log 与 Storage 冲突；单改 `LFAA_DATA_DIR` 不会移动 DSH 数据。定向回归 data-directory、data-directory-settings；[规范](../../../docs/development/file-resources.zh.md)。构建仅写根 dist/packages/workspace/data-directory。
