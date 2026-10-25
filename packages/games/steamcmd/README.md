# `lfaa-games-steamcmd`

SteamCMD 配置、节点游戏目录、通用 Steam Dedicated Server Tool AppID 配置、运行环境安装/校验/完整卸载、服务端安装/更新/启动/停止任务以及真实 Daemon 状态的唯一领域 Owner。它不维护 Steam 商店客户端清单，也不推断任意客户端 AppID 可匿名安装。

公开合同位于 `src/service.ts`：SteamCMD 安装设置沿用 `installMode`、`steamcmdDirectory`、`gameDirectory`；服务端记录包含 Tool AppID、相对安装子目录、启动程序/参数、停服指令、停服等待秒数及显式 EULA 同意；安装、校验、完整卸载和服务端任务沿用 `steamcmd_tasks` 的认证节点租约，状态由 Daemon 回报。卸载仅删除配置的工具目录，游戏目录和服务端文件保留；服务器状态运行中或未知时拒绝卸载。SQLite 迁移由 `storage/storage-sqlite` 持有。Controller 做认证、角色、参数与 Permission Owner 适配，Daemon 再校验目标路径并以 `shell:false` 执行。

支持范围：在线 Windows x64 Daemon；在线安装从 Valve 官方 SteamCMD CDN 下载，并以真实版本输出确认可用。文件管理通过 `game-storage` 的 `steamcmd-runtime` 子资源只读浏览同一节点的工具目录，安装、校验和完整卸载仍由 SteamCMD Owner 执行。服务端只按 Steamworks 已发布的 Dedicated Server Tool AppID 运行 `+app_update <toolAppId> validate`；许可未明确同意、路径越界、未配置启动/停服命令、未知运行状态或租约结果不确定时拒绝猜测成功或自动重放。普通启动只证明进程已创建，不证明游戏已就绪或外网可达。

设置沿用“项目与存储”中 SteamCMD 的工具路径与游戏目录；没有新增设置中心项。数据库持有服务端配置和状态，目标 Windows Daemon 持有实际文件与受管子进程。Agent Tools 与常规页面都调用本服务；Agent 操作经 Permission Owner，常规页面操作走认证管理员与显式用户动作。

构建只写仓库根 `dist/packages/games/steamcmd/`。定向 Steam 服务端/任务回归、数据库迁移、Daemon 进程控制与节点实测在每轮 `docs/PROMPTS.md` 合同中区分记录；静态/隔离验证不表示真实 Steam 账号、AppID、服务端或网络可用性均已验收。

DST 使用本 Owner 建立共享 `dstClusterId` 与 Master/Caves 两条分片记录；两行引用同一个 Tool AppID 和安装目录，安装/更新任务只派发一次，并在两个分片都确认停止时才允许执行。集群名和分片进入 Daemon 任务合同；运行配置从 SteamCMD 游戏目录下的 `dst-clusters/<clusterId>` 读取，集群令牌正文不写入数据库或任务。客户端商店 AppID 与 Tool AppID 的区别仍适用；未经官方核实的数字 AppID/停服命令由管理员明确填写。
