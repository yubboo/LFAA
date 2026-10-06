# LFAA 跨游戏联机 Owner

该包拥有 TCP/UDP 路由、账户隔离房间、目标适配器与第三方 Provider Adapter Registry。联网服务独立于 Minecraft/Steam 游戏的部署、实例与进程 Owner。

路由记录由控制端写入 `LFAA_DATA_DIR/connectivity/routes.json`，包含 ownerId 并在 API 层按账户过滤；凭据单独经现有 `lfaaCredentials` 加密保存。LFAA Relay 控制通道、数据面和健康握手尚未实现，因此房间域名当前始终禁用；只配置环境变量不会使它显示为可用。用户自备路线只保存其实际交接地址，不探测或控制外部进程。

Minecraft Java 可通过注册目标适配器提供当前账户、在线节点上正在运行的实例。其他游戏 App 可用同一 `ConnectivityTargetAdapter` 注册真实服务目标。没有完成官方 API 核验的 Provider 不注册适配器，不展示节点或调用按钮。

本包不更改 SQLite schema，不拥有游戏部署、不操作系统防火墙，也不把地址生成、配置存在或进程启动作为联网成功证据。

`src/easytier-release.mjs` 是当前 Windows x64 EasyTier 运行包的唯一固定发布清单（v2.6.4、官方 URL、SHA-256、精确字节数和 Daemon 能力标识）。管理员可从联机 App 请求 Daemon 执行受限安装；这一阶段只下载、校验、暂存解压并核验 `easytier-core.exe --version`，不启动虚拟网络实例。EasyTier 实例生命周期、结构化 RPC 对等状态、Android/macOS/Linux 运行包及 LFAA 房间 Relay 都仍是后续阶段。

EasyTier 安装任务由本 Owner 保存在 `LFAA_DATA_DIR/connectivity/easytier-install-tasks.json`，与路由文件同目录、独立格式、限量并在回读后确认。只返回账户拥有的任务摘要；认证 Daemon 只能为绑定节点领取和完成固定版本任务。租约到期转为 `unknown` 并禁止自动重放，不复用 AI Host Shell 队列或 SQLite schema。
