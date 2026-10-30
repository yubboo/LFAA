# LFAA-SHARED-MINECRAFT-TERMINAL-20261030

<a id="lfaa-shared-minecraft-terminal-20261030"></a>

## 用户目标与现状

- 用户希望系统终端可以被 Minecraft 等应用直接复用，不出现多个互不相干的终端界面；Minecraft 控制台应像 Windows/Linux 开服控制台一样持续查看输出并输入服务端命令。
- 当前实现：`ui-workspace` 和 Minecraft 实例详情共用同一个 Terminal Manager/xterm 表面；每个标签仍是互相隔离的真实会话。系统 Shell 运行目标节点配置的操作系统 Shell；Minecraft 服务端标签附着该实例已由 Daemon 管理的真实 PTY。Minecraft 日志单独位于“日志”页，不进入终端。
- 重要边界：共享的是终端管理器、终端呈现和键盘/输出交互，不是进程、会话、权限或数据。Minecraft 标签操作真实 Minecraft Java 进程，而不是 PowerShell/Bash Shell；不另造行命令控件或使用日志替代进程输出。服务端创建、生命周期、EULA 与任务仍由 Minecraft/Daemon Owner 管理，Shell 继续走 Terminal Controller 与统一 Permission Owner。

## 入口、Owner 与设置

- 运行入口：系统节点 PTY 由 `/work` 工作区终端管理器打开；Minecraft 使用 `/games/minecraft/instance/:id/terminal`，其日志在 `/games/minecraft/instance/:id/logs`。
- 新共享 UI Owner：`packages/client/ui-sidebar-terminal`，复用单一 xterm 渲染/输入表面；`ui-workspace` 与 `ui-minecraft` 是消费者。
- 系统 PTY：认证/权限由 `packages/api/terminal-controller`、`packages/interaction/permission-presets` 管理，Daemon 在目标节点创建 Shell PTY；Shell 与目录仍读取 `settings.general.integratedShell` 和 `settings.general.taskFolder`。
- Minecraft 服务端终端/日志：`packages/client/ui-minecraft` 将共享终端 Dock 放在实例的终端页，并独立读取日志页；服务端 raw 输入/输出走 Terminal Controller 与该实例 PTY，Minecraft 生命周期和控制权限仍归 Minecraft API/领域 Owner；日志使用 Minecraft 认证日志 API 与 Socket.IO。
- 外观继续读取 Settings/Theme 已有主题、代码字体、字号、强调色、壁纸/遮罩、模糊与减少动态效果映射；权限沿用各自既有 Permission Owner。无新增或重置设置项。

## 范围与可观察验收

- 把 xterm 实现、主题适配、容器尺寸响应、输入行模式和滚动能力放进一个公开可复用的 Terminal Surface；系统 PTY 与 Minecraft 控制台均使用它，删除重复 xterm 初始化。
- Minecraft 终端使用受管 PTY 原始输入与真实进程输出；不得另做行命令框或静态日志输出。服务端会话按实例、节点、运行状态、账户权限与支持能力附着；快捷命令向活动服务端 PTY 发送，失败反馈来自真实会话。
- Shell 模式继续传递 PTY 原始输入，保留审批、目标节点选择、关闭清理、SSE 和有界输入/输出；Minecraft 模式不启动或暴露任意 OS Shell。
- 响应式检查覆盖常用桌面和窄分栏/短屏；键盘 Enter、退格、历史上下键、Ctrl+C 清空当前命令草稿，禁用时不可输入；切换实例/卸载须撤销观察器和事件订阅。
- 本轮不在真实 Minecraft 服务器执行命令；实页验收仅查看页面/日志并可使用不提交的本地快捷填入验证。未有真实服务实例或无法登录时准确记录边界，不造产品假数据。

## UI Skill 前置与实施批次

- 已按仓库必需前置读取 Taste Skill、Impeccable、Audit Skills、UI Motion、UI/UX Pro Max、Baseline UI。采用响应式容器、共享外观令牌、键盘可达、真实状态和低动态效果；本任务不添加装饰动画。Audit Skills 对 TypeScript/React/CSS 无专项静态分析能力，仍检查认证、权限、服务端校验和领域归属。
- 批次 1：新增共享 Terminal Surface 包并使系统 PTY 消费它；本批直接类型/构建回归后先验收 `/work`，再开始批次 2。
- 批次 2：Minecraft 控制台改用共享表面并适配已有日志/命令合同；定向回归和构建通过。正式页面当前没有 Minecraft 实例，无法进入真实实例控制台路由；未创建测试实例、未触发部署或发送服务器命令。对实际 Minecraft 总览壳层做桌面、窄视口和短屏检查，实例控制台的实页响应式仍待有真实实例时验收。

