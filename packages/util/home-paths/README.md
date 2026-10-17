# 数据根与私有目录工具

`resolveHomeDirectory()` 是本机安装/Home Owner：`LFAA_HOME` 必须是绝对路径；留空默认 `%USERPROFILE%\.lfaa`（非 Windows 使用 `~/.lfaa`）。`resolveDataDirectory()` 优先采用显式 `LFAA_DATA_DIR`，否则返回 `<LFAA_HOME>/data`。插件包与受控运行适配文件位于 `<LFAA_HOME>/plugins`；App Boot 在 `<LFAA_HOME>/profiles/<Profile>` 创建用户级 Cordis Patch 模板并读取覆盖；用户运行数据位于可单独迁移的 `LFAA_DATA_DIR`。只有默认数据位置被选中时，数据分类才会落在 `<LFAA_HOME>/data`；推荐或自定义位置启用时不创建第二份 `.lfaa/data`。两个根不会互相扫描或合并。Profile 配置不创建 `node_modules`，也不会在用户目录运行任意依赖安装脚本。测试只传入合成 Home/目录，不读写实际用户 Home。

`private-directory.mjs` 保护真实凭据目录：POSIX 0700；Windows 受保护继承 ACL 只允许当前 OS 账户、SYSTEM 和 Administrators。路径经环境变量进入固定 PowerShell/.NET 脚本，不插入命令文本；符号链接拒绝，权限设置失败阻止密钥访问或创建。每进程成功保护后缓存，避免在请求链反复同步启动辅助进程。

由 launch-environment、Settings 和 Daemon 的既有凭据路径调用；它不负责用户认证、加密或权限审批。测试检查真实目录和既有文件 ACL，不使用产品凭据。

2026-10-14：data-layout 补齐 tmp 分类；所有分类从唯一 data 根派生，首次默认 .lfaa/data 与项目 data 推荐位置保持区分，不能随盘类型改变。旧分区记录不成为第二个根。

`ensureDataDirectories()` 在控制端和本机 Daemon 启动时，按 `resolveDataPaths()` 自动补齐数据库、用户、会话、凭据、游戏、环境、工具、插件运行数据、缓存、临时文件、日志、备份、模型、连接和存储分类。凭据仍由 `private-directory.mjs` 保护；分类目录必须是普通目录。该初始化只建空目录，不创建账户、作品、游戏实例或其他业务数据；重复调用安全。
