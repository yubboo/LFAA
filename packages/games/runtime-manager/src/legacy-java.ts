/** 功能：兼容旧 Minecraft Java API 的任务传输合同。作用：环境规则已归 RuntimeManager；旧调用者仍沿原任务形状返回，迁移完成后删除此适配。 */
import {win32} from "node:path";
import {ApiError} from "lfaa-util-values/src/http-error.js";
import {database} from "lfaa-storage-sqlite/src/database.js";
import {getDaemonNode,listDaemonNodes,type DaemonNode} from "lfaa-host-daemon/src/local-daemon.js";
import {createMinecraftTask,type MinecraftTask} from "lfaa-jobs/src/minecraft-queue.js";
import {getUserSettings} from "lfaa-settings/src/service.js";
function requireOnlineWindowsNode(nodeId:string):DaemonNode {
  const node=getDaemonNode(nodeId);
  if(!node||node.status!=="online"||node.platform!=="win32"||node.architecture!=="x64")throw new ApiError(409,"java_node_unavailable","请选择在线 Windows x64 环境执行节点。");
  if(!node.capabilities.includes("java-environment-manager-v1"))throw new ApiError(409,"java_manager_daemon_update_required","节点尚未加载 Java 环境执行器。");
  return node;
}
export function installMinecraftJava(nodeId: string, userId: string, major: number): MinecraftTask {
  const node = requireOnlineWindowsNode(nodeId);
  if (!Number.isInteger(major) || major < 8 || major > 40) throw new ApiError(400, "invalid_java_version", "Java 主版本号不受支持。");
  if (hasPendingJavaEnvironmentTask(node.id, "install", major)) throw new ApiError(409, "java_install_pending", `Java ${major} 的安装任务已经排队或正在执行。`);
  if (hasPendingJavaEnvironmentTask(node.id, "uninstall", major)) throw new ApiError(409, "java_uninstall_pending", `Java ${major} 的卸载任务尚未完成。`);
  if (node.javaRuntimes.some((runtime) => runtime.major === major && runtime.managed)) {
    throw new ApiError(409, "java_runtime_already_installed", "本机已登记此 Java 主版本的受管理运行环境。");
  }
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { javaMajor: major, downloadTimeoutSeconds: getUserSettings(userId).minecraftRuntime.minecraftDownloadTimeoutSeconds },
    message: `等待下载并校验 Temurin Java ${major} 官方 JRE/JDK 压缩包。`
  });
}

export function uninstallMinecraftJava(nodeId: string, userId: string, major: number): MinecraftTask {
  const node = requireJavaManagementNode(nodeId);
  if (!Number.isInteger(major) || major < 8 || major > 40) throw new ApiError(400, "invalid_java_version", "Java 主版本号不受支持。");
  if (hasPendingJavaEnvironmentTask(node.id, "uninstall", major)) throw new ApiError(409, "java_uninstall_pending", `Java ${major} 的卸载任务已经排队或正在执行。`);
  if (!node.javaRuntimes.some((runtime) => runtime.major === major && runtime.managed)) {
    throw new ApiError(404, "java_runtime_not_managed", "找不到 LFAA 管理的此 Java 版本，无法卸载电脑上的外部 Java。");
  }
  // 保留运行中或结果未确认实例依赖的 Java；停止状态的实例可在重装相同主版本后继续使用。
  const activeInstance = database.prepare(`
    SELECT name FROM minecraft_instances
    WHERE node_id = ? AND java_major = ? AND (java_runtime_id IS NULL OR java_runtime_id = 'temurin-' || java_major)
      AND state IN ('installing', 'starting', 'running', 'stopping', 'unknown')
    LIMIT 1
  `).get(nodeId, major) as { name: string } | undefined;
  if (activeInstance) throw new ApiError(409, "java_runtime_in_use", `Minecraft 实例“${activeInstance.name}”正在使用 LFAA 托管 Java ${major} 或状态未确认，暂不能卸载。`);
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { operation: "uninstall", javaMajor: major },
    message: `等待卸载 LFAA 管理的 Temurin Java ${major} JRE。`
  });
}

