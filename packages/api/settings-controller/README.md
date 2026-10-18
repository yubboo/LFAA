# Settings API

本包登记认证后的设置路由，不复制身份、配置或数据迁移规则。系统数据根只读启动配置，由 workspace/data-directory 提供状态；系统数据迁移入口禁用。游戏、Writing、AI Video 的业务内容根及其复制/核对/ZIP 操作由 settings/project-storage 与 content-storage-migration 持有。

业务内容迁移路由要求管理员身份；写入、复制切换、手动核对切换及归档导入/导出均经过 Permission Owner 的 `authorizeExplicitUserAction`，页面上的明确操作按钮构成单次授权。系统复制只覆盖受管业务树并保留目标备份，手动模式核对 SHA-256，ZIP 脚本仅解包 `games/` 与账户项目目录。系统账号、AI Provider、会话、设置、环境、缓存、插件 Profile 和远端节点路径不由这些路由处理。

构建仅写根 dist/packages/api/settings-controller；[数据与文件合同](../../../docs/development/file-resources.zh.md)。真实服务重载与数据迁移不由构建代替。

## 小鱼共享工作入口（2026-10-14）

GET /ai/skills 通过实际 Skill Registry 返回当前账户可见摘要，隐藏绝对路径、资源基址和正文；按插件开关过滤，连接关闭撤销发现。

构建只写仓库根 dist/packages/api/settings-controller/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