## 实施与验收记录

### 批次 3：系统与 Minecraft 共享受管 PTY

- 已实现：单一 `ui-sidebar-terminal` Surface 负责 xterm、主题、尺寸和键盘渲染；`useTerminalSession` 负责共享的 Controller 会话、Permission Owner 流程、SSE、输入/尺寸串行与清理。`ui-workspace` 继续接入节点原生 Shell PTY；Minecraft 只附着当前 Daemon 持有的服务进程 PTY，不暴露 OS Shell。
- 已实现：Minecraft 的原始按键与服务端输出经活动实例的专属 PTY 通道；Enter、Tab、历史编辑和服务端提供的命令由运行中的核心/插件处理。附着前检查账户、实例、目标节点、运行状态、在线节点能力和当前会话；单实例独占一个控制台附着，断开时只撤销订阅/附着，不会停止 Minecraft 服务端。
- 安全边界：原生 Windows 启动复用同一 Daemon TerminalHandle/ConPTY；Windows AppContainer 通过 Job Object 内的 Pseudo Console 和长度/尺寸校验帧传输交互，仍保留 AppContainer 的进程、文件 ACL 与网络限制。未创建测试实例、未接受 EULA、未向 Minecraft 服务端发送命令。
- 构建和回归：Terminal Surface、Workspace、Minecraft、Terminal Controller、Daemon、Remotes 包构建通过；客户端与 Host `tsc --noEmit` 通过；Windows Sandbox Host `cargo check` 和正式 `build:windows-sandbox-host` 通过；`build:control-plane`、`build:web` 通过。`terminal-api.test.mjs` 5/5、`minecraft-task-workspace.test.mjs` 9/9 通过。新增的心跳能力合同用例通过；同测试文件另一既有旧入口断言仍期望 `/work`，当前产品路由实际为 `/apps/steamcmd/ai-work`，未改动此无关断言。`git diff --check` 通过。
- 官方 Web 服务按用户此前授权通过正式菜单重启，实际地址 `http://127.0.0.1:3000`。修正 Daemon 能力登记的 Joi 白名单后，Minecraft 总览显示当前 Daemon `DESKTOP-26FQTU7` 在线、控制端健康；之前心跳 `400 invalid_request` 不再出现。
- ChatGPT 内置浏览器实页：`/work`，980×922 实际视口。共享底部终端创建新会话后，画面显示 `PS C:\Users\yu\.lfaa\data>`；输入 `Get-Loc` 后按 Tab，画面显示 Shell 补全为 `Get-LocalGroup`；退格可编辑输入；运行只读 `Get-Location` 返回 `C:\Users\yu\.lfaa\data`。随后使用“结束会话”关闭，不保留 Shell 进程。
- Minecraft 实页：`/games/minecraft/overview`，同一 980×922 内置浏览器视口；总览明确显示“还没有 Minecraft 实例”，运行实例 0/0，Daemon 在线。没有真实实例，因而实例 PTY、服务端/插件原生 Tab 补全和服务端命令仍未实测；此项不能由 Shell 补全或模拟 PTY 代替。
- 响应式证据：当前实页截图的 980×922 嵌入式窗口展示了窄分栏工作区和底部终端，没有可见横向溢出；Minecraft 总览壳层此前的 680×720 与 1280×480 测量结果保留。真实实例控制台尚不可进入，短屏/超窄容器下的 MC PTY 表面与真实设备验收仍待有实例及对应视口工具时完成。
- 性能边界：终端 scrollback 限 2000 行，客户端输入/输出缓冲和重放均有界；Minecraft 无新轮询循环，继续使用原 REST/SSE/领域数据流。当前无真实 Minecraft 实例和浏览器帧时间分析器，未声称服务器命令效果、MC 端 Tab 体验或帧时间通过。

## 用户后续要求：完整交互式服务端终端

