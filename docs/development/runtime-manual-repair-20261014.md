# 2026-10-14 手动开服与运行环境修复验收

当前合同：`LFAA-RUNTIME-MANUAL-REPAIR-20261014`。工作副本 `H:/LFAA1`，保留此前全部未提交工作；本轮未提交、未发布。用户凭据仅用于真实浏览器登录，没有写入文档或源码。

## 已修复的行为

- Minecraft 的环境菜单进入游戏库共享运行环境，支持部署草稿、实例原路返回以及对应服务器跳转。旧 Java 管理 UI 移除；运行环境分类为 Java、SteamCMD、Microsoft Visual C++、DirectX。
- 手动部署默认端口被同节点实例登记时建议下一个空闲登记端口，显式输入仍保留；重名、端口冲突、旧 Java 选择不适用于当前版本/节点时先提示，禁止提交错误参数。成功提交消耗当前草稿，立即进入真实任务页面。
- Java 配置要求、已发现环境和运行状态分开呈现。截图中 Java 8 的“正在使用”来自旧失败实例的声明及未知状态，不能证明 Java 8 已安装或运行。新页面只按设备实际版本检测显示安装状态。
- 实例列表提供可恢复删除：运行/活动任务拒绝；已停止/失败或未知状态交由节点核实进程、目录及身份。完整目录移入节点 `backups/minecraft/deleted-instances` 后才删除实例及关联部署登记；任务历史保留。目录不存在时明确回报，没有伪造文件操作。
- Java、Minecraft 目录与工件、SteamCMD 引导包共用支持进程代理/NO_PROXY 的独立官方资源传输，连接重置及临时 HTTP 错误有界重试，失败/取消关闭响应流与清理未完成文件，保留摘要、HTTPS 来源及身份校验。
- Microsoft 运行库通过只读注册表/DLL 检测；官方安装包经 Microsoft 数字签名核验后保存，明确 `installed:false`，不自动执行系统安装器。修复 PowerShell 模块路径继承与中文错误编码问题。
- 环境卡片使用共享主题与外观令牌，按容器宽度切列；实例详情窄分栏改为单列，设备选择框限制在容器内。

## 设置和权限

没有新增账户偏好或重置用户配置。复用：`permissions.mode`；`minecraftRuntime.minecraftDefaultCore`、`minecraftDefaultMemoryMb`、`minecraftDefaultPort`、`minecraftBedrockDefaultPort`、`minecraftExecutionMode`、`minecraftDownloadTimeoutSeconds`、`minecraftReadyTimeoutSeconds`、`minecraftStopTimeoutSeconds`；项目存储 `runtimeDirectory`、`downloadCacheDirectory`、`temporaryDirectory` 及节点覆盖；原 SteamCMD `installMode`、`steamcmdDirectory`、`gameDirectory`。外观继承主题、强调色、字体/字号、代码字体、对比度、壁纸、遮罩透明度、模糊与减少动态效果。EULA/模型工具继续统一三种权限，不增设第二套确认策略。

## 本轮实际证据

- 使用用户指定账号在真实浏览器登录，通过常规向导新建 `mc-1.16.5`：Paper 1.16.5 / build 794，按领域推荐准备 Java 16，真实下载官方 JDK 与核心并校验；任务成功，节点真实日志 `Done (4.109s)`，本机 TCP 25570 监听。安全停服日志确认三个世界分区保存并退出。
- 首次提交遇到 PaperMC 来源连接失败，未创建实例；重新提交成功。不能保证上游永不断网，不能把这次失败删除或说成全程无网络问题。新增长期回归覆盖连接重置重试、取消和普通 404 不重试。
- 第二次浏览器部署 `delete-check-1.16.5` 复用已有 Java 16 和核心缓存；默认自动建议 25568。显式输入已登记的 25565 显示警告且“核对部署信息”不可用；恢复 25568 后完成真实开服及安全停服。
- 浏览器删除上述专用实例成功：原目录不存在、数据库实例及关联部署已移除，完整目录保存在 `H:/LFAA1/data/backups/minecraft/deleted-instances/8511a05a-40f2-4307-83a5-160cc9ef5026-c2608445-35c2-4407-a132-0152327f8ba9`。用户的其他实例没有删除。
- Visual C++ x64 官方安装包 18,731,856 字节、DirectX June 2010 官方包 100,275,120 字节下载并通过 Windows Microsoft 签名核验，分别位于 `data/environments/VisualCpp` 和 `data/environments/DirectX`；没有运行这两个系统安装器。实际检测到本机 VC v14.44.35211.00（x86/x64）及 D3DX9_43 9.29.952.3111，不宣称所有旧游戏依赖齐全。
- SteamCMD 官方引导 ZIP 的真实 HTTPS HEAD 返回 200、长度 774,825 字节；完整安装/首次更新的浏览器结果在本记录完成时补齐。
- 41 项定向回归全部通过（任务/取消/迁移/归档/Java/下载/三模式/Agent/API/账户与存储）；Control Plane、Web 类型检查及正式构建、182 个能力包构建通过。Web 有既有大 chunk 告警，未以提高告警阈值掩盖。最终 Gate、指纹及窄屏复验结果在完成时补齐。

