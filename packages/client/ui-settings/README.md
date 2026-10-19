# 共享设置界面

“个人资料 / 安全 / 账号管理”集中在单一“账号”设置入口并通过页内 Tab 切换；资料仍读取当前认证会话，凭据继续调用 Account Owner，账号列表继续使用 `AdminUsersPage` 与管理 API。旧 `section=profile/security/account` 深链映射到对应 Tab；页面继续消费 Appearance 共享令牌，不新增账户设置偏好。设置工具栏按 `settings-main` 实际容器宽度排列；窄容器中先显示自动保存状态，再并排显示两项操作，避免主操作孤立换行。通知页提示保持现有接入边界，并使用适合窄栏阅读的短文案。

设置中心“集成 → 插件”使用本包的标准设置内容区与 `SettingRow`/`SettingsSwitch` 呈现当前 Profile 的真实已安装插件；清单通过 Connection API 按需读取，启停复用受认证的 Profile Plugin Manager 生命周期 API，携带固定来源提交和目标 App，并继续经过 Permission Owner。多 App 插件在行内选择目标 App；搜索只过滤当前真实清单，不新增设置或插件状态。齿轮沿用 `/settings?section=plugins`，普通 SettingsPage 将该路由映射到 Profile 插件菜单。AI 扩展开关、Skill 目录、能力目录、资料库、MCP 配置、Cordis 启停/重建诊断与 DSH 壁纸引擎 Slot 设置仍由本包持有表单和 Owner 调用，但只通过 `lfaa-client-ui-plugin-manager` 的独立模式挂载在最左侧“插件”入口。插件管理器的二级菜单选择本包的总览、能力类别、资料库、MCP 与诊断视图，不在内容区重复显示分类筛选；Profile 来源检查与安装清单也在那里展示。独立工作区的旧 `plugins` 分区仍显示账户 AI 扩展与 MCP 内容，`plugins.enabled` 仅控制账户 AI 扩展。设置页保留自己的分组搜索与导航状态，并通过 `lfaa-client-ui-sidebar/SecondaryNavigation` 与插件页复用同一菜单呈现组件；分组展开、选中项与导航仍归本包，栏宽和拖动归 `ui-dockkit`。

独立插件工作区沿用 `plugins.enabled`、`plugins.skillDirectories`、`plugins.mcpServers` 与 `computerControl.enabled` 的既有保存和权限合同；运行概况只读取已登记扩展、MCP 配置和 Cordis Runtime 快照。插件工作区使用完整容器宽度与容器断点排版，卡片和表单仍消费 Appearance 共享主题、强调色、字体/字号、表面、模糊及减少动态效果令牌，不另建设置或视觉配置。

SettingsPage 管理账户与产品配置，沿用共享 Appearance 和减少动态效果令牌。通知页 `general.notificationPopupsEnabled` 默认开启，是工作台弹窗/系统通知/提示音的总开关；关闭后保留会话内审批与澄清卡片，并保留弹窗内已选择的提醒类别偏好。设置中心不提供首次登录提醒分类开关；各提醒是否需要处理仍由凭据、AI Provider、SteamCMD 与 Project Storage Owners 的真实状态决定，弹窗中的“不更改”用于关闭对应类别提醒，“稍后再说”仅在当前工作区延后五分钟。版本公告在用户确认后按账户与版本记录，不新增公告开关；桌面更新器的下载/安装与强制更新仍由更新器 Owner 控制。总开关关闭时显示暂停说明。General 自动保存失败会恢复为最近一次服务端确认值并保留错误提示；运行中的 Web/控制端构建不一致时提示重启后重试。SteamCMD 配置仍与业务内容位置在“项目与存储”管理，底层分别调用 SteamCMD 与 Project Storage Owners；SteamCMD 工具路径不会混入业务迁移。AI 模型、Minecraft、用户权限和开发者配置继续在唯一的“配置中心”侧栏入口内切换。项目与存储页面管理游戏/小说/漫剧业务 `data` 选择、迁移操作及游戏 Owner 的节点/实例位置；不提供独立的系统数据根管理，也不展示系统运行目录和控制端数据库路径。默认业务根为 `<LFAA_HOME>/data`（Windows 默认 `%USERPROFILE%\\.lfaa\\data`），推荐位置按当前项目/安装根动态解析为 `data`，自定义使用用户选择的完整路径。业务位置选择不影响账户、AI、会话、设置或插件 Profile；系统文件留在 LFAA Home（默认 `%USERPROFILE%\\.lfaa`）并由各自 Owner 管理，不创建 `system-data` 子目录。开发者页只展示客户端与控制端状态，不展示存储目录。非超级管理员及启动配置锁定环境只读。分类目录采用容器响应式紧凑清单。

