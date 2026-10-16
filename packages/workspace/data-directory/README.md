# 数据根选择与迁移 Owner

首次未配置使用系统账户 .lfaa/data；默认根解析仍由 home-paths 唯一实现。GET 返回 currentDirectory、defaultDirectory、recommendedDirectory 与 selection，推荐位置由此 Owner 从项目根（桌面安装时对应安装根）推导为 data；客户端不能另猜一份路径。

设置中心仅在用户显式保存选择时调用本 Owner；允许自定义根切回默认或推荐，但不会自动覆盖已有选择。推荐动作使用本 Owner 的推荐路径并走同一迁移校验；历史根不叫 data 时，保留当前目录仍使用原路径。记录待迁移位置不等于已经切换。实际复制由完整启动器在停止后执行，核验成功才换根，保留源数据，不覆盖非空目标或合并目录。目标/源码围栏、链接、活动实例/任务、只读部署环境与原超级管理员授权继续生效。

根选择只负责一个 data 根，分类目录由 data-layout 和 Settings 派生。历史分类根只作已有作品/环境回读，真实数据不由本包擅自整理。定向回归 data-directory、data-directory-settings；[规范](../../../docs/development/file-resources.zh.md)。构建仅写根 dist/packages/workspace/data-directory。
