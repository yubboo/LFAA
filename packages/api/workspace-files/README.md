# Files API 与游戏资源挂载

本包把认证 HTTP 请求交给唯一 SystemFileLibrary；`/files/locations` 与真实目录 entries 分开。`game-instances` 按 Minecraft Owner 的稳定 ID、名称、节点、状态投影，目标节点依据已核验实例索引解析目录；`game-storage` 使用保存的 Minecraft/SteamCMD 节点位置，Daemon 自己解释路径。`game-servers` 保留整台节点 data 的显式来源。

按实例及游戏存储浏览要求节点分别报告 `node-filesystem-instance-v1`、`node-filesystem-game-storage-v1`；旧节点、离线、失败和未知结果不伪装为空目录或成功。相同节点任务等待函数由两种挂载共用；取消/超时不重放副作用。状态可能变化，写入最终仍由节点检查活动进程和持久标记。控制端自定义实例绝对路径保护也沿用共享 instance-files。

挂载、变更保护和路由随 Cordis 生命周期撤销，不创建第二套文件/游戏/权限服务。安装元数据留在领域 Owner；没有 Steam 游戏实例 Runtime 的能力仍不声明为可用。传输保留现有单文件 3 MiB、摘要与认证限制。

构建写根 dist/packages/api/workspace-files；[设计合同](../../../docs/development/file-resources.zh.md)，定向回归 apps/cli/tests/file-resources、system-file-library 与 file-manager-api。实际远端/游戏进程验收与隔离节点边界夹具分别报告。
