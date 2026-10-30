<a id="lfaa-minecraft-universal-jvm-tuning-20261030"></a>

# LFAA Minecraft JVM 通用调优预设（2026-10-30）

## 目标

按用户澄清修正实例概览 JVM 区域：推荐与高性能预设面向所有 Java 服务端核心，不因 Paper 或 Java 主版本而隐藏/留空；尚未显式配置的实例以推荐 G1 参数作为真实默认值，并在页面显示。首次部署、旧下载注册与后续启动都必须向目标 Java 传入参数；目标 Java 拒绝参数时继续 fail closed，不得创建服务端进程。

这份合同补充并覆盖 `minecraft-instance-jvm-configuration-20261030.md` 中“旧版 Paper/Java 8–16 才提供 GC 参数、现代 Java 推荐为空”的旧预设限制。它不把 JVM 参数描述为必然提升 TPS；真实收益需以对应服务端负载测量。

## Owner、设置与权限

- 运行入口：`/games/minecraft/instance/<instanceId>/overview`。
- 实例配置 Owner：`packages/games/minecraft`；参数纯值合同：`packages/util/values/src/minecraft-jvm-contract.mjs`；持久化：`packages/storage/storage-sqlite`；真实 JVM 派生和启动预检：`packages/host/daemon`。所有 Java 服务端核心共享同一个 JVM 参数合同。SQLite v79 `jvm_arguments_configured` 区分自动推荐与用户显式保存，空列表仍可作为用户明确选择。
- JVM 的 G1 参数对 Java 服务端进程通用；PocketMine 是 PHP 核心，不运行 JVM，必须继续明确说明其不适用，不能伪称可消费 Java 参数。
- 设置中心不新增字段。新实例最大堆继续读取 `minecraftRuntime.minecraftDefaultMemoryMb`；外观读取现有 Appearance/共享主题与减少动态效果映射。
- 保存沿用管理员、实例停止、节点在线、无活动任务、现有认证/输入校验和 Permission Owner 合同。验收只读取页面与源码/Java，不写入真实实例、不保存偏好、不启动/停止服务端。

## 实施批次与验收

1. 共享参数合同为所有 Java 主版本提供可用的 G1 推荐/高性能集合；清除仅由 Paper 或主版本决定可用性的静态门槛，但保留唯一白名单与参数依赖校验。以真实目标 Java 的有时限 `-version` 验证完整参数组合；失败仍阻止服务端进程。
2. 未配置实例使用非空推荐参数，安装、注册、启动/重启任务都消费同一组参数；已保存非空参数以及显式保存的空列表原样保留。推荐/高性能预设适用于所有 Java `coreType`；PocketMine 明确提示其 PHP 运行时不消费 JVM 参数。页面标明默认/显式状态，预设选择、摘要和保存状态正确。
3. 覆盖 Paper、CatServer、Fabric/其他 Java 核心与不同 Java 主版本的共享合同回归；回归空草稿展示、保存后读取、参数顺序、预检拒绝不启动和参数不串实例。完成直接包构建/类型检查及 ChatGPT 内置浏览器桌面与窄/短屏实页验收，记录视口、交互、截图与未测边界。

## UI 技能与风险记录

- 本轮读取 Taste Skill、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI 六项技能。沿用 Minecraft 工作台现有面板和 Ant Design 控件，只修正真实参数可见性/预设状态，不重做界面；不新增动效。
- Audit Skills 的明示覆盖是 Java/.NET/PHP；不会把本轮 TSX/JS 静态核对写成该技能专项审计。安全核对聚焦唯一参数白名单、账户/实例 Owner、服务端校验和 Java 启动预检。
- 相关配置仅 `minecraftRuntime.minecraftDefaultMemoryMb`（只决定新实例 Xmx）与现有 Appearance；本任务不改设置中心或现有用户偏好。

## 实施记录

- **实现：** 通用推荐参数包含 G1、并行引用处理、150 ms 软停顿目标、禁止显式 `System.gc()` 和更大的 G1 预留堆；高性能预设包含 Aikar G1 扩展项，并排除预触整堆/共享内存项。`MaxGCPauseMillis` 是 JVM 尽力达到的软目标，不保证 TPS/GC 指标提升。
- **实际 Java：** 本机 Temurin 21.0.11 的推荐（6 项）和高性能（16 项）参数组分别通过 `java.exe ... -version`，退出码均为 0；没有实际启动 Minecraft 服务端。其他本地 Java 主版本未安装，仍由目标 Daemon 在每次启服前针对所选 Java 执行真实预检，拒绝时不派生服务端进程。
- **定向回归：** JVM 参数合同、UI、Minecraft 多核心/部署、迁移及 Daemon 启动回归 34/34 通过；合同测试读取核心目录 Owner 的登记清单，覆盖 16 个 Java 核心（PocketMine 单独验证为 PHP 例外）及 Java 8/11/17/21 解析、高性能实验参数顺序、默认与显式空配置、首次部署/后续启动任务载荷和 v79 配置来源标记。Daemon 回归同时确认目标 Java 拒绝参数时不派生服务端进程。
- **设置/权限：** 沿用 `minecraftRuntime.minecraftDefaultMemoryMb`（仅新实例最大堆初值）及 Appearance；无新增设置、偏好写入或真实实例数据写入。保存权限和实例状态合同未变。
- **构建/类型检查：** 按用户要求等待通知和并行工作区改动完成后，Client/Host 类型检查、`pnpm run build:control-plane`、`pnpm run build:web` 均成功；`node scripts/runtime-build-state.mjs web` 返回 `[]`，Web 产物与当前源码指纹一致。正式入口 `pnpm run lfaa web` 启动后，`/api/health` 返回 `ok`、持久化 `ready`。
- **内置浏览器实页验收：** ChatGPT 内置浏览器实际路由 `/games/minecraft/instance/45f694c3-fbf3-447c-a848-80c6a5c5724c/overview`。桌面视口 1280×720 显示 1.21.1 Paper / Java 21 实例、推荐 JVM 默认和参数区；选择“高性能”后看到 16 项有效并启用保存，再切回“推荐”后恢复 6 项、保存禁用，未提交参数。窄/短屏视口 390×640 无横向溢出，编辑器与摘要纵向排列；滚动至底部时保存按钮完整位于固定顶栏下方（y=103–135），可见且可达。已恢复 1280×720 并保留验收页；未启动、停止或修改真实 Minecraft 实例。
- **工作区检查：** `pnpm run sync:workspace` 同步根清单后，`pnpm run check:workspace` 仍因三个已有开发合同缺失索引锚点报错：`minecraft-multicore-metadata-recovery-20261030.md#lfaa-minecraft-multicore-metadata-recovery-20261030`、`minecraft-instance-jvm-configuration-20261030.md#lfaa-minecraft-instance-jvm-configuration-20261030`、`java-environment-master-detail-20261030.md#lfaa-java-environment-master-detail-20261030`。这些与本次实现无关，未改写对应合同；本轮 `git diff --check` 通过。
