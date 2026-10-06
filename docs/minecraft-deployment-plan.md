# Minecraft 多核心与面板自动开服开发计划

任务：LFAA-MINECRAFT-DEPLOYMENT-02。开始：2026-09-30；记录更新：2026-10-01。状态：17 类核心代码与相关回归完成，16 类选定构建实机开服/正常停服通过；SpongeNeo 和浏览器视觉验收受外部环境阻塞，详见下表。

## 目标与边界

传统面板一次填写核心、版本/构建、目标节点、实例名称、内存、端口及 EULA 同意后，复用现有 Minecraft 服务与节点任务完成运行环境准备、下载校验、安装、配置和启动就绪确认。AI 入口复用业务能力，不把此面板任务扩展成第二套 Agent 或关键词流程。

允许修改 games/minecraft、client/ui-minecraft、client/connection、api/minecraft-controller、api/remotes、jobs/jobs、host/daemon、settings/settings 及其设置界面、storage-sqlite 的必要迁移和长期回归测试、对应文档。保留本轮开始时既有未提交工作，尤其执行控制合同、模型/提示词及依赖安装修改。构建仅输出根 dist，不发布、不提交版本、不移动用户实例、不自动重放未知结果。

## 配置盘点

| 权威配置 | 默认/归属 | 本次使用 |
|---|---|---|
| LFAA_DATA_DIR | 启动配置；实际目录按现行解析器 | 节点的真实实例、缓存、Java 数据 |
| Minecraft instanceDirectory | games/minecraft；全局默认+节点覆盖，configuration JSON | 新部署读取，旧实例保持记录目录 |
| minecraftRuntime.minecraftReadyTimeoutSeconds | 120 秒；账户 Minecraft Runtime 设置 | 自动开服与手动启动共享就绪预算 |
| minecraftRuntime.minecraftStopTimeoutSeconds | 30 秒；账户 Minecraft Runtime 设置 | 安全停服预算 |
| minecraftRuntime.minecraftDefaultCore | Paper；账户 Minecraft Runtime 默认值 | 初始核心，保留已保存选择 |
| minecraftRuntime.minecraftExecutionMode | native；账户 Minecraft Runtime 设置 | 多核心原生执行；显式 AppContainer 不静默降级 |
| minecraftRuntime.minecraftDefaultMemoryMb | 4096 MB；账户 Minecraft Runtime 默认值 | Java 实例表单默认值与任务快照 |
| minecraftRuntime.minecraftDefaultPort | 25565；账户 Minecraft Runtime 默认值 | Java/代理 TCP 默认端口 |
| minecraftRuntime.minecraftBedrockDefaultPort | 19132；账户 Minecraft Runtime 默认值 | 基岩 UDP 默认端口 |
| minecraftRuntime.minecraftDownloadTimeoutSeconds | 1800 秒；账户 Minecraft Runtime 设置 | 核心、加载器、Java/PHP 工件下载预算，30–7200 秒 |
| minecraftRuntime.minecraftInstallTimeoutSeconds | 900 秒；账户 Minecraft Runtime 设置 | 安装器/首次启动依赖准备预算，30–7200 秒 |
| general.language | 已保存语言或 system | Nukkit 首次启动语言，免交互语言向导 |
| appearance.theme/accentColor/advanced | 系统主题、强调色、字体/字号/对比度/减少动态效果 | 消费工作台和 Ant Design 的共享映射 |
| appearance.backgrounds.minecraft/overlay/blur | 当前已保存偏好 | 保留壁纸与遮罩，不局部覆盖 |

核心名称、分类、可信来源和安装协议属于固定能力登记；版本、构建与文件来自在线目录，不写死用户截图中的版本。新增可调行为须先接入设置中心。

## 阶段与验收