- 2026-10-30 用户补充：Minecraft 控制台与系统终端都必须能直接输入命令；Minecraft 需要服务端原生 Tab 补全并支持实际核心/插件提供的全部命令，系统终端继续执行当前节点配置的 OS Shell 全部能力。不能把静态快捷项或手写命令目录当成完整终端，也不能另建第二个终端 UI/协议。
- 当前代码证据：系统 Shell 经 `terminal-controller` → `terminal-channel` → `subprocess-local` 原生 ConPTY，共享 Terminal Surface 的 raw 输入直接写到 PTY；Minecraft 现在经领域任务将完整单行文本写入进程 stdin，普通命令可送达，但没有交互式 TTY，因此无法使用服务端原生 Tab 补全，现有行输入控件也会把 Tab 留给浏览器焦点切换。
- 本批目标：在保留 Minecraft 实例/进程生命周期和安全隔离 Owner 的前提下，让 Minecraft 控制台附着到 Daemon 实际持有的交互式终端流，并由共享 Terminal Surface 接收 raw 按键、显示真实进程输出及原生 Tab 建议；系统 Shell 与 Minecraft 控制台共用 xterm 与终端中继合同，不暴露 Minecraft 进程为 OS Shell，不通过命令列表、插件白名单或静态补全冒充真实能力。
- Owner/权限/数据：系统 Shell 继续由 Terminal Controller、统一 Permission Owner、Settings 和目标 Daemon 管理；Minecraft 实例状态、启动/安全停止、EULA、核心选择、控制台归 `packages/games/minecraft` 与 Daemon/AppContainer Host；账户身份和已有权限模式不变。终端附着会按目标实例重新检查权限、节点、实例状态及进程归属，断线不重放按键。
- 设置盘点：复用 `general.integratedShell`、`general.taskFolder`、`permissions.mode`，以及既有主题/代码字体/字号/强调色/壁纸与减少动态效果映射。不新增设置，不改已有偏好。
- 允许范围：改造终端 Controller/Daemon/`subprocess-local` 与必要的 Minecraft UI 接入、Rust AppContainer Host PTY 适配、直接相关包 README/架构说明和本合同；保留所有当前工作树内容。
- 禁止范围：不创建/重装 Minecraft 实例、不改 EULA/许可状态、不自动接受协议、不启动或向真实服务器发送命令、不降级 AppContainer 或节点认证授权、不执行浏览器外系统命令、不写入假服务器/假命令结果。
- 可观察验收：普通系统终端能输入 OS 命令且 Tab 交由当前 Shell；Minecraft 真实运行实例上输入、编辑、Enter、Ctrl+C、尺寸调整与 Tab 均经过同一个已认证终端会话，补全来自当前运行服务端，断线/切换/卸载撤销所有流与进程句柄；未装配或不支持交互控制台的实例明确说明原因并保持只读。没有用户真实 Minecraft 实例时只做源码、构建和非破坏性系统 Shell 实页检查，Minecraft 实际服务端补全记为未实测。
- 新批次 3：先验证系统 Shell 当前输入链；再实现可附着受管 Minecraft PTY 的统一会话与 UI；每个用户可见批次按构建、内置浏览器及真实进程可用范围分别记录证据。预期可能涉及的入口/Owner 包：`terminal-controller`、`subprocess-local`、Daemon、Minecraft UI、`native/system`；具体文件在源码链确认后填写。

## 用户对终端入口的进一步澄清

- 目标交互：系统只有一套真正的终端管理器，支持多个互相独立的终端会话/标签；每个会话可运行当前授权 Shell 的常规命令并独立切换目录、管理文件。普通终端入口与 Minecraft 开服页使用同一个管理器，不再分别呈现成两种终端产品。
- Minecraft 位置：Minecraft App 在实例开服/运维区域嵌入同一管理器，并按当前实例把新会话起始目录定位到实例目录。运行服务器的前台 PTY 会话显示真实服务端输出并接收服务端输入；需要执行 `cd`、`ls`、文件操作时，使用同一管理器中的另一个独立 Shell 会话。实例停止、断开或切换不影响其他会话。
- Owner 约束：Shell 命令、当前节点、会话生命周期和文件操作继续由 Terminal/Permission Owner 校验；Minecraft 一键部署、实例启动/停止、服务端 PTY 归 Minecraft/Daemon Owner。入口位置可以共享，目标类型、当前目录和 PID/实例绑定必须由可见会话状态表达，不能把服务端 PTY 冒充成 Shell，也不能让普通 Shell 绕过实例生命周期合同。
- 上述差距是本批实施前的状态：现在系统底部终端和 Minecraft 控制台都注册 `ui-sidebar-terminal` 的同一个多会话管理器；Shell 与受管服务端 PTY 是独立标签，服务端会话不会被冒充成 Shell。
- 后续实施边界：先沿 Terminal Controller/会话存储/工作区布局 Owner 设计唯一多会话管理器，再将系统底部入口和 Minecraft 开服位置接到同一会话列表及标签状态；复用现有认证、权限、Settings、Daemon 和 Minecraft 生命周期，不新设第二套终端权限或 Shell 执行链。本次 `server.properties` 修复未改动终端实现。

