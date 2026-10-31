# `lfaa-client-ui-sidebar-terminal`

本包是 Client 唯一共享 xterm 与终端管理器 Owner，公开 `TerminalSurface`、`TerminalSessionController`、`useTerminalSession`、`TerminalManagerProvider` 和 `TerminalManagerRightSidebar`。管理器在账户工作区内维护多个独立标签；一个标签对应一个真实 Shell PTY 或已登记 Minecraft 服务端 PTY。底部终端与 Minecraft 实例控制台注册同一管理器的显示位置，移动显示位置不重连会话；关闭一个标签只关闭该会话。`TerminalSurface` 统一 ANSI 输出、滚动、代码字体/字号/颜色映射、容器尺寸适配及清理；`raw` 模式把原始键盘流交给会话控制器，`line` 模式只保留给确实使用单行命令合同的消费者。

系统终端由 `packages/client/ui-workspace/src/InteractiveTerminal.tsx` 提供底部显示位置；Workbench 在应用路由切换时保留管理器和会话标签。普通 Shell 使用已连接节点上的当前设置目录；Minecraft 内新建 Shell 时，目标路径由 Minecraft Service 校验并解析为实例目录。普通登录账户均可申请 OS Shell，会话是否创建及其后续输入仍由 Permission Owner 和既有终端 API 校验。本包不创建 Daemon Shell，也不持有操作系统权限策略。

Minecraft 控制台由 `packages/client/ui-minecraft` 消费：实例进入启动中时就为真实受管服务端 PTY 注册输出订阅；Daemon 在进程创建后立即把原始 PTY 输出逐段推送，最近最多 128 KiB 只用于短暂补齐订阅竞态，不读取或持久化日志。启动、运行时的 Tab、Enter、Ctrl+C 输入直接通过同一 PTY；服务端进程退出后移除控制台标签并切回始终保留的实例目录 Shell，不显示“实例已停止”或“重新连接”提示。Shell 由已配置的系统终端在 Minecraft Service 校验的实例目录启动，支持普通目录导航和脚本命令；脚本输出显示在该 Shell 中。Minecraft 页面上的系统启动动作仍走既有实例任务 API，启动后同页自动附着新服务端 PTY 并切到该控制台。此处 Shell 是普通 OS Shell，不会把手动启动的脚本冒充为受管 Minecraft 生命周期状态；受管状态与管理动作仍由 Minecraft Service 和真实实例进程决定。完整日志始终由 Minecraft 独立日志页读取与筛选。实例 Shell 仅供有 Minecraft 管理权限且运行节点在线时创建，Shell/控制台的创建与后续输入继续走 Permission Owner。嵌入式 Minecraft 会话不显示断开/重连按钮；普通通用 Shell 的会话管理保持原行为。`TerminalManagerRightSidebar` 将真实节点、核心、端口、配置内存、快捷命令和实时运行指标注入 `ApplicationWorkspace` 最外层右侧菜单；指标来自认证的 Minecraft 只读接口，在线人数、版本、节点本机 Ping 与受管进程启动时间来自 Daemon 状态协议及实际进程记录。Paper TPS 只在服务端控制台会话已连接且用户输入空闲时低频查询，查询文本与输出会保留在控制台；其他核心明确显示不提供 TPS。客户端串行对账、隐藏页面暂停、关闭/切换实例/账户后撤销读取并忽略迟到响应。中间控制台保持单列，快捷命令只向当前活动的服务端 PTY 发送，实例不在运行或未连接时禁用，不调用另一条控制接口。关闭服务端 PTY 标签只关闭终端会话，不停止 Minecraft 实例。本包不解释游戏指令或实现 PTY，也不显示未接入的节点硬件 CPU 指标。

组件读取既有共享外观令牌：主题文字/状态色、Settings 代码字体与字号、强调色、壁纸终端遮罩和减少动态效果。普通 Shell 读取 `settings.general.integratedShell`、`settings.general.taskFolder`；Minecraft 实例 Shell 读取 `settings.general.integratedShell`，并固定使用实例登记目录作为 cwd。权限继续使用 `settings.permissions.mode` 与 Permission Owner；Minecraft 服务端标签继续使用 Minecraft 管理权限、实例状态和命令 API。无新增、重置或本地持久化的设置项。

xterm 限制滚动历史为 2000 行，FitAddon 将尺寸限制到节点协议支持的 500 列/300 行；原始 Shell 输入/输出预算由共享会话 hook 与 Terminal Controller 的既有合同约束。组件只在挂载时创建一个终端，ResizeObserver、主题 MutationObserver、动画帧及 xterm 订阅均在卸载时撤销；按实际容器宽度隐藏次级输入提示，终端本体可在窄分栏内独立滚动。

本包是静态 UI 依赖，不新增 Cordis 服务、Bundle 能力、任务路由或权限策略；当前静态消费者由 `ui-workspace` 与 `ui-minecraft` 明确声明。构建产物只进入根目录 `dist/packages/client/ui-sidebar-terminal/`。源码/类型/构建不能代替真实 Shell、Minecraft 节点、ChatGPT 内置浏览器和设备验收。
