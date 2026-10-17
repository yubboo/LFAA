# LFAA 共享启动与装配

Profile 的有序 Bundle、源码 Profile Patch、`<LFAA_HOME>/profiles/<Profile>/cordis.patch.yml`、兼容的 Home 根 Patch 和显式 `--patch` 依次合成 Loader 配置。默认 Home 由 `lfaa-launch-environment` 的 `LFAA_HOME` Owner 解析；旧 `LFAA_HARNESS_HOME` 和显式 `--home` 仍可覆盖。启动时只创建空 Profile Patch 模板，不复制或迁移用户数据。Patch 可将既有插件 ID 指向替代模块；`required` 行不可禁用，但可替换实现。替代包必须真实提供消费者所需服务，缺失服务时启动/消费合同失败，不回退到原实现或假成功。配置和运行状态仍由 Profile、Loader 与各 Service Owner 持有；Profile 依赖仍由项目工作区管理，LFAA 不会在用户目录自动安装任意依赖或运行安装脚本；细节对照见 `docs/development/dsh-lfaa-extension-audit-20261017.md`。

AI Host 的 loadInstruction 仅转发同一 AiExtensionRegistry 的按需正文读取；listInstructionExtensions 只给摘要，getSystemInstructions 只提供主 Agent 核心指引。领域内容不再按 App 自动注入。专家角色由原 Agent Loop 显式选择并继承原权限/预算；Host 不另建内容库、Agent 或注册表。