export function registerMinecraftJavaPath(nodeId: string, userId: string, executablePath: string, runtimeId?: string): MinecraftTask {
  const node = requireJavaManagementNode(nodeId);
  // Java 路径属于节点本地设置，只接受 Windows java.exe 绝对路径并由 Daemon 实际核验。
  const path = executablePath.trim();
  if (path.length > 2048 || /[\r\n\u0000]/u.test(path) || !win32.isAbsolute(path) || win32.basename(path).toLocaleLowerCase() !== "java.exe") {
    throw new ApiError(400, "invalid_java_path", "请输入 Windows 上 java.exe 的完整绝对路径。");
  }
  if (runtimeId && !node.javaRuntimes.some((runtime) => runtime.runtimeId === runtimeId && runtime.source === "custom" && !runtime.managed)) {
    throw new ApiError(404, "custom_java_path_not_found", "找不到可修改的手动登记 Java 路径；请刷新运行环境列表后重试。");
  }
  const normalizedPath = win32.normalize(path).toLocaleLowerCase();
  if (hasPendingJavaEnvironmentTask(node.id, "register-path", (payload) => {
    const pendingPath = typeof payload.executablePath === "string" ? win32.normalize(payload.executablePath).toLocaleLowerCase() : "";
    return runtimeId ? payload.runtimeId === runtimeId : pendingPath === normalizedPath;
  })) {
    throw new ApiError(409, "java_path_update_pending", "此 Java 路径已有管理任务排队或正在执行。");
  }
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { operation: "register-path", executablePath: path, ...(runtimeId ? { runtimeId } : {}) },
    message: runtimeId ? "等待识别并更新手动登记的 Java 路径。" : "等待识别并登记 Java 路径。"
  });
}

export function forgetMinecraftJavaPath(nodeId: string, userId: string, runtimeId: string): MinecraftTask {
  const node = requireJavaManagementNode(nodeId);
  if (!node.javaRuntimes.some((runtime) => runtime.runtimeId === runtimeId && runtime.source === "custom" && !runtime.managed)) {
    throw new ApiError(404, "custom_java_path_not_found", "找不到可移除的手动 Java 路径；请刷新运行环境列表后重试。");
  }
  if (hasPendingJavaEnvironmentTask(node.id, "forget-path", (payload) => payload.runtimeId === runtimeId)) {
    throw new ApiError(409, "java_path_removal_pending", "此 Java 路径的移除任务已经排队或正在执行。");
  }
  return createMinecraftTask({
    nodeId: node.id,
    instanceId: null,
    createdBy: userId,
    kind: "java-install",
    payload: { operation: "forget-path", runtimeId },
    message: "等待移除手动登记的 Java 路径记录。"
  });
}

export function listMinecraftJavaRuntimes(onNodeStatusChanged?: () => void): Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: DaemonNode["javaRuntimes"] }> {
  return listDaemonNodes(onNodeStatusChanged).map((node) => ({ nodeId: node.id, nodeName: node.displayName, nodeStatus: node.status, runtimes: node.javaRuntimes }));
}

function requireJavaManagementNode(nodeId: string): DaemonNode {
  const node = requireOnlineWindowsNode(nodeId);
  if (!node.capabilities.includes("java-environment-manager-v1")) {
    throw new ApiError(409, "java_manager_daemon_update_required", "此节点的 Daemon 尚未启用 Java 环境管理，请重启本机 Daemon 后重试。");
  }
  return node;
}

export function hasPendingJavaEnvironmentTask(
  nodeId: string,
  operation: string,
  matches: ((payload: Record<string, unknown>) => boolean) | number
): boolean {
  const rows = database.prepare(`
    SELECT payload_json FROM minecraft_tasks
    WHERE node_id = ? AND kind = 'java-install' AND status IN ('queued', 'running')
  `).all(nodeId) as Array<{ payload_json: string }>;
  return rows.some((row) => {
    let payload: Record<string, unknown>;
    try { payload = JSON.parse(row.payload_json) as Record<string, unknown>; }
    catch { return false; }
    const taskOperation = typeof payload.operation === "string" ? payload.operation : "install";
    if (taskOperation !== operation) return false;
    return typeof matches === "number" ? Number(payload.javaMajor) === matches : matches(payload);
  });
}

