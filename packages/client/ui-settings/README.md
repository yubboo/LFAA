# 共享设置界面

设置中心不再呈现 Profile 插件、AI 扩展/MCP 或壁纸引擎插件分类。账户扩展开关、Skill 目录、能力目录、资料库、MCP 配置、Cordis 启停/重建诊断与 DSH 壁纸引擎 Slot 设置仍由本包持有表单和 Owner 调用，但只通过 `lfaa-client-ui-plugin-manager` 的独立模式挂载在最左侧“插件”入口；Profile 来源检查与安装清单也在那里展示。`plugins.enabled` 仅控制账户 AI 扩展。

SettingsPage 管理账户与产品已有配置，沿用共享主题、颜色、字体、字号、壁纸、遮罩/模糊、对比度和减少动态效果。项目与存储将唯一数据根选择置顶：默认、推荐、自定义为互斥草稿，选择后需显式保存；自定义可切回默认或推荐，路径仍由原 Owner 返回及校验。当前生效与待迁移位置分开展示，不把迁移计划展示成已生效；非超级管理员及启动配置锁定环境只读。分类目录采用容器响应式紧凑清单。

常规页的“界面动效”组分别提供卡片和弹窗的账户级单选与静态预览，支持键盘方向键切换；两者共享 `util/values` 效果目录并通过现有 General 自动保存。`ui-layout` 映射账户选择，卡片与 Ant Design Modal/确认弹窗消费 `ui-theme` 的集中样式。减少动态效果优先级高于具体选择。

日志、环境、缓存、临时文件及作品位置为从 data 派生的只读说明，不再提供独立根输入。RuntimeStorageSettings 只读显示真实节点环境目录；游戏目录展示原领域记录，存量位置不被重写。安装/迁移、认证授权与实际文件操作仍由各自 Owner 持有。

设置分区按需读取，并按账户缓存已完成的数据，不会为侧栏导航周期轮询。独立的工作区设置请求并发启动；用量页直接读取 Session Owner 的汇总投影，不逐条恢复历史会话。本轮不新增设置、不改变现有账户偏好、默认值或持久化。旧服务没有返回数据根合同字段时不编造默认/推荐路径。构建只写根 dist/packages/client/ui-settings。源码/类型/构建和实际浏览器/设备验收分别记录；[开发提示词](../../../docs/development/file-resources.zh.md)。

Minecraft 默认核心下拉框只依赖领域 Owner 登记的本地核心名称；远端版本目录仍由 Minecraft 领域接口按真实需要读取，不阻塞偏好页渲染。

## 小鱼共享工作入口（2026-10-14）

默认首页固定为 `/work` 小鱼智能体对话区；设置页展示固定首页说明，专业 App 由全局导航紧凑应用菜单进入。旧 `general.defaultMode/defaultStandaloneChat` 字段继续按原值读取和保存，避免设置其他项时覆盖账户数据，但不再决定路由。`general.showServiceStatus` 控制可见顶栏和全局导航连接状态点。原 Appearance `backgrounds.appCenter` 键保留，其设置标签改为“小鱼智能体工作区”，现有壁纸继续映射到 `/work`。Provider、主/子模型、预算、能力、权限与外观继续由原设置中心管理。

构建只写仓库根 dist/packages/client/ui-settings/；当前合同见 [开发提示词](../../../docs/development/xiaoyu-agent.zh.md)。构建、合成模型、浏览器与真实模型/节点验收分别报告。
