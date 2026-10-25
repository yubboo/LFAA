# 账户资料快照与恢复

`lfaa-settings-snapshots` 是设置中心账户资料归档与版本化快照的 Owner。它编排 Settings、Conversation Memory 与 Session 三个现有 Owner，并在 SQLite 中保存受限大小的 gzip 快照；不接管各数据域的原始持久化。

当前 v1 归档包括通用、外观、快捷键、AI 运行时、Minecraft 运行时、Git、Mini 与个性化设置、会话记忆及公开用户/助手对话文本。权限模式、插件/MCP 连接、计算机和浏览器访问设置、密钥、凭据、模型请求/工具原始日志、用量、项目路径、本机图片素材与运行中任务不进入归档。Mini 的账户偏好随归档迁移，窗口运行状态仍由本机 Electron Host 管理。会话恢复为已归档的独立会话，清除项目绑定；同账户同 ID 冲突时跳过，导入不会覆盖已有会话。

外部文件使用 `.lfaa-snapshot` gzip JSON 封装，携带 SHA-256 完整性校验。压缩体最大 32 MiB、解压体最大 128 MiB；会话正文最大 64 MiB，超限会失败，不会静默截断。跨 Owner 恢复先预览，设置与记忆均显式选择是否替换，并在后续 Owner 写入失败时补偿恢复先前设置/记忆。所有写入入口仍由调用方经过统一 Permission Owner；本包不实现第二套审批策略。

运行于 Control Plane。API Controller 与 Agent Tools 使用同一 Owner；用户账户、设置校验和三种权限模式沿用现有 Settings/Identity/Permission Owner。
