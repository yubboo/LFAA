# Minecraft 与 Steam 应用文件入口

<a id="lfaa-game-app-file-manager-roots-20261031"></a>

## 用户目标与可观察结果

- Minecraft 左二“文件管理”打开当前 Minecraft 存储节点的游戏主目录；目录来自 Minecraft Storage Owner，不打开 LFAA data 根或其他 App 资源。
- Steam 应用左二增加“文件管理”，打开当前 Steam 存储节点的游戏主目录；目录来自 SteamCMD Storage Owner，不打开 SteamCMD 工具安装目录。
- 文件页提供返回来源 App 页面的入口；返回后从原 App 左二再次进入文件管理仍定位同一领域主目录。

## 入口、Owner 与边界

- 菜单与来源页面路由由 `packages/client/ui-workspace` 持有。
- 文件页布局、返回按钮由 `packages/client/ui-sidebar-files` 持有；一次性账户限定的目标与返回信息由 `packages/client/connection` 的 File Manager Location 合同传递。
- 实际 Minecraft/Steam 文件位置来自 `/minecraft/storage-settings`、`/steamcmd/settings` 和在线节点 File Owner；`/files` 服务端继续执行账户、角色、完全访问模式、节点能力和相对路径校验。
- Minecraft 有当前实例上下文时优先使用该实例节点；否则使用领域存储清单中的在线节点。Steam 沿用当前目标节点（若有），否则使用 Steam 清单中的在线节点。
- 实际路径默认分别为 `data/games/minecraft` 与 `data/games/steamcmd`；显式按节点保存的位置优先。SteamCMD 工具目录 `steamcmd-runtime` 不作为 Steam 游戏主目录。

## 设置、权限与数据边界

- Minecraft `instanceDirectory` 与 Steam `gameDirectory` 的默认值、持久化及节点覆盖继续由原设置 Owner 管理；不新增路径偏好、不覆盖已有用户配置，也不搬迁文件。
- 文件页沿用 Settings 的主题、颜色、字体、字号、对比度、背景、遮罩、模糊、减少动态效果和 Workbench 布局映射。
- 不直接读取本机/节点文件，不放宽文件操作权限，不在菜单复制路径解析或领域业务规则。

## 分批验收

1. Minecraft 菜单入口读取 Minecraft Storage Owner 的节点清单，优先使用当前实例节点，进入游戏根，并验证返回 Minecraft 及再次进入。
2. Steam 菜单入口读取 SteamCMD Storage Owner 的节点清单，优先使用当前目标节点，进入游戏根，并验证返回 Steam 及再次进入。文件页按来源 App 显示对应返回名称。

## 实施与验收记录

- 初次实现状态（后续修复见下文）：入口和返回完成；Minecraft 实页通过；Steam 路径定位与返回通过，但当时 Steam 游戏目录不存在，无法实测目录列表。
- 源码：`ui-workspace` 对两个 App 统一读取各自 Storage Owner 的当前节点配置，并传入领域目录 ID、返回路由和来源 App；Connection 只传递账户限定的一次性路由信息；文件页依据来源 App 显示“返回 Minecraft”或“返回 Steam”。
- 批次 1 / Minecraft：ChatGPT 内置浏览器路由 `/games/minecraft/instances`，分别检查 1280×900、878×849 和 390×600。左二“文件管理”进入 `C:\Users\Administrator\.lfaa\data\games\minecraft`，显示两项游戏目录及“返回 Minecraft”；点击返回回到实例页，再次进入仍定位同一主目录。390×600 下资源导航以展开浮层显示；收起后文件列表和返回按钮可达，截图未见横向溢出。验收后恢复进入时展开的资源导航状态。运行实例 0/2、排队/执行任务 0。
- 批次 2 / Steam 初次实页：ChatGPT 内置浏览器路由 `/games/steamcmd`，检查 878×849 和 1280×900。左二菜单显示“服务器工作区 / 文件管理”；点击文件管理进入 Steam 游戏主目录路由，按钮显示“返回 Steam”，点击后返回 Steam 工作区，再次进入仍指向同一配置目录。当时目标节点 `C:\Users\Administrator\.lfaa\data\games\steamcmd` 不存在，Owner 返回 ENOENT；根目录自动补建属于下面的后续修复。
- 自动检查：`client-game-app-file-manager-entry.test.mjs` 与 `client-minecraft-instance-file-entry.test.mjs` 当前源码断言均通过；后者两项陈旧调用数量断言更新为真实源码中的 1 次。客户端 TypeScript 检查及 `ui-workspace`、`connection`、`ui-sidebar-files` 构建通过；Impeccable `detect --json` 对两个 UI 源文件返回 `[]`；本任务改动文件 `git diff --check` 通过。全仓 `git diff --check` 仍被已有 `packages/games/minecraft/src/core-sources.ts` 第 121、123 行尾随空格阻塞，该文件不属于本任务，未改动。
- 截图证据：ChatGPT 内置浏览器本轮截图分别显示 Minecraft 根目录（1280×900、390×600）和 Steam 路由错误状态（1280×900）；截图留存在本轮浏览器验收工具输出中，未另存到仓库。手机/短屏仅通过 Minecraft 文件目录与返回入口；未测平板视口。临时视口已重置为默认 879×849；UI 变更不新增 CSS/布局规则。
- 初次批次设置：沿用既有 Minecraft `instanceDirectory`、Steam `gameDirectory` 与通用外观/布局设置；不修改用户设置。真实 Steam 根目录创建记录见下文。

