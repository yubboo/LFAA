# 文件资源与统一数据根交付记录

2026-10-15 统一复验补记：[小鱼统一验收](xiaoyu-agent-20261015.md)记录本轮重新运行的 59/59 文件/存储回归、正式入口与内置浏览器的单根/默认/推荐位置显示。新账号的文件页正确要求超级管理员且完全访问，未绕过该边界，也未迁移真实数据。以下仍保留 2026-10-14 原任务的历史证据。

2026-10-14。以本轮开始时保存的文件哈希区分本轮变更与已有脏工作树；此前包职责/按需能力任务的修改保留。全部本轮文件的绝对路径和职责见末表。

## 已实现行为

首次未配置默认使用当前系统账户的 `.lfaa/data`；当前 Windows 用户对应 `C:\Users\yu\.lfaa\data`。默认解析原本已正确，本次修正旧文档与设置入口。项目 `H:\LFAA1\data` 是设置中心显式点击的推荐位置，自定义总根保持优先，推荐不会覆盖自定义根。

只选择一个 data 根。games、backups、environments、logs、plugins、cache、tmp、lib 等使用既有布局中的子目录；分类入口只是导航，不建立第二套实体目录。删除独立分类位置输入和保存接口，旧写接口明确返回 410。旧作品/环境位置和已登记游戏实例实际目录保留回读，不自动搬迁或删除真实数据。总根切换仍由原 Data Directory Owner 在完整启动时复制、核验，成功后采用新根，保留来源。

首页只显示真实 data 项；磁盘、资料库、节点、游戏实例和实际 Minecraft/SteamCMD 目录通过独立来源发现。游戏实例目录由领域记录与目标 Daemon 验证，运行/未知状态、实例根和登记/进程/安装标记受保护。普通控制端目录入口不能绕过节点 Owner 写入已登记实例。

data/plugins 是 Harness 扩展，不是 games/<实例>/plugins 或 mods。普通浏览只读；安装、更新、兼容、启停、卸载仍由 Plugin Manager 执行；私有运行数据不可浏览。只读参考本机 DSH 的 Profile 安装隔离源码，未声称任意第三方 DSH 包都已兼容或完成真实安装。

开发提示词及以后开发规范见 [中文规范](file-resources.zh.md)，英文入口见 [导读](file-resources.md)。

## 设置中心实际接入

| 配置或事实 | 使用方式 |
| --- | --- |
| LFAA_DATA_DIR、原数据根选择/迁移状态 | 所有分类的权威根；新增返回默认、推荐和当前选择，不另建根解析 |
| project_storage_locations 历史记录 | 仅旧作品/环境回读；不继续提供独立根写入口 |
| 节点 instanceDirectory、实例 storageDirectory、SteamCMD 原设置 | 只读实际目录定位和旧数据兼容，文件 UI 不猜远端根 |
| permissions.mode、Identity 实际角色 | 沿用当前文件服务的 super_admin/full_access 能力边界，未改变权限模式 |
| plugins.enabled 与原 Profile 安装清单 | 管理入口与生命周期继续消费原 Owner；目录存在不代表已启用 |
| Appearance 主题、强调色、文字色、字体/字号、对比度、壁纸、表面透明度、模糊、减少动态效果 | Files/Settings 使用现有共享令牌和组件，无新增外观偏好副本 |

## 验证证据和边界

