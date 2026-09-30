/** 功能：集中定义控制端私有数据目录。作用：应用存储与受限文件工具共用同一边界；完全权限的主机 Shell 仍遵循原合同。关联文件：Minecraft、SteamCMD 服务和 Daemon 文件执行器。 */
export const protectedDataDirectories = Object.freeze(["credentials", "database", "storages", "sessions"]);
