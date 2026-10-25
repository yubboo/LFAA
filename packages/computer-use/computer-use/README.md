# LFAA 本机电脑操控

在 Windows Electron `desktop` Profile 注册本机屏幕观察、点击、文本输入、组合键和滚动工具；Windows CLI `web` Profile 仅在 `LFAA_LOCAL_MODE=true` 且 HTTP 服务绑定回环地址（localhost、127.0.0.0/8、::1）时注册同一组工具。外部监听或远程生产 Web 不会得到电脑操控工具。工具使用 `@trycua/cua-driver` TypeScript SDK 在当前交互用户 Control Plane 进程内调用系统驱动，不启动独立 CUA Daemon，也不在远程节点执行 UI 操作。这是 LFAA 自带的本机电脑执行器；完成这类任务不要求另装第三方 MCP。

账户设置 `computerControl.enabled` 默认关闭。“设置中心 > 电脑操控”只读写账户授权开关，不加载或启动桌面驱动，也不执行桌面动作；开关打开后，模型才可在当前 Profile 已装配工具的范围内按任务自行选择调用。截图仅在当前 Agent Run 内存中保留并作为标准图像输入发送给当前 Provider；会话请求、工具轨迹和模型历史只保存截图已省略的标记。每次鼠标或键盘操作都按设置中心 `permissions.mode` 走 LFAA 现有审批合同，执行后要求 Agent 重新观察屏幕。输入参数不持久化到普通会话轨迹；敏感信息不得回显或写入记忆。

观察同时返回最多 128 个真实可见窗口的 pid/windowId、标题和位置。模型仅在用户目标需要根据当前桌面/浏览器状态选择或继续用户已打开的应用时观察；普通公开网页浏览不会因此读取无关桌面。应用内文本输入与快捷键可指定该窗口，SDK 接收精确窗口目标，避免审批工作台抢占前景后把路径输入网页；系统快捷键仍支持桌面目标。窗口选择复用同一三种权限模式，不增加审批层。此链路已使用 Driver 替身回归，真实窗口激活行为仍需设备验证。

同一受支持 Profile 还提供通用本机应用/游戏工具。模型按自然语言理解应用名称、俗称和上下文，不要求用户提供绝对路径或安装目录。发现来源包括 Windows 应用目录、开始菜单 `.lnk`、已安装软件登记、PATH、Steam 游戏和按名称触发的有界便携 `.exe` 查找。便携查找最多检查 16 个磁盘根、1400 个目录、24000 个目录项、5 层和 2.5 秒；不会全盘无界扫描。明确要求启动时，模型可将自然语言名称直接传给危险启动工具；Owner 在一次有界发现中解析、校验并启动唯一高置信匹配，避免先搜索再启动及重复发现。零结果、低置信、歧义或扫描受限时只返回安全候选和警告，不启动；模型需要比较候选时可先搜索，再以本轮不透明 ID 启动，旧 ID 路径仍会重新发现校验。模型看不到可执行路径，也不能提供命令参数；开始菜单由 Explorer 打开，已发现 EXE 以 `shell:false`、无模型参数启动，Steam 只调用固定 `-applaunch <AppID>`。找到已登记名称后跳过便携扫描；便携候选只在登记来源无匹配时查找。

用户也可直接提供本机 Windows `.exe` 的绝对路径，Agent 也可通过本轮文件/Shell 查询核实路径，再用精确路径工具直达该文件，不先打开资源管理器或键盘输入路径。此路径是可选快捷方式，不是应用启动的前置要求。应用发现、搜索和启动复用账户 `computerControl.enabled` 与现有 `permissions.mode`；`请求审批`逐项等待批准，`替我审批`对同一账户、App、工具版本、风险和目标范围累计两次明确批准后自动记忆，`完全访问`在当前用户目标范围内直接执行且不逐项审批。记忆授权可从设置中心撤销；撤销同时重置该范围的累计次数，避免旧批准立即恢复授权。账户关闭电脑操控后，查询和启动均拒绝执行。所有启动在系统接收请求后仍要求观察真实画面；参数和结果历史不保存完整本机路径。

当名称也可能指官网网页时，除非用户本轮或对话已经明确选了本机客户端，否则 `computer_use_search_local_apps` 和 `computer_use_launch_local_app` 不应先行调用；Agent 先通过 `lfaa_ask_user` 澄清，再按用户选择执行。审批仅决定已明确目标的操作能否执行，不用于代替目标选择。

未指定游戏时，模型可按当前 Control Plane 进程中本 LFAA 账户经 LFAA 发起的 Steam 游戏启动请求次数/最近时间推荐，并须用现有 `lfaa_ask_user` 等待用户选择。历史不写入磁盘、不读取 Steam 账户或实际游玩时长，进程重启即清空；非 Steam 应用不会被当作已识别游戏推荐。名称启动无结果时不要重复同一查询或递归扫盘；仅在用户提供了路径或明确位置后才做对应的有界核实。远程电脑不在本机 Driver 范围内。系统已接收启动请求不证明程序已进入运行界面；须重新观察实际画面。

上游 `@trycua/cua-driver` npm 包采用 MIT 许可证；随包的 Windows 原生运行时另有 `MIT AND MPL-2.0` 许可元数据。CUA telemetry 在创建驱动前通过上游 `CUA_DRIVER_RS_TELEMETRY_ENABLED=false` 关闭。首次真实调用、Windows 原生权限提示和桌面交互仍需在真实设备验收。

## 接入用户的 Computer-Use MCP

除 LFAA 自带的 Windows 桌面驱动外，用户也可在设置中心显式登记本机 stdio MCP。以上游 [open-codex-computer-use](https://github.com/iFurySt/open-codex-computer-use) 为例，其官方说明提供 npm 安装方式和 `open-computer-use` + `mcp` 的 stdio 配置；先由用户自行安装，再把本机可直接启动的可执行文件及参数填入 LFAA。LFAA 用 `shell:false` 启动进程，因此 Windows 上不要把 npm 生成的 `.cmd` 包装器视为已验证入口；可配置直接可执行文件，或 `node.exe` 加已安装包提供的 Node CLI 入口路径和 `mcp` 参数。选定允许使用的 App，开启服务并标记为 Computer-Use。LFAA 不会自动安装或更新该第三方程序；当前未在真实 Windows 桌面验证该上游入口。

只有 LFAA 在本机桌面/本机 CLI 运行、账户 computerControl.enabled 已开启且 MCP 服务属于当前 App 时，模型才会看到这组工具；实际调用仍按 permissions.mode 执行高风险授权。stdio 初始化说明是非可信资料，工具返回图片只传给当前 Provider 请求，不写入历史。远程生产 Web 控制端不会在用户电脑启动本机服务。
