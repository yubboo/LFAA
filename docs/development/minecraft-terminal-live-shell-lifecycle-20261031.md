# Minecraft 服务端终端实时输出与可交互 Shell

<a id="lfaa-minecraft-terminal-live-shell-lifecycle-20261031"></a>

- 编号：`LFAA-MINECRAFT-TERMINAL-LIVE-SHELL-LIFECYCLE-20261031`
- 状态：源码已改，待构建与内置浏览器实页验收
- 目标：修复 Minecraft 实例启动后控制台空白或集中补显启动日志的问题；启动中即附着真实受管 PTY 并转发首段输出。服务端由 `/stop` 等命令退出后，控制台自动切回绑定实例目录的真实交互 Shell，不显示“实例已停止/重新连接”占位；Shell 可用现有系统命令、`cd` 与脚本启动服务端，系统生命周期按钮也可再次启动并切回服务端流式控制台。页面“控制台”标题旁展示实例真实生命周期状态，终端标签只展示实例名称，不以 Shell 会话状态冒充服务端状态。
- 主要 Owner：`packages/client/ui-sidebar-terminal` 管理终端会话、标签、实例状态切换与 xterm 生命周期；`packages/api/terminal-controller` 负责认证、会话合同和 Permission Owner；`packages/host/daemon/src/terminal-channel.mjs` 负责有界节点事件转发；`packages/host/daemon/src/daemon.mjs` 是服务端受管 PTY 与输出订阅 Owner；Minecraft Service 是实例目录、状态和生命周期任务 Owner。
- 运行入口：认证 Web 的 `/games/minecraft/instance/:id/terminal`；Minecraft 管理动作仍走既有实例任务 API；普通命令行 Shell 仍通过同一 Terminal Controller 创建节点本地 PTY。
- 现有配置：实例 Shell 读取 `settings.general.integratedShell` 并以实例登记目录为 cwd；通用 Shell 继续读取 `settings.general.integratedShell` 与 `settings.general.taskFolder`。外观沿用 TerminalSurface 已接入的主题、代码字体/字号、强调色、终端壁纸遮罩和减少动态效果；授权沿用 `settings.permissions.mode` 与 Permission Owner。无新增设置。
- 数据、权限与边界：实例 Shell 的 cwd 由 Minecraft Service 根据注册实例解析；只为当前已认证且具实例管理权限的用户打开。所有 Shell 创建和输入继续通过 Settings/Permission Owner、认证 API、节点认证 SSE 与服务端校验。服务端控制台只附着当前实例的真实受管 PTY；不从日志文件伪造终端、不运行测试游戏命令、不因会话断开而停止服务端。
- 性能与安全：启动期订阅必须有界并随会话关闭/Daemon 通道断开清理；事件保持现有输出预算和背压；服务端未就绪时禁止向其 PTY 写输入；实例目录由领域 Owner 校验；不得新增重复轮询或绕过权限审批。
- 验收条件：源码证明订阅能在服务端进程启动前注册、进程创建后第一段 stdout/stderr 进入真实事件流；启动期间页面显示逐段到达的启动输出；`/stop` 后同页显示真实实例目录 Shell 并可输入基础导航命令（不得停止或启动任何用户服务端做验收）；实例系统启动动作重新开始时同页恢复服务端 PTY 并实时接收后续日志；空白/退出态无“实例已停止/重新连接”提示；常见桌面和窄分栏/短屏布局可读；Settings 和 Permission Owner 边界保持有效。
- 验收边界：本轮不运行 Minecraft 启动、停止、脚本或测试命令；自动化测试按本轮更高优先级的执行限制不运行。记录目标 Web 指纹、实际路由、视口尺寸、真实页面交互、截图证据、构建/类型检查以及未覆盖设备和异常边界。