1. 来源与故障调查：核查 FastMirror、Mohist 当前页面实际 API；核实每种核心工件、校验信息、Java/PHP/安装器要求；追查离线节点、租约与启动日志。保留真实证据，记录接口不可访问项目。
2. 领域与执行：扩展多核心目录、真实构建选择、持久元数据和节点能力；原子提交自动开服任务，执行环境、下载、安装、配置、就绪检查。安装器和代理使用自己的启动合同，未接入能力禁用。
3. 面板：按核心分类提供版本/构建、目标、配置与部署摘要；显示真实阶段、错误及日志入口；控制端连接与 Daemon 在线状态分开；布局按内容收紧并响应工作台宽度。
4. 验证与记录：长期回归覆盖来源/摘要/参数校验、旧数据迁移、事务/互斥、断线未知与不重放、不同核心启动合同；Host/Client 类型检查和相关构建。真实 Windows Daemon、下载/安装、就绪/停服与浏览器设置映射分别登记，构建不代替实机验收。

## 调查记录

- 当前已迁入 packages 新架构。Minecraft 部署与注册仍限制 Vanilla，面板两步操作。
- 截图的浏览器 Socket 在线与节点离线并存；租约过期结果未知，不能自动重放。
- 当前 games/minecraft 与 client/ui-minecraft 缺少 package README；本次补齐实际职责和验证方式。
- FastMirror 页面可访问，为 SPA；web 文本工具无内容，通过实际 HTML/脚本核实接口。
- Mohist 页面可通过 HTTP 请求访问，web 文本工具访问失败；实际页面脚本公布 api.mohistmc.cn。
- 当前另有执行控制的未提交改动持续更新；本次不覆盖其实现，安全执行策略沿用其最新配置合同，不把普通进程宣称为 OS 沙盒。

## 开发与验证记录

### 2026-09-30：登记、来源和领域实现

1. 先登记 PROMPTS 合同与本计划，盘点运行、存储、外观配置。用户明确选择本机原生执行并授权独立测试接受 EULA；没有重置用户偏好或移动用户数据。
2. 核查 FastMirror 前端实际下载模块及 v3 API，接入 16 类核心；Mohist 页面公布的 API 接入 Youer。版本/构建在线获取，分页为 25 项；SHA-1/SHA-256 从来源解析，不接受浏览器提供任意下载地址或摘要。FastMirror 是用户指定的第三方镜像，不冒充核心维护者。
3. 数据库版本 35 保留旧 Vanilla 元数据、部署、任务、日志和外键，增加核心、构建、执行方式及工件快照。一次提交原子登记实例/部署/任务，名称与端口冲突拒绝且不留下额外记录。
4. 节点实现 Jar、Forge 安装器、Sponge Forge/Neo 加载器与 PocketMine PHP 协议。原生环境只继承必要系统字段，游戏/安装器不获得 Daemon 或模型密钥。实例配置和工件独占创建；恢复必须核对归属、摘要及已存文件，不覆盖已有用户修改。
5. 面板按纯净、模组、原版、代理、基岩分类，推荐普通插件生存服使用 Paper；加载真实构建，单在线节点可自动选中。填写后一次提交，任务在节点继续；错误/日志可追查，控制端 Socket 连接与 Daemon 在线分别显示。

### 2026-10-01：实机发现与修复

- 真实完成 API 原先拒绝新增就绪证据字段，修复为枚举字段校验，未知字段仍拒绝；不放宽认证或伪造成功。
- Nukkit 首次启动会等待语言输入，改读账户 language 并使用维护者支持的 `--language`。Java 输出 UTF-8，修复中文就绪行与感叹号识别。
- SpongeNeo 正式版构建没有 RC 后缀，修复加载器坐标解析，并增加正式版/RC 长期回归。
- 核心启动尾部错误在任务完成后才冲刷会丢失；改为完成前等待日志冲刷，保留真实 stderr 和退出原因。核心退出码 0 但未就绪仍失败。
- 旧 Java 下载存在固定 30 分钟与隐式跨域跳转；新 Java 下载复用校验下载器，任务携带账户预算，逐跳校验 HTTPS 可信域、核对 SHA-256，并回传实际字节进度。实测缺少 Java 25 时从官方包安装、版本核对后启动 Paper 26.2。
- SpongeForge 在 30 秒预算下已保存世界但 JVM 未及时退出，发生强制结束；经正式设置 API 将独立验收账户预算调为 90 秒后正常退出。产品保留已保存设置，选该核心时提示 90 秒建议；强制结束显示橙色状态和存档未确认提示，安全重启不在强制结束后继续启动。
- SpongeNeo 初次实测在启动时报告端口被占用。原验收端口来自 Windows 动态端口范围，测试改用 20000–29999 的实际空闲端口；尚未确认首次占用者，不能断言具体系统进程为根因。产品端口检查移到环境准备后、接近实际启动时，冲突仍据实报错，不自动换用户端口。
- PocketMine 显示官方 PHP 与核心自行管理内存，代理禁用世界备份。任务完成表示历史步骤完成，运行状态以实例当前事实为准。
- 面板消费共享字体/字号及主题；Ant Design 字号接入 interfaceFontSize，局部小字改用共享字号令牌。请求切换/卸载拒绝过期响应，不重复引入依赖。

