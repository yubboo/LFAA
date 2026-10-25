# PowerShell 沙箱执行器

本包负责把本机 PowerShell argv 和既有沙箱策略交给 Cordis 服务 `lfaaSandbox`，核验 Provider 回执后再复用 `lfaa-shell` 启动进程，并将取消请求传到 Host。它不创建沙箱策略，也不授予文件或网络权限；策略来自 Settings/Sandbox Policy，Windows x64 执行由 `lfaa-sandbox-windows-acl` 负责。

Base Bundle 必须为本插件注入 `lfaaSandbox`。服务未装配、目标平台不受支持或回执不能证明完整隔离时，本机受限 Shell 拒绝执行，不降级到不受限 PowerShell。完全访问模式仍由 `lfaa-tool-shell` 按设置选用 `lfaa-pwsh-local`，不经本 Provider。

工作目录始终来自已校验的沙箱策略并受 workspaceRoot 约束。PowerShell 7 通过 `-WorkingDirectory` 初始化 Runspace，令 `$PWD`、.NET 当前目录及子进程的相对路径一致；不会改写或包裹用户命令。Windows PowerShell 5.1 继续使用 Host 提供的进程当前目录及当前盘符环境项。

验证：完整 Web Profile 的隔离 Harness 运行真实 `local_execute_command`，覆盖项目语法检查失败、结果回传、SHA-256 保护写入、Git 差异和同命令复验；它不代表真实 Provider 或已安装桌面端验收。构建输出写入仓库根 `dist/packages/shell/pwsh-sandbox/`。
