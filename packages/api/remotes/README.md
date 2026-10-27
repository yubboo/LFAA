# api/remotes

## 小鱼共享工作入口（2026-10-14）

共享 API 输入合同：可选关联只接受有界 App/能力 ID 引用，不接收正文或权限变更。

AI Provider 新凭据替换合同只接收一个 1–4096 字符的 `secret`；不接收 Provider ID、URL、模型或用户 ID，目标配置 ID 与 Provider/模型由 Settings Owner 读取，写入路由另要求管理员角色。

构建只写仓库根 dist/packages/api/remotes/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

实际验收发现心跳合同漏登 node-filesystem-instance-v1 和 node-filesystem-game-storage-v1，已与真实 Daemon 声明对齐；未知能力仍拒绝，未放宽通配字符串。

SteamCMD 服务端配置、服务端任务、完成结果和 Daemon 心跳状态由 `route-contracts.ts` 持有 Joi 边界。配置只接收 Tool AppID、相对目录、参数数组、停服命令、等待时间及 EULA 布尔确认；Shell 执行和领域状态归 SteamCMD Service/Daemon。任务结果拒绝未登记字段；完整卸载回执允许 `removed` 与 `uninstalled` 布尔值，路径仍只接受工具目录和游戏目录字段。

`steamcmdDstClusterSchema` 只接收安全集群名、Steamworks Tool AppID、安装相对目录、显式停服命令、等待秒数和 EULA 确认。集群令牌仅由目标节点文件管理器写入，绝不能进入该 API 的普通 JSON。

Daemon 心跳能力列表显式登记 `node-filesystem-binary-transfer-v1`；节点 Java 摘要允许可选的 `distribution`，但只接受 `temurin`/`zulu`；节点文件任务合同拒绝 `dataBase64`，二进制结果只接受有界传输 ID 与元数据。新协议通过能力协商启用，旧 Daemon 不会收到需要该协议的文件操作。

`miniSettingsSchema` 从 Settings Owner 导出并由 API Controller 用于账户 Mini 偏好写入；本包不持有 Mini 窗口状态或偏好默认值。

`aiChatMessageSchema.workspaceView` 只接受登记的右侧面板枚举、两个开合布尔值和可选 HTTP(S) Browser Dock 地址；地址仅允许在浏览器面板打开时出现，未知字段拒绝。它是单次请求提示，不新增权限或能力合同。

`appearancePresetSnapshotSchema` 与 Settings Owner 共用外观预设快照白名单。API route-contracts 只转出该既有合同，不在远程接口层复制主题、背景或布局默认值。
# Agent 工作台视图

`aiWorkbenchViewSchema` 校验可选的 Canvas/Workflow 当前 App ID、UUID、短标题与 ISO `updatedAt`。它们只是当前工作区定位信息，既不扩展 Tool Scope，也不替代画布/工作流 Owner 的真实读取与版本冲突校验。
