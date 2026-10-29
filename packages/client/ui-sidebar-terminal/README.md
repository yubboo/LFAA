# `lfaa-client-ui-sidebar-terminal`

本包是 Client 唯一共享 xterm 与交互会话控制器 Owner，公开 `TerminalSurface`、`TerminalSessionController` 和 `useTerminalSession`。它统一 ANSI 输出、滚动、代码字体/字号/颜色映射、容器尺寸适配及清理；`raw` 模式把原始键盘流交给同一个会话控制器，Terminal Controller 将输入送到 Shell PTY 或已登记 Minecraft PTY。`line` 模式只保留给确实使用单行命令合同的消费者。

系统终端由 `packages/client/ui-workspace/src/InteractiveTerminal.tsx` 消费：组件提供节点选择与 Shell 入口；共享 hook 管理会话、审批、输入输出和关闭。Shell/工作目录继续读取 Settings，权限由 Permission Owner、Terminal Controller 和 Daemon PTY 合同持有。本包不启动 Shell，也不持有服务端授权策略。

Minecraft 控制台由 `packages/client/ui-minecraft` 消费：已有日志继续来自 Minecraft 领域认证读取/Socket.IO；连接后由共享 hook 通过 Terminal Controller 认证会话附着 Daemon 持有的 PTY，键盘 Tab、Enter、Ctrl+C 和尺寸变化都传给运行中的核心。Minecraft Service/Daemon 仍拥有实例和进程生命周期；断开会话不会停止服务端。本包不解释游戏指令或实现 PTY。其他 App 可复用同一表面和会话 hook。

组件读取既有共享外观令牌：主题文字/状态色、Settings 代码字体与字号、强调色、壁纸终端遮罩和减少动态效果。系统 Shell 仍读取 `settings.general.integratedShell`、`settings.general.taskFolder`，权限继续使用 `settings.permissions.mode` 与 Permission Owner；Minecraft 继续使用自己的管理员访问、实例状态和命令 API。无新增、重置或本地持久化的设置项。

xterm 限制滚动历史为 2000 行，FitAddon 将尺寸限制到节点协议支持的 500 列/300 行；原始 Shell 输入/输出预算仍由 `ui-workspace` 与 Terminal Controller 的既有合同约束。组件只在挂载时创建一个终端，ResizeObserver、主题 MutationObserver、动画帧及 xterm 订阅均在卸载时撤销；按实际容器宽度隐藏次级输入提示，终端本体可在窄分栏内独立滚动。

本包是静态 UI 依赖，不新增 Cordis 服务、Bundle 能力、任务路由或权限策略；当前静态消费者由 `ui-workspace` 与 `ui-minecraft` 明确声明。构建产物只进入根目录 `dist/packages/client/ui-sidebar-terminal/`。源码/类型/构建不能代替真实 Shell、Minecraft 节点、ChatGPT 内置浏览器和设备验收。
