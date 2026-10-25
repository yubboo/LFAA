/** DST 专用参数与启动前文件门禁；配置内容始终留在节点文件系统。 */
import { win32 } from "node:path";

export function buildSteamcmdDstLaunchArguments(serverDataDirectory, clusterName, shard) {
  if (typeof serverDataDirectory !== "string" || !serverDataDirectory.trim()
    || typeof clusterName !== "string" || !/^[A-Za-z0-9_-]{1,32}$/u.test(clusterName)
    || !["Master", "Caves"].includes(shard)) throw new Error("饥荒集群启动参数无效。");
  return ["-persistent_storage_root", serverDataDirectory, "-conf_dir", "DoNotStarveTogether", "-cluster", clusterName, "-shard", shard, "-console"];
}

export async function assertSteamcmdDstClusterFiles(configurationDirectory, shard, assertSafePath) {
  if (typeof configurationDirectory !== "string" || !configurationDirectory.trim()
    || !["Master", "Caves"].includes(shard) || typeof assertSafePath !== "function") throw new Error("饥荒集群文件检查参数无效。");
  const requiredFiles = [
    [win32.resolve(configurationDirectory, "cluster.ini"), "cluster.ini"],
    [win32.resolve(configurationDirectory, "cluster_token.txt"), "cluster_token.txt"],
    [win32.resolve(configurationDirectory, shard, "server.ini"), `${shard}/server.ini`]
  ];
  for (const [path, label] of requiredFiles) {
    let info;
    try { info = await assertSafePath(path); }
    catch (error) {
      if (error?.code === "ENOENT") throw new Error(`饥荒集群缺少有效的 ${label}；请通过节点文件管理器上传配置文件。`);
      throw error;
    }
    if (!info?.isFile?.() || info.size < 1) throw new Error(`饥荒集群缺少有效的 ${label}；请通过节点文件管理器上传配置文件。`);
  }
  return true;
}