### 批次 4：统一终端管理器

- 运行入口：普通工作区底部终端；Minecraft 实例详情的“控制台日志”区域。两个入口展示同一账户内、互相独立的会话标签，不创建第二套执行器或权限流程。
- Owner：会话生命周期和 PTY 仍归 `packages/api/terminal-controller` 与目标 Daemon；实例路径只由 `packages/games/minecraft` 解析；多会话管理器与标签视图归 `packages/client/ui-sidebar-terminal`，`ui-workspace` 和 Minecraft 页面仅注册显示位置；外观继续由同一个终端包读取共享主题/字体令牌。
- 权限：OS Shell 会话经过现有 Permission Owner；Minecraft 服务端 PTY 仍需 Minecraft 管理权限和实例/节点/状态核验。Minecraft Shell 会话以实例 ID 请求由领域 Owner 解析的实例目录作为起始目录，命令仍使用现有集成 Shell 和 Permission Owner。会话当前目录不构成文件访问沙箱。
- 设置：读取 `permissions.mode`、`general.integratedShell`、`general.taskFolder` 及现有外观设置；实例 Shell 优先使用实例当前登记目录，不新增或重置设置。
- 验收：能创建多个彼此隔离的 Shell 标签；Minecraft 运行实例显示受管服务端 PTY 标签；Minecraft 目录 Shell 的 `cwd` 由服务端真实实例数据解析；关闭一个标签不影响其他标签；在两个入口切换时保留同一批标签/PTY，不重复建立 SSE；所有输入/输出、缓冲、Observer 和流都可界定与清理。
- 实施顺序：先补齐 Minecraft Shell 的受校验目录目标和统一终端管理器；构建/类型检查后，立即用正式 Web 服务在桌面和窄/短视口实页检查；配置页真实文件读取仍等待节点在线，只执行只读读取，不写配置。

