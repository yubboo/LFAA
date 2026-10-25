# Bash 沙箱执行器

本包负责把本机 Bash argv 和既有沙箱策略交给 Cordis 服务 `lfaaSandbox`，核验 Provider 回执后再复用 `lfaa-shell` 启动进程，并将取消请求传到 Host。它不创建沙箱策略，也不授予文件或网络权限；策略来自 Settings/Sandbox Policy，Windows x64 执行由 `lfaa-sandbox-windows-acl` 负责。

Base Bundle 必须为本插件注入 `lfaaSandbox`。服务未装配、Bash 不可用、目标平台不受支持或回执不能证明完整隔离时，本机受限 Bash 拒绝执行，不降级到不受限 Bash。该组合声明只提供通用执行器装配；不表示 macOS/Linux 已有受限 OS Provider。

验证：Base Bundle 的包合同和 Profile 装配检查核对 `lfaaSandbox` 注入。Windows x64 AppContainer Provider 不表示 Bash 可执行文件或其他操作系统的 Provider 已实测。构建输出写入仓库根 `dist/packages/shell/bash-sandbox/`。
