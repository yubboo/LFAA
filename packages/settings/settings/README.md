# 设置 Owner 与统一数据根

`registerAiProvider` 是 Provider 设置目录的 Cordis 扩展合同：插件可提供受校验的 Provider 选项、模型发现与真实模型测试处理器，列表 API 返回防篡改副本，注销会移除该插件的目录定义。静态账户凭据仍由本包及 Credentials Owner 管理；Provider 连接 URL 必须使用 HTTPS 且不得内嵌身份信息。该扩展接口不改变当前外部插件 Runtime 的隔离边界。

账户偏好、Provider 凭据引用和权限继续由本包原服务持有。`project-storage.ts` 只从当前 LFAA_DATA_DIR 派生日志、作品根、运行环境、缓存和临时位置，不再保存六套相互独立的分类根。远端环境位置由该节点的真实 data 根与平台推导，不能复用控制端盘符。

常规设置中的 `general.cardMotionEffect` 与 `general.dialogMotionEffect` 由此处执行 Strict 校验、按账户持久化和旧值兼容；旧记录缺字段时分别回落到共享默认值，旧客户端省略动效字段保存其他常规设置时保留已选效果。

`general.defaultMode` 与 `general.defaultStandaloneChat` 因首页固定为 `/work` 而不再驱动路由；服务端仍校验、读取并保存账户原值，其他 General 更新不会重置旧账户偏好。

旧 project_storage_locations 中的作品与环境位置仅作为已有文件回读候选，不删除原记录/文件。Writing、AI Video 和 Runtime Executor 继续核验账户、项目和真实路径；新内容使用统一 data 布局。原分类设置写入接口由 API Owner 明确退役，不另造迁移器或权限策略。

总根选择与推荐由 workspace/data-directory 持有，首次未配置用系统账户 .lfaa/data，项目 data 是显式推荐选择，已有自定义总根不被覆盖。设置页使用共享外观与权限合同；[本轮提示词](../../../docs/development/file-resources.zh.md)。构建只写根 dist/packages/settings/settings。
