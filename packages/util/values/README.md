# 共享纯数据合同

`application-id.ts` 是完整 App ID 权威，同时明确 Workspace/Minecraft 已接入的目录项目子集与 App 路由模式。注册 App 不自动开放项目执行。

`settings-contract.ts` 提供 Settings 类型、唯一默认值及 AI Runtime 每轮模型请求/工具调用的产品安全上限；Client 和 Settings 克隆后消费，不依赖 Node、数据库或 React，不创建第二套持久化。`appearance.theme` 新用户默认 `system`（跟随系统），六个 `appearance.backgrounds` 位置默认 `none`（纯色，由当前主题提供画布色）；Settings Owner 对缺失值使用这些默认，同时保留账户已保存的主题和背景。`aiRuntime.showContextUsage` 对缺少已保存偏好的账户默认开启；Settings Owner 仍保留账户明确保存的开/关选择。General 默认值定义首次登录提醒类别状态及统一通知总开关；旧账户缺少新增字段时由 Settings Owner 回落到共享默认值，设置中心不暴露提醒类别开关。预算设为 0 时使用共享合同中的上限，正数只能收紧该上限。`builtin-backgrounds.ts` 提供内置背景元数据，使主题不再依赖 Minecraft UI；旧 UI 导出仅是迁移兼容入口，消费者迁完后再删除。

`general.cardMotionEffect` 与 `general.dialogMotionEffect` 是常规设置中独立的卡片/弹窗动效选择；`UI_MOTION_EFFECT_OPTIONS` 统一持有 ID、展示名称、说明和唯一默认值（`fluid`）。视觉实现由 `client/ui-theme` 消费，不在本包定义 CSS。

写入校验、旧值兼容、持久化、凭据与权限仍由 Settings/Storage Owner 管理。

2026-10-14：FileResourceLocation 描述独立导航，ManagedFileEntry 保留真实文件类型与可执行操作/说明；位置投影不授予文件权限，也不混入物理目录条目。

## 节点文件二进制传输边界

`src/file-transfer-contract.mjs` 是 Control Plane、Daemon 与 Client 共用的传输限制来源：单文件 3 MiB、Control Plane 内总预留 20 MiB、暂存 5 分钟。此处只定义稳定协议常量，不持有文件字节或运行状态。

## 小鱼共享工作入口（2026-10-14）

声明根路由 `/`、`/tasks` 与旧 App AI Work 地址归一到 `/work`，以及 AgentAssociations 纯值校验；引用有界、唯一，不含正文或执行授权。

构建只写仓库根 dist/packages/util/values/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

`settings-contract.ts` 是首次登录提醒与通知的唯一默认值来源，包含凭据、AI Provider、业务内容目录的提醒状态及全局通知开关；SteamCMD 游戏安装位置不触发首次登录提醒，版本公告确认按账户/版本保存在浏览器本地，不作为 General 设置。旧账户缺少新增字段时由 Settings Owner 使用共享默认值补齐。

`PluginSettings.disabledSkillNames` 是账户级逐 Skill 停用列表，唯一默认值为 `[]`。持久化、严格校验、读取和运行时执行由 Settings/Skill Owners 负责；本包不创建 UI 状态或第二份设置存储。

`GeneralSettings.hiddenApplicationNavigationIds` 保存被用户从全局“应用”菜单隐藏的内置导航 ID，唯一默认值为 `[]`。此偏好仅控制菜单可见项，不授予或撤销应用权限、不卸载应用；ID 白名单与 Workbench 应用导航清单保持一致。

2026-10-23：`browser-provider.ts` 统一登记 `BUILTIN_BROWSER_WORKSPACE_ID`，供 Web/Desktop Client 与 Browser Run Adapter 绑定同一个账户内置浏览器工作区，避免 AI 会话切换导致页面分裂。

`settings-menu-catalog.ts` 是设置中心菜单 ID、标题、分组、账户设置分类、Agent 接入类型与未接入说明的共享只读目录。设置导航和 Agent 设置目录从这里读取菜单语义，避免菜单名称、分类映射与接入状态各维护一份。

`MiniSettings` 属于账户级 `UserSettings.mini`，共享唯一默认值和 companion 枚举供 Client、Settings、Electron 与 Agent 字段目录消费；配置数据仍由 Settings Owner 持久化，Electron 本机窗口状态不会成为第二套账户偏好。
代码审查菜单的 `tools` 路由使用当前 Agent Git Workspace 的 `project_file_operation` 差异读取能力；未绑定仓库时由 Owner 如实返回不可审查边界。

`hooks` 菜单使用 `tools` 路由并发现 `lfaa_settings_runtime_hooks_list`；当前只读当前 Host 已登记的 AI Runtime Hook ID/事件。钩子代码仍由受信任插件 Owner 管理，不接受通用设置 Patch。
