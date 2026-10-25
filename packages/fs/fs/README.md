# 文件服务 Owner

`library.ts` 是页面与模型共用的资源路由、实时身份/权限、挂载、账户审计 Owner；`managed-files.mjs` 是本机与 Daemon 共用的文件操作、路径/链接校验、摘要冲突、串行写入、流式有界读取和回收站实现。`queue.ts` 只保存/派发节点任务，不自行执行游戏文件；`instance-files.mjs` 保护已登记实例根、元数据和未确认进程标记。

`list` 的 entries 只包含真实 data 文件，locations 是单独的导航投影；`listLocations` 不枚举磁盘、递归扫描或创建目录。资源入口带 `locationDescription`，UI 将其显示为真实路径/Owner 说明；挂载 ID 只用于内部路由，不表示磁盘目录。`.lfaa-resources/<类别>` 读取由统一 data 根派生的备份、日志、运行环境、工具、缓存和临时目录；游戏存储/实例通过 workspace-files 挂载回原领域及目标节点。显式 `local-drives` 保留，源码、账户与插件私有数据保护不能经该入口绕过。

第三方插件 Profile 根 `<LFAA_HOME>/profiles/<Profile>` 及其中默认私有运行数据不由通用文件管理器开放；插件自有存储配置由对应 Plugin/Runtime Owner 管理。旧 `<LFAA_HOME>/plugins` 与 `<LFAA_DATA_DIR>/plugins` 子树不再作为数据位置或入口，文件管理器隐藏并拒绝访问历史目录；系统 data 初始化和迁移不创建或复制它。游戏 plugins/mods 属实例，按实例状态与节点 Owner 操作。别名与本机来源使用同一写入锁，回收站由账户哈希隔离，节点任务也由账户派生命名空间。

仍沿用超级管理员与 permissions.mode=full_access 的现有文件入口合同。通用 Shell 授权不由文件服务重新定义。真实数据不随包交付；构建只写根 dist/packages/fs/fs，节点任务不会自动重放结果未知的副作用。

规范与提示词见[资源合同](../../../docs/development/file-resources.zh.md)。回归位于 apps/cli/tests/file-resources、system-file-library、file-manager-foundation、file-manager-api。列表最多返回 500 项，搜索最多扫描 10,000 项，大小计算最多 20,000 项；超出时截断或明确失败，不冒充完整结果。断点续传、大文件分片、通用 DSH ABI 与后台自动清理仍未接入。

节点文件字节由 `src/file-transfers.mjs` 暂存：每个文件最多 3 MiB，单 Control Plane 进程总预留最多 20 MiB，5 分钟过期；任务队列只保存传输 ID 和元数据，并在完成时核对实际字节、名称、大小与 SHA-256。当前单进程 Control Plane 与本机 SQLite 是部署前提；多 Control Plane 横向扩展尚未支持，届时需先提供共享的有界传输存储和一致的任务绑定。
