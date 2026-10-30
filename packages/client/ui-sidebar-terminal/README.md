# `lfaa-client-ui-sidebar-terminal`

本包是 Client 唯一共享 xterm 与终端管理器 Owner，公开 `TerminalSurface`、`TerminalSessionController`、`useTerminalSession` 和 `TerminalManagerProvider`。管理器在账户工作区内维护多个独立标签；一个标签对应一个真实 Shell PTY 或已登记 Minecraft 服务端 PTY。底部终端与 Minecraft 实例控制台注册同一管理器的显示位置，移动显示位置不重连会话；关闭一个标签只关闭该会话。`TerminalSurface` 统一 ANSI 输出、滚动、代码字体/字号/颜色映射、容器尺寸适配及清理；`raw` 模式把原始键盘流交给会话控制器，`line` 模式只保留给确实使用单行命令合同的消费者。

系统终端由 `packages/client/ui-workspace/src/InteractiveTerminal.tsx` 提供底部显示位置；Workbench 在应用路由切换时保留管理器和会话标签。普通 Shell 使用已连接节点上的当前设置目录；Minecraft 内新建 Shell 时，目标路径由 Minecraft Service 校验并解析为实例目录。普通登录账户均可申请 OS Shell，会话是否创建及其后续输入仍由 Permission Owner 和既有终端 API 校验。本包不创建 Daemon Shell，也不持有操作系统权限策略。

Minecraft 控制台由 `packages/client/ui-minecraft` 消费：实例在线且运行时，管理器自动附着唯一的受管服务端 PTY，无需手动连接入口；PTY 仅回放该真实进程内存中最近最多 128 KiB 的原始终端输出，之后的输出和 Tab、Enter、Ctrl+C 输入都直接通过同一 PTY。回放缓冲不读取或持久化日志；活动终端不存在时只显示连接状态。完整日志始终由 Minecraft 独立日志页读取与筛选。只有附着失败或会话退出时，标签内才显示“重试连接/重新连接”。侧栏读取真实节点、核心、端口和配置内存；快捷命令仅向当前活动的服务端 PTY 发送，未连接时禁用，不调用另一条控制接口。Minecraft Service/Daemon 仍拥有实例和进程生命周期，关闭服务端标签不会停止实例。本包不解释游戏指令或实现 PTY，也不生成未接入的 CPU/TPS 等运行指标。

组件读取既有共享外观令牌：主题文字/状态色、Settings 代码字体与字号、强调色、壁纸终端遮罩和减少动态效果。Shell 读取 `settings.general.integratedShell`、`settings.general.taskFolder`，权限继续使用 `settings.permissions.mode` 与 Permission Owner；Minecraft 服务端标签继续使用 Minecraft 管理权限、实例状态和命令 API。无新增、重置或本地持久化的设置项。

xterm 限制滚动历史为 2000 行，FitAddon 将尺寸限制到节点协议支持的 500 列/300 行；原始 Shell 输入/输出预算由共享会话 hook 与 Terminal Controller 的既有合同约束。组件只在挂载时创建一个终端，ResizeObserver、主题 MutationObserver、动画帧及 xterm 订阅均在卸载时撤销；按实际容器宽度隐藏次级输入提示，终端本体可在窄分栏内独立滚动。

本包是静态 UI 依赖，不新增 Cordis 服务、Bundle 能力、任务路由或权限策略；当前静态消费者由 `ui-workspace` 与 `ui-minecraft` 明确声明。构建产物只进入根目录 `dist/packages/client/ui-sidebar-terminal/`。源码/类型/构建不能代替真实 Shell、Minecraft 节点、ChatGPT 内置浏览器和设备验收。