- 批次 1 已完成：新增 `ui-sidebar-terminal` 共享 Terminal Surface；系统 PTY 适配器消费共享表面；PTY 创建/关闭、节点选择、审批、SSE、输入/尺寸串行和 512 KiB 输出预算由共享终端会话 hook 与 Terminal Owner 负责。共享表面拥有 xterm 初始化、主题、FitAddon、2000 行滚动区和 Observer/事件清理。
- 批次 1 验证：`pnpm.cmd --filter lfaa-client-ui-sidebar-terminal run build`、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run check:workspace`、`pnpm.cmd run build:control-plane`、`pnpm.cmd run build:web` 均通过；`node scripts/runtime-build-state.mjs web` 与 `host` 均为 `[]`。官方入口 `pnpm.cmd lfaa web` 通过当前数据锁/进程身份预检后重启，服务报告 `127.0.0.1:3000` 就绪。
- 批次 1 ChatGPT 内置浏览器：`http://127.0.0.1:3000/work`，窗口/视口 978×925；打开底部终端后 AX 确认共享 xterm 已挂载，实际 Surface 为 893×179。截图在本轮 CUA `/work` 验收结果中；没有创建 Shell PTY 或运行用户命令。远端节点交互和较窄移动视口尚未测。
- 批次 2 已实施：`ui-minecraft` 使用同一个 Terminal Surface 的单行命令模式，快捷命令只填入草稿；Enter 仍调用 `sendMinecraftConsole`，沿原认证 API、Minecraft 任务租约和 Daemon 受管进程 stdin 执行。日志复用既有 Socket.IO/REST，不新增订阅或轮询。日志输出按实例 ID 关联，切换实例期间不会把上一实例的快照写入新终端；输出控制字符已清理，输入仍限 1024 字符。
- 批次 2 验证：`pnpm.cmd --filter lfaa-client-ui-sidebar-terminal run build`、`pnpm.cmd --filter lfaa-client-ui-minecraft run build`、`node --test apps/cli/tests/minecraft-task-workspace.test.mjs`（9/9）、`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd run check:workspace`、`pnpm.cmd run build:control-plane`、`pnpm.cmd run build:web` 通过；最终 `node scripts/runtime-build-state.mjs web` 与 `host` 均为 `[]`。正式入口通过 PID/数据锁核对后启动，报告 `http://127.0.0.1:3000` 就绪。
- 批次 2 ChatGPT 内置浏览器：最终构建实页 `http://127.0.0.1:3000/games/minecraft`，桌面视口 978×925。真实账户显示“还没有 Minecraft 实例”、运行实例 0/0，因此无法进入真实实例的控制台日志页，也未造实例或发送命令。打开系统底部终端后，共享 xterm Surface 实测为 893×179；没有创建 PTY。JS console error 0。
- 响应式实页边界：Minecraft 总览壳层在 680×720 时中间内容宽 280px、文档宽 680px；1280×480 时中间内容宽约 879px、文档宽 1280px。两处无横向溢出。上述视口未渲染实例控制台，因此不作为 Minecraft 终端组件实页通过证据；其容器断点与短屏样式只通过源码、回归和构建检查。临时 viewport 覆盖已重置。
- 性能与范围：xterm scrollback 限为 2000 行、日志接口现有快照上限 500 条、客户端去重 ID 集合上限 1000；日志仍按原 30 秒/5 秒对账，没有新增定时器。没有帧时间分析器或真实运行中的 Minecraft 实例，不声称帧率、命令执行效果或控制台输入已验收。附加通用终端 API 回归尝试因当前 CLI `node_modules` 缺少 `lfaa-subprocess-local` 与 `lfaa-launch-environment` 链接而未能启动；针对本批的 Minecraft 工作区回归及完整 Client/Web 构建通过。

### 批次 5：按控制台参考图重排实例日志页

- 入口与布局：`/games/minecraft/instance/:id/logs`。单一控制台面板拆为主日志/PTY 区和服务器状态/快捷命令侧栏；移除折叠日志快照与单独重复的状态卡。无活动会话时用真实日志快照填充主区，提供全部、标准输出、错误、系统筛选和自动滚动；有 PTY 时显示共享真实会话。状态侧栏只用实例/节点已有的核心、端口、配置内存和状态，不填充未接入的 CPU、TPS、玩家数、Ping 或运行时长。
- 命令合同：快捷项为 `help`、`list`、`save-all`，仅在当前活动的 Minecraft 服务端 PTY 运行时启用，并向同一 PTY 发送输入；没有活动 PTY、节点离线或实例停止时禁用。未增加最近命令历史，因为现有 PTY 输入链不持久化任意按键历史。
- 设置与性能：复用 `permissions.mode`、`general.integratedShell`、`general.taskFolder` 及现有主题、代码字体/字号、强调色、壁纸模糊和减少动态效果映射；无设置改动。日志继续使用现有快照与 Socket/REST 对账，不新增轮询；ResizeObserver 与自动滚动帧在清理时撤销。
- 构建：`pnpm.cmd exec tsc --noEmit -p tsconfig.client.json`、`pnpm.cmd --filter lfaa-client-ui-sidebar-terminal run build`、`pnpm.cmd --filter lfaa-client-ui-minecraft run build`、`pnpm.cmd run build:web` 与 `git diff --check` 通过。Web 构建输出有既有单包大于 500 KiB 提醒，但 Vite 构建成功，产物写入根 `dist/`。
- 内置浏览器：正式入口 `pnpm.cmd lfaa web --no-local-daemon` 重启后验收实际路由 `http://127.0.0.1:3000/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/logs`。默认 1506×1244 视口显示 117 条真实日志，布局主区约 644px、侧栏约 270px；自动滚动到最后一条，控制台标题为“控制台”，浏览器 JS 错误 0。点“错误”筛选得到 0 条与“暂无日志”，切回“全部”恢复 117 条；三个快捷项在实例停止/节点离线时均禁用。未启动实例或发送命令。
- 响应式：1280×480 时终端面板约 722×182px，主日志区保留 84px 可滚动高度，侧栏在窄高容器中可内部滚动；980×720 时宽约 435px，主区与状态卡上下排列，日志区约 209px；680×720 的极窄工作区宽约 193px，侧栏限高并可滚动，页面中心可纵向滚动。以上视口 `documentElement.scrollWidth` 均等于视口宽度。最终恢复浏览器默认视口。
- 边界：当前选中实例真实状态为已停止、Daemon 节点离线。真实 PTY 输入、在线快捷命令执行、CPU/TPS 等运行时采样未测，也未添加伪造数据；仅对真实历史快照、筛选、自动滚动、禁用状态与容器布局做了实页检查。