## 实机核心矩阵

验收通过正式账户初始化、认证 API、真实 Windows Daemon 与独立 TEMP 数据目录；逐项下载/摘要/安装/实际就绪/正常停服，退出后清理临时实例。没有使用产品测试路由、权限绕过或假就绪。以下仅代表列出的版本/构建，不保证任意上游构建兼容。

| 核心 | 实际版本 / 构建 | 已观察结果 |
|---|---|---|
| Paper | 1.21.1 / build133；26.2 / build129 | 就绪与正常停服；26.2 自动安装 Temurin Java 25 后通过 |
| Fabric | 1.21.1 / 0.19.5-1.0.1 | 就绪与正常停服 |
| Forge | 1.21.1 / 1.21.1-52.1.16 | 安装器、就绪与正常停服 |
| Arclight | 1.21.1-forge / 1.0.2-d27101f | 就绪与正常停服 |
| CatServer | 1.18.2 / build170 | 就绪与正常停服 |
| Folia | 1.21.8 / build6 | 就绪与正常停服 |
| Leaves | 1.21.8 / build138-9331167 | 就绪与正常停服 |
| Purpur | 1.21.1 / latest | 就绪与正常停服；镜像以 latest 为构建标识，摘要随任务固定 |
| SpongeForge | 1.21.1 / 52.0.3-12.0.0-RC1789 | 就绪通过；30 秒强制停止，正式配置 90 秒正常退出 |
| SpongeNeo | 1.21.8 / 21.8.31-16.0.0 | 正式版解析与加载器下载校验通过；早期启动端口冲突；最后重测因官方 earlydisplay:9.0.16 依赖下载连接重置、安装器退出 1，未计为开服/停服通过 |
| SpongeVanilla | 1.21.1 / 12.0.0-RC1782 | 最新独立重测就绪与正常停服；早期两次在依赖重映射期间退出，原因未确认 |
| Vanilla | 1.21.1 / release | 就绪与正常停服 |
| BungeeCord | general / build2044 | 真实 Paper 后端条件、代理就绪与 end 正常停服 |
| Velocity | 3.4.0 / build566 | 真实 Paper 后端条件、代理就绪与正常停服 |
| Nukkit | general / build1250 | 免语言向导、就绪与正常停服 |
| PocketMine | general / 5.44.3 | 官方 PHP Windows ZIP 校验、安装、就绪与正常停服 |
| Youer | 1.21.1 / build232 | 就绪与正常停服 |

Arclight 的另外一项 **1.21.1-neoforge / 1.0.2-d27101f** 下载/安装后实际启动失败：`MixinTransformerError` 的底层 `ClassCastException` 为 `ArrayList cannot be cast to AnnotationNode`，发生于 MixinExtras 0.5.3 与 ASM 树转换。ASCII 路径也复现；Forge 分支通过。保留该上游构建/运行环境组合的失败事实，不自动换核心、不篡改 Jar，也不把某一构建失败表述为全部 Arclight 不可用。

## 验证命令与限制

从仓库根执行 `pnpm exec tsc --noEmit -p tsconfig.host.json` 通过。`pnpm run build:harness`（64 包）、`pnpm run build:control-plane`、`pnpm run build:daemon` 通过，实际输出在根 dist；新领域模块和 Daemon 执行文件进入产物。

