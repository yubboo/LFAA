# 共享设置界面

设置中心全局导航轨的“应用”图标直接进入 `/work`，使用应用工作区已有四栏布局和左二 `SecondaryNavigation`，不在设置页弹出第二套应用列表。

设置中心的全局“最近会话”入口调用 Workbench 专属导航回调：进入 `/work` 后展开唯一的会话 Dock；普通“工作·小鱼智能体”入口不代替此请求。

“个人资料 / 安全 / 账号管理”集中在单一“账号”设置入口并通过页内 Tab 切换；资料仍读取当前认证会话，凭据继续调用 Account Owner，账号列表继续使用 `AdminUsersPage` 与管理 API。旧 `section=profile/security/account` 深链映射到对应 Tab；页面继续消费 Appearance 共享令牌，不新增账户设置偏好。设置工具栏按 `settings-main` 实际容器宽度排列；窄容器中设置菜单与自动保存状态并排，恢复默认和立即保存按钮在下一行并排铺满。通知页提示保持现有接入边界，并使用适合窄栏阅读的短文案。

设置中心“集成”在 `/settings?section=plugins` 内提供“插件、应用、MCP、技能、市场”五个页内 Tab，不切换到 `/plugin-manager` 路由。插件清单读取真实 Profile 状态，启停复用受认证的 Profile Plugin Manager 生命周期 API，携带固定来源提交和目标 App，并继续经过 Permission Owner；账户 AI 扩展总开关仍由 `plugins.enabled` 保存。MCP 复用账户 `plugins.mcpServers` 配置、服务范围与开关；原 MCP 设置表单由 `McpConnectionsSettings` 提供，独立插件工作区继续复用该组件。技能列表与左侧插件工作区共用认证后的 `/ai/extensions` 清单，并按 `kind=skill` 原样显示；`skillId` 指向同一 Skill Registry 规范名称，`plugins.disabledSkillNames` 持久化逐项停用并由 Skill Owner 在模型目录和按需加载中执行。`/ai/skills` 仍是模型运行时目录，不再被当作第二套设置页清单。应用 Tab 的内置入口复用 Workbench 同一应用清单，开关使用 `general.hiddenApplicationNavigationIds` 仅显示/隐藏全局菜单，不改变权限或运行状态；外部应用首批接入 GitHub App Device Flow，展示当前账户可访问的仓库、Issue 和 PR 只读数据，真实 token 由 GitHub Integration 通过现有加密凭据 Owner 持有。缺少服务端 GitHub App Client ID 时如实显示未配置。市场明确标注暂未接入，不显示示例条目。标签、列表、表单沿用 Appearance 主题与容器宽度断点。AI 扩展开关、Skill 目录、能力目录、资料库、Cordis 启停/重建诊断与 DSH 壁纸引擎 Slot 设置仍由本包持有表单和 Owner 调用，但只通过 `lfaa-client-ui-plugin-manager` 的独立模式挂载在最左侧“插件”入口；独立工作区的旧 `plugins` 分区仍显示账户 AI 扩展与 MCP 内容，`plugins.enabled` 仅控制账户 AI 扩展。设置页分组搜索、导航状态、栏宽和拖动仍归各自 Owner。

五分类都在当前设置页内切换；窄容器下标题动作、分类、计数和搜索按容器宽度重排，极窄容器收紧分类按钮留白避免孤立换行。所有设置分类共用 `SettingsPage.css` 顶部的 `--settings-content-max-width`（760px 居中正文）、`--settings-page-padding-inline`、`--settings-row-inline-padding` 与 `--settings-row-padding`；基础值和 900px/620px 断点覆盖集中维护，修改共享宽度或左右留白会同时作用于所有分类、工具栏和标准设置行。浏览器页与设置中心内的扩展工作区均继承共享正文列；浏览器仅保留分组间距和紧凑控件宽度等专属变量，独立插件工作区保留自身完整容器宽度。

独立插件工作区沿用 `plugins.enabled`、`plugins.skillDirectories`、`plugins.mcpServers` 与 `computerControl.enabled` 的既有保存和权限合同；运行概况只读取已登记扩展、MCP 配置和 Cordis Runtime 快照。设置中心内的扩展页复用共享 760px 正文列；从插件入口独立打开时由宿主覆盖为完整容器宽度，并按容器断点排版。卡片和表单仍消费 Appearance 共享主题、强调色、字体/字号、表面、模糊及减少动态效果令牌，不另建设置或视觉配置。

