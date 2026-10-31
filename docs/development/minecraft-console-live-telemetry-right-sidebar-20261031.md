# Minecraft 控制台真实服务器状态模块

<a id="lfaa-minecraft-console-live-telemetry-right-sidebar-20261031"></a>

## 用户目标与可观察结果

- 在 Minecraft 实例控制台路由的最外层右侧菜单中，现有服务器状态与快捷命令卡片下方新增真实服务器指标卡；不得放入实例概览卡、控制台主区域或通用服务状态区域。
- 在线人数、服务器公布版本、节点到本机服务器的 Ping、进程运行时间只能来自真实运行时读取；数据缺失、节点离线、实例未运行或状态过期时显示明确不可用状态，不显示截图中的示例数值。
- TPS 必须来自真实核心指标来源。用户已选择在控制台会话打开且服务端空闲时，仅对 Paper 核心定时发送只读 `tps` 查询并从真实控制台输出解析；其他核心显示“核心未提供 TPS 采样”。
- 切换实例、离开控制台或切换账户后，停止读取并清除上一实例数据；右侧菜单隐藏时 Client 不再请求指标，恢复显示后继续读取。

## 入口、Owner、数据与权限

- 实际路由：`/games/minecraft/instance/:instanceId/terminal`；当前用户指示的目标为 ChatGPT 内置浏览器图二右侧菜单红框。
- 展示布局由 `packages/client/ui-sidebar-terminal` 的 `TerminalManagerRightSidebar` 提供；Minecraft 实例的服务器状态、核心和端口仍由 Minecraft Owner 传入。
- 真实网络状态由目标节点 Daemon 本机查询当前已运行的实例端口，再经认证节点心跳回到 Control Plane；Control Plane 仅在内存中短期暂存带时间戳的实例指标，不写业务数据库；认证只读路由返回，不从浏览器/Control Plane 猜测远程节点地址。
- 在线人数/最大人数、服务端公布版本与 Ping 来自 Minecraft 服务器状态协议；运行时间来自目标节点受管进程的真实 `startedAt`。不收集或展示玩家名单。
- 不改服务端配置、RCON、插件、世界文件或服务端进程，不启停实例。成员只读权限、账户/节点/实例隔离和服务端授权保持由现有 Owner 校验。

## 设置、性能与响应式边界

- 不新增、重置或修改设置中心配置；沿用现有 Appearance/主题、字号、对比度和减少动态效果，右侧菜单显隐/宽度仍归共享 Workbench 设置。
- Daemon 只为已运行进程做状态探测，每 10 秒至多一次、单次 2 秒超时，同实例仅保留一个在途请求；缓存随心跳短期刷新，超时及进程停止后清理。Paper `tps` 查询仅在真实控制台会话已连接且用户输入空闲时每分钟至多一次，8 秒无输出即标记不可用；命令和输出会进入真实 PTY/日志。客户端只在控制台路由使用串行 10 秒只读 poller，隐藏页面暂停、右侧菜单不可见时跳过读取，卸载/切换实例/账户撤销请求；不新增常驻订阅。
- 桌面、平板、手机、窄分栏和短屏下检查右栏滚动、内容遮挡与横向溢出；密集数据使用现有共享控件及主题令牌，不新增 CSS 自定义属性或动画。

## 设置与 UI Skill 核查

- 设置中心盘点：无需新增设置项。继续读取共享 Appearance 主题/强调色/字体与字号/对比度/壁纸遮罩及模糊/减少动态效果映射；右侧菜单宽度和显隐沿用 Workbench 既有配置及默认值，不写入用户偏好。
- 本轮遵循 LFAA code-change、owner-navigation、validation 与 UI Taste、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI 前置核查；指标数据仍唯一归 Minecraft Service 与 Daemon Owner。

## 实施与验收

- 单批：Daemons 真实采样及心跳、领域 Owner 短期缓存与认证只读路由、Client API 和控制台最外层右栏卡片；保留旧服务器状态和快捷命令卡片原顺序与行为。
- 为协议解析、数据校验/隔离、过期清理和右栏来源/状态分支增加直接回归；运行 Client 类型检查、相关包构建、正式 Web 构建、运行指纹和差异检查，产物只写仓库根 `dist/`。
- 从当前 checkout 启动正式 Web，在 ChatGPT 内置浏览器检查真实控制台路由、桌面与相关窄屏视口；核对模块在右栏的准确位置、真实运行/停止状态、可用性与滚动。未有真实运行服务器时不触发启动；以协议本地夹具验证节点采样，不把夹具当成游戏服务端实测。
- 不更改用户偏好、服务端配置或生命周期；不把截图示例值作为回退内容。记录实际服务、路由、视口、截图与未测范围。

## 实施与验收记录

- 状态：实现完成；用户明确选择 Paper 运行时定时查询 `/tps`。
- 实现：Daemon 读取 Java Server List Ping 与 Bedrock RakNet 状态包；Paper TPS 只读查询受控制台订阅、服务就绪、用户空闲和频率限制约束。Minecraft Service 在内存中隔离缓存，Minecraft Controller 提供登录后只读、`no-store` 接口；Client 仅在目标控制台右栏可见时读取并显示五项指标。为使新数据库可通过当前实例读取链，存储迁移按 v76、v77–v79 顺序补齐既有调用。
- 回归：节点协议/TPS、接口认证与 `no-store`、实例/节点隔离/过期/停止清理和执行控制定向回归 18 项通过；`pnpm run typecheck`、225 包 Harness、Control Plane/Web 构建、`git diff --check` 通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。
- 实页：ChatGPT 内置浏览器 `http://127.0.0.1:3000/games/minecraft/instance/bd7c58bb-a1e1-4d20-b7f6-d66f23841e2d/terminal`，视口 1750×1244；在最外层右栏、服务器状态与快捷命令下方看到指标卡，右栏宽度 360 px。实例真实状态为已停止，五项均明确显示“实例未运行”，没有显示示例数值；未触发启停。页面截图已在本轮 CUA 实页验收中目视检查。
- 边界：当前目标实例已停止，因此没有实测游戏服务端实时人数/TPS/Ping/进程时长，也没有真实 Paper PTY 输出验收；手机宽度与短屏未实测。协议夹具只验证报文解析和查询调度，不能替代真实运行 Paper 服务验收。
