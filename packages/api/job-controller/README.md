# 任务 API

本包将认证后的 Jobs/Runtime/节点请求交给原 Owner，保留账户、节点身份、任务租约、取消和未知结果合同，不自行执行环境安装或游戏业务。

运行环境、缓存、临时位置由目标节点唯一 data 根派生；旧 PUT /runtime-environments/storage/:targetId 明确返回 independent_storage_retired，GET 与运行任务继续消费原 Runtime Manager。已保存的旧环境根仅作回读候选，安装与更新不新建独立根。

构建写根 dist/packages/api/job-controller；[本轮数据根规范](../../../docs/development/file-resources.zh.md)。实际节点与设备验收和隔离任务夹具分开记录。

Daemon 心跳同时接收 SteamCMD 服务端进程状态并返回该节点已登记服务端 ID；节点身份仍由 `requireLocalDaemon` 校验。服务端任务与状态更新由 `games/steamcmd` 持有，Job Controller 只负责节点认证与协议路由。

节点文件任务输入与结果字节使用 Daemon 身份认证的原始流路由；输入绑定运行中的上传任务、用户和节点，结果绑定运行中的下载/二进制预览任务。完成时由文件队列核对已收字节及名称、大小和 SHA-256，再只把小型元数据写入 SQLite。

Minecraft 节点通过认证后领取任务时，Job Controller 才调用领域 Owner 解封已绑定实例和属性名的 `server.properties` 敏感值；若认证解密失败则将已领取任务标为失败，不返回或记录明文。通用任务列表和详情继续由 Minecraft Domain 移除敏感属性键。

`POST /daemon/heartbeat` 仍先由 `requireLocalDaemon` 校验节点身份；Minecraft Service 只接收与该节点登记实例 ID 相符的运行指标，并负责缓存和过期清理。Job Controller 只转发受严格 Joi 合同验证的可选 `telemetry`，不自行读取或解释服务端指标。

同一心跳的可选 `systemResources` 由 Remote Joi 严格验证后交给 Host Daemon Owner 有界保存在内存；CPU、内存、固定磁盘合计和默认网卡速率都由节点实际采集。Job Controller 不计算或补全监控值。
