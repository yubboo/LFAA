<a id="lfaa-daemon-heartbeat-java-distribution-20261027"></a>

# LFAA-DAEMON-HEARTBEAT-JAVA-DISTRIBUTION-20261027：修复托管 Java 心跳校验

## 用户问题与目标

用户粘贴的完整 Web 启动日志显示，本机 Daemon 每 5 秒向 `/api/daemon/heartbeat` 发送请求，Control Plane 持续返回 `400 invalid_request`；Daemon 随后又报告“已连接控制端”，造成连接状态误报。目标是让当前 Daemon 发出的合法托管 Java 运行时信息通过严格校验并被节点 Owner 正常保存，同时只有心跳成功后才报告连接恢复。

## Owner、入口与设置

- 入口：`pnpm lfaa web` 装配 Control Plane 与本机 Daemon；独立 Daemon 也复用同一心跳协议。
- 心跳发送由 `packages/host/daemon/src/daemon.mjs` 持有；HTTP 字段校验由 `packages/api/remotes/src/route-contracts.ts` 持有；节点 Java 摘要及其持久化由 `packages/host/daemon/src/local-daemon.ts` 持有。Minecraft/运行环境服务和 Client 只是消费者。
- Daemon 托管 Java 检测可返回 `distribution: "temurin" | "zulu"`。该字段用于描述真实运行时，不新增用户设置。相关账户配置 `minecraftRuntime` 的默认值为就绪超时 120 秒、停服超时 30 秒、默认内存 4096 MB、Java 版端口 25565、下载超时 1800 秒、安装超时 900 秒、原生执行、Paper 核心、基岩版端口 19132；默认由 `DEFAULT_USER_SETTINGS` 定义，Joi 校验、`user_settings` 的 `minecraft-runtime` 持久化与 Client 分类映射保持原 Owner。本次协议解析不读取或改变这些任务选项。
- Java 搜索目录继续由运行环境存储 Owner 按节点 `dataRoot` 派生 `environments`、`cache`、`tmp`；本机业务根默认来自系统数据根/`<LFAA_HOME>/data`，用户选定的业务根由 Project Storage Owner 持久化，显式 `LFAA_DATA_DIR` 优先。设置中心的现有路径选择和历史目录候选均不改变，本修复不迁移数据。
- 数据由节点登记数据库保存；远端 Daemon 仍必须通过现有 Bearer/TLS 身份校验，心跳数组、字段和能力继续严格验证。权限仍由现有认证与节点身份 Owner 执行。

## 复现、修改范围与验收

- 复现证据：Daemon 的 `discoverJavaRuntimes()` 对托管 Java 运行时发送 `distribution`，而心跳 Joi 子对象使用 `.unknown(false)` 且未登记该字段；带该字段的合法节点心跳会被拒绝。运行时管理与 Minecraft API 使用保存的节点 Java 摘要。
- 允许修改心跳字段类型/校验、Daemon 恢复日志时机、现有直接回归、受影响包 README 与本合同/任务索引。
- 保持 `distribution` 仅可为 `temurin` 或 `zulu`；未知字段/值、未知能力、无效节点身份仍须拒绝。不得放宽整对象校验，不改轮询周期/数据根/权限策略，不重启用户运行中的服务。
- 验收：回归证明托管 Temurin/Zulu 心跳接受、未知发行版和额外字段拒绝；构建 Daemon、API Remotes 与 Control Plane；执行 `git diff --check` 和工作区差异核对。真实用户节点/数据库与服务重启不作为源码验收，本轮不操作真实数据或运行进程。

## 性能、安全与可维护性

沿用现有 5 秒单次心跳请求及有界数组，不新增订阅、重试重叠、缓存或后台任务。校验只新增一个枚举字段；错误日志仅在错误变化时输出，恢复消息在心跳成功后输出。无设置变更、无副作用授权变化；`distribution` 不接受任意字符串。

## 实施与验证记录

- `route-contracts.ts` 现在只接受可选的 `distribution: "temurin" | "zulu"`；服务端 `JavaRuntimeSummary` 和 Client `MinecraftNode` 类型同步该真实字段。未知发行版仍拒绝，嵌套对象继续 `.unknown(false)`。
- `daemon.mjs` 将“已连接控制端”恢复日志移到心跳响应成功之后；仅 `/health` 成功但业务心跳仍被拒绝时，不再报连接已恢复，也不反复清空错误状态。
- 回归先于修复失败，明确报 `"javaRuntimes[0].distribution" is not allowed`；修复后定向测试通过。完整 `file-manager-api.test.mjs` 为 12/12 通过，包含 Temurin/Zulu 接受、未知发行版/额外字段拒绝及原文件传输回归。
- 验证：`pnpm run build:control-plane` 通过；`pnpm run build:web`（客户端 TypeScript 检查、3,881 模块 Vite 构建）通过，产物写入仓库根 `dist/`。`git diff --check` 通过。`pnpm run check:workspace` 未通过，报告既有 `docs/development/left-preview-hover-flicker-20261025.md` 引用的 `dist/.tmp/hover-flicker-desktop.png` 和 `dist/.tmp/hover-flicker-narrow.png` 缺失；这些文件不属于本修复范围且未补造或清理。
- 未接触真实用户数据库或运行数据。当前 3000 端口由本 checkout 的 Web PID 25340 提供，其 Daemon 子进程为 PID 11228；两者启动时间早于本轮构建，仍需重启才会加载本轮 Control Plane/Daemon 代码。因重启可能中断节点任务，本轮未重启；最新构建下的真实本机心跳恢复尚未实机验收。无设置中心配置变更。性能判断限于源码：5 秒单次轮询与已有数组上限不变，新增一个枚举校验，无新增请求/订阅；未测真实设备 CPU、网络延迟或浏览器帧时间。
