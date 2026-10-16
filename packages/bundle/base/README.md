# 共享能力基础组合

2026-10-16：子 Agent 委派/控制工具显式依赖 lfaaSessions，任务来源和结果持久化由原 Session Owner 提供；本组合仅声明装配顺序，不持有任务状态或执行规则。

本包只提供 Control Plane 的有序 Cordis 组合补丁和 workspace 依赖，不持有领域规则、Prompt/Skill/Expert 正文或工具执行器。

`cordis.patch.yml` 装配原存储、身份、设置、权限、Agent、Session、Tools 与领域服务；本轮新增独立 Prompt/Expert/Skill Provider 和领域工具插件。工具声明依赖 `lfaaMinecraft`、`lfaaSteamcmd`、`lfaaRuntimeManager` 或 `lfaaWriting`，领域服务未就绪/卸载时不继续登记其能力。Shared Registry 管理元数据和撤销，模型按目标选择具体方法与工具合同。

Profile 决定启动组合，账户和业务设置仍归各原 Owner；本包不覆盖用户偏好，不按界面 App 复制实现，也不扩大权限或节点能力。组合必需性、依赖与卸载使用原 Boot/Loader 合同。构建输出为根 `dist/packages/bundle/base/`。

完整 Web Profile 回归位于 `apps/cli/tests/harness-runtime-wiring.test.mjs`，覆盖真实插件装配及合成 Provider 执行链；现场 Provider、浏览器、桌面和远端验收另行记录。
