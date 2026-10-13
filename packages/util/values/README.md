# 共享纯数据合同

`application-id.ts` 是完整 App ID 权威，同时明确 Workspace/Minecraft 已接入的目录项目子集与 App 路由模式。注册 App 不自动开放项目执行。

`settings-contract.ts` 提供 Settings 类型、唯一默认值及 AI Runtime 每轮模型请求/工具调用的产品安全上限；Client 和 Settings 克隆后消费，不依赖 Node、数据库或 React，不创建第二套持久化。预算设为 0 时使用共享合同中的上限，正数只能收紧该上限。`builtin-backgrounds.ts` 提供内置背景元数据，使主题不再依赖 Minecraft UI；旧 UI 导出仅是迁移兼容入口，消费者迁完后再删除。

写入校验、旧值兼容、持久化、凭据与权限仍由 Settings/Storage Owner 管理。
