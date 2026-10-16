# Minecraft 领域服务

模型可用 `minecraft_resolve_core_artifact` 只读获取同一工件 Owner 的核心、构建、摘要和实际 Java 要求；环境的安装状态不能代替核心要求。`minecraft_provision_server` 暴露领域服务已有的 `javaRuntimeId`，用户指定环境时原样传递并在登记任务前验证；不匹配返回未开始，不自动更换指定环境。工件连接失败也仅在事务前标为可恢复的未开始，任务创建后的异常仍保留未知副作用边界。

`service.ts` 持有实例、配置、部署和 Java 管理事实；`core-sources.ts` 解析 PaperMC Fill v3、FastMirror 和 Mohist Youer 的真实版本、分页构建与校验摘要，并唯一登记核心名称。API 与模型工具共用这些服务，执行位于目标 Daemon。明确 Paper 时只查询官方目录，工件 URL/SHA-256 与最低 Java 来自对应版本/构建元数据；省略 build 时选择该版本最新 STABLE，不静默替换版本。未指定端口时在同一数据库事务内从设置默认值起避开已登记实例端口，启动前由节点检查真实监听。设置中心读取核心名称不触发远端版本目录查询；实际部署和版本选择仍使用实时来源合同。

新入口为 `provisionMinecraftServer`，默认核心从独立的账户 Minecraft Runtime 配置读取（初始 Paper），执行方式为该分类中账户明确选择的 native。AI Provider 与推理参数属于 `ai-runtime`，不会承载 Minecraft 默认值。环境准备、下载、安装、配置和启动由同一个持久任务完成；仅收到真实就绪证据才标记成功。Forge/Sponge 加载器及 PocketMine PHP 使用各自协议。代理必须选择同节点已运行、明确关闭正版验证的后端，不静默修改后端认证。EULA/核心许可接受在操作摘要中明确说明，并沿用统一三种权限模式。

开服 Skill 资源和原 Provider 已迁入 `packages/skill/minecraft`，作为独立插件注册并在卸载时撤销，通过 `lfaa_skill_list/load` 的 registry 来源按需读取，不由本 App 服务挂载。提示词正文归 `packages/prompt/minecraft`，模型工具合同归 `packages/games/tool-minecraft`；通过共享目录跨界面选择，核心/实例/部署事务仍归本包。没有复制原资料中的固定路径、当前版本断言或独立启动/备份脚本；实际执行仍归领域工具与 Daemon。它不承诺全部核心、真实 Provider 成功率或公网连通。

恢复限于已确认失败且同一摘要的原实例，节点核对目录归属、已有文件与进程标记；租约过期结果未知不能重放。旧 Vanilla 下载/注册接口标注兼容用途，替代位置为自动开服服务，待旧记录和调用方迁移完成后删除。旧 AppContainer 实例保留元数据，显式选择 AppContainer 时仍 fail closed，不自动降级。

账户运行配置来自 settings；节点实例相对根目录来自 storage configuration，既有实例路径不移动。数据库版本 35 保留旧实例、任务、日志与外键，增加核心、构建、执行方式及工件快照。

Paper 官方构建的最低 Java 字节码版本与官方推荐运行版本共同决定 `javaMajor`，复用同一插件核心规则。Paper 1.12.2 最低为 8，推荐为 11，项目已有 Java 11 时直接复用，不因为 Fill 元数据的 minimum 字段再下载 Java 8。依据为 [Paper 官方运行要求](https://docs.papermc.io/paper/getting-started/#requirements)。

长期回归位于 `apps/cli/tests/minecraft-{multicore,provisioner,task-leases}.test.mjs`。经明确 EULA 授权可运行 `minecraft-live-deployment.test.mjs`，只操作独立临时数据；支持按核心、版本与账户停服预算验收。具体命令、已验证构建、上游兼容问题及未测量边界见 [开发与验收记录](../../../docs/archive/audits/minecraft-deployment-plan.md)。构建输出只进入根 `dist/packages/games/minecraft/`。

玩家联机不是此部署服务的副作用。Minecraft App 通过 `lfaa-game-connectivity` 注册 Java TCP 目标适配器；联机 App 只列出当前账户拥有、节点在线且实际运行的实例，并读取真实保存端口生成回环目标。网络路线由跨游戏 Connectivity Owner 管理，不调用 Minecraft 部署或启停服务。