已保存模型账户将官方目录刷新与真实模型测试分成独立操作：目录刷新不发推理请求且保留当前选择；真实测试只请求当前模型，并明确可能产生 Provider 用量。模型目录缺少当前选择时设置页保留该型号并提示从最新目录手动选择。控件继续使用现有 Settings API 与 Appearance 令牌。

常规页的“界面动效”组分别提供卡片和弹窗的账户级单选与静态预览，支持键盘方向键切换；两者共享 `util/values` 效果目录并通过现有 General 自动保存。`ui-layout` 映射账户选择，卡片与 Ant Design Modal/确认弹窗消费 `ui-theme` 的集中样式。减少动态效果优先级高于具体选择。

首次登录提醒沿用 `general.defaultAdminCredentialReminderEnabled`、`general.aiProviderReminderEnabled`、`general.setupReminderEnabled` 及全局 `general.notificationPopupsEnabled`。队列包含凭据、AI Provider 和业务内容数据目录，不再显示独立的游戏安装位置提醒。SteamCMD 现有路径配置仍可在“项目与存储”中调整。通知页不提供首次登录分类开关；“不更改”通过 Settings Owner 保存对应类别关闭状态。当日暂停按浏览器账户、类别和本地日期隔离；“稍后再说”只在当前工作区延后五分钟。“我知道了”按账户与版本确认公告后不再自动显示该版本；“关于与更新”始终提供当前版本公告入口。桌面更新器下载/安装弹窗不受版本公告确认记录控制。

日志、环境、缓存、临时文件及作品位置为从 data 派生的只读说明，不再提供独立根输入。RuntimeStorageSettings 只读显示真实节点环境目录；游戏目录展示原领域记录，存量位置不被重写。安装/迁移、认证授权与实际文件操作仍由各自 Owner 持有。

设置分区按需读取，并按账户缓存已完成的数据，不会为侧栏导航周期轮询。独立的工作区设置请求并发启动；用量页直接读取 Session Owner 的汇总投影，不逐条恢复历史会话。本轮不新增设置、不改变现有账户偏好、默认值或持久化。旧服务没有返回数据根合同字段时不编造默认/推荐路径。构建只写根 dist/packages/client/ui-settings。源码/类型/构建和实际浏览器/设备验收分别记录；[开发提示词](../../../docs/development/file-resources.zh.md)。

Minecraft 默认核心下拉框只依赖领域 Owner 登记的本地核心名称；远端版本目录仍由 Minecraft 领域接口按真实需要读取，不阻塞偏好页渲染。

## 小鱼共享工作入口（2026-10-14）

默认首页固定为 `/work` 小鱼智能体对话区；设置页展示固定首页说明，专业 App 由全局导航紧凑应用菜单进入。旧 `general.defaultMode/defaultStandaloneChat` 字段继续按原值读取和保存，避免设置其他项时覆盖账户数据，但不再决定路由。`general.showServiceStatus` 控制可见顶栏和全局导航连接状态点。原 Appearance `backgrounds.appCenter` 键保留，其设置标签改为“小鱼智能体工作区”，现有壁纸继续映射到 `/work`。Provider、主/子模型、预算、能力、权限与外观继续由原设置中心管理。

构建只写仓库根 dist/packages/client/ui-settings/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
