# Minecraft Controller

该包只负责 Minecraft HTTP 路由、认证和响应适配；核心类型、来源和版本事实归 `lfaa-games-minecraft`。`GET /minecraft/core-names` 经现有认证后返回领域 Owner 登记的核心名称，用于设置中心选择账户默认核心，不访问外部目录；`GET /minecraft/cores` 仍读取实时核心/版本目录，部署和工件校验语义不变。设置偏好继续由 `lfaa-settings` 校验与持久化，实例操作仍经领域服务和目标 Daemon。

管理员可调用 `POST /minecraft/instances/:instanceId/properties/read` 请求领域 Owner 将有界读取任务排入实例节点；节点能力不足、离线或实例忙碌时按真实错误响应。`PATCH /minecraft/instances/:instanceId/properties` 兼容 `{properties}`，并可接受 `{fileProperties}` 对真实文件属性做动态编辑；两者互斥，后者由 Domain 限定在当前节点快照键内并限制长度/数量/字符，敏感密文从用户任务响应剔除。读回/保存结果均经同一 Minecraft 任务与 Daemon Owner。

`GET /minecraft/instances/:instanceId/directory` 仅管理员可读；路径由 Minecraft Owner 的 `getMinecraftInstanceShellDirectory()` 按当前实例登记目录解析，返回实例 ID 与真实目录，不接受浏览器提供的路径片段。

直接回归：`apps/cli/tests/minecraft-core-names-api.test.mjs`。构建只写仓库根 `dist/packages/api/minecraft-controller/`。

`GET /minecraft/overview` 只返回真实 Minecraft 节点、实例和任务汇总，不访问 Mojang 官方版本目录；目录仍通过独立的 `/minecraft/releases` 路由按需读取。官方版本尚未加载时，overview 的 `latestRelease` 为 `null`，不显示虚构版本。核心目录和构建路由只在部署选择流程中访问；二进制文件仍只在显式部署/环境安装操作中由目标节点下载。

认证只读 `GET /minecraft/instances/:instanceId/telemetry` 返回 Minecraft Service 的新鲜瞬时状态，并设置 `Cache-Control: no-store`。它不启动节点任务、不请求服务端命令，也不修改实例；实例和节点权限/状态仍由对应 Owner 核验。

认证只读 `GET /minecraft/nodes/:nodeId/resources` 返回节点 Host Daemon 最近最多 30 条实际整机资源采样，并设置 `Cache-Control: no-store`。Controller 只核验节点登记和格式、回传 `local-daemon` Owner 状态，不从节点名、实例配置或截图推算 CPU、内存、磁盘和网络值。