SettingsPage 管理账户与产品配置，沿用共享 Appearance 和减少动态效果令牌。 新账户的外观初始主题跟随系统，登录页、应用中心、SteamCMD、Minecraft、写作和设置中心背景均默认为纯色；Settings Owner 对已保存的主题与背景选择保持原值。通知页 `general.notificationPopupsEnabled` 默认开启，是工作台弹窗/系统通知/提示音的总开关；关闭后保留会话内审批与澄清卡片，并保留弹窗内已选择的提醒类别偏好。设置中心不提供首次登录提醒分类开关；各提醒是否需要处理仍由凭据、AI Provider、SteamCMD 与 Project Storage Owners 的真实状态决定，弹窗中的“不更改”用于关闭对应类别提醒，“稍后再说”仅在当前工作区延后五分钟。版本公告在用户确认后按账户与版本记录，不新增公告开关；桌面更新器的下载/安装与强制更新仍由更新器 Owner 控制。总开关关闭时显示暂停说明。General 自动保存失败会恢复为最近一次服务端确认值并保留错误提示；运行中的 Web/控制端构建不一致时提示重启后重试。SteamCMD 配置仍与业务内容位置在“项目与存储”管理，底层分别调用 SteamCMD 与 Project Storage Owners；SteamCMD 工具路径不会混入业务迁移。AI 模型、Minecraft、用户权限和开发者配置继续在唯一的“配置中心”侧栏入口内切换。项目与存储页面管理游戏/小说/漫剧业务 `data` 选择、迁移操作及游戏 Owner 的节点/实例位置；不提供独立的系统数据根管理，也不展示系统运行目录和控制端数据库路径。默认业务根为 `<LFAA_HOME>/data`（Windows 默认 `%USERPROFILE%\\.lfaa\\data`），推荐位置按当前项目/安装根动态解析为 `data`，自定义使用用户选择的完整路径。业务位置选择不影响账户、AI、会话、设置或插件 Profile；系统文件留在 LFAA Home（默认 `%USERPROFILE%\\.lfaa`）并由各自 Owner 管理，不创建 `system-data` 子目录。开发者页只展示客户端与控制端状态，不展示存储目录。非超级管理员及启动配置锁定环境只读。分类目录采用容器响应式紧凑清单。

AI 与模型页把普通按量 Provider 放在系统模型区（管理员管理）并把 Agent Plan/Coding Plan 放在当前用户的个人席位区。个人席位使用专属 API Key 和套餐 URL，用户手填 Model Name、真实测试后保存，且只对本人可见和可管理；Plan 配置不读取普通 `/models` 目录。个人活动套餐模型优先用于 AI Work，没有个人席位时继续使用系统活动模型。密钥不进入浏览器持久存储，测试可能产生 Provider 用量。`aiRuntime` 运行参数仍由各登录账户自己保存。控件继续使用现有 Settings API 与 Appearance 令牌，并按设置页容器响应式布局。

常规页的“界面动效”组分别提供卡片和弹窗的账户级单选与静态预览，支持键盘方向键切换；两者共享 `util/values` 效果目录并通过现有 General 自动保存。`ui-layout` 映射账户选择，卡片与 Ant Design Modal/确认弹窗消费 `ui-theme` 的集中样式。减少动态效果优先级高于具体选择。

首次登录提醒沿用 `general.defaultAdminCredentialReminderEnabled`、`general.aiProviderReminderEnabled`、`general.setupReminderEnabled` 及全局 `general.notificationPopupsEnabled`。队列包含凭据、AI Provider 和业务内容数据目录，不再显示独立的游戏安装位置提醒。SteamCMD 现有路径配置仍可在“项目与存储”中调整。通知页不提供首次登录分类开关；“不更改”通过 Settings Owner 保存对应类别关闭状态。当日暂停按浏览器账户、类别和本地日期隔离；“稍后再说”只在当前工作区延后五分钟。“我知道了”按账户与版本确认公告后不再自动显示该版本；“关于与更新”始终提供当前版本公告入口。桌面更新器下载/安装弹窗不受版本公告确认记录控制。

日志、环境、缓存、临时文件及作品位置为从 data 派生的只读说明，不再提供独立根输入。RuntimeStorageSettings 只读显示真实节点环境目录；游戏目录展示原领域记录，存量位置不被重写。安装/迁移、认证授权与实际文件操作仍由各自 Owner 持有。

设置分区按需读取，并按账户缓存已完成的数据，不会为侧栏导航周期轮询。独立的工作区设置请求并发启动；用量页直接读取 Session Owner 的汇总投影，不逐条恢复历史会话。本轮不新增设置、不改变现有账户偏好、默认值或持久化。旧服务没有返回数据根合同字段时不编造默认/推荐路径。构建只写根 dist/packages/client/ui-settings。源码/类型/构建和实际浏览器/设备验收分别记录；[开发提示词](../../../docs/development/file-resources.zh.md)。