## 2026-10-31 后续修复与复验

- 缺失游戏根处理：Daemon 文件操作在创建游戏存储服务前，按当前节点配置安全地逐段确认并创建缺失的 Minecraft/Steam 游戏根；并发创建遇到 `EEXIST` 后重新核实节点类型与链接属性。此规则不自动创建 SteamCMD 工具安装目录，仍沿用其安装 Owner。
- 实际 Steam 根：使用 SteamCMD Storage Owner 当前 `gameDirectory`（本机节点默认 `C:\Users\Administrator\.lfaa\data\games\steamcmd`），首次进入时创建真实目录。文件管理页实读该节点位置并显示“此目录为空 / 0 个项目”；磁盘检查确认该路径存在且为目录。未改设置。
- 左一入口复验发现并修复：Steam 左二文件页的“返回 Steam”正常；但游戏页左一“更多功能 → 文件管理”此前只导航 `/files`，残留游戏路径会污染全局入口。`ui-workspace` 现在先为当前账户写入 Data 根位置，再导航，文件页不会复用旧应用路径快照。
- 窄屏布局：ChatGPT 内置浏览器 `/files`，760×560；布局列为 `64px 238.844px 1px 456.156px`，中心区从 x=303.844px 紧接左二栏与分隔线，去掉旧的 64px Overlay 左缩进。`innerWidth=760`、document/body `scrollWidth=760`，无整页横向溢出。已捕获全局 Data 总览截图。
- 桌面布局：同一 `/files` 实测 1280×720；document/body `scrollWidth=1280`，中心区从 x=303.844px 开始，无横向溢出。验收完成后清除临时 viewport 覆盖。
- 真文件列表回归：独立目录夹具中先让 Steam 游戏根缺失，首次读取时创建真实目录，再用文件服务创建 `import-staging` 并再次读取；该文件夹能在真实列表中出现。`file-manager-foundation.test.mjs` 11/11 通过。此用例写入并清理隔离的 `dist/.tmp` 测试根，没有在用户游戏目录创建测试文件。
- 自动回归：游戏文件入口/资源边界 6/6；Mobile Dock 去除 Overlay 左缩进 1/1；Client TypeScript、`lfaa-client-ui-workspace`、正式 Web 构建通过。Impeccable detector 对 `ui-workspace/src/ApplicationWorkspace.tsx` 与 DockKit 响应式样式返回 `[]`。Steam Storage 根修复批次另已通过 Daemon 构建、Host/Client 类型、Control Plane/Web 构建；官方 `pnpm lfaa web` 重启后健康接口为 `status=ok`、`persistence=ready`，`runtime-build-state.mjs web` 返回 `[]`。
- 全量文件 `client-workbench-responsive.test.mjs` 的一次尝试有 4 条既有 ApplicationWorkspace/CSS 结构断言与当前并行工作区源码不匹配；本轮变更关联的响应式回归单独 1/1 通过。全仓 `git diff --check` 仍报告不相关 `packages/games/minecraft/src/core-sources.ts` 第 121、123 行尾随空格；本轮改动文件定向检查通过。
- 设置与权限：继续使用设置中心现有 Data 根、Minecraft `instanceDirectory`、Steam `gameDirectory`、文件权限和 Appearance/布局设置；没有新增或修改设置、没有更改权限模式。根目录创建只处理配置指定的游戏根，不扫描其他项目目录、不清理任何用户内容。
- 后续导入服务端要求：文件管理器只负责展示和操作真实目录；将来“导入服务端”必须由 Steam 服务端 Owner 校验所选目录及可执行文件/元数据，再写入该 Owner 的正式服务器登记，使部署、启动和更新能力识别同一真实目录。单独创建文件夹不应伪装成已登记服务器；本轮未实现导入部署流程。
- 其他未测：帧时间、实体手机/平板、Electron WebView、已导入的真实第三方服务端启动流程。
