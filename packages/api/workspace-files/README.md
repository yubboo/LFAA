# Files API 与游戏资源挂载

本包把认证 HTTP 请求交给唯一 SystemFileLibrary；`/files/locations` 与真实目录 entries 分开。资源挂载提供用户可读的物理位置说明；stable ID 仅作内部路由，UI 不展示伪目录名。`game-instances` 按 Minecraft Owner 的稳定 ID、名称、节点、状态投影，目标节点依据已核验实例索引解析目录并返回实际存储位置；`game-storage` 使用保存的 Minecraft/SteamCMD 节点位置，Daemon 自己解释路径。SteamCMD 工具目录通过内部 `steamcmd-runtime` 子资源只读浏览，界面展示节点设置中的实际工具目录，写入和删除仍由 SteamCMD 生命周期 Owner 管理。`game-servers` 保留整台节点 data 的显式来源；文件资源根只列在线且具备 `node-filesystem-v1` 的节点，离线节点仍保留在节点 Owner 的历史记录中，不会生成无法打开的目录入口。

按实例及游戏存储浏览要求节点分别报告 `node-filesystem-instance-v1`、`node-filesystem-game-storage-v1`；旧节点、离线、失败和未知结果不伪装为空目录或成功。相同节点任务等待函数由两种挂载共用；取消/超时不重放副作用。状态可能变化，写入最终仍由节点检查活动进程和持久标记。控制端自定义实例绝对路径保护也沿用共享 instance-files。

挂载、变更保护和路由随 Cordis 生命周期撤销，不创建第二套文件/游戏/权限服务。安装元数据留在领域 Owner；没有 Steam 游戏实例 Runtime 的能力仍不声明为可用。传输保留现有单文件 3 MiB、摘要与认证限制。

`POST /files/upload` 接收认证的 `application/octet-stream`；本机文件仍交给 SystemFileLibrary，远程上传只向任务表登记传输 ID。图片/PDF 预览和下载由用户认证的 `GET /files/transfers/:id` 读取原始字节，成功发送后删除暂存内容。远程二进制操作只交给报告 `node-filesystem-binary-transfer-v1` 的在线节点；旧节点仍可执行不涉及字节的操作。

构建写根 dist/packages/api/workspace-files；[设计合同](../../../docs/development/file-resources.zh.md)，定向回归 apps/cli/tests/file-resources、system-file-library 与 file-manager-api。实际远端/游戏进程验收与隔离节点边界夹具分别报告。