### 批次 6：实例运行时自动显示真实控制台

- 修复：实例处于运行中、节点在线且当前用户具备 Minecraft 管理权限时，`ui-sidebar-terminal` 自动创建并启动该实例唯一的受管服务端 PTY 标签；取消独立的“连接服务端”入口。实例重启后重置本轮自动附着标记；同一运行周期内不会因退出事件反复创建标签。附着失败/退出只在该标签提供重试/重新连接。运行中的 xterm 自动聚焦，原始按键经现有 Terminal Controller 输入队列写入 Daemon 维护的真实 Minecraft PTY。
- 输出：附着前以真实日志 API 最近 200 条（最多 128 KiB）作为 xterm 历史，保留 Minecraft 启动信息；连接后不清屏，后续输出由 PTY SSE 实时写入。实例停止或节点离线时才显示只读日志快照。将菜单名称改为“控制台”并移除易误解的“实时日志已连接”状态标签。
- 安全与设置：没有新建命令 API、Shell、权限开关、凭据或假数据。继续执行 Minecraft 管理权限、实例运行状态、节点在线能力及 Terminal Controller/Permission Owner 检查；快捷命令和手工输入都走同一服务端 PTY。沿用 `permissions.mode` 和已映射的主题/代码字体、字号、强调色、壁纸遮罩与减少动态效果设置，无新增或重置设置项。
- 检查：Client TypeScript 检查、`lfaa-client-ui-sidebar-terminal` 与 `lfaa-client-ui-minecraft` 包构建、`pnpm.cmd run build:web`、`git diff --check` 均通过；`node scripts/runtime-build-state.mjs web` 返回 `[]`。Web 按正式入口重启成功。
- 内置浏览器：`http://127.0.0.1:3000/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/logs`，默认 1506×1244 实页显示“控制台”而非“控制台日志”，无“连接服务端”入口，停止实例显示 117 条真实日志；浏览器错误 0。1280×480 短屏实页终端面板约 722px 宽，日志区域约 86px 高，页面无横向溢出；之后恢复默认视口。
- 未测：该实例仍为已停止，目标 Daemon 节点离线；因此不能实际建立 PTY、输入游戏命令或验证运行中的启动输出/焦点交互。本轮未启动实例、连接其他节点或发送命令。代码构建和停止状态页面验收不冒充运行中 PTY 验收。

### 2026-10-30：真实实例启动、配置与控制台联动验收