## 实际数据整理

核实无运行 Java 占用后，按用户授权把当前目录改为：

- `H:/LFAA1/data/environments/Java/Java11-windows-x64`
- `H:/LFAA1/data/environments/Java/Java21-windows-x64`
- `H:/LFAA1/data/environments/Java/Java25-windows-x64`
- 新下载的 16 使用 `H:/LFAA1/data/environments/Java/Java16-windows-x64`。

内部 `temurin-<主版本>` ID 保留以兼容真实实例；Eclipse Temurin 厂商名仍如实显示。同步现有 Sandbox 的 `javaRootName` 引用，原 JSON 保存到 `data/backups/runtime-layout-20261014`。其他 data 目录分别属于账户、凭据、数据库、缓存、存档、日志和备份 Owner，没有擅自搬迁或清空真实数据。

## 性能与未测边界

环境清单本机结果 60 秒缓存且合并并发发现；读取任务使用现有串行、隐藏暂停的 poller，卸载撤销；环境检测与服务器投影有数量上界，不递归扫整盘。控制端节点 ID 每次 overview 只读取一次，未按服务器逐项同步读文件。下载进度仍有节流，代理连接随响应释放。

静态/隔离回归与真实浏览器证据分别记录。未测：帧时间/主线程长任务量化、实际手机/平板设备、第二台远端机器、Linux/macOS、Minecraft 客户端登录、局域网第二台设备访问和公网可达性；本机监听不代表上述网络验收。AI Work 工具接入通过隔离 Provider/权限回归，本轮没有重复调用真实付费 Provider。

## 官方来源

