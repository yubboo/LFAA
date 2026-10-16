# 共享纯数据合同

`application-id.ts` 是完整 App ID 权威，同时明确 Workspace/Minecraft 已接入的目录项目子集与 App 路由模式。注册 App 不自动开放项目执行。

`settings-contract.ts` 提供 Settings 类型、唯一默认值及 AI Runtime 每轮模型请求/工具调用的产品安全上限；Client 和 Settings 克隆后消费，不依赖 Node、数据库或 React，不创建第二套持久化。预算设为 0 时使用共享合同中的上限，正数只能收紧该上限。`builtin-backgrounds.ts` 提供内置背景元数据，使主题不再依赖 Minecraft UI；旧 UI 导出仅是迁移兼容入口，消费者迁完后再删除。

`general.cardMotionEffect` 与 `general.dialogMotionEffect` 是常规设置中独立的卡片/弹窗动效选择；`UI_MOTION_EFFECT_OPTIONS` 统一持有 ID、展示名称、说明和唯一默认值（`fluid`）。视觉实现由 `client/ui-theme` 消费，不在本包定义 CSS。

写入校验、旧值兼容、持久化、凭据与权限仍由 Settings/Storage Owner 管理。

2026-10-14：FileResourceLocation 描述独立导航，ManagedFileEntry 保留真实文件类型与可执行操作/说明；位置投影不授予文件权限，也不混入物理目录条目。

## 小鱼共享工作入口（2026-10-14）

声明根路由 `/`、`/tasks` 与旧 App AI Work 地址归一到 `/work`，以及 AgentAssociations 纯值校验；引用有界、唯一，不含正文或执行授权。

构建只写仓库根 dist/packages/util/values/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
