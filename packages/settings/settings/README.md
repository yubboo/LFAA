# 设置 Owner 与统一数据根

`registerAiProvider` 是 Provider 设置目录的 Cordis 扩展合同：插件可提供受校验的 Provider 选项、模型发现与真实模型测试处理器，列表 API 返回防篡改副本，注销会移除该插件的目录定义。静态账户凭据仍由本包及 Credentials Owner 管理；Provider 连接 URL 必须使用 HTTPS 且不得内嵌身份信息。该扩展接口不改变当前外部插件 Runtime 的隔离边界。

已保存账户的“更新目录”只重新读取并保存 Provider 官方模型目录，不发起模型推理，也不更改已选模型 ID 或 `reasoning_mode`；若当前型号已从新目录移除，保留原选择并提示用户手动选择。“重测模型”只对当前已选型号发起真实请求，可能产生 Provider 用量。两个动作共用本包的账户隔离、加密凭据与 Provider 目录 Owner，不新增配置。

账户偏好、Provider 凭据引用和权限继续由本包原服务持有，位于 LFAA Home 的系统分类目录（默认 `%USERPROFILE%\\.lfaa`，不增加 `system-data` 子目录）。`project-storage.ts` 负责保存游戏、小说和漫剧的业务内容根，首次默认 `<LFAA_HOME>/data`（Windows 默认示例 `%USERPROFILE%\\.lfaa\\data`）。系统推荐路径根据当前项目或安装根动态解析为其 `data` 子目录，自定义路径按用户所选绝对路径使用。Home 中各系统分类路径受保护；仅游戏、小说和漫剧业务内容写入/迁移业务内容根。该操作只影响业务 Owner；迁移、覆盖备份和 ZIP 归档由本包业务内容迁移合同实施，绝不复制系统数据库、账号、AI 配置、会话或系统运行数据。自动化回归用合成数据，浏览器验收使用现有 `admin` 测试账号，不增加临时存储模式或测试账号。远端环境位置由该节点真实 data 根与平台推导，不能复用控制端盘符。

常规设置中的 `general.cardMotionEffect` 与 `general.dialogMotionEffect` 由此处执行 Strict 校验、按账户持久化和旧值兼容；旧记录缺字段时分别回落到共享默认值，旧客户端省略动效字段保存其他常规设置时保留已选效果。

`general.notificationPopupsEnabled` 是账户级通知总开关，默认开启。General 读取旧账户缺失字段时回落为开启；旧客户端保存其他 General 字段时省略该字段不会覆盖服务端已保存状态。其余通知类别和提示音设置独立保留。

`general.defaultMode` 与 `general.defaultStandaloneChat` 因首页固定为 `/work` 而不再驱动路由；服务端仍校验、读取并保存账户原值，其他 General 更新不会重置旧账户偏好。

旧 project_storage_locations 中的作品与环境位置仅作为已有文件回读候选，不删除原记录/文件。Writing、AI Video 和 Runtime Executor 继续核验账户、项目和真实路径；新内容写入当前已选择的业务内容根。原分类设置写入接口由 API Owner 明确退役，不另造迁移器或权限策略。

业务内容选择由 `project-storage.ts` 保存，首次默认 `<LFAA_HOME>/data`；“系统推荐”按当前项目或安装根动态生成 `data`，自定义位置直接使用用户选定的绝对路径。系统账户数据仍由独立的 `LFAA_DATA_DIR`/home-paths 处理；本设置绝不改变该系统根。

`content-storage-migration.ts` 仅发现 `games/` 与账户哈希下的 Writing/AI Video 项目树。系统复制覆盖前保留目标业务子树备份，合并时保留目标独有文件；手动模式只有路径、类型、大小及 SHA-256 完全一致才切换；ZIP 导入/导出只包含上述业务树。迁移源始终保留，复制/导入回读校验成功后才保存新根。API 由认证管理员显式发起，并通过 Permission Owner 的显式页面操作授权。开发者页只展示客户端与控制端状态，不展示或更改数据目录。浏览器验收复用现有 admin 测试账号；自动化回归使用合成文件，不创建产品账号。ZIP 辅助脚本随 Electron/Tauri 运行树打包。

设置页沿用共享主题、字号、动效与响应式配置；[本轮提示词](../../../docs/development/file-resources.zh.md)。构建只写根 dist/packages/settings/settings。
