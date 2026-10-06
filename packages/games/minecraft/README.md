# Minecraft 领域服务

`service.ts` 持有实例、配置、部署和 Java 管理事实；`core-sources.ts` 解析 FastMirror 的 16 类核心和 Mohist Youer 的真实版本、分页构建与校验摘要；`deployment-service.ts` 原子登记一次面板自动开服的实例、部署和节点任务。API 与模型工具共用这些服务，执行位于目标 Daemon。

新入口为 `provisionMinecraftServer`，默认核心从独立的账户 Minecraft Runtime 配置读取（初始 Paper），执行方式为该分类中账户明确选择的 native。AI Provider 与推理参数属于 `ai-runtime`，不会承载 Minecraft 默认值。环境准备、下载、安装、配置和启动由同一个持久任务完成；仅收到真实就绪证据才标记成功。Forge/Sponge 加载器及 PocketMine PHP 使用各自协议。代理必须选择同节点已运行、明确关闭正版验证的后端，不静默修改后端认证。EULA 由用户明确同意。

恢复限于已确认失败且同一摘要的原实例，节点核对目录归属、已有文件与进程标记；租约过期结果未知不能重放。旧 Vanilla 下载/注册接口标注兼容用途，替代位置为自动开服服务，待旧记录和调用方迁移完成后删除。旧 AppContainer 实例保留元数据，显式选择 AppContainer 时仍 fail closed，不自动降级。

账户运行配置来自 settings；节点实例相对根目录来自 storage configuration，既有实例路径不移动。数据库版本 35 保留旧实例、任务、日志与外键，增加核心、构建、执行方式及工件快照。

长期回归位于 `apps/cli/tests/minecraft-{multicore,provisioner,task-leases}.test.mjs`。经明确 EULA 授权可运行 `minecraft-live-deployment.test.mjs`，只操作独立临时数据；支持按核心、版本与账户停服预算验收。具体命令、已验证构建、上游兼容问题及未测量边界见 [开发与验收记录](../../../docs/minecraft-deployment-plan.md)。构建输出只进入根 `dist/packages/games/minecraft/`。

玩家联机不是此部署服务的副作用。Minecraft App 通过 `lfaa-game-connectivity` 注册 Java TCP 目标适配器；联机 App 只列出当前账户拥有、节点在线且实际运行的实例，并读取真实保存端口生成回环目标。网络路线由跨游戏 Connectivity Owner 管理，不调用 Minecraft 部署或启停服务。
