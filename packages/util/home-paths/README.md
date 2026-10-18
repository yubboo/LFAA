# 数据根与私有目录工具

`resolveHomeDirectory()` 是本机安装/Home Owner：`LFAA_HOME` 必须是绝对路径；留空默认 `%USERPROFILE%\.lfaa`（非 Windows 使用 `~/.lfaa`）。`resolveDataDirectory()` 优先采用显式 `LFAA_DATA_DIR`，否则返回 `<LFAA_HOME>` 本身，系统账户、Provider、会话、凭据和运行数据在 Home 下各自的分类目录中保存，不再增加 `system-data` 子目录。游戏、小说和漫剧业务内容由 Settings Owner 单独存放在 `<LFAA_HOME>/data`；推荐目录按当前项目/安装根动态解析为 `data`。Home 是系统文件根，`Home/data` 是业务内容根，迁移只读取业务根中的游戏、小说和漫剧受管子树。App Boot 的 Profile Cordis Patch 与 Plugin Manager 的插件源码/清单位于同一个 `<LFAA_HOME>/profiles/<Profile>`；受控 Wallpaper Engine 运行副本和默认私有运行数据位于该 Profile 的 `runtime-adapters/<plugin-id>/` 与 `runtime-data/<plugin-id>/`。插件自有存储位置配置由对应 Plugin/Runtime Owner 解释；旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 不再作为入口，也不由系统 data 初始化或迁移接管。系统分类、业务内容与 Profile 目录不会互相扫描或合并。自动化回归只使用合成数据；浏览器验收复用现有 `admin` 测试账号，不提供临时存储模式或独立临时 Web 服务。Profile 配置不创建 `node_modules`，也不会在用户目录运行任意依赖安装脚本。

`private-directory.mjs` 保护真实凭据目录：POSIX 0700；Windows 受保护继承 ACL 只允许当前 OS 账户、SYSTEM 和 Administrators。路径经环境变量进入固定 PowerShell/.NET 脚本，不插入命令文本；符号链接拒绝，权限设置失败阻止密钥访问或创建。每进程成功保护后缓存，避免在请求链反复同步启动辅助进程。

由 launch-environment、Settings 和 Daemon 的既有凭据路径调用；它不负责用户认证、加密或权限审批。测试检查真实目录和既有文件 ACL，不使用产品凭据。

2026-10-14 历史路径说明已由 2026-10-18 存储合同修正：系统分类直接位于 `.lfaa` Home，业务内容位于 `.lfaa/data`；项目 `data` 仅是用户选择推荐位置后生效。旧分区记录不成为第二个根。

`ensureDataDirectories()` 在控制端和本机 Daemon 启动时，按 `resolveDataPaths()` 在系统根下自动补齐数据库、用户、会话、凭据、游戏、环境、工具、缓存、临时文件、日志、备份、模型、连接和存储分类。默认系统根就是 `<LFAA_HOME>`，业务 `<LFAA_HOME>/data` 与 Profile `<LFAA_HOME>/profiles` 由各自 Owner 管理，不由分类初始化创建；凭据仍由 `private-directory.mjs` 保护，分类目录必须是普通目录。初始化只建空系统目录，不创建账户、作品、游戏实例或其他业务数据；重复调用安全。
