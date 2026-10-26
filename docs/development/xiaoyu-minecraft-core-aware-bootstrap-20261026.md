# LFAA 小鱼 Minecraft 核心识别与自然语言开服合同（2026-10-26）

## 目标

用户可以直接对小鱼说目标游戏版本、插件服/模组服、指定核心和实例名。小鱼应从核心 Owner 返回的能力分类理解该核心属于 Java 原版、插件、模组、混合、代理或基岩服务端；遵守用户明确指定，不静默替换核心。正常部署复用 `minecraft_provision_server`：在目标节点自动解析所选核心的真实工件及 Java 运行要求，复用匹配 Java，缺少时由目标 Daemon 的 Runtime Manager 按当前设置和受校验官方工件准备，再部署并等待真实就绪结果。

已有部署和 Java 自动准备链归现有 Owner，本任务不再实现第二套流程，不用固定关键词路由替代模型决策。小鱼按用户目标选择目录、运行环境和部署工具，并根据真实回执继续判断。UI 页面切换不是开服执行器；系统领域工具操作真实状态、回报任务和证据。

## 入口、Owner 与配置

- 模型选择与任务循环：`packages/core/agent-loop`、`packages/core/tools`。
- 核心名称、版本、兼容信息和 Java 要求：`packages/games/minecraft/src/core-sources.ts`，唯一核心目录 Owner。
- AI 合同：`packages/games/tool-minecraft/src/index.ts`；运行环境合同：`packages/games/tool-runtime`。
- 自动安装、许可操作、部署与就绪证据：Minecraft Deployment Service、Jobs Queue、目标 Daemon 与 Runtime Manager。
- 领域方法正文：`packages/skill/minecraft/assets/minecraft-server-setup/SKILL.md`，经已有 Skill Registry 按需加载。
- 沿用设置中心 Provider/模型、AI 请求/工具预算、`permissions.mode`、`minecraftRuntime` 默认核心/内存/端口/执行方式/超时、设备存储位置与节点覆盖；无新增设置，不重置用户偏好。
- EULA、核心许可、下载、安装、实例创建和启动继续由统一 Permission Owner 按三种权限模式执行；不得额外引入领域审批策略。

## 修改范围

- 在核心 Owner 为每个已登记核心补充清晰的服务端类型和兼容内容事实；保留上游 `category` 原值和既有下载/Java 规则。
- 在 AI 核心目录、工件读取与开服回执中传递该分类；用户点名核心或要求插件/模组时，小鱼按需核对该核心的兼容信息。核心不兼容时明确冲突，不偷偷换成其他核心。
- 在 Skill 方法中说明从自然语言识别目标、读取真实分类、复用一次性部署链、按结果恢复和交付；不可支持的版本/内容安装能力必须准确披露。
- 维护受影响 Minecraft、AI 工具与 Skill Owner README 和长期回归。

## 验收

- `minecraft_list_cores` 对所有已登记核心返回稳定、明确的 server type/compatible content；Paper 等插件核心不会因来源 `category=pure` 而被模型误认作无插件能力核心；混合核心会同时说明两类能力，代理/基岩核心不会冒充 Java 插件服或模组服。
- 指定 Paper/Forge/Arclight 等核心时模型可通过按需目录获得相符信息；工件预检返回同一核心 Owner 的实际 Java 版本，部署参数保留用户指定核心，不匹配或来源缺失时不派发任务。
- 一般部署仍由单一领域任务自动复用/准备 Java、校验工件、启动并等待真实任务回执；失败与未知状态不伪报成功、不重放未知副作用。
- 运行直接相关 Minecraft/Skill/工具合同回归、类型与包/正式入口构建、`check:workspace` 和 `git diff --check`；报告真实模型、Daemon/Minecraft 安装、EULA/启服与桌面设备测试范围。
- 不创建服务器、不下载 Java 或核心、不接受 EULA、不改变用户设置；无需 UI 新功能。

## 实施与验证记录（2026-10-26）

