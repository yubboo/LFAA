# 设置 Owner 与统一数据根

`registerAiProvider` 是 Provider 设置目录的 Cordis 扩展合同：插件可提供受校验的 Provider 选项、模型发现与真实模型测试处理器，列表 API 返回防篡改副本，注销会移除该插件的目录定义。静态账户凭据仍由本包及 Credentials Owner 管理；Provider 连接 URL 必须使用 HTTPS 且不得内嵌身份信息。该扩展接口不改变当前外部插件 Runtime 的隔离边界。

已保存账户的“更新目录”只重新读取并保存 Provider 官方模型目录，不发起模型推理，也不更改已选模型 ID 或 `reasoning_mode`；若当前型号已从新目录移除，保留原选择并提示用户手动选择。“重测模型”只对当前已选型号发起真实请求，可能产生 Provider 用量。两个动作共用本包的账户隔离、加密凭据与 Provider 目录 Owner，不新增配置。

账户偏好、Provider 凭据引用和权限留在 LFAA Home（默认 `%USERPROFILE%\\.lfaa`，不增加 `system-data` 子目录）。`project-storage.ts` 负责统一业务 Data 根，首次默认 `<LFAA_HOME>/data`（Windows 默认 `%USERPROFILE%\\.lfaa\\data`）；Home Paths 只在 Data 根下创建游戏、环境、工具、缓存、临时文件、日志、备份、模型和联机等业务分类，账户业务文件位于 Data 根的 `users/` 下。系统推荐路径按当前项目或安装根动态解析为其 `data` 子目录；自定义路径把用户所选目录作为父目录，在其中创建 `data/`（所选目录本身名为 `data` 时直接使用）。位置保存在 Home 控制配置；切换时创建新业务分类、保留旧根，控制端与 Daemon 重启后使用新值。游戏、小说和漫剧内容复制/核对/ZIP 仅处理受管业务子树，不复制 Home 系统账户数据。浏览器验收使用现有 `admin` 测试账号，不增加临时存储模式或测试账号。远端环境位置由该节点真实 data 根与平台推导，不能复用控制端盘符。

常规设置中的 `general.cardMotionEffect` 与 `general.dialogMotionEffect` 由此处执行 Strict 校验、按账户持久化和旧值兼容；旧记录缺字段时分别回落到共享默认值，旧客户端省略动效字段保存其他常规设置时保留已选效果。

`general.notificationPopupsEnabled` 是账户级通知总开关，默认开启，统一控制首次登录提醒、版本公告及其他工作台弹出通知。凭据、AI Provider 和业务内容目录类别状态分别保存在 General 的 `defaultAdminCredentialReminderEnabled`、`aiProviderReminderEnabled` 与 `setupReminderEnabled`，由提醒弹窗中的“不更改”更新；设置中心不提供首次登录类别开关。SteamCMD 游戏安装位置由“项目与存储”管理，不作为首次登录提醒。General 读取旧账户缺失字段时使用共享默认值；旧客户端保存其他 General 字段时省略已有字段不会覆盖服务端状态。版本公告的确认状态按账户/版本保存在浏览器本地；公告与桌面更新器合同相互独立。

`general.defaultMode` 与 `general.defaultStandaloneChat` 因首页固定为 `/work` 而不再驱动路由；服务端仍校验、读取并保存账户原值，其他 General 更新不会重置旧账户偏好。

账户 `plugins.disabledSkillNames` 保存设置中心逐 Skill 停用名单，默认空列表，最多 200 个唯一 kebab-case 名称。读取历史设置缺少此字段时使用空列表；旧客户端提交缺字段时，`saveUserSettings()` 合并当前值以保留既有停用选择。此名单只控制模型 Skill 发现、按需加载和工作区 Skill 引用，不修改 Skill 文件、来源或权限模式。

`general.hiddenApplicationNavigationIds` 是用户可隐藏的内置应用菜单项白名单，默认 `[]`；读写时按共享 App ID 列表严格校验并去重。旧账户缺字段时读取默认空列表；旧客户端遗漏字段更新其他 General 偏好时保留服务端当前值。该设置仅控制导航显示，不代表应用权限、安装或运行状态。

旧 project_storage_locations 中的作品与环境位置仅作为已有文件回读候选，不删除原记录/文件。Writing、AI Video 和 Runtime Executor 继续核验账户、项目和真实路径；新内容写入当前已选择的业务内容根。原分类设置写入接口由 API Owner 明确退役，不另造迁移器或权限策略。

“项目与存储”由 `project-storage.ts` 唯一持有业务 Data 根：首次默认 `<LFAA_HOME>/data`；“系统推荐”按当前项目或安装根动态生成 `data`；自定义位置在用户选择的位置下创建 `data/`（如果所选目录本身名为 `data`，就直接使用它）。当前 Data 根原子保存在 `<LFAA_HOME>/storages/data-directory.json`，旧 `project_storage_locations.content_directory` 只在升级时回读一次；首次选定或切换后创建 Data 业务分类，旧根保留。控制端和 Daemon 重启后从同一配置读取该路径。若部署显式设置 `LFAA_DATA_DIR`，设置页只读并由部署配置控制。

`content-storage-migration.ts` 仅发现 `games/` 与账户哈希下的 Writing/AI Video 项目树。系统复制覆盖前保留目标业务子树备份，合并时保留目标独有文件；手动模式只有路径、类型、大小及 SHA-256 完全一致才切换；ZIP 导入/导出只包含上述业务树。迁移源始终保留，复制/导入回读校验成功后才保存新根。API 由认证管理员显式发起，并通过 Permission Owner 的显式页面操作授权。开发者页只展示客户端与控制端状态，不展示或更改数据目录。浏览器验收复用现有 admin 测试账号；自动化回归使用合成文件，不创建产品账号。ZIP 辅助脚本随 Electron/Tauri 运行树打包。

设置页沿用共享主题、字号、动效与响应式配置；[本轮提示词](../../../docs/development/file-resources.zh.md)。构建只写根 dist/packages/settings/settings。

外观自定义背景由 Settings Owner 按认证账户保存文件与 MIME 索引；上传声明中的 MIME 只作提示，实际 PNG/JPEG/WebP 类型按文件签名确定，再由唯一尺寸解析和服务端 3 MiB、8192 边长、2000 万像素限制校验。素材文件回读、摘要、读取和删除继续按账户隔离；构建只写根 dist/packages/settings/settings。
