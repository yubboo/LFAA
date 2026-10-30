# 文件管理实例路径显示与离线节点入口

<a id="lfaa-file-manager-instance-path-stale-nodes-20261031"></a>

## 用户目标与可观察结果

- 从 Minecraft 实例打开文件时，面包屑显示实际目录末级名称，不显示实例 UUID；悬停说明显示实际存储路径，不暴露文件服务内部路由。
- “节点资源”和“游戏存储位置”只列出当前在线且支持文件管理的节点；同一台机器的旧离线身份不再复制出无法打开的文件入口。
- 保留目录对应的正确 Owner 路由、权限、路径校验和节点历史记录；不按节点显示名合并身份，也不删除用户数据。
- 桌面、窄分栏、手机与短屏中的文件管理布局保持可滚动、无横向溢出。

## 入口、Owner 与边界

- `/files` 的布局与面包屑由 `packages/client/ui-sidebar-files` 唯一维护；实例文件入口的物理目录由 `packages/api/workspace-files` 调用 Minecraft Owner 与目标 Daemon 解析。
- `.lfaa-library/game-instances/<instanceId>`、`.lfaa-library/game-storage/<nodeId>/...` 是授权后的内部路由键，保留其数据合同；页面不得把这些 ID 作为物理文件夹名称呈现。
- 节点列表按稳定 ID 注册。节点存活/凭据归 Daemon Owner 管理；目录路由仅展示可执行的在线节点，历史节点实体及其任务、审计数据留在原 Owner。

## 设置、权限与数据边界

- 文件管理没有单独的路径标签或离线节点显示设置；继续读取既有 Theme、字体、字号、外观和 Workbench 布局设置，不新增或重置偏好。
- 继续由 File Manager 和 Daemon 验证账户、角色、节点能力、相对路径及写入状态。验收仅读页面和隔离测试数据，不修改真实节点记录、文件或设置。
- 修复前只读核对当前 SQLite：同显示名的两条 `daemon_nodes` 记录分别在线/离线、data root 相同；旧记录仍被 SteamCMD、AI Host Task 和文件审计引用，不能删除或合并。

## 可观察验收

- 实例根面包屑显示真实存储目录末级名称；面包屑标题不再暴露 UUID 或 `.lfaa-library/...` 内部路由。
- 文件资源根不显示无法执行文件操作的离线节点；直接请求离线节点仍由 API 拒绝，不放宽认证与在线状态校验。
- 覆盖实例入口、两个节点资源根、在线/离线同名夹具、窄分栏及手机宽度；通过对应回归和包构建。
- 按仓库规则重建正式 Web，并在 ChatGPT 内置浏览器对 `/files` 实页检查桌面、窄分栏和短屏；记录交互、截图证据及未测范围。

## 实施与验收记录

- 状态：完成。
- 源码诊断：Daemon 通过 `LFAA_HOME/credentials/daemon-node-id` 稳定复用节点 ID，不是每次启动随机生成。只读数据库确认两条同名、同 data root 的节点身份：一条在线，一条自 2026-10-25 离线；旧身份仍关联 14 条 SteamCMD 任务、33 条主机任务和 12 条文件审计记录，因此保留记录与历史，不按显示名合并或删除。
- 实现：`workspace-files` 的节点资源与游戏存储根只枚举在线且具备文件系统能力的节点；离线 ID 的直接访问仍被拒绝。面包屑继续用稳定内部 ID 路由，但展示实例真实目录名或节点显示名；标题和物理路径不再泄露 `.lfaa-library/.../<UUID>`。Windows data root 先用 `win32.normalize` 统一分隔符，非 Windows 绝对路径用 POSIX 规范化。
- 定向回归：在线/离线同名节点入口 1/1 通过（旧记录保留、入口不重复、离线直接访问仍失败）；面包屑 4/4 通过。Host `tsc --noEmit`、Control Plane 构建、`git diff --check` 通过。Impeccable detector 对两个 UI 源文件返回 `[]`。
- 实页验收：在 ChatGPT 内置浏览器使用 `admin` 登录态，正式 Web `http://127.0.0.1:3000` 重启后检查 `/games/minecraft/instances` → 1.21.1「打开实例文件」→ `/files`。桌面 1280×720 显示 `LFAA 数据 / 应用资源 / 游戏实例 / 1.21.1`，物理路径为 `C:\Users\yu\.lfaa\data\games\minecraft\1.21.1`；点“返回实例”回到同一实例 UUID 的概览页，往返入口正常。
- 响应式验收：390×844 与 320×640 的 `documentElement.scrollWidth`/`clientWidth`、`body.scrollWidth`/`clientWidth` 分别相等，无页面横向溢出；文件列表区域保持纵向滚动（320×640 时列表容器 262×269、内容高度 1883），滚至末尾可达分页与项目计数。320px 宽时上传按钮换行，路径以省略号收纳。
- Web 构建已在本轮 UI 源码完成后通过；随后 API 路径规范化只改 Host 文件服务 Owner，因此重建 Control Plane 并重启正式 Web 后实页复验。全量 `file-resources.test.mjs` 仍有 3 个隔离数据库夹具缺列失败（`jvm_initial_heap_mb`、Writing `directory_name`），不属于本次节点/面包屑用例；两项定向回归均通过。
- 设置：不新增或改动设置；沿用既有外观与 Workbench 布局设置，验收未保存或重置用户偏好。未在真实手机设备及其他操作系统节点上实测。