从 `apps/cli` 执行：

```powershell
node --import tsx --import ./register-package-loader.mjs --test tests/minecraft-provisioner.test.mjs tests/minecraft-multicore.test.mjs tests/minecraft-task-leases.test.mjs tests/execution-control.test.mjs
```

21 项相关长期回归通过；包括旧数据库迁移/外键、运行设置快照、事务/重名、未知结果不重放、真实端口冲突、来源跳转/摘要、已有文件不覆盖、协议与就绪判定。新增测试夹具只在测试环境，不进入运行树。

联网实机测试仅在用户明确接受 EULA 后启用：

```powershell
$env:LFAA_TEST_MINECRAFT_EULA = 'accepted'
$env:LFAA_TEST_MINECRAFT_CORES = 'Paper'
node --import tsx --import ./register-package-loader.mjs --test tests/minecraft-live-deployment.test.mjs
```

`LFAA_TEST_MINECRAFT_VERSION` 可选择验收版本；`LFAA_TEST_MINECRAFT_STOP_SECONDS` 经正式设置 API 保存独立测试账户的停服预算；不覆盖真实账户。代理验收先建立真实 Paper 后端，由正常 API 显式配置其测试正版验证，再启动代理。

早期 Client 类型检查被本轮之外 WritingWorkspace.tsx 的未使用变量与 workspace 可空错误阻塞，保留失败记录且未修改该模块。另一项工作随后修复其代码，最终 `pnpm run build:web`（完整 Client 类型检查与 Vite）通过，1628 个模块输出到根 dist/apps/web。不能用早期单独 Vite 成功冒充完整门禁通过。

浏览器可视验收 **未完成**：IAB 请求独立本地测试站点收到 `net::ERR_BLOCKED_BY_CLIENT`；当前 3000 站点可显示正常登录页，但该浏览器没有用户会话，未读取用户密码或绕过认证。主题、颜色、字体/字号、壁纸/遮罩/模糊、减少动态效果已接入共享映射并静态核查，但不能声称实际点击设置或业务面板视觉通过。当前仓库脚本未定义 workspace-preflight/quality-gate/release-gate 命令，这些命名 Gate **未运行**；相关类型、测试与构建按上述实际执行记录。

Java/代理本机 TCP 连接已实际测量；基岩只有核心真实就绪日志，UDP 客户端、公网防火墙、外网玩家、代理玩家身份转发 **未测量**。不会自动开放防火墙。OS AppContainer ACL/跨实例权限实机验收不属于 native 成功结果，不标记通过。没有发布、上传、版本提交或重启用户现有控制端。

最新测试正常收尾会验证 TEMP 路径边界并清理自己的实例。此前中断遗留的 heJQfs、yjuaJW、AflyQc、GWP3O6、H4sXSI 测试目录与临时 Arclight 源码调查目录，递归清理命令被自动审批审核以 `blocked by policy` 拒绝，暂保留在用户 TEMP，未绕过拒绝或删除真实用户目录。

官方 NeoForge Maven 在实测中出现 Node fetch 的 `ECONNRESET` 与正文 `terminated`，同 URL 的 PowerShell/Node HTTPS 请求也有成功记录，不能认定站点全面离线。只读元数据与工件下载允许一次重新建连；工件两次尝试共用同一总下载预算与摘要，每次只清理自己独占创建的文件。摘要错误、不可信跳转、已有文件冲突不重试，任何安装/配置/开服任务均不因网络重试而重复。长期测试验证部分正文中断后的清理、重新建连、同 URL/信号及最终摘要。

最终 SpongeNeo 重测的 6,158,744 字节安装器已通过官方 SHA-1，实际运行加载器后因 `net.neoforged.fancymodloader:earlydisplay:9.0.16` 下载失败退出 1；日志包含 `java.net.SocketException: Connection reset` 与 `These libraries failed to download. Try again.`。核心任务据实 failed，最后一次临时测试目录正常清理。网络恢复后可在正式部署记录显式恢复原工件，不自动换构建或伪造成功。该环境阻塞不以构建通过替代。