- 9 个直接回归文件合计 **59/59 通过**：file-resources、system-file-library、file-manager-foundation、file-manager-api、data-directory-settings、data-directory、runtime-environment、writing-local-files、minecraft-multicore。包含真实临时文件、SQLite/身份/API 与队列；远端完成回报使用测试替身，未代替实际节点验收。
- Client/Host 类型检查、16 个受影响包串行构建、正式 Control Plane 和 Web 构建、Daemon 语法、check:workspace（192 包）与 git diff --check 通过。所有编译产物在根 dist；Web 仍报告已有较大 chunk 提示。不存在的 workspace-preflight 未运行；未执行全仓测试或桌面封装。
- 正式 Web 与 Control Plane 源码/构建指纹均返回空差异 `[]`。常规构建和定向回归不证明实际节点/游戏、Provider 或桌面设备已验收。
- 4096 项实际目录的工作量测量：全量 readdir 取得 4096 项，当前流式读取取得 512 项即返回 500 项并标记 truncated；当前耗时 22ms。仅证明该样本读取工作量减少，不是旧代码耗时对比或真实游戏目录/FPS指标。证据保存在根 dist/.tmp/file-manager/performance.json。
- 隔离浏览器已检查登录、data/来源分离、缓存预览、插件只读、空游戏实例状态、390×700 与 390×500 容器滚动。之后新增的推荐/分类只读设置与最终账户隔离修改仅由类型/API/构建核对，**尚未在浏览器重新实测**；手机/平板实体设备、帧时间、实际节点/游戏读写未运行。
- 额外尝试 storage-hub 回归时遇到既有 schema 断言期望 50、实际 56；本任务未修改 schema 版本，未修改该断言。该额外检查失败，不能宣称全仓测试通过。
- 可见的 3314 页面曾连接隔离测试根，已关闭并停止该自有测试服务；该 Temp 路径是夹具，不是产品默认位置。既有用户服务未重启，运行中的旧服务不会因构建自动升级。
- 已核对该测试端口无监听；删除精确隔离夹具 `C:\Users\yu\AppData\Local\Temp\lfaa-file-browser-L9IKaI` 的操作被自动审批策略拦截，工具没有提供更具体原因，未绕过拦截。夹具保留，不作为产品默认数据根。

当前限制沿用明确合同：目录返回上限 500、扫描上限 20000；搜索扫描 10000、深度 10；单文件传输 3 MiB、批次 20 MiB。分类导航不自动创建缺失目录、不全盘递归统计；大包安装由插件/游戏原领域 Owner 负责。

## 每个变更文件的绝对路径与职责

表内目标链接使用仓库相对路径；标签为本次工作副本绝对路径。

