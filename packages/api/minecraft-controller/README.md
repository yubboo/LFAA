# Minecraft Controller

该包只负责 Minecraft HTTP 路由、认证和响应适配；核心类型、来源和版本事实归 `lfaa-games-minecraft`。`GET /minecraft/core-names` 经现有认证后返回领域 Owner 登记的核心名称，用于设置中心选择账户默认核心，不访问外部目录；`GET /minecraft/cores` 仍读取实时核心/版本目录，部署和工件校验语义不变。设置偏好继续由 `lfaa-settings` 校验与持久化，实例操作仍经领域服务和目标 Daemon。

直接回归：`apps/cli/tests/minecraft-core-names-api.test.mjs`。构建只写仓库根 `dist/packages/api/minecraft-controller/`。
