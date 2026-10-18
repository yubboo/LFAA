# 共享设置界面

设置中心不再呈现 Profile 插件、AI 扩展/MCP 或壁纸引擎插件分类。账户扩展开关、Skill 目录、能力目录、资料库、MCP 配置、Cordis 启停/重建诊断与 DSH 壁纸引擎 Slot 设置仍由本包持有表单和 Owner 调用，但只通过 `lfaa-client-ui-plugin-manager` 的独立模式挂载在最左侧“插件”入口。插件管理器的一排主标签选择本包的总览、能力类别、资料库、MCP 与诊断视图，不在内容区重复显示次级导航或分类筛选胶囊；Profile 来源检查与安装清单也在那里展示。`plugins.enabled` 仅控制账户 AI 扩展。

独立插件工作区沿用 `plugins.enabled`、`plugins.skillDirectories`、`plugins.mcpServers` 与 `computerControl.enabled` 的既有保存和权限合同；运行概况只读取已登记扩展、MCP 配置和 Cordis Runtime 快照。插件工作区使用完整容器宽度与容器断点排版，卡片和表单仍消费 Appearance 共享主题、强调色、字体/字号、表面、模糊及减少动态效果令牌，不另建设置或视觉配置。

SettingsPage 管理账户与产品已有配置，沿用共享主题、颜色、字体、字号、壁纸、遮罩/模糊、对比度和减少动态效果；Ant Design Modal 与确认弹窗表面同步消费当前 Appearance 令牌。通知页的 `general.notificationPopupsEnabled` 默认开启；关闭后不弹出工作台/系统通知或提示音，但会话内审批和澄清卡片保留，其他类别偏好不被覆盖。AI Provider 与业务内容存储提醒各有独立长期设置和按类别计算的本地当日暂停；“稍后再说”只收起当前显示，账户安全提醒会在后续登录重新检查。总开关关闭时显示暂停说明和恢复按钮，已开启的类别状态会标注为“总开关已暂停”，避免误以为类别设置失效。SteamCMD 配置不再占用独立侧栏分类；安装模式/工具目录、安装校验任务、Steam 游戏目录与业务内容 `data` 一并在“项目与存储”管理，底层仍调用 SteamCMD 与项目存储各自 Owner，SteamCMD 工具路径不会混入业务迁移。AI 模型、Minecraft、用户权限和开发者配置继续在唯一的“配置中心”侧栏入口内切换。项目与存储页面管理游戏/小说/漫剧业务 `data` 选择、迁移操作及游戏 Owner 的节点/实例位置；不提供独立的系统数据根管理，也不展示系统运行目录和控制端数据库路径。默认业务根为 `<LFAA_HOME>/data`（Windows 默认 `%USERPROFILE%\\.lfaa\\data`），推荐位置按当前项目/安装根动态解析为 `data`，自定义使用用户选择的完整路径。业务位置选择不影响账户、AI、会话、设置或插件 Profile；系统文件留在 LFAA Home（默认 `%USERPROFILE%\\.lfaa`）并由各自 Owner 管理，不创建 `system-data` 子目录。开发者页只展示客户端与控制端运行状态，不展示存储目录。非超级管理员及启动配置锁定环境只读。分类目录采用容器响应式紧凑清单。

常规页的“界面动效”组分别提供卡片和弹窗的账户级单选与静态预览，支持键盘方向键切换；两者共享 `util/values` 效果目录并通过现有 General 自动保存。`ui-layout` 映射账户选择，卡片与 Ant Design Modal/确认弹窗消费 `ui-theme` 的集中样式。减少动态效果优先级高于具体选择。

日志、环境、缓存、临时文件及作品位置为从 data 派生的只读说明，不再提供独立根输入。RuntimeStorageSettings 只读显示真实节点环境目录；游戏目录展示原领域记录，存量位置不被重写。安装/迁移、认证授权与实际文件操作仍由各自 Owner 持有。

设置分区按需读取，并按账户缓存已完成的数据，不会为侧栏导航周期轮询。独立的工作区设置请求并发启动；用量页直接读取 Session Owner 的汇总投影，不逐条恢复历史会话。本轮不新增设置、不改变现有账户偏好、默认值或持久化。旧服务没有返回数据根合同字段时不编造默认/推荐路径。构建只写根 dist/packages/client/ui-settings。源码/类型/构建和实际浏览器/设备验收分别记录；[开发提示词](../../../docs/development/file-resources.zh.md)。

Minecraft 默认核心下拉框只依赖领域 Owner 登记的本地核心名称；远端版本目录仍由 Minecraft 领域接口按真实需要读取，不阻塞偏好页渲染。

## 小鱼共享工作入口（2026-10-14）

默认首页固定为 `/work` 小鱼智能体对话区；设置页展示固定首页说明，专业 App 由全局导航紧凑应用菜单进入。旧 `general.defaultMode/defaultStandaloneChat` 字段继续按原值读取和保存，避免设置其他项时覆盖账户数据，但不再决定路由。`general.showServiceStatus` 控制可见顶栏和全局导航连接状态点。原 Appearance `backgrounds.appCenter` 键保留，其设置标签改为“小鱼智能体工作区”，现有壁纸继续映射到 `/work`。Provider、主/子模型、预算、能力、权限与外观继续由原设置中心管理。

构建只写仓库根 dist/packages/client/ui-settings/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