Minecraft 默认核心下拉框只依赖领域 Owner 登记的本地核心名称；远端版本目录仍由 Minecraft 领域接口按真实需要读取，不阻塞偏好页渲染。

## 小鱼共享工作入口（2026-10-14）

默认首页固定为 `/work` 小鱼智能体对话区；设置页展示固定首页说明，专业 App 由全局导航紧凑应用菜单进入。旧 `general.defaultMode/defaultStandaloneChat` 字段继续按原值读取和保存，避免设置其他项时覆盖账户数据，但不再决定路由。`general.showServiceStatus` 控制可见顶栏和全局导航连接状态点。原 Appearance `backgrounds.appCenter` 键保留，其设置标签改为“小鱼智能体工作区”，现有壁纸继续映射到 `/work`。Provider、主/子模型、预算、能力、权限与外观继续由原设置中心管理。

构建只写仓库根 dist/packages/client/ui-settings/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

外观背景选择器将内置图片与账户私有上传图片放在同一网格，上传图片接在内置卡片之后，并在对应卡片提供删除入口。上传后先持久化当前目标槽位，再提示成功；删除前先将所有引用该图片的槽位清空并保存，再删除素材。登录页仍只支持内置背景。

“关于与更新”提供项目内 LFAA 开发手册入口；点击后在现有设置正文中打开并可返回，不新增账户开关、API 或本地持久化。手册图示与专题正文由 `src/developer-handbook-content.ts` 结构化提供，页面由 `src/DeveloperHandbook.tsx` 呈现，覆盖左一全局导航、左二工作区导航、中间区域、右侧 Dock、设置中心和业务页。说明中的现状与历史验收以当前源码、系统架构及 `docs/PROMPTS.md` 合同为准。页面按 `settings-main` 实际容器宽度重排，复用 Appearance 主题/字体/字号及共享间距令牌；不新增 CSS 自定义属性，不请求用户数据，不更改设置。构建只写仓库根 `dist/packages/client/ui-settings/`。

“怎么开发与验收”专题提供可直接改写的功能提示词和任务合同字段；新功能/修复的决策与实测结果仍以 `docs/PROMPTS.md` 唯一任务记录为准，手册不持有第二份任务历史。

## MCP 连接预设

`McpConnectionsSettings` 提供官方 `rea-agents@6.7.0` Windows stdio 预设，写入现有 `plugins.mcpServers`，默认只关联 `workspace` App。用户可以修改、停用或移除；预设不改全局 `plugins.enabled`。服务启用且 AI Work 启动连接后，Windows 控制端由既有 MCP Runtime 调用 `npx` 启动；macOS/Linux 用户需按本机控制端平台编辑 launcher。工具调用仍逐项走现有 `permissions.mode`。

AI 与模型设置中，上下文用量显示、较早上下文自动压缩和未知模型窗口容量分别使用独立设置行；上下文显示项旁标出当前开关状态及其作用。`aiRuntime.showContextUsage` 对没有已保存值的账户默认开启；用户明确关闭后，AI Work 输入框下仍显示“上下文已关闭”提示和设置位置，不影响 Token/缓存统计。已保存的账户选择保持不变。

从 AI Work 上下文关闭提示进入设置时，设置中心请求定位到“显示上下文使用情况”行；跳转本身不自动改变用户开关。

## 浏览器接入设置

`browserUse.enabled` 默认关闭，只控制 Agent 是否可发现浏览器工具；`webUrlOpenLocation` 与 `localUrlOpenLocation` 默认均为 `lfaa`，分别控制 Agent 打开公开网页和 localhost/loopback URL 时的首选位置；选择当前已打开的浏览器需要本 Run 可用的个人 Browser Adapter 或 Windows CUA，CUA 还要求 `computerControl.enabled` 并遵循 `permissions.mode`，不会镜像到 LFAA Dock，也不会由选择项静默开启电脑操控。工作区 HTML/HTM 文件继续经受限 LFAA 预览。LFAA 内置浏览器随当前 Host 自动可用，不需要手动连接；`browserUse.enabledProviderIds` 默认空，只保存用户明确选择的个人 Tabbit 提供方；`browserUse.searchEngine` 默认 Bing；`showFullUrl` 默认关闭；`recordRecentSites` 默认开启，控制按账户保存 LFAA Browser Dock 与 Agent 实际访问的网站元数据。`allowAgentHistoryAccess` 默认关闭，`annotateScreenshots` 默认 `on-demand`；WebMCP 默认关闭并可按 HTTP(S) 来源设置允许/拒绝例外；`askBeforeDownload` 默认开启；摄像头、麦克风、位置和通知权限默认逐次询问并可按来源设置例外；开发者模式与完整 CDP 默认关闭，完整 CDP 只能在开发者模式开启时启用。除明确标注的 Electron 本机能力外，所有偏好通过 Settings Owner 按账户校验和保存，旧客户端缺字段更新时保留已有值。