| 文件 | 变更 | 职责 |
| --- | --- | --- |
| [H:\LFAA1\apps\cli\tests\data-directory-settings.test.mjs](../../apps/cli/tests/data-directory-settings.test.mjs) | 修改 | 默认/推荐/自定义根及安全迁移回归 |
| [H:\LFAA1\apps\cli\tests\data-directory.test.mjs](../../apps/cli/tests/data-directory.test.mjs) | 修改 | 首次默认用户目录与显式推荐回归 |
| [H:\LFAA1\apps\cli\tests\file-resources.test.mjs](../../apps/cli/tests/file-resources.test.mjs) | 新增 | 资源/插件/实例围栏、取消、性能与单根 API 回归 |
| [H:\LFAA1\apps\cli\tests\runtime-environment.test.mjs](../../apps/cli/tests/runtime-environment.test.mjs) | 修改 | 环境目录派生与旧环境回读回归 |
| [H:\LFAA1\apps\cli\tests\system-file-library.test.mjs](../../apps/cli/tests/system-file-library.test.mjs) | 修改 | 真实目录/来源分离与统一权限/工具回归 |
| [H:\LFAA1\docs\PROMPTS.md](../../docs/PROMPTS.md) | 修改 | 当前合同、允许边界与验收记录 |
| [H:\LFAA1\docs\development\file-resources-20261014.md](../../docs/development/file-resources-20261014.md) | 新增 | 逐文件职责、设置使用和完整验证交付 |
| [H:\LFAA1\docs\development\file-resources.md](../../docs/development/file-resources.md) | 新增 | 英文规范入口 |
| [H:\LFAA1\docs\development\file-resources.zh.md](../../docs/development/file-resources.zh.md) | 新增 | 可复用开发提示词与目录规范 |
| [H:\LFAA1\docs\harness-packages.json](../../docs/harness-packages.json) | 修改 | 生成的包职责/README/依赖清单 |
| [H:\LFAA1\docs\harness-packages.md](../../docs/harness-packages.md) | 修改 | 生成的包职责目录 |
| [H:\LFAA1\docs\开发计划.md](../../docs/开发计划.md) | 修改 | 当前实现状态和未验边界 |
| [H:\LFAA1\docs\系统总体架构.md](../../docs/系统总体架构.md) | 修改 | 文件/游戏/插件/数据根的唯一 Owner 事实 |
| [H:\LFAA1\packages\api\job-controller\README.md](../../packages/api/job-controller/README.md) | 新增 | 记录包职责：环境控制 API 派生位置 |
| [H:\LFAA1\packages\api\job-controller\src\runtime-routes.ts](../../packages/api/job-controller/src/runtime-routes.ts) | 修改 | 停用独立环境目录写入口，返回 410 |
| [H:\LFAA1\packages\api\remotes\src\route-contracts.ts](../../packages/api/remotes/src/route-contracts.ts) | 修改 | 移除失去消费者的独立分区 schema |
| [H:\LFAA1\packages\api\settings-controller\README.md](../../packages/api/settings-controller/README.md) | 新增 | 记录包职责：单根设置/推荐与原授权 |
| [H:\LFAA1\packages\api\settings-controller\package.json](../../packages/api/settings-controller/package.json) | 修改 | 同步实际 Owner 消费依赖 |
| [H:\LFAA1\packages\api\settings-controller\src\index.ts](../../packages/api/settings-controller/src/index.ts) | 修改 | 推荐动作与旧分区写入口退役 |
| [H:\LFAA1\packages\api\workspace-files\README.md](../../packages/api/workspace-files/README.md) | 新增 | 记录包职责：资源/实例/平台 API 合同 |
| [H:\LFAA1\packages\api\workspace-files\package.json](../../packages/api/workspace-files/package.json) | 修改 | 同步实际 Owner 消费依赖 |
| [H:\LFAA1\packages\api\workspace-files\src\index.ts](../../packages/api/workspace-files/src/index.ts) | 修改 | 认证资源发现、节点平台/实例挂载与原队列取消 |
| [H:\LFAA1\packages\boot\plugin-manager\README.md](../../packages/boot/plugin-manager/README.md) | 修改 | 记录包职责：扩展/游戏插件分离与唯一生命周期 |
| [H:\LFAA1\packages\client\connection\README.md](../../packages/client/connection/README.md) | 修改 | 记录包职责：公共资源/存储消费合同 |
| [H:\LFAA1\packages\client\connection\src\api.ts](../../packages/client/connection/src/api.ts) | 修改 | 资源/数据根合同、推荐动作及旧分区 API 清理 |
| [H:\LFAA1\packages\client\connection\src\runtime-api.ts](../../packages/client/connection/src/runtime-api.ts) | 修改 | 移除独立环境存储写入客户端 API |
| [H:\LFAA1\packages\client\ui-settings\README.md](../../packages/client/ui-settings/README.md) | 新增 | 记录包职责：单根界面及分类只读 |
| [H:\LFAA1\packages\client\ui-settings\src\RuntimeStorageSettings.tsx](../../packages/client/ui-settings/src/RuntimeStorageSettings.tsx) | 修改 | 只读节点真实环境位置及可取消读取 |
| [H:\LFAA1\packages\client\ui-settings\src\SettingsPage.tsx](../../packages/client/ui-settings/src/SettingsPage.tsx) | 修改 | 单一总根设置、推荐按钮与分类/游戏位置只读 |
| [H:\LFAA1\packages\client\ui-sidebar-files\README.md](../../packages/client/ui-sidebar-files/README.md) | 新增 | 记录包职责：工作台/外观/响应式与验收边界 |
| [H:\LFAA1\packages\client\ui-sidebar-files\src\FileManagerPage.css](../../packages/client/ui-sidebar-files/src/FileManagerPage.css) | 修改 | 资源导航、窄容器/短屏布局与共享外观 |
| [H:\LFAA1\packages\client\ui-sidebar-files\src\FileManagerPage.tsx](../../packages/client/ui-sidebar-files/src/FileManagerPage.tsx) | 修改 | 工作台、真实能力、回收站及账户请求隔离 |
| [H:\LFAA1\packages\core\tools\src\business-tools.ts](../../packages/core/tools/src/business-tools.ts) | 修改 | 模型按统一工具发现资源与节点游戏作用域 |
| [H:\LFAA1\packages\fs\fs\README.md](../../packages/fs/fs/README.md) | 新增 | 记录包职责：唯一文件执行器及资源围栏/限制 |
| [H:\LFAA1\packages\fs\fs\src\instance-files.d.mts](../../packages/fs/fs/src/instance-files.d.mts) | 新增 | 实例文件保护公开类型 |
| [H:\LFAA1\packages\fs\fs\src\instance-files.mjs](../../packages/fs/fs/src/instance-files.mjs) | 新增 | 实例停止状态、根/标记保护和共享执行器 |
| [H:\LFAA1\packages\fs\fs\src\library.ts](../../packages/fs/fs/src/library.ts) | 修改 | 目录/资源分离、原认证、私有与插件围栏 |
| [H:\LFAA1\packages\fs\fs\src\managed-files.d.mts](../../packages/fs/fs/src/managed-files.d.mts) | 修改 | 共享文件执行器异步保护/取消/互斥合同 |
| [H:\LFAA1\packages\fs\fs\src\managed-files.mjs](../../packages/fs/fs/src/managed-files.mjs) | 修改 | 流式有界读取、路径校验、异步保护与统一互斥 |
| [H:\LFAA1\packages\fs\fs\src\queue.ts](../../packages/fs/fs/src/queue.ts) | 修改 | 创建者命名空间与仅排队读取可取消 |
| [H:\LFAA1\packages\games\runtime-manager\README.md](../../packages/games/runtime-manager/README.md) | 修改 | 记录包职责：新环境派生与旧环境回读 |
| [H:\LFAA1\packages\games\runtime-manager\src\service.ts](../../packages/games/runtime-manager/src/service.ts) | 修改 | 新环境派生总根，旧环境回读 |
| [H:\LFAA1\packages\host\daemon\README.md](../../packages/host/daemon/README.md) | 修改 | 记录包职责：节点能力和真实目录执行 |
| [H:\LFAA1\packages\host\daemon\src\daemon.mjs](../../packages/host/daemon/src/daemon.mjs) | 修改 | 节点验证真实实例/平台目录与状态、能力回报及执行 |
| [H:\LFAA1\packages\settings\settings\README.md](../../packages/settings/settings/README.md) | 新增 | 记录包职责：分类派生与历史回读 |
| [H:\LFAA1\packages\settings\settings\src\project-storage.ts](../../packages/settings/settings/src/project-storage.ts) | 修改 | 一个总根派生分类目录、旧分区仅回读 |
| [H:\LFAA1\packages\util\home-paths\README.md](../../packages/util/home-paths/README.md) | 修改 | 记录包职责：统一默认根/data 子目录 |
| [H:\LFAA1\packages\util\home-paths\src\data-layout.d.mts](../../packages/util/home-paths/src/data-layout.d.mts) | 修改 | 共享 tmp 子目录类型 |
| [H:\LFAA1\packages\util\home-paths\src\data-layout.mjs](../../packages/util/home-paths/src/data-layout.mjs) | 修改 | 统一 data 布局补齐 tmp |
| [H:\LFAA1\packages\util\values\README.md](../../packages/util/values/README.md) | 修改 | 记录包职责：公共资源元数据类型 |
| [H:\LFAA1\packages\util\values\src\file-manager-contract.ts](../../packages/util/values/src/file-manager-contract.ts) | 修改 | 资源元数据公共合同 |
| [H:\LFAA1\packages\workspace\data-directory\README.md](../../packages/workspace/data-directory/README.md) | 新增 | 记录包职责：数据根选择与迁移 |
| [H:\LFAA1\packages\workspace\data-directory\package.json](../../packages/workspace/data-directory/package.json) | 修改 | 同步实际 Owner 消费依赖 |
| [H:\LFAA1\packages\workspace\data-directory\src\service.ts](../../packages/workspace/data-directory/src/service.ts) | 修改 | 默认/推荐/自定义根与原安全迁移 Owner |
| [H:\LFAA1\pnpm-lock.yaml](../../pnpm-lock.yaml) | 修改 | 实际工作区依赖同步 |
| [H:\LFAA1\开发规范.md](../../开发规范.md) | 修改 | 纠正旧可移动盘默认规则，规范单根与显式推荐 |

本轮共 56 个变更文件。