- 核心 Sources Owner 为全部 17 个登记核心提供 `serverType`/`compatibleContent`。`category` 及其代理/端口用途不变。核心名称按登记名大小写不敏感匹配，小鱼传 `paper` 也会回到唯一登记的 `Paper`。
- AI `minecraft_list_cores`、`minecraft_resolve_core_artifact` 和 `minecraft_provision_server` 均返回同一核心 Owner 的类型信息；部署回执附带所选核心、版本、Java 主版本要求和真实任务状态。Skill 指导模型先识别核心/兼容冲突，再复用现有单任务自动 Java 准备与部署，不增加固定业务编排器。
- 设置中心配置清点：沿用 Provider/模型与 `aiRuntime` 请求、上下文、工具和输出预算；`permissions.mode` 的请求审批/替我审批/完全访问；Minecraft Runtime 的默认核心、内存、端口、执行模式及下载/安装/就绪/停服超时；设备数据目录与节点存储覆盖。没有新增设置、持久化字段或偏好变更。桌面观察/点击沿用 `computerControl.enabled` 与统一 Permission Owner；Skill 明确按需操作且每个动作后重新观察，不打开开关或凭点击认定任务完成。
- 定向 Node 回归 21/21 通过，覆盖核心类型、大小写名、Paper Java 11 真实要求、自动部署合同、隔离节点工件校验、Skill 发现/撤销和跨 App 按需加载；无真实模型或节点部署。
- `pnpm run typecheck` 通过；`lfaa-games-minecraft`、`lfaa-tool-minecraft`、`lfaa-skill-minecraft` 包构建及 `pnpm run build:control-plane` 通过；`node scripts/runtime-build-state.mjs host` 返回 `[]`；`git diff --check` 通过。
- `pnpm run check:workspace` 仍报告 3 项既存文档问题：`left-preview-hover-flicker-20261025.md` 两张 `dist/.tmp` 截图不存在，`docs/PROMPTS.md` 缺 `lfaa-compact-application-center-anchor-20261025` 锚点；这些与本任务无关，未改动。
- 性能/风险边界：核心类型来自静态登记表；最多 17 次本地映射复制，不增加网络请求、轮询或后台任务。后续完整开服验收已覆盖真实 Provider、在线 Daemon 的 Java/核心下载、用户授权的许可与 EULA、实例创建、启动和本机就绪；公网连接、客户端实际登录、桌面电脑操控未测试。`/games/environments` 本批未改界面。

## 后续完整开服验收（2026-10-26）

- 用户明确要求验收完整开服流程，并在停于 EULA/Paper 许可步骤时授权继续；当时设置中心显示“完全权限”。目标为在线节点 `WIN-20250328BHE`、隔离实例 `xiaoyu-e2e-paper1122-20261026`、Paper 1.12.2 构建 1620、Java 11、默认端口 25565。此前启动的 Web 使用 `--no-local-daemon`，没有本机 Daemon；通过 Harness 正式入口重启为默认完整 Web，Control Plane、Web 与本机 Daemon 均启动后再执行验收。重启前没有运行实例或 Minecraft 任务。
- 小鱼先通过 Minecraft/Runtime Owner 查明 Paper 类型与 Java 11 要求，使用 Runtime Manager 安装并实际验证 Eclipse Temurin `11.0.32.1`（`verify=true`）；随后调用 `minecraft_provision_server` 一次完成部署。任务 `17a7a996-4270-4b49-9c76-8c43b4d2b1da` 返回 `succeeded`、100%；部署 ID `e31c027b`。用户授权对应本次指定实例的 EULA 与 Paper 许可记录。
- 实例 ID `17e265c3-a9a8-419b-b43c-ae4592d2480d`，状态 `running`、原生进程、4096 MB，节点 `WIN-20250328BHE`；路径 `C:\Users\Administrator\.lfaa\data\games\minecraft\xiaoyu-e2e-paper1122-20261026`。Owner 只读文件回执确认 `server.jar` 为 40,979,699 字节，`lfaa-provision.json` 的 SHA-256 为 `3a2041807f492dcdc34ebb324a287414946e3e05ec3df6fd03f5b5f7d9afc210`，与预检时 PaperMC 官方核心目录摘要一致；`lfaa-deployment.json` 记录 Paper/1620/Java 11，核心生成 `bukkit.yml`、`spigot.yml` 和 `paper.yml`。`eula.txt` 为 `eula=true`；`start.bat` 指向受管 Temurin 11，参数为 `-Xms1024M -Xmx4096M -jar server.jar nogui`；`daemon-process.json` 记录 PID 30220；`server.properties` 记录端口 25565、`online-mode=true`。
- Minecraft 服务器日志有 `Starting Minecraft server on *:25565`，世界维度生成后输出 `Done (4.943s)! For help, type "help" or "?"`；部署回执为 `locallyListening=true`。另用 Windows 只读进程与端口查询确认 PID 30220 的 `java.exe` 路径为受管 Temurin 11，并且本机监听 `::`:25565 的 owning PID 正是 30220；独立计算的 `server.jar` SHA-256 与 `lfaa-provision.json` 完全一致。因此已验证核心部署成功、进程运行和节点本机 25565 就绪。日志窗口未截到 Paper 启动横幅，核心身份由官方目录回执的工件摘要、部署元数据和核心生成配置互证；公网可达性、客户端实际登录和桌面电脑操控未验证。未改动其他实例、Minecraft 设置、权限、防火墙、端口转发或既有 Java 21。
