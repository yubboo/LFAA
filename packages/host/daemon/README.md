# Daemon Host

节点详情和列表都以同一 20 秒心跳有效期返回在线状态；读取详情无需先调用列表来刷新过期状态。列表持久化离线变化并按原回调通知，收到新心跳后恢复在线；能力和执行授权仍由原节点与 Permission Owner 校验。

Minecraft 自动部署的 Java 准备继续使用 `resolveMinecraftJavaRuntime`：匹配环境缺失时安装并验证 Temurin，再下载/校验核心并提交实例元数据。`minecraft-provisioner.mjs` 接受 PaperMC 官方 `fill-data.papermc.io` 工件，仍校验每次 HTTPS 跳转和来源摘要；Java 官方目录失败会标明实际 Java 主版本及准备阶段。此源码路径与隔离回归不等于真实网络下载、安装或游戏就绪验收。

Daemon Host 是目标节点本机能力的执行 Owner。通用项目文件操作由 `src/project-files.mjs` 在调用方提供的已登记根目录内执行：读取限定为普通 UTF-8 文本并支持分页；创建文件不覆盖既有内容，更新按 SHA-256 检查并发修改，删除仅对普通文件调用单文件 unlink，不递归删除目录。Agent Tool 可用的操作仍由 `packages/core/tools/src/project-tools.ts` 单独列明。

`project-files` 的 `initialize_default_workspace` 只供认证 Workspace Controller 调用，在本机 OS 账户的系统“文档”下创建 `LFAA/default-workspace` 并返回 Daemon 规范路径；Windows 从用户 Documents 注册表位置读取，Linux 使用 `xdg-user-dir DOCUMENTS`，macOS 使用账户 Documents。创建前后都检查真实路径，禁止落入 `LFAA_DATA_DIR`；它不初始化或搬迁业务数据目录。

全局管理员文件工作台由 `src/daemon.mjs` 执行。本机与远程节点通用 `node-filesystem-directory-size-v1` 能力只在管理员显式请求目录大小时遍历目标目录；遍历限定为数据根内最多 20,000 项和 64 层，按小批量异步检查文件元数据，拒绝越界路径，不进入数据根的受保护目录，不跟随链接/目录联接，不读取文件内容；预算用尽或目录正在变化时失败且不返回部分总和。列表读取不计算目录大小。

成功的 `create`、`create_tree`、`write`、`replace` 与 `delete` 结果附带以 `/` 分隔的项目相对 `relativePath`（文件树还为每个文件返回该字段），供 Session 活动和已登记项目 Git 审阅映射；既有 `path`、摘要和内容结果保持原义。此字段不授权额外文件读取，也不替代 Workspace Controller 对项目和节点的认证校验。

`task-lanes.mjs` 隔离一个 Shell 槽与一个轮转运维槽，避免不限时 Shell 阻塞 Minecraft 停服；防止重叠领取，停机后不执行刚返回的租约。卸载先停止领取/取消命令，再等待已领运维任务并结束受管实例。长安装仍可能占用运维槽；时限来自现有账户设置，不改 commandTimeoutSeconds 默认 0。Electron 通过 IPC 请求既有 Harness 生命周期，不用 Windows SIGTERM 代替安全退出。

`managed-process-shutdown.mjs` 确认受管实例退出：正常 stop 超时或写入失败后复用既有进程终止策略，再确认退出。强制退出保留恢复标记；仍未确认时以失败状态结束 Daemon，使桌面拒绝安装更新，不吞掉错误后报告成功。

## 运行与桌面打包

`terminal-channel.mjs` 在现有控制端地址上建立认证 POST SSE 命令连接，通过顺序 HTTP 批量回报输出和应答；本机与远程节点共用该链，远程仍要求 HTTPS。真实 Shell 经 subprocess-local 的原生 PTY 在线程中启动，节点最多 8 个会话，发送队列 1 MiB；控制端断线、凭据失效或 Daemon 卸载关闭全部会话，不重放输入。Shell 选择来自 Settings，并通过 terminal-bash 异步解析，必要 OS 环境采用显式允许集合，不继承模型服务密钥。

Windows Electron 桌面安装包内置本机 Daemon，并由桌面主进程自动启动和收尾。Daemon 保持独立进程与 `daemon` Profile，控制端通过现有认证节点任务通道单独读取节点状态和派发操作。需要新增远程节点时，管理员通过控制端签发 HTTPS 连接身份，目标 Windows x64 主机导入连接文件后运行 `lfaa daemon`；远程主机安装器和系统服务托管尚未接入。

实例和旧部署建目录统一调用现有 `ensureStorageDirectory(getMinecraftStorageRoot(...))`，不调用不存在的路径助手。元数据读取区分不存在与 JSON 损坏，损坏时明确指出 `lfaa-instance.json` 并保留原文件供核对，避免被误诊为未下载而重复部署。

根脚本 `build:windows-sandbox-host` 编译的是 Rust `lfaa-sandbox-host.exe`，不是 Daemon 服务本身。Electron 桌面发行脚本会自动调用该构建并将原生宿主随 Daemon 运行树打包；普通用户无需单独构建或启动 Daemon。

AI Work 变更审阅复用同一执行器的内部 `write` 操作，但仅由认证 Workspace Controller 的用户界面路由调用。保存要求最近读取的 SHA-256 匹配、内容为不超过 2 MiB 的 UTF-8 文本，并通过同目录临时文件替换；路径、符号链接与 Daemon 数据目录边界继续由执行器校验。Git 状态和单文件差异归 `src/git-workspace.mjs`，只接受固定参数化操作，不执行浏览器传来的任意命令或补丁。界面复制 `git apply` 命令时仅将经过完整性限制的文件差异编码进剪贴板，不会由 Daemon 或 Client 自动执行。

`src/easytier-runtime.mjs` 只接受 Connectivity Owner 派发的固定 EasyTier v2.6.4 安装操作，复用 Daemon 的数据根目录围栏、官方 HTTPS 资产摘要/大小验证和 ZIP 路径检查。安装包保存在 `environments/easytier/v2.6.4`，安装任务使用唯一暂存目录、拒绝覆盖无效已有目标，并通过核心程序 `--version` 输出确认后才加入节点心跳能力。该能力不启动 EasyTier、修改虚拟网卡或上报网络/对等连接状态；组网实例管理 RPC 尚未接入。

## 游戏文件资源范围（2026-10-14）

节点新增 node-filesystem-instance-v1 与 node-filesystem-game-storage-v1：实例请求只提交已登记实例 ID，目标节点用既有核验索引定位真实目录；Minecraft/SteamCMD 平台目录从节点自己的已保存设置解析，支持原 Owner 允许的绝对自定义位置。实例根、元数据、活动进程或保留进程/安装标记由共享 instance-files 保护。普通 data、实例和平台来源共用文件执行器和串行写锁；回收站命名空间由控制端依据真实账户派生，不能由浏览器覆盖。旧节点不声称支持这些范围。扩展 plugins 目录由 Plugin Manager 生命周期维护，不受通用文件写操作管理。构建和隔离夹具不等于实际节点/游戏进程验收。