- [Adoptium API 使用说明](https://github.com/adoptium/api.adoptium.net/blob/main/docs/cookbook.adoc)
- [Microsoft Visual C++ 官方下载](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170)
- [DirectX June 2010 官方下载](https://www.microsoft.com/en-us/download/details.aspx?id=8109)

## 本轮逐文件变更清单

以下仅列本轮实际改动，不把先前工作树的其他修改算作本轮交付。新增 SteamCMD 目录提升回归后共 47 个源码/文档/回归文件。

| 文件绝对路径 | 职责与本轮变化 |
|---|---|
| [H:/LFAA1/docs/PROMPTS.md](../PROMPTS.md) | 登记本轮目标、设置、权限与验收边界 |
| [H:/LFAA1/docs/系统总体架构.md](../系统总体架构.md) | 同步环境分类、下载和删除归档事实 |
| [H:/LFAA1/docs/开发计划.md](../开发计划.md) | 链接本轮交付及未测边界 |
| [H:/LFAA1/docs/development/runtime-manual-repair-20261014.md](runtime-manual-repair-20261014.md) | 完整证据、设置、数据迁移和逐文件清单 |
| [H:/LFAA1/packages/client/ui-layout/src/GameLibraryPage.tsx](../../packages/client/ui-layout/src/GameLibraryPage.tsx) | 共享页面加载、任务与 App 入口导航 |
| [H:/LFAA1/packages/client/ui-layout/src/GameLibraryPage.css](../../packages/client/ui-layout/src/GameLibraryPage.css) | 分类卡片、主题与窄屏约束 |
| [H:/LFAA1/packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx](../../packages/client/ui-layout/src/RuntimeEnvironmentPanel.tsx) | 四类环境、实际检测、下载和对应服务器 |
| [H:/LFAA1/packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx](../../packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx) | 端口/名称/Java 校验及草稿消费 |
| [H:/LFAA1/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx](../../packages/client/ui-minecraft/src/MinecraftWorkspace.tsx) | 环境统一跳转、删除操作、要求与状态分开 |
| [H:/LFAA1/packages/client/ui-minecraft/src/MinecraftWorkspace.css](../../packages/client/ui-minecraft/src/MinecraftWorkspace.css) | 实例详情按容器切列和选择器收缩 |
| [H:/LFAA1/packages/client/ui-minecraft/README.md](../../packages/client/ui-minecraft/README.md) | 记录新手动流程、导航与删除边界 |
| [H:/LFAA1/packages/client/connection/src/runtime-api.ts](../../packages/client/connection/src/runtime-api.ts) | 环境包和对应服务器的共享类型 |
| [H:/LFAA1/packages/client/connection/src/api.ts](../../packages/client/connection/src/api.ts) | 实例删除请求和任务种类 |
| [H:/LFAA1/packages/games/runtime-manager/src/service.ts](../../packages/games/runtime-manager/src/service.ts) | 环境控制、包校验、节点快照及只读服务器投影 |
| [H:/LFAA1/packages/games/runtime-manager/README.md](../../packages/games/runtime-manager/README.md) | 记录分类与 Owner 边界 |
| [H:/LFAA1/packages/host/runtime-environment/src/executor.mjs](../../packages/host/runtime-environment/src/executor.mjs) | 统一 Java/Microsoft 检测和下载执行 |
| [H:/LFAA1/packages/host/runtime-environment/src/executor.d.mts](../../packages/host/runtime-environment/src/executor.d.mts) | 扩展非 Java 记录类型 |
| [H:/LFAA1/packages/host/runtime-environment/src/java-runtime.mjs](../../packages/host/runtime-environment/src/java-runtime.mjs) | Java 目录命名、旧目录操作及响应回收 |
| [H:/LFAA1/packages/host/runtime-environment/src/network.mjs](../../packages/host/runtime-environment/src/network.mjs) | 官方来源代理、有界重试和连接释放 |
| [H:/LFAA1/packages/host/runtime-environment/src/network.d.mts](../../packages/host/runtime-environment/src/network.d.mts) | 官方传输类型 |
| [H:/LFAA1/packages/host/runtime-environment/src/download.mjs](../../packages/host/runtime-environment/src/download.mjs) | 连接重置重试与失败下载回收 |
| [H:/LFAA1/packages/host/runtime-environment/src/runtime-io.mjs](../../packages/host/runtime-environment/src/runtime-io.mjs) | 最小系统环境和 PowerShell UTF-8 |
| [H:/LFAA1/packages/host/runtime-environment/src/windows-runtimes.mjs](../../packages/host/runtime-environment/src/windows-runtimes.mjs) | Microsoft 目录、检测、签名下载和清理 |
| [H:/LFAA1/packages/host/runtime-environment/src/windows-runtimes.d.mts](../../packages/host/runtime-environment/src/windows-runtimes.d.mts) | 安装包目录类型 |
| [H:/LFAA1/packages/host/runtime-environment/package.json](../../packages/host/runtime-environment/package.json) | 声明独立网络适配依赖 |
| [H:/LFAA1/packages/host/runtime-environment/README.md](../../packages/host/runtime-environment/README.md) | 执行器、命名及下载边界说明 |
| [H:/LFAA1/packages/games/minecraft/src/service.ts](../../packages/games/minecraft/src/service.ts) | 删除的状态、互斥、节点前置条件 |
| [H:/LFAA1/packages/games/minecraft/src/core-sources.ts](../../packages/games/minecraft/src/core-sources.ts) | 核心目录共用官方传输 |
| [H:/LFAA1/packages/games/minecraft/src/catalog.ts](../../packages/games/minecraft/src/catalog.ts) | Mojang 元数据共用官方传输 |
| [H:/LFAA1/packages/games/minecraft/package.json](../../packages/games/minecraft/package.json) | 声明官方传输包依赖 |
| [H:/LFAA1/packages/api/minecraft-controller/src/index.ts](../../packages/api/minecraft-controller/src/index.ts) | 认证实例删除入口 |
| [H:/LFAA1/packages/api/job-controller/src/runtime-routes.ts](../../packages/api/job-controller/src/runtime-routes.ts) | Microsoft 包参数校验 |
| [H:/LFAA1/packages/api/remotes/src/route-contracts.ts](../../packages/api/remotes/src/route-contracts.ts) | 归档能力和回执协议 |
| [H:/LFAA1/packages/jobs/jobs/src/minecraft-queue.ts](../../packages/jobs/jobs/src/minecraft-queue.ts) | 归档回执后事务删除并保留历史 |
| [H:/LFAA1/packages/storage/storage-sqlite/src/database.ts](../../packages/storage/storage-sqlite/src/database.ts) | v56 删除任务迁移，保留索引/外键/数据 |
| [H:/LFAA1/packages/storage/storage-domain/src/migration.ts](../../packages/storage/storage-domain/src/migration.ts) | 当前迁移链接入 v56 |
| [H:/LFAA1/packages/host/daemon/src/daemon.mjs](../../packages/host/daemon/src/daemon.mjs) | 目录归档、能力回报、Java 位置与官方下载 |
| [H:/LFAA1/packages/core/tools/src/runtime-tools.ts](../../packages/core/tools/src/runtime-tools.ts) | 共享下载参数及 update 校验对齐 |
| [H:/LFAA1/packages/core/tools/src/business-tools.ts](../../packages/core/tools/src/business-tools.ts) | 删除工具复用领域 Owner 与权限 |
| [H:/LFAA1/pnpm-lock.yaml](../../pnpm-lock.yaml) | 同步声明的工作区与网络依赖 |
| [H:/LFAA1/apps/cli/tests/runtime-environment.test.mjs](../../apps/cli/tests/runtime-environment.test.mjs) | 迁移、下载重试、签名失败与取消回归 |
| [H:/LFAA1/apps/cli/tests/minecraft-archive.test.mjs](../../apps/cli/tests/minecraft-archive.test.mjs) | 删除互斥、状态、归档回执与记录保留 |
| [H:/LFAA1/apps/cli/tests/agent-runtime.test.mjs](../../apps/cli/tests/agent-runtime.test.mjs) | 迁移版本断言同步 v56 |
| [H:/LFAA1/apps/cli/tests/harness-agent-api.test.mjs](../../apps/cli/tests/harness-agent-api.test.mjs) | API 集成迁移版本断言同步 v56 |
| [H:/LFAA1/apps/cli/tests/file-storage.test.mjs](../../apps/cli/tests/file-storage.test.mjs) | 旧存储恢复版本断言同步 v56 |

实际手工更新的数据文件：`H:/LFAA1/data/environments/sandbox/minecraft/4d3fe0bb-4e9c-4579-bbc0-5e980fc0bcde.json`（Java 目录引用）；原件备份 `H:/LFAA1/data/backups/runtime-layout-20261014/4d3fe0bb-4e9c-4579-bbc0-5e980fc0bcde.json`。游戏实例、Java/运行库下载、数据库迁移和日志属于上述 Owner 的真实执行产物，按目录记录，没有作为源码提交。

| 文件绝对路径 | 职责与本轮变化 |
|---|---|
| [H:/LFAA1/packages/host/daemon/src/steamcmd-installation.mjs](../../packages/host/daemon/src/steamcmd-installation.mjs) | 空目录/空 .gitkeep 的原子提升、失败回退、用户文件保护 |
| [H:/LFAA1/apps/cli/tests/steamcmd-installation.test.mjs](../../apps/cli/tests/steamcmd-installation.test.mjs) | 真实隔离目录验证占位保留和拒绝覆盖 |
