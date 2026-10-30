# 共享纯数据合同

`application-id.ts` 是完整 App ID 与显示名称权威，同时明确 Workspace/Minecraft 项目 Owner 子集、可供 AI Work 项目选择的业务 App 领域上下文集合与 App 路由模式。系统默认入口为 `/work`；根地址 `/`、旧 `/desktop`、`/tasks` 和通用 Workspace AI Work 地址都归一到 `/work`；`/apps/<app>/ai-work` 保留领域聊天作用域，画布与手动面板继续使用同一 App ID。项目 Owner 的 `appId` 与用户选择的 `applicationIds` 是不同合同；关联只向 Agent 提供项目领域提示，不自动开放工具、执行或授权。

`canvas-node-types.ts` 是各 App 自由画布节点白名单；Canvas UI 的工具轨/新增菜单与 `canvas_*` Agent 工具读取同一映射。Minecraft、写作、AI 漫剧和通用工作区各自只暴露已登记的节点类型；通用 Canvas 的节点连线仍不代表可执行工作流。

`settings-contract.ts` 提供 Settings 类型、唯一默认值及 AI Runtime 每轮模型请求/工具调用的产品安全上限；Client 和 Settings 克隆后消费，不依赖 Node、数据库或 React，不创建第二套持久化。`appearance.theme` 新用户默认 `system`（跟随系统），六个 `appearance.backgrounds` 位置默认 `none`（纯色，由当前主题提供画布色）；Settings Owner 对缺失值使用这些默认，同时保留账户已保存的主题和背景。`aiRuntime.showContextUsage` 对缺少已保存偏好的账户默认开启；Settings Owner 仍保留账户明确保存的开/关选择。General 默认值定义首次登录提醒类别状态及统一通知总开关；旧账户缺少新增字段时由 Settings Owner 回落到共享默认值，设置中心不暴露提醒类别开关。预算设为 0 时使用共享合同中的上限，正数只能收紧该上限。`builtin-backgrounds.ts` 是内置背景 ID、名称和 Web URL 的共享清单；静态图本体放在 `apps/web/public/`，外观选项与 Workbench 壁纸读取同一清单，目录文件本身不会自动变成可选项。旧 UI 导出仅是迁移兼容入口，消费者迁完后再删除。

`AppearanceAreaEffects` 为登录、应用中心、SteamCMD、Minecraft、写作和设置中心保存独立遮罩覆盖；Workbench 五个区域另可覆盖玻璃模糊。覆盖默认 `null` 并继承原有全局 `appearance.overlay`（65%）与 `appearance.blur`（14px），不迁移或重置旧账户值；服务端负责范围校验和旧客户端兼容。

`appearance.advanced.writingLightRaysEnabled` 是写作工作区光线背景的账户级开关，默认开启；设置中心和写作工具栏共用该字段。旧账户缺少该值时只补共享默认值，其他外观偏好保持原值。

`appearance.advanced.aiWorkOutputFocusBlurEnabled` 是 AI Work 回复空闲虚化的账户级开关，默认关闭；缺少该字段的新账户/旧账户使用此默认，已有账户明确保存的开关选择由 Settings Owner 原样保留。

`general.cardMotionEffect` 与 `general.dialogMotionEffect` 是常规设置中独立的卡片/弹窗动效选择；`UI_MOTION_EFFECT_OPTIONS` 统一持有 ID、展示名称、说明和唯一默认值（`fluid`）。视觉实现由 `client/ui-theme` 消费，不在本包定义 CSS。

写入校验、旧值兼容、持久化、凭据与权限仍由 Settings/Storage Owner 管理。

`ark-provider.ts` 统一提供普通方舟 OpenAI 兼容 Base URL 与个人 Agent Plan/Coding Plan 专属端点、Provider ID 及官方文档地址。Settings Provider 解析和 Pi AI 的普通方舟默认 Base URL 共用这些协议事实；账户归属、密钥和请求仍由各自 Owner 管理。

2026-10-14：FileResourceLocation 描述独立导航，ManagedFileEntry 保留真实文件类型与可执行操作/说明；位置投影不授予文件权限，也不混入物理目录条目。

2026-10-28：`ManagedFileEntry.downloadStrategy="stream"` 标记领域 Owner 已提供认证流下载；它只绕过通用小文件 Blob 传输上限，不增加写、改名、移动或删除权限。

## 节点文件二进制传输边界

`src/file-transfer-contract.mjs` 是 Control Plane、Daemon 与 Client 共用的传输限制来源：单文件 3 MiB、Control Plane 内总预留 20 MiB、暂存 5 分钟。此处只定义稳定协议常量，不持有文件字节或运行状态。