- 实例：`xiaoyu-e2e-paper1122-20261026`，ID `17e265c3-a9a8-419b-b43c-ae4592d2480d`，节点 `WIN-20250328BHE`（`57702d78-5f53-45cb-8193-51c87c5fa568`），软件 Paper 1.12.2，运行目录归该实例，配置内存 4096 MB，端口 25565。
- 启动发现并修复：实例原生启动任务此前排队未领取；节点支持原生 Minecraft，却没有 AppContainer。`packages/jobs/jobs/src/minecraft-queue.ts` 原筛选把所有 start/restart 都错误地要求沙盒能力。现在 `executionMode=native` 可由已通过原生能力校验的节点领取；非原生任务仍要求沙盒能力，任务创建侧权限/节点能力校验不变。复用排队任务 `9ff87861-c5f4-4915-86b6-ebb67c9aec06`，正式 Web/Daemon 重启后任务成功。
- 启动证据：任务回执 `processStarted=true`、`serverReady=true`、`locallyListening=true`、`executionMode=native`、`serverPort=25565`；数据库实例状态为 `running`。操作系统当前监听进程为 `java.exe` PID 44888，命令行指向 LFAA Java 11 和 `server.jar`，参数 `-Xmx4096M`。服务端启动日志包含 Paper 1.12.2 的 `Done (...)! For help, type "help" or "?"`。没有验证局域网/外网可达或 Minecraft 客户端登录。
- 控制台证据：在内置浏览器实际路由 `http://127.0.0.1:3000/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/logs`，自动附着到该实例运行时 PTY；终端输入 `list` 后，服务端同一输出流返回 `There are 0/20 players online`，与配置 `max-players=20` 对上。不是只读日志快照或另一个 Shell 的返回。
- 配置证据：在实例运行期间打开 `/games/minecraft/instance/17e265c3-a9a8-419b-b43c-ae4592d2480d/configuration` 并显式“重新读取文件”；节点任务 `1687cc72-542f-4178-8f2d-b14019e94224` 成功，快照时间 `2026-10-30T03:30:25.372Z`，真实文件有 34 项，其中 9 项可编辑、25 项只读。`server-port=25565`、`max-players=20`、`view-distance=10` 与已启动实例吻合；1.12.2 文件没有 `simulation-distance`。此次未保存或写入文件。
- 设置与影响：复用 `permissions.mode`、`general.integratedShell`、`general.taskFolder` 和 Appearance 现有映射；没有改设置、EULA 或用户配置。实例和本机 Java 进程仍保持运行。
- 单标签边界：验收期间另一个浏览器标签尝试附着同一 Minecraft 控制台，服务端依据现有“同实例单一活动控制台”约束返回 409 `minecraft_console_attached`；原活动会话未被顶替，Minecraft 进程与端口保持运行。该第二标签未复用第一个标签的 PTY，因此跨浏览器标签共享/恢复不作为通过项；本次已通过的是一个真实控制台会话中的输入与回显。
- 构建/验证：`pnpm.cmd --filter lfaa-jobs run build`、`pnpm.cmd --filter lfaa-api-job-controller run build`、`pnpm.cmd run build:control-plane`、`pnpm.cmd run build:web` 成功；`node scripts/runtime-build-state.mjs host` 与 `web` 均返回 `[]`，`git diff --check` 通过。没有运行自动化测试套件；以上验收直接覆盖真实启动、运行中配置回读、PTY 输入输出和监听进程。

### 2026-10-30 后续澄清：系统共用终端管理器，Minecraft 日志独立

- 用户再次明确：系统所有入口都使用同一终端管理器；PowerShell/CMD 与 Minecraft 服务端是不同的真实会话，但使用相同 xterm/终端交互。实例启动时在 Minecraft 的终端位置看到它实际受管进程的输出并可输入；日志是独立页面和数据源。不能把 Shell、日志、另一套“控制台日志”或只读历史混成第二个终端。
- **该段为当前源码契约，覆盖本文件更早批次中把日志快照注入终端的实现/验收描述。** 实例详情路由区分 `/terminal` 与 `/logs`；前者只消费该实例同一受管 PTY 的 stdout 与输入，后者只读 Minecraft 日志 API/Socket。PTy 不可用时终端只说明真实状态，不显示日志。
- 当前 Daemon 在进程内为每个 Minecraft 受管 PTY 保留最多 128 KiB 的 stdout，重新附着先回放此真实进程缓冲，再订阅同一流；没有全量输出拷贝到日志，也没有额外轮询。已退出进程的缓冲立即清理。多个普通 Shell 会话和服务端会话仍分别拥有 PTY，只共享管理器、终端表面与统一设置适配。
- 本次源码验证：Terminal Manager、Minecraft UI、Daemon 包构建，Client 类型检查、正式 Web 构建和 Control Plane 构建通过；`interactive-terminal.test.mjs` 7/7、`minecraft-task-workspace.test.mjs` 9/9、Impeccable mechanical detector `[]`、`node --check` 与 `git diff --check` 通过。构建产物位于根 `dist/`。
- 本次正式内置浏览器未能加载最新构建：新 `/terminal` 路由显示运行版本需要安全重启的提示。当前 Web PID 30736 监督 Daemon PID 28404，后者托管 Minecraft Java PID 44888；为避免中断真实服务器，没有重启 Web/Daemon 或 Minecraft。故新源码的终端输入/输出、自动聚焦、重连和窄屏视觉尚未用本轮页面实测；此前 `list` 返回 `0/20` 属于上一个已运行版本的历史验收证据，不能替代这次实页验收。
