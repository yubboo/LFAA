# Daemon Host

Daemon Host 是目标节点本机能力的执行 Owner。通用项目文本操作由 `src/project-files.mjs` 在调用方提供的已登记根目录内执行：读取限定为普通 UTF-8 文本并支持分页；Agent Tool 可用的操作仍由 `packages/core/tools/src/project-tools.ts` 单独列明。

## 运行与桌面打包

Windows Electron 桌面安装包内置本机 Daemon，并由桌面主进程自动启动和收尾。Daemon 保持独立进程与 `daemon` Profile，控制端通过现有认证节点任务通道单独读取节点状态和派发操作。需要新增远程节点时，管理员通过控制端签发 HTTPS 连接身份，目标 Windows x64 主机导入连接文件后运行 `lfaa daemon`；远程主机安装器和系统服务托管尚未接入。

根脚本 `build:windows-sandbox-host` 编译的是 Rust `lfaa-sandbox-host.exe`，不是 Daemon 服务本身。Electron 桌面发行脚本会自动调用该构建并将原生宿主随 Daemon 运行树打包；普通用户无需单独构建或启动 Daemon。

AI Work 变更审阅复用同一执行器的内部 `write` 操作，但仅由认证 Workspace Controller 的用户界面路由调用。保存要求最近读取的 SHA-256 匹配、内容为不超过 2 MiB 的 UTF-8 文本，并通过同目录临时文件替换；路径、符号链接与 Daemon 数据目录边界继续由执行器校验。Git 状态和单文件差异归 `src/git-workspace.mjs`，只接受固定参数化操作，不执行浏览器传来的任意命令或补丁。界面复制 `git apply` 命令时仅将经过完整性限制的文件差异编码进剪贴板，不会由 Daemon 或 Client 自动执行。

`src/easytier-runtime.mjs` 只接受 Connectivity Owner 派发的固定 EasyTier v2.6.4 安装操作，复用 Daemon 的数据根目录围栏、官方 HTTPS 资产摘要/大小验证和 ZIP 路径检查。安装包保存在 `environments/easytier/v2.6.4`，安装任务使用唯一暂存目录、拒绝覆盖无效已有目标，并通过核心程序 `--version` 输出确认后才加入节点心跳能力。该能力不启动 EasyTier、修改虚拟网卡或上报网络/对等连接状态；组网实例管理 RPC 尚未接入。
