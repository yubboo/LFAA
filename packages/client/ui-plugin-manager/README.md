# LFAA 插件管理页

本包实现独立插件工作区：Profile 插件分区查看安装清单、检查 NPM/GitHub/Host 绝对路径来源；启用和停用按钮直接调用受认证的生命周期 API，安装和卸载直接调用受认证的管理 API；AI 扩展与运行时分区承载账户扩展开关、Skill 目录、能力目录、资料库、MCP 配置及 Cordis 模块启停/重建诊断；壁纸引擎插件分区承接 DSH Slot 原生设置。页面由 Workbench 在 `/plugin-manager` 路由按需装载；保留 DSH Host 的 `/plugins` 静态资源前缀。

插件来源解析、不可变版本、安装事务、真实 Runtime 状态和删除由 `packages/boot/plugin-manager` 持有；启停按钮调用 `packages/api/plugin-controller` 的受认证生命周期 API，由 Permission Owner 将当前明确点击作为单次用户授权并复核管理员身份、目标 App 和固定来源版本，再调用同一 Plugin Manager Owner 并返回真实 Runtime 状态。自然语言启停继续由现有 Agent Loop/Core Tools 按当前 `permissions.mode` 执行；安装和卸载按钮直接调用同一 Owner；安装绑定检查所得固定内容版本，卸载说明包含插件私有数据清理。插件文件位于 `LFAA_DATA_DIR` 派生的 Profile 路径。账户设置 `plugins.enabled` 只控制 AI 扩展，不改变 Profile 插件。

Host 本机来源输入指运行 LFAA 的 Host 绝对路径，不是浏览器/设备路径。当前只有明确适配的 Runtime 才能启停；无法运行的 DSH Bundle 以真实不兼容状态展示，不会导入控制端或 Client 主 Realm。来源脚本只作声明展示，不由本包执行。

页面读取 `permissions.mode` 显示当前授权模式，并消费现有角色、主题/字体/字号、对比度、壁纸/遮罩、模糊及减少动态效果共享映射；不新增设置或偏好。设置分类导航不再列出插件或 MCP，相关设置表单仅以独立模式嵌入本插件工作区。Profile 清单读取在进入分区时执行一次，用户可显式刷新；退出分区时中止未完成读取，没有后台轮询。

包入口：`src/index.ts`；按需客户端注册：`src/client/index.ts`；主消费者：`packages/client/ui-layout`。构建只写仓库根 `dist/packages/client/ui-plugin-manager/`。源代码/类型、包与入口构建、真实 Web 内置浏览器视口验收分别记录；构建不代表真实插件安装或生命周期已实测。
