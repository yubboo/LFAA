# `lfaa-api-steamcmd-controller`

SteamCMD Settings 与服务端操作的认证 REST 适配器。管理员角色和登录账户由 Authorization Owner 校验；SteamCMD 配置、服务端记录、租约任务由 `games/steamcmd` 保存；显式常规页面操作调用 Permission Owner；Daemon 执行结果不由 Controller 推测。

公开 API：`GET /steamcmd/servers?nodeId=...`、`POST /steamcmd/servers`、`PUT /steamcmd/servers/:serverId`、`POST /steamcmd/servers/:serverId/tasks`。Tool AppID、目录、启动参数、停服命令、EULA 和任务种类经 `api/remotes/route-contracts` 严格验证。AI Tools 直接调用相同领域服务并使用 Agent Loop 的 Permission Owner，不复制 Controller 规则。

运行于 Control Plane，由 Gateway/Bundle 装配；依赖、构建入口与消费者见本包 `package.json` 和生成包清单。构建只写根 `dist/packages/api/steamcmd-controller/`。接口合成与隔离测试不代替真实 Steam 下载或节点游戏进程验收。
