# Settings API

本包登记认证后的设置路由，不复制身份、配置或数据迁移规则。系统数据根只读启动配置，由 workspace/data-directory 提供状态；系统数据迁移入口禁用。游戏、Writing、AI Video 的业务内容根及其复制/核对/ZIP 操作由 settings/project-storage 与 content-storage-migration 持有。

AI Provider 目录由认证用户读取，账户集合由 Settings Owner 按 system/user scope 限定：普通 Provider 系统账户的新增和管理仅管理员可写；火山方舟 Agent Plan/Coding Plan 账户仅所属登录用户可管理，跨用户账户返回未找到，不能作为共享模型使用。模型凭据由 Settings Owner 加密，不进入路由响应。用户级 `aiRuntime` 偏好仍由原设置路由持有。

业务内容迁移路由要求管理员身份；写入、复制切换、手动核对切换及归档导入/导出均经过 Permission Owner 的 `authorizeExplicitUserAction`，页面上的明确操作按钮构成单次授权。系统复制只覆盖受管业务树并保留目标备份，手动模式核对 SHA-256，ZIP 脚本仅解包 `games/` 与账户项目目录。系统账号、AI Provider、会话、设置、环境、缓存、插件 Profile 和远端节点路径不由这些路由处理。

构建仅写根 dist/packages/api/settings-controller；[数据与文件合同](../../../docs/development/file-resources.zh.md)。真实服务重载与数据迁移不由构建代替。

账户资料 API 复用 `settings-snapshots` 归档 Owner；Control Plane 装配的 `lfaaAttachments` 仅用于 v2 迁移包导出与附件恢复。`/settings/import/export` 导出 v2 gzip 文件，预览与恢复同时接收 v1/v2；上传仍要求认证和既有 Settings/Memory/Session 校验。请求体上限为 256 MiB，附件按目标用户写入 Attachment Owner；不在 Controller 中解析会话或直接读写附件目录。

## 小鱼共享工作入口（2026-10-14）

GET /ai/skills 通过实际 Skill Registry 返回当前账户已登记且可见的摘要、来源分类和账户 `plugins.disabledSkillNames` 派生的 `enabled` 状态；`origin` 将 LFAA 内置、账户安装、本机、项目和自定义 Skill 区分开，隐藏 Provider、绝对路径、资源基址和正文。插件总开关关闭时，仍展示内置与账户已安装 Skill，并标记账户 Skill 暂不可用；本机文件系统 Skill 仍遵循现有 Host 访问开关。单项停用由 Skill Tool Owner 在目录和正文加载时执行。

`GET /settings/parental` 只返回认证账户自身的策略与每日用量；管理员可通过账户 ID 查看成员策略并取得可管理成员列表。`PUT /settings/parental/:accountId` 要求管理员角色，Identity/Auth Owner 再次验证目标为普通成员、校验时区和七天策略并返回真实回读。Agent 工具不绕过这些 Owner 条件，统一 Permission Owner 在执行写工具前授权。

`GET /settings/sync/status` 要求认证并返回当前账户在此 Control Plane 的已保存设置分类和最近更新时间，使用 `private, no-store`，不返回设置内容或秘密。`PUT /settings/mini` 复用 Settings Owner 的严格 Mini 分类 schema；窗口生命周期不由该 API 假造。

构建只写仓库根 dist/packages/api/settings-controller/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。

外观预设的 `/settings/appearance-presets/validate` 仅认证并做快照结构校验，不写入账户设置；它允许移植文件中的源账户背景 ID 留待重上传。`/apply` 则委托 Settings Owner 验证当前账户背景归属，并原子保存白名单中的 Appearance 与 General 字段。背景字节仍只经现有认证 `/settings/backgrounds/:id` 读取和 `/settings/backgrounds` 上传。