`src/minecraft-property-contract.mjs` 统一 Minecraft `server.properties` 键、单项/总量限制、敏感键识别及字段值校验。调用方仍须以当前节点文件快照限制可改键，并执行各自认证和任务职责；本包不持有 Minecraft 文件或配置状态。

## 小鱼共享工作入口（2026-10-14）

声明根路由 `/`、`/tasks` 与旧 App AI Work 地址归一到 `/work`，以及 AgentAssociations 纯值校验；引用有界、唯一，不含正文或执行授权。

构建只写仓库根 dist/packages/util/values/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

`settings-contract.ts` 是首次登录提醒与通知的唯一默认值来源，包含凭据、AI Provider、业务内容目录的提醒状态及全局通知开关；SteamCMD 游戏安装位置不触发首次登录提醒，版本公告确认按账户/版本保存在浏览器本地，不作为 General 设置。旧账户缺少新增字段时由 Settings Owner 使用共享默认值补齐。

`PluginSettings.disabledSkillNames` 是账户级逐 Skill 停用列表，唯一默认值为 `[]`。持久化、严格校验、读取和运行时执行由 Settings/Skill Owners 负责；本包不创建 UI 状态或第二份设置存储。

`GeneralSettings.hiddenApplicationNavigationIds` 保存被用户从全局“应用”菜单隐藏的内置工作台导航 ID，唯一默认值为 `[]`。此偏好仅控制菜单可见项，不授予或撤销应用权限、不卸载应用；导航 ID 可指向领域聚合入口或系统共享能力，不等同于 `ApplicationId`，白名单与 Workbench 导航清单保持一致。

2026-10-23：`browser-provider.ts` 统一登记 `BUILTIN_BROWSER_WORKSPACE_ID`，供 Web/Desktop Client 与 Browser Run Adapter 绑定同一个账户内置浏览器工作区，避免 AI 会话切换导致页面分裂；`isBuiltinBrowserProvider` 统一识别可镜像到 LFAA Dock 的内置 Provider，个人 Tabbit 页面不镜像。

`settings-menu-catalog.ts` 是设置中心菜单 ID、标题、分组、账户设置分类、Agent 接入类型与未接入说明的共享只读目录。设置导航和 Agent 设置目录从这里读取菜单语义，避免菜单名称、分类映射与接入状态各维护一份。

`MiniSettings` 属于账户级 `UserSettings.mini`，共享唯一默认值和 companion 枚举供 Client、Settings、Electron 与 Agent 字段目录消费；配置数据仍由 Settings Owner 持久化，Electron 本机窗口状态不会成为第二套账户偏好。
代码审查菜单的 `tools` 路由使用当前 Agent Git Workspace 的 `project_file_operation` 差异读取能力；未绑定仓库时由 Owner 如实返回不可审查边界。

`hooks` 菜单使用 `tools` 路由并发现 `lfaa_settings_runtime_hooks_list`；当前只读当前 Host 已登记的 AI Runtime Hook ID/事件。钩子代码仍由受信任插件 Owner 管理，不接受通用设置 Patch。

`appearance-presets.ts` 持有系统内置预设与纯值快照创建/应用/匹配规则；快照仅覆盖 Appearance 与 General 的白名单视觉布局字段。`AppearanceSettings.presets` 默认空数组，不改变已有外观默认值或其他设置。

`src/minecraft-jvm-contract.mjs` 是 Minecraft JVM 参数的纯值 Owner：统一解析 Xms/Xmx、G1 白名单及参数依赖；推荐/高性能预设向所有 Java Minecraft 核心提供，不按 Paper 或 Java 主版本静态置空。目标 Daemon 用实例选择的真实 Java 执行启动前预检，拒绝不支持参数时不启动服务端。Minecraft Service、目标 Daemon 和 Client 共用同一合同；这里不持久化账户或实例数据，也不负责下载 Java。

`builtin-backgrounds.ts` 还登记“云涧书境”写作图片。`applyWritingWorkspacePresetAppearance()` 和 `writingWorkspacePresetMatches()` 仅映射 `appearance.backgrounds.writing`、`appearance.areaEffects.writing` 与 `appearance.advanced.writingLightRaysEnabled`，不能经普通账户级预设路径影响其他区域。

`general.notificationToastDurationSeconds`（1–60 秒，默认 5）和 `general.notificationToastEffect`（复用统一 UI 动效 ID，默认 `fluid`）是通知提示卡偏好；唯一共享类型与默认值由本合同提供，声音继续使用既有 `general.notificationSound`。
