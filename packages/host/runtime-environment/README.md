# 运行环境执行器

本包持有 Java 发现、真实版本检测、官方 Temurin 工件解析、摘要校验、安装与受管环境操作。控制端本机适配器与 Daemon 使用同一执行实现；不导入数据库、Agent、权限或业务任务 Owner。调用方只传入已经授权的目标目录、取消信号、进度和运行依赖检查。

节点能力按实际平台登记；当前托管安装沿用 Windows x64 ZIP 执行合同，其他平台不得假装已安装。发现只读取 PATH、JAVA_HOME、托管/登记目录和有界常见安装目录，不后台递归扫整盘。现有 Java 目录、runtimeId 和自定义路径记录保持兼容。

编译输出只进入根 `dist/packages/host/runtime-environment`。

托管 Java 新安装目录为 `运行环境目录/Java/Java<主版本>-windows-x64`，运行时 ID 保持稳定。目录改名必须显式授权并核查占用与引用，本包不自动搬迁真实环境。本轮按用户授权迁移了当前 Windows 工作副本的 11/21/25，真实下载的 16 也使用新命名。

`windows-runtimes` 通过有界只读注册表/DLL 检测 Visual C++ v14 与 DirectX 旧版组件；官方安装包只下载到设备环境目录，并以系统原生 PowerShell Security 模块验证 Microsoft 签名。下载成功明确返回 `installed:false`，不擅自运行系统安装器或提供虚假卸载。进程环境仅传必要系统路径及任务参数，PowerShell 输出统一 UTF-8。

官方目录与工件共用独立 `EnvHttpProxyAgent`，遵守进程代理及 NO_PROXY，连接重置/临时 HTTP 错误有界重试一次，响应流结束释放连接；二进制还须通过摘要或 Microsoft 签名。取消清理未完成文件，不重放安装/进程操作。
