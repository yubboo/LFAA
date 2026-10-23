# `lfaa-games-steamcmd`

SteamCMD 配置、节点游戏目录、通用 Steam Dedicated Server Tool AppID 配置、安装/更新/启动/停止任务以及真实 Daemon 状态的唯一领域 Owner。它不维护 Steam 商店客户端清单，也不推断任意客户端 AppID 可匿名安装。

公开合同位于 `src/service.ts`：SteamCMD 安装设置沿用 `installMode`、`steamcmdDirectory`、`gameDirectory`；服务端记录包含 Tool AppID、相对安装子目录、启动程序/参数、停服指令、停服等待秒数及显式 EULA 同意；任务沿用 `steamcmd_tasks` 的认证节点租约，状态由 Daemon 回报。SQLite 迁移由 `storage/storage-sqlite` 持有。Controller 做认证、角色、参数与 Permission Owner 适配，Daemon 再校验目标路径并以 `shell:false` 执行。

支持范围：在线 Windows x64 Daemon；SteamCMD 必须先安装并通过真实版本输出校验。服务端只按 Steamworks 已发布的 Dedicated Server Tool AppID 运行 `+app_update <toolAppId> validate`；许可未明确同意、路径越界、未配置启动/停服命令、未知运行状态或租约结果不确定时拒绝猜测成功或自动重放。普通启动只证明进程已创建，不证明游戏已就绪或外网可达。

设置沿用“项目与存储”中 SteamCMD 的工具路径与游戏目录；没有新增设置中心项。数据库持有服务端配置和状态，目标 Windows Daemon 持有实际文件与受管子进程。Agent Tools 与常规页面都调用本服务；Agent 操作经 Permission Owner，常规页面操作走认证管理员与显式用户动作。

构建只写仓库根 `dist/packages/games/steamcmd/`。定向 Steam 服务端/任务回归、数据库迁移、Daemon 进程控制与节点实测在每轮 `docs/PROMPTS.md` 合同中区分记录；静态/隔离验证不表示真实 Steam 账号、AppID、服务端或网络可用性均已验收。