密码与联系信息由 Browser Owner 读取元数据、Credentials Owner 加密保存秘密值；密码列表不返回秘密，填入仅面向当前 LFAA 页面匹配的来源与标准字段，且不提交表单。下载目录、下载历史和扩展安装记录由 Electron 本机 Host 管理；网站权限默认值/例外也由 Electron 原生浏览器执行。普通 Web Host 会显示不支持状态，不伪装成可用。浏览历史清理走 Browser Owner；清除浏览数据同时清理 LFAA 范围的浏览状态，不读取或修改系统个人浏览器数据。

设置菜单名称、分组、字段分类与待接入说明从 `util/values/src/settings-menu-catalog.ts` 读取；`SettingsPage` 仅在 Client 侧补图标，Agent 设置目录复用相同菜单 ID 和状态，避免导航文案与 Agent 语义分叉。

代码审查页复用当前 AI 工作区的 Agent Git Workspace 与 Git Host；页面只说明审查范围并进入 `/work`，实际差异由 Agent 调用 `project_file_operation` 读取，不在设置页复制 Git 状态或审查权限。

钩子菜单按需读取现有 `/ai/extensions` Owner 返回的 AI Runtime Hook 清单，与扩展诊断页共用同一个缓存结果；Agent 的只读工具从同一 Host Hook Registry 获取 ID 与事件。设置页不编辑或执行插件回调。

设置中心 Mini 页通过共享 `UserSettings.mini` 保存伙伴外观、显示、置顶与不透明度；Electron Host 才显示原生窗口入口。云端偏好页读取当前认证 Control Plane 的账户分类/更新时间和快照入口，不把不同实例的状态描述为自动同步。

外观页桌面标题保留右侧 LFAA 强调色预览；`settings-main` 容器不宽于 620px 时，预览移到“外观”标题右侧，与标题同排，说明文字仍在下一行。布局只消费现有 Appearance 令牌，不引入配置或改变账户偏好。“强调色”设置行依据实际可用宽度优先左右排列，放不下时才改为上下，色盘自身允许自然折行，遵循“横平竖直，能一行就一行，不能一行就多行，先左右后上下”。

“导入与导出”通过认证 Settings API 在设备间手动迁移 v2 账户包：包含公开会话、长期记忆、安全活动摘要、分支检查点和会话引用附件；预览先显示设置差异、会话冲突和附件容量，恢复由用户勾选设置/记忆/会话。导入会话保持归档态，恢复会话后继续对话；项目文件须单独迁移并重新关联。新设备重新配置 Provider、权限及连接。个人快照保留本机 v1 回滚语义；旧 v1 归档可导入但缺少附件/Agent 检查点。沿用 Appearance 与设置页容器响应式布局，不新增偏好。

设置中心“画布”页（菜单名“画布”，分组“个人”，路由 `/settings?section=canvas`）通过共享 `UserSettings.canvas` 保存默认打开模式、网格样式、拖动吸附、小地图和 Agent 面板默认展开，选项文案与枚举由 `util/values/settings-contract.ts` 的共享目录提供；保存复用现有分类防抖自动保存与错误提示（PUT `/settings/canvas`），不新增第二套保存通道。生成模型继续使用“AI 与模型”中已保存的图片/视频生成设置，画布页只提供跳转说明。菜单名称、分组、别名和搜索词登记在 `settings-menu-catalog.ts`，设置页按同一目录生成导航与搜索。
# 设置中心 Client

AI 模型页从认证设置 Owner 返回的模型 `taskType`、套餐层级和目录来源展示 Agent Plan/Coding Plan 能力；文本聊天模型单独选择，图像与视频按已有生成账户/模型偏好配置。Client 不把套餐密钥发给浏览器或运行时，也不自行确认席位权益。

外观页管理账户级 `appearance.advanced.writingLightRaysEnabled`，通过现有 Settings Owner 自动保存；普通写作工具栏快捷开关使用同一偏好。本包不实现光线绘制或写作业务逻辑。