## 变更文件清单

仅列本任务贡献；同文件中其他并行任务已有修改保持原样。

| 绝对路径 | 本次职责与改动 |
|---|---|
| H:/LFAA/packages/games/minecraft/src/core-sources.ts | 新建真实 17 核心目录、构建与可信工件解析 |
| H:/LFAA/packages/games/minecraft/src/deployment-service.ts | 新建原子自动开服及已确认失败恢复 |
| H:/LFAA/packages/games/minecraft/src/service.ts | 多核心事实、原生动作、Java 下载预算、兼容旧入口 |
| H:/LFAA/packages/games/minecraft/src/index.ts | 登记领域自动开服服务 |
| H:/LFAA/packages/games/minecraft/README.md | 新建领域职责、迁移与验证说明 |
| H:/LFAA/packages/host/daemon/src/minecraft-provisioner.mjs | 新建下载、安装、配置、原生协议与就绪执行 |
| H:/LFAA/packages/host/daemon/src/daemon.mjs | 节点能力、Java 准备、日志冲刷与真实结果 |
| H:/LFAA/packages/host/daemon/README.md | 补充多核心执行和实机边界 |
| H:/LFAA/packages/jobs/jobs/src/minecraft-queue.ts | 就绪成功门禁、部署/实例事实映射 |
| H:/LFAA/packages/jobs/jobs/README.md | 补充版本 35、多核心和未知结果合同 |
| H:/LFAA/packages/api/minecraft-controller/src/index.ts | 认证目录/构建/自动开服接口 |
| H:/LFAA/packages/api/remotes/src/route-contracts.ts | 配置与实际完成证据的严格字段校验 |
| H:/LFAA/packages/core/tools/src/business-tools.ts | 模型复用目录/构建/provision，旧入口标注替代位置 |
| H:/LFAA/packages/settings/settings/src/service.ts | 新配置类型、权威默认与保存校验 |
| H:/LFAA/packages/client/connection/src/api.ts | 共享配置/事实类型与正式 API |
| H:/LFAA/packages/client/ui-settings-general/src/default-settings.ts | 前端共享默认值 |
| H:/LFAA/packages/client/ui-settings/src/SettingsPage.tsx | 新运行配置控件与实时核心选择 |
| H:/LFAA/packages/client/ui-minecraft/src/MinecraftDeploymentPanel.tsx | 新建一次提交面板、真实分类/构建、配置默认与提示 |
| H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.tsx | 接入自动面板、真实边界/状态、字体、PHP/代理呈现 |
| H:/LFAA/packages/client/ui-minecraft/src/MinecraftWorkspace.css | 收紧响应布局、共享字体/色彩令牌 |
| H:/LFAA/packages/client/ui-minecraft/README.md | 新建面板职责和设置/验收说明 |
| H:/LFAA/packages/client/ui-workspace/src/ApplicationWorkspace.tsx | 传递权威设置到 Minecraft 工作区 |
| H:/LFAA/packages/storage/storage-sqlite/src/database.ts | 保留旧数据的数据库版本 35 迁移 |
| H:/LFAA/packages/storage/storage-domain/src/migration.ts | 当前迁移链接入版本 35 |
| H:/LFAA/apps/cli/tests/minecraft-provisioner.test.mjs | 新建协议、来源、就绪、归属与端口长期回归 |
| H:/LFAA/apps/cli/tests/minecraft-multicore.test.mjs | 新建迁移、事务、设置、EULA、SpongeNeo 回归 |
| H:/LFAA/apps/cli/tests/minecraft-live-deployment.test.mjs | 新建明确 EULA 授权的真实认证/API/Daemon 验收 |
| H:/LFAA/docs/PROMPTS.md | 当前任务索引及合同链接 |
| H:/LFAA/docs/minecraft-deployment-plan.md | 计划、配置盘点、详细开发记录与实际矩阵 |
| H:/LFAA/docs/系统总体架构.md | 更新多核心、原生/AppContainer 与真实 API 事实 |
| H:/LFAA/docs/开发计划.md | 更新 P4 已接入范围与实机验收要求 |
