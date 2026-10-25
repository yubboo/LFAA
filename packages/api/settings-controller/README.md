# Settings API

本包登记认证后的设置路由，不复制身份、配置或数据迁移规则。系统数据根只读启动配置，由 workspace/data-directory 提供状态；系统数据迁移入口禁用。游戏、Writing、AI Video 的业务内容根及其复制/核对/ZIP 操作由 settings/project-storage 与 content-storage-migration 持有。

AI Provider 与模型目录由登录用户共享读取；新增、改模型/思考参数、刷新或测试已保存模型、替换 API Key、切换活动模型和删除系统模型都要求 `requireAuthentication + requireRole("admin")`。模型凭据继续由 Settings Owner 加密，不进入路由响应。用户级 `aiRuntime` 偏好另由原设置路由持有。

业务内容迁移路由要求管理员身份；写入、复制切换、手动核对切换及归档导入/导出均经过 Permission Owner 的 `authorizeExplicitUserAction`，页面上的明确操作按钮构成单次授权。系统复制只覆盖受管业务树并保留目标备份，手动模式核对 SHA-256，ZIP 脚本仅解包 `games/` 与账户项目目录。系统账号、AI Provider、会话、设置、环境、缓存、插件 Profile 和远端节点路径不由这些路由处理。

构建仅写根 dist/packages/api/settings-controller；[数据与文件合同](../../../docs/development/file-resources.zh.md)。真实服务重载与数据迁移不由构建代替。

## 小鱼共享工作入口（2026-10-14）

GET /ai/skills 通过实际 Skill Registry 返回当前账户可见摘要、来源和账户 `plugins.disabledSkillNames` 派生的 `enabled` 状态；隐藏绝对路径、资源基址和正文。插件总开关仍按原规则过滤非内置技能；单项停用由 Skill Tool Owner 在目录和正文加载时执行。

`GET /settings/parental` 只返回认证账户自身的策略与每日用量；管理员可通过账户 ID 查看成员策略并取得可管理成员列表。`PUT /settings/parental/:accountId` 要求管理员角色，Identity/Auth Owner 再次验证目标为普通成员、校验时区和七天策略并返回真实回读。Agent 工具不绕过这些 Owner 条件，统一 Permission Owner 在执行写工具前授权。

`GET /settings/sync/status` 要求认证并返回当前账户在此 Control Plane 的已保存设置分类和最近更新时间，使用 `private, no-store`，不返回设置内容或秘密。`PUT /settings/mini` 复用 Settings Owner 的严格 Mini 分类 schema；窗口生命周期不由该 API 假造。

构建只写仓库根 dist/packages/api/settings-controller/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
