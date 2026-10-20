# 数据根与私有目录工具

`resolveHomeDirectory()` 是本机账户/控制数据 Home Owner：`LFAA_HOME` 必须是绝对路径；留空默认 `%USERPROFILE%\.lfaa`（非 Windows 使用 `~/.lfaa`）。`resolveDataDirectory()` 是业务 Data 根 Owner：显式部署 `LFAA_DATA_DIR` 优先；否则读取设置中心“项目与存储”选择，首次默认 `<LFAA_HOME>/data`。控制配置文件 `<LFAA_HOME>/storages/data-directory.json` 保存这一唯一选择。Home 只承载数据库、账户文件、会话、凭据和控制配置；Data 根承载账户业务文件、游戏、运行环境、工具、缓存、临时文件、日志、备份、模型与联机配置。应用推荐位置按当前项目/安装根动态解析为 `data`。切换 Data 根只登记新路径并创建分类；旧根和其中的文件保留，重启后控制端与本机 Daemon 读取同一个选择。App Boot 的 Profile Cordis Patch 与 Plugin Manager 的插件源码/清单位于 `<LFAA_HOME>/profiles/<Profile>`；受控 Wallpaper Engine 运行副本和默认私有运行数据位于该 Profile 的 `runtime-adapters/<plugin-id>/` 与 `runtime-data/<plugin-id>/`。插件自有存储位置配置由对应 Plugin/Runtime Owner 解释；旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 不再作为入口，也不由系统 data 初始化或迁移接管。系统账户数据、业务 Data 与 Profile 目录不会互相扫描或合并。自动化回归只使用合成数据；浏览器验收复用现有 `admin` 测试账号，不提供临时存储模式或独立临时 Web 服务。Profile 配置不创建 `node_modules`，也不会在用户目录运行任意依赖安装脚本。

`private-directory.mjs` 保护真实凭据目录：POSIX 0700；Windows 受保护继承 ACL 只允许当前 OS 账户、SYSTEM 和 Administrators。路径经环境变量进入固定 PowerShell/.NET 脚本，不插入命令文本；符号链接拒绝，权限设置失败阻止密钥访问或创建。每进程成功保护后缓存，避免在请求链反复同步启动辅助进程。

由 launch-environment、Settings 和 Daemon 的既有凭据路径调用；它不负责用户认证、加密或权限审批。测试检查真实目录和既有文件 ACL，不使用产品凭据。

2026-10-20 路径说明：`.lfaa` 是账户/控制 Home，`LFAA_DATA_DIR` 默认指向 `.lfaa/data`。`ensureHomeDirectories()` 只创建 Home 的账户与控制分类；`ensureDataDirectories()` 只在有效 Data 根创建 `users/`、`games/`、`environments/`、`lib/`、`cache/`、`tmp/`、`logs/`、`backups/`、`models/` 和 `connectivity/`。两组目录名称相同也不代表归属相同；账户设置与业务项目文件分别由各自 Owner 持有。

`ensureHomeDirectories()` 与 `ensureDataDirectories()` 由控制端和本机 Daemon 启动时分别调用：前者只在 Home 创建账户/控制分类并保护凭据；后者只在 Data 根创建业务分类。两者仅创建普通目录，不创建账户、作品或游戏实例；重复调用安全。Profile 根由各自 Owner 管理，不由两种分类初始化接管。
