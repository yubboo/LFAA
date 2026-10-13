# 文件管理源码对照与统一服务方案

核查日期：2026-10-13。本文依据公开仓库固定提交与 LFAA 当前调用链；未运行参考项目，未将其源码装配进 LFAA。

## 参考实现

| 项目及固定提交 | 文件操作链路 | 可采用的方式 |
|---|---|---|
| MCSManager `18c80bfb911ad362f2bd00d2d7cff875d04be10a` | 前端 → Panel 文件 API → Daemon 直接请求/响应 → 实例目录 FileManager | 文件操作封装、实例边界、服务端分页、分页后并行读取元数据、批量操作、右键菜单、目录标签、文件传输凭证 |
| GSManager `c4e346258e6c59a777b9bd50a85cd5552a0c1d25` | 前端共享文件状态 → Server 文件 API → Server 本机磁盘；长操作使用独立文件任务 | 系统文件入口、本机直接接口、列表/网格、剪贴板与快捷键、分片上传、流式下载、打开文件的变化通知 |

MCSManager 的 `/files/list` 校验节点、实例归属与参数后，直接等待 `RemoteRequest(...).request("file/list", ...)`，不经过持久任务领取与浏览器任务结果轮询。FileManager 以实例工作目录为边界；全局文件功能也使用 Daemon 中的特殊全局实例。它不是无 Daemon 的本机文件管理。

- [Panel 文件路由](https://github.com/MCSManager/MCSManager/blob/18c80bfb911ad362f2bd00d2d7cff875d04be10a/panel/src/app/routers/filemananger_router.ts#L67)
- [Daemon 文件管理器](https://github.com/MCSManager/MCSManager/blob/18c80bfb911ad362f2bd00d2d7cff875d04be10a/daemon/src/service/system_file.ts#L126)
- [实例目录适配](https://github.com/MCSManager/MCSManager/blob/18c80bfb911ad362f2bd00d2d7cff875d04be10a/daemon/src/service/file_router_service.ts#L7)
- [前端文件交互](https://github.com/MCSManager/MCSManager/blob/18c80bfb911ad362f2bd00d2d7cff875d04be10a/frontend/src/hooks/useFileManager.ts#L298)

MCSManager 先使用 `readdir` 的目录类型信息枚举名称，再排序、截取当前页，并并行读取该页元数据；仍需枚举整个目录，不能据此宣称任意大目录恒定耗时。前端进入目录也显示加载状态。

GSManager 的 `/files/list` 认证后直接调用本机 `fs.readdir/fs.stat`，不接受节点 ID。共享状态保存目录、选择集、剪贴板和编辑文件，支持逐页追加；文件监视器在连接断开时解除。压缩、批量复制移动使用独立文件任务，普通目录读取直接返回。

- [Server 文件接口](https://github.com/GSManagerXZ/GameServerManager/blob/c4e346258e6c59a777b9bd50a85cd5552a0c1d25/server/src/routes/files.ts#L364)
- [共享文件状态](https://github.com/GSManagerXZ/GameServerManager/blob/c4e346258e6c59a777b9bd50a85cd5552a0c1d25/client/src/stores/fileStore.ts#L153)
- [文件变化通知](https://github.com/GSManagerXZ/GameServerManager/blob/c4e346258e6c59a777b9bd50a85cd5552a0c1d25/server/src/modules/file/FileWatchManager.ts#L28)
- [分片上传接口](https://github.com/GSManagerXZ/GameServerManager/blob/c4e346258e6c59a777b9bd50a85cd5552a0c1d25/server/src/routes/files.ts#L1550)

GSManager 当前目录接口顺序读取全部目录项元数据后再分页，这部分不作为 LFAA 大目录性能模板。其绝对路径与服务端操作系统账户模型也不等同于 LFAA 账户资源隔离。源码许可证分别为 MCSManager 的 Apache-2.0 与 GSManager 的 GPL-3.0；本轮只核查与借鉴设计，未复制产品代码。

## LFAA 当前问题

`/files` 先发现在线节点，目录读取再通过 `POST /files/tasks` 写入 SQLite，等待 Daemon 领取，浏览器轮询 `GET /files/tasks/:taskId`。节点发现失败会封锁整页。缓存和缩短领取间隔只能减轻等待，不能修正系统文件服务与游戏执行节点的职责混用。

刚开始的只读应用资源聚合草稿已撤销，未发布、未迁移真实数据、未登记为可用。只读清单不足以承载用户要求的文件管理能力。

## 已确定的目标

用户已明确：Daemon 负责游戏节点，系统文件管理不以 Daemon 存在或在线为前提。无节点来源采用统一文件库，各应用 Owner 挂载允许访问的账户资源，节点目录是可选来源。

1. 系统文件服务归文件领域包，统一目录、搜索、预览、读写、创建、重命名、复制移动、上传下载、回收站与审计合同；共享界面和 Agent 工具使用同一合同。
2. 本机适配器由运行 LFAA 的 Server/Host 执行授权目录内的文件操作。无节点仍可使用真实账户资源，不创建假节点、不为文件管理启动隐藏 Daemon。Web 本机指 Server 所在主机；桌面使用所属 Host 的系统能力。
3. 应用资源适配器由 Writing、知识库、AI Video 等 Owner 声明账户资源和逐操作能力。结构化数据修改经原 Owner 同步索引、版本与业务约束，不能直接改底层文件造成应用状态失配。不能把只读聚合包装成完整文件管理。
4. 远程游戏目录适配器才依赖目标 Daemon，只影响对应来源。节点身份、实例范围、敏感目录和运行实例保护保留在对应 Owner。
5. 本机交互短读直接响应，不进入游戏任务领取队列。压缩、备份、大批量复制等进入文件服务自己的有界任务；上传下载采用流或分片，不把大文件装进 Base64 JSON 或任务数据库。
6. 界面统一为来源/目录导航、位置及操作栏、独立滚动文件区、选择状态、按需预览/编辑面板。有界快照按账户/来源/目录隔离；后台同步不清空已有列表，错误与不可用状态只影响对应来源。

## 验收条件与现状

- 无节点、节点离线或节点发现失败时，账户资源的授权目录、读写和传输仍可用，远程来源清楚显示不可连接。
- 本机目录读取为一次文件查询，不写 `node_file_tasks`，不轮询节点结果。分页后只读取当前页所需元数据，不递归计算目录容量。
- 回归账户、路径穿越、链接、敏感配置、同名覆盖、过期写入与运行游戏实例边界；业务资源修改后原应用回读一致。
- 浏览器覆盖桌面、窄分栏、手机和短屏，验证目录滚动、列拖拽、批量操作、预览/编辑分离、传输取消恢复和错误重试；分别报告请求数/耗时、列表规模与帧时间。
- 沿用 `permissions.mode` 和适用 `appearance` 映射，不新增第二套权限、不重置用户偏好。新增可调策略先接 Settings Owner。
- 当前只完成源码对照和目标修订，统一服务迁移、上述功能回归及性能测量尚未完成。
