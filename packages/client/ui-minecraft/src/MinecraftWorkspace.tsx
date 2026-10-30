/**
 * 功能：呈现 Minecraft 常规模式的真实管理工作台。
 * 作用：读取 LFAA 控制端与本机 Daemon 数据，并提交受权限控制的实例任务。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-sidebar-terminal/src/TerminalSurface.tsx、packages/client/ui-minecraft/src/MinecraftWorkspace.css。
 */
import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { setFileManagerLocation } from "lfaa-client-connection/src/file-manager-location.js";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { playNotificationSound } from "lfaa-client-resources/src/notification-runtime.js";
import { Alert, Button, Card, Checkbox, ConfigProvider, Input, InputNumber, Modal, Popconfirm, Progress, Select, Space, Spin, Tag, Typography } from "antd";
import {
  hasAdminAccess,
  deleteMinecraftInstance,
  deleteMinecraftTaskRecords,
  getErrorMessage,
  loadMinecraftDeployments,
  loadMinecraftInstances,
  loadMinecraftJava,
  loadMinecraftNodes,
  loadMinecraftOverview,
  loadMinecraftTasks,
  loadMinecraftTaskDetails,
  loadMinecraftInstanceLogs,
  registerMinecraftDeployment,
  retryMinecraftDeployment,
  runMinecraftInstanceAction,
  readMinecraftServerProperties,
  saveMinecraftServerFileProperties,
  setMinecraftInstanceJvmConfiguration,
  type MinecraftDeployment,
  type MinecraftInstance,
  type MinecraftLog,
  type MinecraftNode,
  type MinecraftTask,
  type MinecraftTaskDetails,
  type UserRole,
  type UserSettings
} from "lfaa-client-connection/src/api.js";
import { createBrowserPersistence, createClientPersistenceKey, createJsonPersistenceCodec } from "lfaa-client-store/src/browser-persistence.js";
import { createMinecraftSocket, type MinecraftRealtimeChange } from "lfaa-client-connection/src/minecraft-socket.js";
import { TerminalManagerDock } from "lfaa-client-ui-sidebar-terminal/src/TerminalManagerProvider.js";
import "./MinecraftWorkspace.css";
import { MinecraftDeploymentPanel } from "./MinecraftDeploymentPanel.js";
import {cancelMinecraftTask} from "lfaa-client-connection/src/runtime-api.js";
import { MinecraftConnectivityPanel } from "./MinecraftConnectivityPanel.js";
import { MinecraftJvmSettings } from "./MinecraftJvmSettings.js";
import paperCoreLogo from "./assets/papermc_logo.min.svg";

const minecraftConsoleQuickCommands = [
  { label: "帮助", command: "help" },
  { label: "在线玩家", command: "list" },
  { label: "保存世界", command: "save-all" }
];
import { DaemonConnections } from "./DaemonConnections.js";
import { MinecraftWorkflowCanvas } from "./MinecraftWorkflowCanvas.js";

interface MinecraftWorkspaceProps {
  onPrepareWithAi:(prompt:string)=>void;
  userId: string;
  section: string;
  role: UserRole;
  settings: UserSettings;
  onNavigate: (path: string) => void;
  onOpenConnectivity: () => void;
  onContentReady: (ready: boolean) => void;
}

const minecraftRoot = "/apps/minecraft/normal";
const unavailableValue = "—"; // taste-skill-ignore em-dash: shared placeholder for a value the app has not received.
type RealtimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
type MinecraftInstanceFilter = "all" | MinecraftInstance["state"];

interface MinecraftWorkspaceSnapshot {
  overview: { latestRelease: string | null; node: MinecraftNode | null; instanceCount: number; runningCount: number; activeTaskCount: number };
  nodes: MinecraftNode[];
  javaNodes: Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: MinecraftNode["javaRuntimes"] }>;
  instances: MinecraftInstance[];
  deployments: MinecraftDeployment[];
  tasks: MinecraftTask[];
  refreshedAt: string;
}

const minecraftWorkspaceSnapshots = createSnapshotCache<MinecraftWorkspaceSnapshot>();
const MINECRAFT_SNAPSHOT_FRESHNESS_MS = 30_000;
const MINECRAFT_CONNECTED_RECONCILE_INTERVAL_MS = 30_000;
const MINECRAFT_DISCONNECTED_RECONCILE_INTERVAL_MS = 10_000;
const MINECRAFT_LOG_CONNECTED_RECONCILE_INTERVAL_MS = 30_000;
const MINECRAFT_LOG_DISCONNECTED_RECONCILE_INTERVAL_MS = 5_000;
const minecraftTaskSelectionCodec = createJsonPersistenceCodec<string[]>((value): value is string[] => Array.isArray(value) && value.every((id) => typeof id === "string"));

interface MinecraftActionToast {
  id: number;
  message: string;
  showTasksLink: boolean;
  expiresAt: number;
}

interface MinecraftActionFeedback {
  message: string;
  showTasksLink: boolean;
}

function realtimeStatusLabel(status: RealtimeConnectionStatus): string {
  return ({ connecting: "实时连接中", connected: "控制端已连接", reconnecting: "实时连接恢复中", disconnected: "实时连接中断" })[status];
}

function realtimeStatusColor(status: RealtimeConnectionStatus): string {
  return ({ connecting: "processing", connected: "success", reconnecting: "warning", disconnected: "error" })[status];
}

function getInstanceRoute(instanceId: string, view: "overview" | "configuration" | "terminal" | "logs" | "backup"): string {
  if (view === "logs") return `${minecraftRoot}/logs/${encodeURIComponent(instanceId)}`;
  return `${minecraftRoot}/instance/${encodeURIComponent(instanceId)}/${view}`;
}

function navigateToInstanceFiles(userId: string, instanceId: string, onNavigate: (path: string) => void): void {
  setFileManagerLocation(userId, `.lfaa-library/game-instances/${encodeURIComponent(instanceId)}`, getInstanceRoute(instanceId, "overview"));
  onNavigate("/files");
}

function stateLabel(state: MinecraftInstance["state"]): string {
  return ({ installing: "安装中", stopped: "已停止", starting: "启动中", running: "运行中", stopping: "停止中", error: "异常", unknown: "状态未知" })[state];
}

function taskLabel(kind: MinecraftTask["kind"]): string {
  return ({ install: "安装服务端", start: "启动实例", stop: "停止实例", restart: "重启实例", console: "控制台指令", properties: "保存配置", "properties-read": "读取服务端配置", backup: "世界备份", "java-install": "Java 环境管理", delete:"归档并删除实例" })[kind];
}

const minecraftPropertyLabels: Record<string, string> = {
  motd: "服务器描述", difficulty: "游戏难度", gamemode: "默认模式", "max-players": "玩家上限", "server-port": "服务器端口",
  "server-ip": "绑定地址", "view-distance": "视距", "simulation-distance": "模拟距离", "level-name": "世界名称", "level-seed": "世界种子",
  "online-mode": "正版验证", pvp: "玩家对战", "white-list": "白名单", "enable-rcon": "远程控制", "rcon.port": "远程控制端口",
  "rcon.password": "远程控制密码", "enable-query": "服务器查询", "query.port": "查询端口", "enable-command-block": "命令方块",
  "allow-nether": "允许下界", "allow-flight": "允许飞行", hardcore: "极限模式", "force-gamemode": "强制默认模式",
  "spawn-monsters": "生成敌对生物", "spawn-animals": "生成动物", "spawn-npcs": "生成村民", "spawn-protection": "出生点保护",
  "generate-structures": "生成建筑", "max-build-height": "最大建筑高度", "max-world-size": "最大世界边界", "level-type": "世界类型",
  "generator-settings": "生成器设置", "player-idle-timeout": "玩家闲置时间", "op-permission-level": "管理员权限等级",
  "prevent-proxy-connections": "代理连接校验", "network-compression-threshold": "网络压缩阈值", "resource-pack": "资源包地址",
  "resource-pack-sha1": "资源包校验值", "snooper-enabled": "匿名统计", "sync-chunk-writes": "区块同步写入",
  "max-tick-time": "单刻最长时间", "use-native-transport": "原生网络传输", "entity-broadcast-range-percentage": "实体广播距离"
};

const minecraftPropertySections = ["网络与安全", "玩法与世界", "性能", "其他"] as const;
const minecraftBooleanPropertyKeys = new Set([
  "online-mode", "pvp", "white-list", "enable-rcon", "enable-query", "enable-command-block", "allow-nether",
  "allow-flight", "hardcore", "force-gamemode", "spawn-monsters", "spawn-animals", "spawn-npcs",
  "generate-structures", "prevent-proxy-connections", "snooper-enabled", "sync-chunk-writes", "use-native-transport"
]);
const minecraftNumericPropertyKeys = new Set([
  "server-port", "query.port", "rcon.port", "max-players", "view-distance", "simulation-distance",
  "spawn-protection", "max-build-height", "max-world-size", "player-idle-timeout", "op-permission-level",
  "network-compression-threshold", "max-tick-time", "entity-broadcast-range-percentage"
]);

function minecraftPropertySection(key: string): typeof minecraftPropertySections[number] {
  if (/server-ip|server-port|query|rcon|network|proxy|online-mode|white-list|resource-pack/iu.test(key)) return "网络与安全";
  if (/gamemode|difficulty|pvp|allow-|spawn-|hardcore|force-|generate|level-|generator|world|command-block|idle-timeout|permission-level/iu.test(key)) return "玩法与世界";
  if (/view-distance|simulation-distance|tick|thread|compression|cache|native-transport|broadcast-range|snooper/iu.test(key)) return "性能";
  return "其他";
}

function minecraftPropertyLabel(key: string): string {
  return minecraftPropertyLabels[key] ?? key.replaceAll("-", " ").replaceAll("_", " ");
}

function minecraftPropertyOptions(key: string, rawValue: string | null): Array<{ value: string; label: string }> | null {
  if (rawValue === null) return null;
  const normalizedValue = rawValue.toLocaleLowerCase();
  if (minecraftBooleanPropertyKeys.has(key) && /^(?:true|false)$/u.test(normalizedValue)) {
    const enabled = normalizedValue === "true";
    return [{ value: rawValue, label: enabled ? "开启" : "关闭" }, { value: enabled ? "false" : "true", label: enabled ? "关闭" : "开启" }];
  }
  const numeric = /^[0-3]$/u.test(normalizedValue);
  if (key === "difficulty" && (numeric || ["peaceful", "easy", "normal", "hard"].includes(normalizedValue))) {
    const values = numeric ? ["0", "1", "2", "3"] : ["peaceful", "easy", "normal", "hard"];
    return values.map((value, index) => ({ value: value === normalizedValue ? rawValue : value, label: ["和平", "简单", "普通", "困难"][index]! }));
  }
  if (key === "gamemode" && (numeric || ["survival", "creative", "adventure", "spectator"].includes(normalizedValue))) {
    const values = numeric ? ["0", "1", "2", "3"] : ["survival", "creative", "adventure", "spectator"];
    return values.map((value, index) => ({ value: value === normalizedValue ? rawValue : value, label: ["生存", "创造", "冒险", "旁观"][index]! }));
  }
  return null;
}

function deploymentStateLabel(state: MinecraftDeployment["state"]): string {
  return ({ queued: "等待下载", downloading: "下载中", ready: "下载完成", failed: "下载失败", registering: "创建实例中", registered: "实例已创建" })[state];
}

function deploymentStateColor(state: MinecraftDeployment["state"]): string {
  return ({ queued: "default", downloading: "processing", ready: "success", failed: "error", registering: "processing", registered: "success" })[state];
}

function deploymentTaskLabel(task: MinecraftTask): string {
  if (task.payload.operation === "deploy") return "下载服务端";
  if (task.payload.operation === "register") return "创建实例";
  return taskLabel(task.kind);
}

function javaTaskLabel(task: MinecraftTask): string {
  const operation = task.payload.operation;
  if (operation === "uninstall") return "卸载 Java";
  if (operation === "register-path") return task.payload.runtimeId ? "修改 Java 路径" : "登记 Java 路径";
  if (operation === "forget-path") return "移除 Java 路径记录";
  return "安装 Java";
}

function taskStatusLabel(status: MinecraftTask["status"]): string {
  return ({ queued: "排队中", running: "执行中", succeeded: "已完成", failed: "失败" })[status];
}

function taskDetailStatusLabel(task: MinecraftTask): string {
  if (task.status === "failed" && task.result?.outcome === "unknown") return "异常 · 结果未确认";
  return task.result?.forced === true ? "已强制停止" : taskStatusLabel(task.status);
}

function taskProblemLog(logs: MinecraftTaskDetails["logs"]): MinecraftTaskDetails["logs"][number] | null {
  return logs.find((log) => log.stream === "stderr" || /\b(error|exception|failed|failure|fatal|denied|cannot)\b|失败|异常|错误|拒绝|找不到|无法/iu.test(log.line)) ?? null;
}

function taskJsonText(value: unknown): string {
  return JSON.stringify(value, null, 2) ?? String(value);
}

function taskDetailTime(value: string | null): string {
  return value ? new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "medium" }).format(new Date(value)) : "尚未开始";
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function formatMinecraftLogLine(line: string): string {
  return line.slice(0, 4096)
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/gu, "")
    .replace(/\u001b\][^\u0007]*(?:\u0007|\u001b\\)/gu, "")
    .replace(/\uFFFD(?=\[(?:\d{1,2}:){2}\d{1,2}\b)/gu, "")
    .replace(/\u0009/gu, "    ")
    .replace(/[\r\n]/gu, " ")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, "")
    .replace(/\uFFFD$/u, "");
}

function MinecraftWorkspaceView({ onPrepareWithAi,userId, section, role, settings, onNavigate, onOpenConnectivity, onContentReady }: MinecraftWorkspaceProps) {
  const snapshotKey = `${userId}\u001f${role}`;
  const cachedSnapshot = useRef(minecraftWorkspaceSnapshots.get(snapshotKey) ?? null).current;
  const [overview, setOverview] = useState<MinecraftWorkspaceSnapshot["overview"] | null>(() => cachedSnapshot?.overview ?? null);
  const [nodes, setNodes] = useState<MinecraftNode[]>(() => cachedSnapshot?.nodes ?? []);
  const [nodesLoaded, setNodesLoaded] = useState(() => cachedSnapshot !== null);
  const [javaNodesLoaded, setJavaNodesLoaded] = useState(() => cachedSnapshot !== null);
  const [deploymentsLoaded, setDeploymentsLoaded] = useState(() => cachedSnapshot !== null);
  const [tasksLoaded, setTasksLoaded] = useState(() => cachedSnapshot !== null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(() => cachedSnapshot?.refreshedAt ?? null);
  const [javaNodes, setJavaNodes] = useState<MinecraftWorkspaceSnapshot["javaNodes"]>(() => cachedSnapshot?.javaNodes ?? []);
  const [instances, setInstances] = useState<MinecraftInstance[]>(() => cachedSnapshot?.instances ?? []);
  const [deployments, setDeployments] = useState<MinecraftDeployment[]>(() => cachedSnapshot?.deployments ?? []);
  const [tasks, setTasks] = useState<MinecraftTask[]>(() => cachedSnapshot?.tasks ?? []);
  const [logs, setLogs] = useState<MinecraftLog[]>([]);
  const [logsInstanceId, setLogsInstanceId] = useState("");
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [logInstanceSelection, setLogInstanceSelection] = useState("");
  const [loading, setLoading] = useState(() => cachedSnapshot === null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<MinecraftActionToast | null>(null);
  const [actionToastSeconds, setActionToastSeconds] = useState(settings.general.notificationToastDurationSeconds);
  const actionToastSequence = useRef(0);
  const [busy, setBusy] = useState(false);
  const [taskDetailId, setTaskDetailId] = useState<string | null>(null);
  const [taskDetails, setTaskDetails] = useState<MinecraftTaskDetails | null>(null);
  const [taskDetailLoading, setTaskDetailLoading] = useState(false);
  const [taskDetailError, setTaskDetailError] = useState<string | null>(null);
  const taskDetailSequence = useRef(0);
  const taskDetailAbortController = useRef<AbortController | null>(null);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>("connecting");
  const realtimeStatusRef = useRef(realtimeStatus);
  realtimeStatusRef.current = realtimeStatus;
  const [memoryMb, setMemoryMb] = useState<number | null>(settings.minecraftRuntime.minecraftDefaultMemoryMb);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [registerDeploymentId, setRegisterDeploymentId] = useState("");
  const [registerJavaRuntimeId, setRegisterJavaRuntimeId] = useState("");
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [propertyDraft, setPropertyDraft] = useState<Record<string, string>>({});
  const [touchedSensitiveProperties, setTouchedSensitiveProperties] = useState<Set<string>>(() => new Set());
  const [propertySearch, setPropertySearch] = useState("");
  const [propertyReadTaskId, setPropertyReadTaskId] = useState<string | null>(null);
  const [propertyReadLoading, setPropertyReadLoading] = useState(false);
  const [propertyReadError, setPropertyReadError] = useState<string | null>(null);
  const propertyReadAttemptedFor = useRef<string | null>(null);
  const handledPropertyReadTask = useRef<string | null>(null);
  const [instanceSearch, setInstanceSearch] = useState("");
  const [instanceStateFilter, setInstanceStateFilter] = useState<MinecraftInstanceFilter>("all");
  const [taskStatusFilter, setTaskStatusFilter] = useState<MinecraftTask["status"] | "all">("all");
  const mounted = useRef(false);
  const refreshSequence = useRef(0);
  const snapshotReadInFlight = useRef(false);
  const snapshotAbortController = useRef<AbortController | null>(null);
  const initialSnapshotReadScheduled = useRef(false);
  const lastSnapshotReadAt = useRef(cachedSnapshot ? Date.parse(cachedSnapshot.refreshedAt) : 0);
  const socketConnectedOnce = useRef(false);
  const contentReadyNotified = useRef(cachedSnapshot !== null);
  const realtimeSocket = useRef<ReturnType<typeof createMinecraftSocket> | null>(null);
  const readLogsRef = useRef<(() => void) | null>(null);
  const logTarget = useRef({ instanceId: "", view: "overview" });
  const [instanceLogFilter, setInstanceLogFilter] = useState<"all" | "stdout" | "stderr" | "system">("all");
  const [instanceLogAutoScroll, setInstanceLogAutoScroll] = useState(true);
  const instanceLogViewport = useRef<HTMLDivElement>(null);

  const detailMatch = /^instance\/([0-9a-f-]{36})\/(overview|configuration|terminal|logs|backup)$/iu.exec(section);
  const standaloneLogsMatch = /^logs(?:\/([0-9a-f-]{36}))?$/iu.exec(section);
  const legacyLogInstanceId = detailMatch?.[2] === "logs" ? detailMatch[1] : "";
  const standaloneLogs = Boolean(standaloneLogsMatch || legacyLogInstanceId);
  const routeLogInstanceId = standaloneLogsMatch?.[1] ?? legacyLogInstanceId;
  const selectedInstanceId = detailMatch && detailMatch[2] !== "logs" ? detailMatch[1] : "";
  const detailView = standaloneLogs ? "logs" : detailMatch?.[2] ?? "overview";
  const preferredLogInstance = instances.find((item) => item.state === "running") ?? instances[0] ?? null;
  const selectedLogInstanceId = routeLogInstanceId
    ? instances.some((item) => item.id === routeLogInstanceId) ? routeLogInstanceId : ""
    : instances.some((item) => item.id === logInstanceSelection) ? logInstanceSelection : preferredLogInstance?.id ?? "";
  const selectedLogInstance = instances.find((item) => item.id === selectedLogInstanceId) ?? null;
  logTarget.current = { instanceId: selectedLogInstanceId || selectedInstanceId, view: detailView };
  const selectedInstance = instances.find((item) => item.id === selectedInstanceId) ?? null;
  const instanceLogSnapshot = useMemo(() => {
    const loaded = Boolean(selectedLogInstance && logsLoaded && logsInstanceId === selectedLogInstance.id);
    const entries = selectedLogInstance && logsInstanceId === selectedLogInstance.id
      ? logs.slice().sort((left, right) => left.id - right.id).map(entry => ({
        id: entry.id,
        time: new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
        stream: entry.stream === "stderr" ? "stderr" as const : entry.stream === "system" ? "system" as const : "stdout" as const,
        text: formatMinecraftLogLine(entry.line)
      }))
      : [];
    return { loaded, entries };
  }, [selectedLogInstance?.id, logs, logsInstanceId, logsLoaded]);
  const visibleInstanceLogs = useMemo(() => instanceLogFilter === "all"
    ? instanceLogSnapshot.entries
    : instanceLogSnapshot.entries.filter(entry => entry.stream === instanceLogFilter), [instanceLogFilter, instanceLogSnapshot.entries]);

  useLayoutEffect(() => {
    if (instanceLogAutoScroll && instanceLogViewport.current) instanceLogViewport.current.scrollTop = instanceLogViewport.current.scrollHeight;
  }, [instanceLogAutoScroll, visibleInstanceLogs]);

  useEffect(() => { setInstanceLogFilter("all"); setInstanceLogAutoScroll(true); }, [selectedLogInstanceId]);
  const independentCoreConfiguration = selectedInstance && ["BungeeCord", "Velocity", "Nukkit", "PocketMine"].includes(selectedInstance.coreType);
  const propertySnapshot = selectedInstance?.serverProperties.fileSnapshot ?? null;
  const propertyEditorState = useMemo(() => {
    const entries = propertySnapshot?.entries ?? [];
    const changed: Record<string, string | null> = Object.fromEntries(entries.flatMap((entry): Array<[string, string | null]> => {
      if (entry.sensitive) {
        if (!touchedSensitiveProperties.has(entry.key)) return [];
        const replacement = propertyDraft[entry.key] ?? "";
        return replacement.length > 0 ? [[entry.key, replacement]] : [[entry.key, null]];
      }
      const value = propertyDraft[entry.key] ?? "";
      return value !== (entry.value ?? "") ? [[entry.key, value]] : [];
    }));
    const normalizedSearch = propertySearch.trim().toLocaleLowerCase();
    const filteredEntries = normalizedSearch
      ? entries.filter((entry) => `${entry.key} ${minecraftPropertyLabel(entry.key)}`.toLocaleLowerCase().includes(normalizedSearch))
      : entries;
    const sections = minecraftPropertySections.map((title) => ({ title, entries: filteredEntries.filter((entry) => minecraftPropertySection(entry.key) === title) })).filter((section) => section.entries.length > 0);
    const columns: Array<(typeof sections)[number][]> = [[], []];
    const columnWeights = [0, 0];
    for (const section of sections) {
      const columnIndex = columnWeights[0] <= columnWeights[1] ? 0 : 1;
      columns[columnIndex]!.push(section);
      columnWeights[columnIndex] = columnWeights[columnIndex]! + section.entries.length + 1;
    }
    return { sections, columns: columns.filter((column) => column.length > 0), changed, total: entries.length, visible: filteredEntries.length };
  }, [propertyDraft, propertySearch, propertySnapshot, touchedSensitiveProperties]);
  const proxyInstance = selectedInstance && ["BungeeCord", "Velocity"].includes(selectedInstance.coreType);
  const selectedDeployment = deployments.find((item) => item.id === registerDeploymentId) ?? null;
  const selectedInstanceNode = selectedInstance ? nodes.find((node) => node.id === selectedInstance.nodeId) ?? null : null;
  const selectedInstanceSupportsInteractiveConsole = selectedInstanceNode?.capabilities.includes("minecraft-interactive-console-v1") ?? false;
  const selectedInstanceSupportsPropertiesFile = selectedInstanceNode?.capabilities.includes("minecraft-server-properties-file-v1") ?? false;
  const selectedInstanceJavaNode = selectedInstance ? javaNodes.find((node) => node.nodeId === selectedInstance.nodeId) ?? null : null;
  const selectedInstanceJavaRuntimes = selectedInstanceJavaNode?.runtimes ?? selectedInstanceNode?.javaRuntimes ?? [];
  const selectedInstanceJavaRuntime = selectedInstanceJavaRuntimes.find((runtime) => runtime.runtimeId === selectedInstance?.javaRuntimeId) ?? null;
  const registerNode = selectedDeployment
    ? nodes.find((node) => node.id === selectedDeployment.nodeId) ?? null
    : null;
  const registerNodeRuntimes = selectedDeployment
    ? javaNodes.find((node) => node.nodeId === selectedDeployment.nodeId)?.runtimes
      ?? registerNode?.javaRuntimes
      ?? []
    : [];
  const registerNodeSupportsJavaSelection = registerNode?.capabilities.includes("minecraft-java-runtime-selection-v1") ?? false;
  const registerCompatibleJavaRuntimes = selectedDeployment
    ? registerNodeRuntimes.filter((runtime) => runtime.major === selectedDeployment.javaMajor)
    : [];
  const registerSelectedJavaRuntime = registerCompatibleJavaRuntimes.find((runtime) => runtime.runtimeId === registerJavaRuntimeId) ?? null;
  const eligibleNodes = useMemo(() => nodes.filter((node) => node.status === "online" && node.platform === "win32" && node.architecture === "x64" && node.capabilities.includes("minecraft-multicore-v1")), [nodes]);
  const canOperate = hasAdminAccess(role);
  const onlineNodeCount = nodes.filter((node) => node.status === "online").length;
  const onlineWindowsNodes = nodes.filter((node) => node.status === "online" && node.platform === "win32" && node.architecture === "x64");
  const overviewInstance = useMemo(() => instances.find((instance) => instance.state === "running") ?? instances[0] ?? null, [instances]);
  const overviewInstanceCanStart = Boolean(overviewInstance && canOperate && overviewInstance.nodeStatus === "online"
    && (settings.minecraftRuntime.minecraftExecutionMode !== "appcontainer" || overviewInstance.sandboxAvailable)
    && ["stopped", "error"].includes(overviewInstance.state));
  const overviewInstanceCanStop = Boolean(overviewInstance && canOperate && overviewInstance.nodeStatus === "online"
    && ["running", "starting"].includes(overviewInstance.state));
  const overviewInstanceCanRestart = Boolean(overviewInstance && canOperate && overviewInstance.nodeStatus === "online"
    && overviewInstance.state === "running");
  useEffect(()=>{if(section==="java")onNavigate(`/games/environments?return=overview`);},[section,onNavigate]);
  const currentSection = standaloneLogs ? "logs" : section === "overview" || section === "nodes" || section === "deployment" || section === "instances" || section === "java" || section === "tasks" || section === "workflows" || section === "connectivity" ? section : detailMatch ? "instances" : "overview";
  const visibleInstances = useMemo(() => {
    const query = instanceSearch.trim().toLocaleLowerCase();
    return instances.filter((instance) => (instanceStateFilter === "all" || instance.state === instanceStateFilter)
      && (!query || `${instance.name} ${instance.coreType} ${instance.releaseId} ${instance.nodeName}`.toLocaleLowerCase().includes(query)));
  }, [instances, instanceSearch, instanceStateFilter]);
  const instanceStateCounts = useMemo(() => instances.reduce<Partial<Record<MinecraftInstance["state"], number>>>((counts, instance) => {
    counts[instance.state] = (counts[instance.state] ?? 0) + 1;
    return counts;
  }, {}), [instances]);
  const latestFailedTaskByNode = useMemo(() => {
    const failedTasks = [...tasks].filter((task) => task.status === "failed").sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
    const latestByNode = new Map<string, MinecraftTask>();
    for (const task of failedTasks) if (!latestByNode.has(task.nodeId)) latestByNode.set(task.nodeId, task);
    return latestByNode;
  }, [tasks]);
  const taskStatusCounts = useMemo(() => {
    const counts: Record<MinecraftTask["status"], number> = { queued: 0, running: 0, succeeded: 0, failed: 0 };
    for (const task of tasks) counts[task.status] += 1;
    return counts;
  }, [tasks]);
  const visibleTasks = useMemo(() => taskStatusFilter === "all" ? tasks : tasks.filter(task => task.status === taskStatusFilter), [taskStatusFilter, tasks]);
  const taskStatusFilterLabel = taskStatusFilter === "all" ? "全部" : ({ queued: "排队中", running: "执行中", succeeded: "已完成", failed: "失败" } as const)[taskStatusFilter];
  const detailTask = taskDetails?.task ?? tasks.find((task) => task.id === taskDetailId) ?? null;
  const detailNode = detailTask ? nodes.find((node) => node.id === detailTask.nodeId) : null;
  const firstProblemLog = taskDetails ? taskProblemLog(taskDetails.logs) : null;
  const snapshotPoller = useRef<ReturnType<typeof createReadPoller> | null>(null);
  const readSnapshot = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const controller = new AbortController();
    snapshotAbortController.current = controller;
    snapshotReadInFlight.current = true;
    initialSnapshotReadScheduled.current = false;
    setRefreshError(null);
    const isCurrent = () => mounted.current && sequence === refreshSequence.current;
    const overviewRequest = loadMinecraftOverview(controller.signal).then((value) => { if (isCurrent()) setOverview(value.overview); return value; });
    const nodesRequest = loadMinecraftNodes(controller.signal).then((value) => { if (isCurrent()) { setNodes(value.nodes); setNodesLoaded(true); } return value; });
    const instancesRequest = loadMinecraftInstances(controller.signal).then((value) => { if (isCurrent()) setInstances(value.instances); return value; });
    const criticalRequests = Promise.allSettled([overviewRequest, nodesRequest, instancesRequest]);
    let contentReady = false;
    const markContentReady = () => {
      if (!isCurrent()) return;
      setLoading(false);
      if (!contentReadyNotified.current && !contentReady) {
        contentReady = true;
        contentReadyNotified.current = true;
        onContentReady(true);
      }
    };
    try {
      const criticalResults = await criticalRequests;
      if (!isCurrent()) return;
      const criticalFailure = criticalResults.find((result) => result.status === "rejected");
      if (criticalFailure?.status === "rejected") setRefreshError(getErrorMessage(criticalFailure.reason));
      markContentReady();

      const javaRequest = loadMinecraftJava(controller.signal).then((value) => { if (isCurrent()) { setJavaNodes(value.nodes); setJavaNodesLoaded(true); } return value; });
      const tasksRequest = loadMinecraftTasks(controller.signal).then((value) => { if (isCurrent()) { setTasks(value.tasks); setTasksLoaded(true); } return value; });
      const deploymentsRequest = loadMinecraftDeployments(controller.signal).then((value) => { if (isCurrent()) { setDeployments(value.deployments); setDeploymentsLoaded(true); } return value; });
      const allRequests = Promise.allSettled([overviewRequest, nodesRequest, javaRequest, instancesRequest, tasksRequest, deploymentsRequest]);
      const results = await allRequests;
      if (!isCurrent()) return;
      const failures = results.flatMap((result) => result.status === "rejected" ? [getErrorMessage(result.reason)] : []);
      setRefreshError(failures[0] ?? null);
      if (results.every((result) => result.status === "fulfilled")) {
        const [overviewResult, nodesResult, javaResult, instancesResult, tasksResult, deploymentsResult] = results;
        if (overviewResult.status === "fulfilled" && nodesResult.status === "fulfilled" && javaResult.status === "fulfilled"
          && instancesResult.status === "fulfilled" && tasksResult.status === "fulfilled" && deploymentsResult.status === "fulfilled") {
          const refreshedAt = new Date().toISOString();
          setLastRefreshedAt(refreshedAt);
          minecraftWorkspaceSnapshots.set(snapshotKey, {
            overview: overviewResult.value.overview,
            nodes: nodesResult.value.nodes,
            javaNodes: javaResult.value.nodes,
            instances: instancesResult.value.instances,
            tasks: tasksResult.value.tasks,
            deployments: deploymentsResult.value.deployments,
            refreshedAt,
          });
          lastSnapshotReadAt.current = Date.now();
        }
      }
    } finally {
      snapshotReadInFlight.current = false;
      if (snapshotAbortController.current === controller) snapshotAbortController.current = null;
    }
  }, [onContentReady, snapshotKey]);
  const refresh = useCallback(() => snapshotPoller.current?.refresh() ?? Promise.resolve(), []);
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;
  const requestPropertiesRead = useCallback(async () => {
    const instanceId = selectedInstance?.id;
    if (!instanceId) return;
    propertyReadAttemptedFor.current = instanceId;
    setPropertyReadLoading(true);
    setPropertyReadError(null);
    try {
      const { task } = await readMinecraftServerProperties(instanceId);
      handledPropertyReadTask.current = null;
      setPropertyReadTaskId(task.id);
      void refresh();
    } catch (error) {
      setPropertyReadError(getErrorMessage(error));
      setPropertyReadLoading(false);
    }
  }, [refresh, selectedInstance?.id]);
  const updatePropertyDraft = useCallback((key: string, value: string, sensitive = false) => {
    setPropertyDraft((current) => ({ ...current, [key]: value }));
    if (sensitive) setTouchedSensitiveProperties((current) => new Set(current).add(key));
  }, []);

  const reconnectRealtime = useCallback(() => {
    setRealtimeStatus("reconnecting");
    realtimeSocket.current?.connect();
  }, []);

  useEffect(() => {
    mounted.current = true;
    if (cachedSnapshot) onContentReady(true);
    const cachedAt = cachedSnapshot ? Date.parse(cachedSnapshot.refreshedAt) : Number.NaN;
    const cacheAgeMs = Number.isFinite(cachedAt) ? Math.max(0, Date.now() - cachedAt) : Number.POSITIVE_INFINITY;
    const initialDelayMs = cacheAgeMs < MINECRAFT_SNAPSHOT_FRESHNESS_MS ? MINECRAFT_SNAPSHOT_FRESHNESS_MS - cacheAgeMs : 0;
    initialSnapshotReadScheduled.current = initialDelayMs === 0;
    const poller = createReadPoller(readSnapshot, () => realtimeStatusRef.current === "connected"
      ? MINECRAFT_CONNECTED_RECONCILE_INTERVAL_MS
      : MINECRAFT_DISCONNECTED_RECONCILE_INTERVAL_MS, { initialDelayMs });
    snapshotPoller.current = poller;
    return () => {
      mounted.current = false;
      refreshSequence.current += 1;
      snapshotAbortController.current?.abort();
      snapshotAbortController.current = null;
      poller.stop();
      if (snapshotPoller.current === poller) snapshotPoller.current = null;
    };
  }, [cachedSnapshot, onContentReady, readSnapshot]);

  useEffect(() => {
    let alive = true;
    const socket = createMinecraftSocket();
    realtimeSocket.current = socket;
    const onConnect = () => {
      if (!alive) return;
      const reconnect = socketConnectedOnce.current;
      socketConnectedOnce.current = true;
      realtimeStatusRef.current = "connected";
      setRealtimeStatus("connected");
      const snapshotAgeMs = Date.now() - lastSnapshotReadAt.current;
      if (reconnect || (!initialSnapshotReadScheduled.current && !snapshotReadInFlight.current && snapshotAgeMs >= MINECRAFT_SNAPSHOT_FRESHNESS_MS)) {
        void refreshRef.current();
      }
      if (logTarget.current.view === "logs") readLogsRef.current?.();
    };
    const onDisconnect = () => {
      if (alive) {
        const status = socket.active ? "reconnecting" : "disconnected";
        realtimeStatusRef.current = status;
        setRealtimeStatus(status);
        if (logTarget.current.view === "logs") readLogsRef.current?.();
      }
    };
    const onConnectError = () => {
      if (alive) { const status = socket.active ? "reconnecting" : "disconnected"; realtimeStatusRef.current = status; setRealtimeStatus(status); }
    };
    const onReconnectAttempt = () => {
      if (alive) { realtimeStatusRef.current = "reconnecting"; setRealtimeStatus("reconnecting"); }
    };
    const onReconnectFailed = () => {
      if (alive) { realtimeStatusRef.current = "disconnected"; setRealtimeStatus("disconnected"); }
    };
    const onMinecraftChange = (change: MinecraftRealtimeChange) => {
      if (!alive) return;
      if (change.scopes.includes("state") || change.scopes.includes("tasks")) void refreshRef.current();
      if (logTarget.current.view === "logs" && change.scopes.includes("logs") && (!change.instanceId || change.instanceId === logTarget.current.instanceId)) {
        readLogsRef.current?.();
      }
    };

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("connect_error", onConnectError);
    socket.on("minecraft:changed", onMinecraftChange);
    socket.io.on("reconnect_attempt", onReconnectAttempt);
    socket.io.on("reconnect_failed", onReconnectFailed);
    socket.connect();
    return () => {
      alive = false;
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("connect_error", onConnectError);
      socket.off("minecraft:changed", onMinecraftChange);
      socket.io.off("reconnect_attempt", onReconnectAttempt);
      socket.io.off("reconnect_failed", onReconnectFailed);
      socket.disconnect();
      if (realtimeSocket.current === socket) realtimeSocket.current = null;
    };
  }, []);

  useEffect(() => {
    if (detailView !== "logs" || !selectedLogInstanceId) {
      setLogs([]);
      setLogsInstanceId("");
      setLogsLoaded(true);
      return;
    }
    let alive = true;
    let initialReadPending = true;
    const controller = new AbortController();
    setLogs([]);
    setLogsInstanceId("");
    setLogsLoaded(false);
    const readLogs = () => loadMinecraftInstanceLogs(selectedLogInstanceId, controller.signal).then((result) => { if (alive) { setLogs(result.logs); setLogsInstanceId(selectedLogInstanceId); } }).catch((error: unknown) => { if (alive) setActionError(getErrorMessage(error)); }).finally(() => {
      if (alive && initialReadPending) {
        initialReadPending = false;
        setLogsLoaded(true);
      }
    });
    const poller = createReadPoller(readLogs, () => realtimeStatusRef.current === "connected"
      ? MINECRAFT_LOG_CONNECTED_RECONCILE_INTERVAL_MS
      : MINECRAFT_LOG_DISCONNECTED_RECONCILE_INTERVAL_MS);
    const trigger = () => { void poller.refresh(); };
    readLogsRef.current = trigger;
    return () => { alive = false; controller.abort(); if (readLogsRef.current === trigger) readLogsRef.current = null; poller.stop(); };
  }, [detailView, selectedLogInstanceId]);

  useEffect(() => {
    setPropertyDraft(Object.fromEntries((propertySnapshot?.entries ?? []).map((entry) => [entry.key, entry.sensitive ? "" : entry.value ?? ""])));
    setTouchedSensitiveProperties(new Set());
    setPropertySearch("");
  }, [selectedInstance?.id, propertySnapshot?.observedAt]);

  useEffect(() => {
    if (detailView !== "configuration") {
      propertyReadAttemptedFor.current = null;
      return;
    }
    if (!selectedInstance || independentCoreConfiguration || propertySnapshot || !canOperate || !tasksLoaded) return;
    if (selectedInstance.nodeStatus !== "online") {
      setPropertyReadLoading(false);
      setPropertyReadError("实例所在节点未连接。节点上线后会读取真实 server.properties 文件。");
      return;
    }
    if (!selectedInstanceSupportsPropertiesFile) return;
    if (propertyReadAttemptedFor.current === selectedInstance.id) return;
    propertyReadAttemptedFor.current = selectedInstance.id;
    const activeRead = tasks.find((task) => task.instanceId === selectedInstance.id && task.kind === "properties-read" && (task.status === "queued" || task.status === "running"));
    if (activeRead) {
      setPropertyReadTaskId(activeRead.id);
      setPropertyReadLoading(true);
    } else {
      void requestPropertiesRead();
    }
  }, [canOperate, detailView, independentCoreConfiguration, propertySnapshot, requestPropertiesRead, selectedInstance, selectedInstanceSupportsPropertiesFile, tasks, tasksLoaded]);

  useEffect(() => {
    const task = tasks.find((item) => item.id === propertyReadTaskId);
    if (!task || task.status === "queued" || task.status === "running" || handledPropertyReadTask.current === task.id) return;
    handledPropertyReadTask.current = task.id;
    if (task.status === "failed") {
      setPropertyReadError(task.message || "节点读取 server.properties 失败。");
      setPropertyReadLoading(false);
      return;
    }
    setPropertyReadError(null);
    void refresh().finally(() => setPropertyReadLoading(false));
  }, [propertyReadTaskId, refresh, tasks]);

  const showActionFeedback = useCallback((feedback: MinecraftActionFeedback) => {
    setActionNotice(null);
    if (settings.general.notificationPopupsEnabled) {
      const durationSeconds = settings.general.notificationToastDurationSeconds;
      setActionToast({
        id: ++actionToastSequence.current,
        message: feedback.message,
        showTasksLink: feedback.showTasksLink,
        expiresAt: Date.now() + durationSeconds * 1_000,
      });
      setActionToastSeconds(durationSeconds);
      playNotificationSound(settings.general.notificationSound);
      return;
    }
    setActionToast(null);
    setActionNotice(feedback.showTasksLink
      ? `${feedback.message} 可在 Minecraft“任务”中查看进度。`
      : feedback.message);
  }, [settings.general.notificationPopupsEnabled, settings.general.notificationSound, settings.general.notificationToastDurationSeconds]);

  const submitAction = useCallback(async (
    operation: () => Promise<unknown>,
    feedback: MinecraftActionFeedback = { message: "操作已提交。", showTasksLink: true },
  ): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    setActionToast(null);
    try {
      await operation();
      showActionFeedback(feedback);
      void refresh();
      return true;
    } catch (error) {
      setActionError(getErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }, [refresh, showActionFeedback]);

  const actionToastId = actionToast?.id ?? null;
  useEffect(() => {
    if (actionToastId === null || !actionToast) return;
    const updateCountdown = () => {
      const remainingSeconds = Math.max(0, Math.ceil((actionToast.expiresAt - Date.now()) / 1000));
      setActionToastSeconds(remainingSeconds);
      if (remainingSeconds === 0) setActionToast((current) => current?.id === actionToastId ? null : current);
    };
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [actionToastId, actionToast]);

  useEffect(() => {
    if (!settings.general.notificationPopupsEnabled) setActionToast(null);
  }, [settings.general.notificationPopupsEnabled]);

  const openActionToastTasks = useCallback(() => {
    setActionToast(null);
    onNavigate("/games/minecraft/tasks");
  }, [onNavigate]);

  useEffect(() => () => {
    taskDetailSequence.current += 1;
    taskDetailAbortController.current?.abort();
    taskDetailAbortController.current = null;
  }, []);

  const openTaskDetails = useCallback(async (taskId: string) => {
    const sequence = ++taskDetailSequence.current;
    taskDetailAbortController.current?.abort();
    const controller = new AbortController();
    taskDetailAbortController.current = controller;
    setTaskDetailId(taskId);
    setTaskDetails(null);
    setTaskDetailError(null);
    setTaskDetailLoading(true);
    try {
      const details = await loadMinecraftTaskDetails(taskId, controller.signal);
      if (taskDetailSequence.current === sequence) setTaskDetails(details);
    } catch (error) {
      if (taskDetailSequence.current === sequence) setTaskDetailError(getErrorMessage(error));
    } finally {
      if (taskDetailSequence.current === sequence) setTaskDetailLoading(false);
      if (taskDetailAbortController.current === controller) taskDetailAbortController.current = null;
    }
  }, []);

  const closeTaskDetails = useCallback(() => {
    taskDetailSequence.current += 1;
    setTaskDetailId(null);
    setTaskDetails(null);
    setTaskDetailError(null);
    setTaskDetailLoading(false);
  }, []);

  useEffect(() => {
    if (currentSection !== "tasks" && taskDetailId) closeTaskDetails();
  }, [closeTaskDetails, currentSection, taskDetailId]);

  const removeTaskRecords = useCallback(async (taskIds: string[]): Promise<boolean> => {
    const succeeded = await submitAction(() => deleteMinecraftTaskRecords(taskIds), {
      message: `已删除 ${taskIds.length} 条终态任务记录及其关联节点日志；Minecraft 实例和部署登记已保留。`,
      showTasksLink: false,
    });
    if (succeeded) {
      if (taskDetailId && taskIds.includes(taskDetailId)) closeTaskDetails();
    }
    return succeeded;
  }, [closeTaskDetails, submitAction, taskDetailId]);

  const openRegisterModal = (deploymentId: string) => {
    const deployment = deployments.find((item) => item.id === deploymentId);
    const nodeRuntimes = deployment
      ? javaNodes.find((node) => node.nodeId === deployment.nodeId)?.runtimes
        ?? nodes.find((node) => node.id === deployment.nodeId)?.javaRuntimes
        ?? []
      : [];
    const compatibleRuntimes = deployment ? nodeRuntimes.filter((runtime) => runtime.major === deployment.javaMajor) : [];
    const supportsJavaSelection = nodes.find((node) => node.id === deployment?.nodeId)?.capabilities.includes("minecraft-java-runtime-selection-v1") ?? false;
    const preferredRuntime = supportsJavaSelection ? compatibleRuntimes.find((runtime) => !runtime.managed) : null;
    setRegisterDeploymentId(deploymentId);
    setRegisterJavaRuntimeId(preferredRuntime?.runtimeId ?? "");
    setEulaAccepted(false);
    setRegisterModalOpen(true);
  };

  const submitRegisterDeployment = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!registerDeploymentId || !memoryMb || !eulaAccepted) return;
    void submitAction(() => registerMinecraftDeployment(registerDeploymentId, { memoryMb, eulaAccepted: true, javaRuntimeId: registerJavaRuntimeId || null }), {
      message: "部署注册任务已提交。",
      showTasksLink: true,
    }).then((created) => {
      if (created) setRegisterModalOpen(false);
    });
  };

  const retryDeployment = (deploymentId: string) => {
    void submitAction(() => retryMinecraftDeployment(deploymentId), { message: "部署重试任务已提交。", showTasksLink: true });
  };

  const instanceAction = (action: "start" | "stop" | "backup" | "restart") => {
    if (!selectedInstance) return;
    void submitAction(() => runMinecraftInstanceAction(selectedInstance.id, action), { message: `${taskLabel(action)}任务已提交。`, showTasksLink: true });
  };

  const deleteInstance = (instance: MinecraftInstance) => {
    void submitAction(() => deleteMinecraftInstance(instance.id), {
      message: `已提交“${instance.name}”的归档删除任务；节点完成归档后会移除实例登记。`,
      showTasksLink: true,
    });
  };

  const saveProperties = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInstance || !propertySnapshot || !Object.keys(propertyEditorState.changed).length) return;
    void submitAction(async () => {
      await saveMinecraftServerFileProperties(selectedInstance.id, propertyEditorState.changed);
    }, { message: "配置写入任务已提交。", showTasksLink: true });
  };

  const selectedInstanceCanStart = Boolean(selectedInstance && canOperate
    && selectedInstance.nodeStatus === "online"
    && (settings.minecraftRuntime.minecraftExecutionMode !== "appcontainer" || selectedInstance.sandboxAvailable)
    && ["stopped", "error"].includes(selectedInstance.state));
  const selectedInstanceCanStop = Boolean(selectedInstance && canOperate
    && selectedInstance.nodeStatus === "online"
    && ["running", "starting"].includes(selectedInstance.state));
  const selectedInstanceCanRestart = Boolean(selectedInstance && canOperate
    && selectedInstance.nodeStatus === "online"
    && selectedInstance.state === "running");
  const selectedInstanceHasActiveTask = Boolean(selectedInstance && tasks.some(task => task.instanceId === selectedInstance.id && (task.status === "queued" || task.status === "running")));
  const selectedInstanceCanEditJvm = Boolean(selectedInstance && canOperate && tasksLoaded && !selectedInstanceHasActiveTask
    && selectedInstance.nodeStatus === "online" && (selectedInstance.coreType !== "PocketMine")
    && ["stopped", "error"].includes(selectedInstance.state));
  const isInstanceConsole = Boolean(selectedInstance && detailView === "terminal");
  const pageTitle = currentSection === "overview" ? "Minecraft 服务器" : currentSection === "nodes" ? "运行设备" : currentSection === "deployment" ? "部署" : currentSection === "instances" ? "服务器列表" : currentSection === "java" ? "Java 环境" : currentSection === "connectivity" ? "世界联机" : currentSection === "workflows" ? "工作流" : currentSection === "logs" ? "服务端日志" : "任务";
  const pageDescription = selectedInstance
    ? detailView === "terminal" || detailView === "overview" ? ""
        : `Minecraft ${selectedInstance.releaseId} · ${selectedInstance.nodeName}`
    : currentSection === "logs"
      ? selectedLogInstance ? `${selectedLogInstance.name} · ${selectedLogInstance.coreType} ${selectedLogInstance.releaseId}` : "选择一个实例查看日志。"
      : currentSection === "overview"
        ? "开服、管理运行设备和服务器状态。"
      : currentSection === "nodes"
        ? "设备连接与服务端能力。"
        : currentSection === "deployment"
        ? "新建服务器并跟踪部署。"
          : currentSection === "instances"
            ? "查找并管理服务器实例。"
            : currentSection === "tasks"
              ? "部署、实例与 Java 任务。"
              : currentSection === "connectivity"
                ? ""
                : currentSection === "workflows"
                  ? "编排可重复运行的 Minecraft 操作。"
                : "Java 运行环境状态来自 LFAA 控制端与本机 Daemon。";

  if (loading) return <div className="minecraft-loading" role="status" aria-label="Minecraft 管理工作台加载中"><Spin size="large" /><span>正在读取 Minecraft 主机与实例状态…</span></div>;

  return (
    <ConfigProvider theme={{ token: { fontSize: settings.appearance.advanced.interfaceFontSize } }}>
    <section className={`minecraft-workspace minecraft-workspace--${currentSection}${isInstanceConsole ? " minecraft-workspace--instance-console" : ""}`} data-section={currentSection} aria-labelledby="minecraft-page-title">
      <header className={`minecraft-page-heading${selectedInstance ? " minecraft-page-heading--instance" : ""}`}>
        <div className="minecraft-page-heading__copy">
          <Typography.Title id="minecraft-page-title" level={2}>{isInstanceConsole ? "控制台" : selectedInstance ? detailView === "overview" ? "实例概览" : selectedInstance.name : pageTitle}</Typography.Title>
          {selectedInstance ? <div className="minecraft-page-heading__description-slot" aria-hidden={!pageDescription}>
            <Typography.Paragraph className={pageDescription ? undefined : "minecraft-page-heading__description-placeholder"} title={pageDescription || undefined}>{pageDescription || "\u00a0"}</Typography.Paragraph>
          </div> : pageDescription ? <Typography.Paragraph>{pageDescription}</Typography.Paragraph> : null}
        </div>
        <Space className="minecraft-page-heading__controls" size="small" wrap>
          {currentSection === "logs" ? <Select aria-label="选择日志实例" placeholder="选择实例" value={selectedLogInstance?.id ?? undefined} onChange={(instanceId: string) => { setLogInstanceSelection(instanceId); onNavigate(getInstanceRoute(instanceId, "logs")); }} disabled={!instances.length} options={instances.map((instance) => ({ value: instance.id, label: `${instance.name} · ${instance.coreType} ${instance.releaseId}` }))} /> : null}
          {!isInstanceConsole ? <Tag role="status" aria-live="polite" color={realtimeStatusColor(realtimeStatus)}>{currentSection === "connectivity" ? `控制端 · ${realtimeStatusLabel(realtimeStatus)}` : realtimeStatusLabel(realtimeStatus)}</Tag> : null}
          {currentSection === "overview" && !selectedInstance ? <Button type={overviewInstance ? "default" : "primary"} onClick={() => onNavigate("/games/minecraft/deployment")}>{overviewInstance ? "新建服务器" : "开始开服"}</Button> : null}
          {currentSection === "instances" && !selectedInstance ? <Button type="primary" onClick={() => onNavigate(`${minecraftRoot}/deployment`)}>新建服务器</Button> : null}
          {isInstanceConsole && selectedInstance ? <>
            {selectedInstance.state === "stopped" || selectedInstance.state === "error" ? <Button type="primary" disabled={!selectedInstanceCanStart} loading={busy} onClick={() => instanceAction("start")}>启动实例</Button> : null}
            {["running", "starting"].includes(selectedInstance.state) ? <Popconfirm title={`安全停止“${selectedInstance.name}”？`} description="Daemon 会向服务端发送正常停止指令，并按设置中心的停服时限等待退出。" okText="安全停止" cancelText="取消" onConfirm={() => instanceAction("stop")}>
              <Button danger disabled={!selectedInstanceCanStop} loading={busy}>安全停止</Button>
            </Popconfirm> : null}
            {selectedInstance.state === "running" ? <Button disabled={!selectedInstanceCanRestart} loading={busy} onClick={() => instanceAction("restart")}>安全重启</Button> : null}
          </> : null}
          {currentSection === "overview" ? <span className="minecraft-overview-sync">{lastRefreshedAt ? `同步于 ${timeLabel(lastRefreshedAt)}` : "等待首次同步"}</span> : null}
          {realtimeStatus !== "connected" ? <Button size="small" onClick={reconnectRealtime}>重新连接</Button> : null}
          <Button onClick={() => void refresh()}>刷新状态</Button>
        </Space>
      </header>
      {refreshError ? <Alert className="minecraft-alert" type="warning" showIcon message="部分 Minecraft 数据暂时无法读取" description={refreshError} /> : null}
      {actionError ? <Alert className="minecraft-alert" type="error" showIcon closable onClose={() => setActionError(null)} message={actionError} /> : null}
      {actionNotice ? <Alert className="minecraft-alert" type="success" showIcon closable onClose={() => setActionNotice(null)} message={actionNotice} role="status" /> : null}
      {actionToast && settings.general.notificationPopupsEnabled ? <aside
        key={actionToast.id}
        className="minecraft-action-toast"
        data-toast-effect={settings.general.notificationToastEffect}
        role="status"
        aria-live="polite"
        aria-atomic="true"
        aria-label={actionToast.showTasksLink ? "Minecraft 操作已提交" : "Minecraft 操作已完成"}
      >
        {actionToast.showTasksLink ? <button className="minecraft-action-toast__open" type="button" onClick={openActionToastTasks} aria-label="查看 Minecraft 任务">
          <span className="minecraft-action-toast__copy">
            <strong>操作已提交</strong>
            <span>{actionToast.message}</span>
            <small>点击查看任务</small>
          </span>
        </button> : <div className="minecraft-action-toast__message">
          <strong>操作已完成</strong>
          <span>{actionToast.message}</span>
        </div>}
        <button className="minecraft-action-toast__close" type="button" aria-label="关闭 Minecraft 操作提示" onClick={() => setActionToast(null)}>关闭</button>
        <div className="minecraft-action-toast__countdown" aria-hidden="true">{actionToastSeconds} 秒后自动收起</div>
      </aside> : null}

      {!selectedInstance && currentSection === "connectivity" ? <MinecraftConnectivityPanel onOpenConnectivity={onOpenConnectivity} /> : null}

      {selectedInstance ? <>
        <nav className="minecraft-instance-tabs" aria-label="Minecraft 实例菜单">
          {([ ["overview", "实例概览"], ["configuration", "服务器配置"], ["terminal", "控制台"], ["backup", "世界备份"] ] as const).map(([view, label]) => <button key={view} type="button" aria-current={detailView === view ? "page" : undefined} onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, view))}>{label}</button>)}
        </nav>
        {detailView === "overview" ? <div className="minecraft-instance-overview lfaa-card-motion-list">
          <section className="minecraft-instance-hero lfaa-card-motion" aria-labelledby="minecraft-instance-hero-title">
            <div className="minecraft-instance-hero__art" aria-hidden="true"><img src="/backgrounds/cherry-blossom-waterfront.png" alt="" loading="lazy" decoding="async" /></div>
            <div className="minecraft-instance-hero__content">
              <div className="minecraft-instance-hero__heading">
                <div className="minecraft-instance-hero__identity">
                  <div className="minecraft-instance-hero__title"><Typography.Title id="minecraft-instance-hero-title" level={3}>{selectedInstance.name}</Typography.Title><Tag color={selectedInstance.state === "running" ? "green" : selectedInstance.state === "error" ? "red" : selectedInstance.state === "unknown" ? "orange" : "default"}>{stateLabel(selectedInstance.state)}</Tag></div>
                  <Typography.Text type="secondary">{selectedInstance.coreType} · Minecraft {selectedInstance.releaseId}</Typography.Text>
                </div>
                <div className="minecraft-instance-hero__actions" aria-label={`${selectedInstance.name} 实例操作`}>
                  <Button type="primary" disabled={!selectedInstanceCanStart} loading={busy} onClick={() => instanceAction("start")}>启动</Button>
                  <Popconfirm title={`安全停止“${selectedInstance.name}”？`} description="Daemon 会向服务端发送正常停止指令，并按设置中心的停服时限等待退出。" okText="安全停止" cancelText="取消" disabled={!selectedInstanceCanStop} onConfirm={() => instanceAction("stop")}><Button danger disabled={!selectedInstanceCanStop} loading={busy}>安全停止</Button></Popconfirm>
                  <Button disabled={!selectedInstanceCanRestart} loading={busy} onClick={() => instanceAction("restart")}>安全重启</Button>
                  <Button onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, "terminal"))}>进入控制台</Button>
                  <Button onClick={() => navigateToInstanceFiles(userId, selectedInstance.id, onNavigate)}>打开实例文件</Button>
                </div>
              </div>
              <dl className="minecraft-instance-hero__facts">
                <div><dt>运行节点</dt><dd>{selectedInstance.nodeName}<Tag color={selectedInstance.nodeStatus === "online" ? "green" : "default"}>{selectedInstance.nodeStatus === "online" ? "在线" : "离线"}</Tag></dd></div>
                <div><dt>服务端口</dt><dd>{selectedInstance.serverProperties.serverPort ?? "未配置"}</dd></div>
                <div><dt>运行配置</dt><dd>{selectedInstance.coreType === "PocketMine" ? "官方 PHP" : `Java ${selectedInstance.javaMajor} · ${selectedInstance.memoryMb} MB`}</dd></div>
              </dl>
            </div>
          </section>
          {selectedInstance.coreType === "PocketMine" ? <Alert type="info" showIcon message="PocketMine 使用 PHP，不适用 JVM 参数。" /> : <MinecraftJvmSettings
              key={selectedInstance.id}
              instance={selectedInstance}
              javaLabel={selectedInstance.javaRuntimeId === null
                ? "节点自动管理"
                : selectedInstanceJavaRuntime
                  ? `${selectedInstanceJavaRuntime.vendor} ${selectedInstanceJavaRuntime.major}`
                  : selectedInstance.javaRuntimeId}
              canEdit={selectedInstanceCanEditJvm}
              busy={busy}
              onRefresh={() => { void refresh(); }}
              onSave={async (value) => {
                return submitAction(() => setMinecraftInstanceJvmConfiguration(selectedInstance.id, value), {
                  message: "JVM 参数已保存，将在下次启动时应用。",
                  showTasksLink: false,
                });
              }}
            />}
          {settings.minecraftRuntime.minecraftExecutionMode === "appcontainer" && !selectedInstance.sandboxAvailable ? <Alert type="error" showIcon message="当前选择 AppContainer，但节点沙盒不可用。可在设置中心选择推荐的本机原生执行。" /> : null}
        </div> : null}
        {detailView === "configuration" && independentCoreConfiguration ? <Alert type="info" showIcon message="此核心使用独立配置格式" description="请通过节点文件管理修改真实配置；停止实例后再修改。" /> : null}
        {detailView === "configuration" && !independentCoreConfiguration ? <Card className="minecraft-card minecraft-config-card">
          <div className="minecraft-config-heading"><div><Typography.Title level={4}>server.properties</Typography.Title><Typography.Paragraph type="secondary">编辑节点文件中真实存在的属性；敏感值默认隐藏，可输入新值或移除该项。</Typography.Paragraph></div><Space wrap><Tag color={propertySnapshot ? "success" : "default"}>{propertySnapshot ? `节点文件 · ${timeLabel(propertySnapshot.observedAt)}` : "尚无文件快照"}</Tag><Button size="small" loading={propertyReadLoading} disabled={!canOperate || propertyReadLoading || selectedInstance.nodeStatus !== "online" || !selectedInstanceSupportsPropertiesFile} onClick={() => void requestPropertiesRead()}>{propertySnapshot ? "重新读取文件" : "读取节点文件"}</Button></Space></div>
          {propertyReadError ? <Alert className="minecraft-property-read-alert" type="error" showIcon message="没有取得节点文件快照" description={propertyReadError} /> : null}
          {!selectedInstanceSupportsPropertiesFile && selectedInstance.nodeStatus === "online" ? <Alert className="minecraft-property-read-alert" type="info" showIcon message="节点需要更新后才能读取真实配置" description="目标 Daemon 尚未报告 server.properties 安全回读能力。更新并重启节点后，页面会读取文件，不再用 Minecraft 默认值代填。" /> : null}
          {!propertySnapshot ? <div className="minecraft-property-empty" role="status">{propertyReadLoading ? <><Spin size="small" /><span>正在通过节点任务读取 server.properties…</span></> : canOperate ? <span>读取完成前不会显示或保存配置项。</span> : <span>当前账户为只读角色，尚无快照时请管理员读取节点文件。</span>}</div> : <>
            <div className="minecraft-property-toolbar">
              <Input allowClear value={propertySearch} onChange={(event) => setPropertySearch(event.target.value)} placeholder="搜索属性名" aria-label="搜索 server.properties 属性" />
              <Typography.Text type="secondary">显示 {propertyEditorState.visible} / {propertyEditorState.total} 项 · {Object.keys(propertyEditorState.changed).length} 项待保存</Typography.Text>
            </div>
            {propertyEditorState.total ? <form className="minecraft-property-form" onSubmit={saveProperties}>
              <div className="minecraft-property-sections">
                {propertyEditorState.columns.map((column, columnIndex) => <div className="minecraft-property-column" key={`property-column-${columnIndex}`}>
                  {column.map((section) => <section className="minecraft-property-group" key={section.title}>
                    <header><Typography.Title level={5}>{section.title}</Typography.Title><Typography.Text type="secondary">{section.entries.length} 项</Typography.Text></header>
                    <div className="minecraft-property-fields">
                      {section.entries.map((entry) => {
                        const value = propertyDraft[entry.key] ?? "";
                        const options = entry.sensitive ? null : minecraftPropertyOptions(entry.key, entry.value);
                        const label = minecraftPropertyLabel(entry.key);
                        const numeric = !entry.sensitive && !options && minecraftNumericPropertyKeys.has(entry.key) && /^-?\d+(?:\.\d+)?$/u.test(value);
                        return <label className="minecraft-property-field" key={entry.key}>
                          <span className="minecraft-property-field__label">{label}{entry.sensitive ? <Tag>敏感值</Tag> : null}</span>
                          <code className="minecraft-property-field__key">{entry.key}</code>
                          {entry.sensitive
                            ? <span className="minecraft-property-field__sensitive-control"><Input.Password aria-label={entry.key} autoComplete="new-password" maxLength={4096} placeholder="输入新值；留空保持当前值" value={value} onChange={(event) => updatePropertyDraft(entry.key, event.target.value, true)} /><Button type="link" size="small" disabled={!canOperate || selectedInstance.state !== "stopped"} onClick={() => { setPropertyDraft((current) => ({ ...current, [entry.key]: "" })); setTouchedSensitiveProperties((current) => new Set(current).add(entry.key)); }}>移除</Button></span>
                            : options
                              ? <Select value={value} options={options} onChange={(nextValue) => updatePropertyDraft(entry.key, nextValue)} />
                              : numeric
                                ? <InputNumber controls value={value === "" ? null : Number(value)} onChange={(nextValue) => { if (nextValue !== null) updatePropertyDraft(entry.key, String(nextValue)); }} />
                                : <Input maxLength={4096} value={value} onChange={(event) => updatePropertyDraft(entry.key, event.target.value)} />}
                        </label>;
                      })}
                    </div>
                  </section>)}
                </div>)}
              </div>
              {propertyEditorState.visible === 0 ? <Typography.Paragraph type="secondary">没有匹配的属性。</Typography.Paragraph> : null}
              <footer className="minecraft-property-actions">
                <Typography.Text type="secondary">{Object.keys(propertyEditorState.changed).length ? `待保存 ${Object.keys(propertyEditorState.changed).length} 项` : "配置与节点文件一致"}{selectedInstance.state !== "stopped" ? " · 停止实例后可保存" : ""}</Typography.Text>
                <Space wrap>
                  <Button htmlType="button" disabled={!Object.keys(propertyEditorState.changed).length} onClick={() => { setPropertyDraft(Object.fromEntries(propertySnapshot.entries.map((entry) => [entry.key, entry.sensitive ? "" : entry.value ?? ""]))); setTouchedSensitiveProperties(new Set()); }}>撤销更改</Button>
                  <Button type="primary" htmlType="submit" loading={busy} disabled={!canOperate || !Object.keys(propertyEditorState.changed).length || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"}>保存配置</Button>
                </Space>
              </footer>
            </form> : <Typography.Paragraph type="secondary">真实文件中暂无属性。</Typography.Paragraph>}
            <Typography.Text className="minecraft-property-source-note" type="secondary">快照来自 {selectedInstance.nodeName}。保存仅提交已更改属性，并保留文件中的其他内容。</Typography.Text>
          </>}
        </Card> : null}
        {detailView === "terminal" ? <div className="minecraft-console-layout">
            <div className="minecraft-server-terminal">
              <TerminalManagerDock placement="minecraft" appId="minecraft" sessionId={null} instance={{
                id: selectedInstance.id,
                name: selectedInstance.name,
                nodeId: selectedInstance.nodeId,
                nodeName: selectedInstance.nodeName,
                nodeStatus: selectedInstance.nodeStatus,
                state: selectedInstance.state,
                supportsConsole: selectedInstanceSupportsInteractiveConsole,
                software: `${selectedInstance.coreType} ${selectedInstance.releaseId}`,
                port: selectedInstance.serverProperties.serverPort ?? null,
                memoryLabel: selectedInstance.coreType === "PocketMine" ? "PHP 管理" : `${selectedInstance.memoryMb} MB`,
                quickCommands: selectedInstanceSupportsInteractiveConsole ? minecraftConsoleQuickCommands : []
              }} />
            </div>
        </div> : null}
        {detailView === "backup" && proxyInstance ? <Alert type="info" showIcon message="代理没有世界存档，请到后端实例备份。" /> : null}
        {detailView === "backup" && !proxyInstance ? <Card className="minecraft-card minecraft-backup-card"><Typography.Title level={4}>世界备份</Typography.Title><Typography.Paragraph>为保证存档一致性，当前 MVP 只允许备份已停止实例中的世界目录。备份保存在节点数据目录 `data/backups/minecraft/`，由 Daemon 实际执行。</Typography.Paragraph><Alert type="info" showIcon message="备份操作会复制世界文件；不会清理或覆盖现有世界。" /><Button type="primary" loading={busy} disabled={!canOperate || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"} onClick={() => instanceAction("backup")}>创建世界备份</Button>{selectedInstance.state !== "stopped" ? <Typography.Text type="secondary">请先安全停止实例，再创建备份。</Typography.Text> : null}</Card> : null}
      </> : null}

      {currentSection === "logs" ? selectedLogInstance ? <Card className="minecraft-card minecraft-instance-logs">
        <div className="minecraft-instance-logs__heading"><Typography.Text type="secondary">{instanceLogSnapshot.loaded ? `${instanceLogSnapshot.entries.length} 条` : "读取中"}</Typography.Text></div>
        <div className="minecraft-instance-logs__toolbar">
          <div className="minecraft-instance-logs__filters" role="group" aria-label="日志类型">
            {([ ["all", "全部"], ["stdout", "标准输出"], ["stderr", "错误"], ["system", "系统"] ] as const).map(([filter, label]) => <button key={filter} type="button" aria-pressed={instanceLogFilter === filter} className={instanceLogFilter === filter ? "is-active" : ""} onClick={() => setInstanceLogFilter(filter)}>{label}</button>)}
          </div>
          <Checkbox checked={instanceLogAutoScroll} onChange={(event) => setInstanceLogAutoScroll(event.target.checked)}>自动滚动</Checkbox>
        </div>
        <div ref={instanceLogViewport} className="minecraft-instance-logs__viewport" role="log" aria-live="off" aria-label={`${selectedLogInstance.name}服务端日志`}>
          {visibleInstanceLogs.length ? <ol>{visibleInstanceLogs.map(entry => <li key={entry.id} className={`minecraft-instance-logs__line is-${entry.stream}`}><time>{entry.time}</time>{entry.stream === "stdout" ? null : <span>[{entry.stream}]</span>}<code>{entry.text}</code></li>)}</ol>
            : <div className="minecraft-instance-logs__empty" role="status">{instanceLogSnapshot.loaded ? "暂无日志" : "正在读取日志…"}</div>}
        </div>
      </Card> : <div className="minecraft-empty" role="status">{routeLogInstanceId ? "该实例当前不存在或不可见。" : "还没有 Minecraft 实例。创建实例后即可查看服务端日志。"}</div> : null}

      {!selectedInstance && currentSection === "overview" ? <>
        <section className={`minecraft-overview-hero ${overviewInstance ? "minecraft-overview-hero--server" : "minecraft-overview-hero--launch"}`} aria-label={overviewInstance ? "当前 Minecraft 服务器" : "开服流程"}>
          {overviewInstance ? <>
            <div className="minecraft-overview-hero__copy">
              <div className="minecraft-overview-hero__title"><Typography.Title level={3}>{overviewInstance.name}</Typography.Title><Tag color={overviewInstance.state === "running" ? "green" : overviewInstance.state === "error" ? "red" : overviewInstance.state === "unknown" ? "orange" : "default"}>{stateLabel(overviewInstance.state)}</Tag></div>
              <div className="minecraft-world-route" aria-label={`运行节点 ${overviewInstance.nodeName}，${overviewInstance.nodeStatus === "online" ? "在线" : "离线"}，承载实例 ${overviewInstance.name}`}>
                <div className="minecraft-world-route__stop" data-status={overviewInstance.nodeStatus === "online" ? "online" : "offline"}>
                  <span className="minecraft-world-route__marker" aria-hidden="true" />
                  <span className="minecraft-world-route__label">运行节点</span>
                  <strong>{overviewInstance.nodeName}</strong>
                  <Tag color={overviewInstance.nodeStatus === "online" ? "green" : "default"}>{overviewInstance.nodeStatus === "online" ? "在线" : "离线"}</Tag>
                </div>
                <span className="minecraft-world-route__track" aria-hidden="true" />
                <div className="minecraft-world-route__stop" data-status={overviewInstance.state}>
                  <span className="minecraft-world-route__marker" aria-hidden="true" />
                  <span className="minecraft-world-route__label">Minecraft 实例</span>
                  <strong>此服务器</strong>
                  <Tag color={overviewInstance.state === "running" ? "green" : overviewInstance.state === "error" ? "red" : overviewInstance.state === "unknown" ? "orange" : "default"}>{stateLabel(overviewInstance.state)}</Tag>
                </div>
              </div>
              <div className="minecraft-overview-hero__facts">
                <span><small>端口</small><strong>{overviewInstance.serverProperties.serverPort ?? "未配置"}</strong></span>
                <span><small>最大内存</small><strong>{overviewInstance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${overviewInstance.memoryMb} MB`}</strong></span>
              </div>
            </div>
            <div className="minecraft-overview-hero__side">
              <div className="minecraft-overview-hero__actions" aria-label={`${overviewInstance.name} 快捷操作`}>
                {overviewInstanceCanStart ? <Button type="primary" loading={busy} onClick={() => void submitAction(() => runMinecraftInstanceAction(overviewInstance.id, "start"), { message: `${taskLabel("start")}任务已提交。`, showTasksLink: true })}>启动</Button> : null}
                {overviewInstanceCanStop ? <Popconfirm title={`安全停止“${overviewInstance.name}”？`} description="Daemon 会向服务端发送正常停止指令，并按设置中心的停服时限等待退出。" okText="安全停止" cancelText="取消" onConfirm={() => void submitAction(() => runMinecraftInstanceAction(overviewInstance.id, "stop"), { message: `${taskLabel("stop")}任务已提交。`, showTasksLink: true })}><Button danger loading={busy}>安全停止</Button></Popconfirm> : null}
                {overviewInstanceCanRestart ? <Button loading={busy} onClick={() => void submitAction(() => runMinecraftInstanceAction(overviewInstance.id, "restart"), { message: `${taskLabel("restart")}任务已提交。`, showTasksLink: true })}>安全重启</Button> : null}
                <Button onClick={() => onNavigate(getInstanceRoute(overviewInstance.id, "terminal"))}>终端</Button>
                <Button onClick={() => onNavigate(getInstanceRoute(overviewInstance.id, "overview"))}>管理实例</Button>
                <Button onClick={() => navigateToInstanceFiles(userId, overviewInstance.id, onNavigate)}>打开实例文件</Button>
              </div>
              <div className="minecraft-overview-hero__core" aria-label={`${overviewInstance.coreType} 核心，Minecraft ${overviewInstance.releaseId}`}>
                <span className="minecraft-overview-hero__core-mark" aria-hidden="true">
                  {overviewInstance.coreType === "Paper" ? <img src={paperCoreLogo} alt="" /> : <svg viewBox="0 0 32 32" focusable="false"><path d="m16 3 12 6.5v13L16 29 4 22.5v-13L16 3Z" /><path d="m4.5 9.75 11.5 6.2 11.5-6.2M16 16v12.5" /></svg>}
                </span>
                <span className="minecraft-overview-hero__core-copy"><strong>{overviewInstance.coreType}</strong><small>Minecraft {overviewInstance.releaseId}</small></span>
              </div>
            </div>
          </> : <div className="minecraft-overview-launch">
            <div className="minecraft-overview-launch__intro">
              <Typography.Title level={3}>还没有 Minecraft 服务器</Typography.Title>
              <Typography.Paragraph>开服时选择服务端和运行设备，核对配置并明确同意 Minecraft EULA。</Typography.Paragraph>
            </div>
            <ol className="minecraft-launch-steps" aria-label="首次开服流程">
              <li><span className="minecraft-launch-steps__number" aria-hidden="true">01</span><div><strong>选择服务端</strong><small>挑选核心与游戏版本</small></div></li> {/* taste-skill-ignore numbering: these values show the actual deployment steps. */}
              <li>
                <span className="minecraft-launch-steps__number" aria-hidden="true">02</span> {/* taste-skill-ignore numbering: this is the actual device-selection step. */}
                <div className="minecraft-launch-steps__device">
                  <strong>选择运行设备</strong>
                  <small data-state={!nodesLoaded ? "pending" : eligibleNodes.length ? "ready" : "blocked"} aria-live="polite">{!nodesLoaded ? refreshError ? "设备状态暂不可读" : "正在读取设备状态" : eligibleNodes.length ? `${eligibleNodes.length} 台设备满足部署条件` : !onlineWindowsNodes.length ? "没有在线 Windows x64 Daemon" : "Daemon 尚未报告多核心执行能力"}</small>
                  {nodesLoaded && !eligibleNodes.length ? <Button type="link" onClick={() => onNavigate("/apps/minecraft/normal/nodes")}>检查设备</Button> : null}
                </div>
              </li>
              <li><span className="minecraft-launch-steps__number" aria-hidden="true">03</span><div><strong>核对并开服</strong><small>确认配置并阅读、同意 EULA</small></div></li> {/* taste-skill-ignore numbering: this is the actual final review step. */}
            </ol>
          </div>}
        </section>
        <div className="minecraft-stat-grid lfaa-card-motion-list" role="group" aria-label="Minecraft 管理摘要">
          <button className="minecraft-metric-card lfaa-card-motion" type="button" onClick={() => onNavigate("/apps/minecraft/normal/nodes")} aria-label="查看运行设备状态">
            <span>在线设备</span><strong>{nodesLoaded ? <>{onlineNodeCount} / {nodes.length}</> : unavailableValue}</strong><small>{nodesLoaded ? "在线 / 已登记" : "节点状态读取中"}</small>
          </button>
          <button className="minecraft-metric-card lfaa-card-motion" type="button" onClick={() => onNavigate("/apps/minecraft/normal/instances")} aria-label="查看 Minecraft 实例">
            <span>服务器实例</span><strong>{overview?.runningCount ?? unavailableValue} / {overview?.instanceCount ?? unavailableValue}</strong><small>运行中 / 全部</small>
          </button>
          <button className="minecraft-metric-card lfaa-card-motion" type="button" onClick={() => onNavigate("/apps/minecraft/normal/tasks")} aria-label="查看 Minecraft 活动任务">
            <span>进行中任务</span><strong>{overview?.activeTaskCount ?? unavailableValue}</strong><small>排队中或执行中</small>
          </button>
        </div>
        {overviewInstance && nodesLoaded && !eligibleNodes.length ? <Alert
          className="minecraft-alert"
          type="warning"
          showIcon
          message="当前没有满足部署前置条件的节点"
          description={!onlineWindowsNodes.length
            ? "没有在线 Windows x64 Daemon。"
            : "请更新并重启 Daemon，使节点报告多核心执行能力。"}
          action={<Button type="link" onClick={() => onNavigate("/apps/minecraft/normal/nodes")}>检查控制节点</Button>}
        /> : null}
        <div className="minecraft-overview-dashboard">
          <section className="minecraft-overview-panel minecraft-overview-server-panel">
            <div className="minecraft-card-heading"><div><Typography.Title level={4}>运行设备</Typography.Title><Typography.Text type="secondary">服务器实际部署和运行的设备。</Typography.Text></div><Button type="link" onClick={() => onNavigate("/games/minecraft/nodes")}>管理设备</Button></div>
            {!nodesLoaded ? <div className="minecraft-empty">{refreshError ? "节点状态暂不可读。" : "正在读取节点状态…"}</div> : nodes.length ? <div className="minecraft-node-preview-list">
              {nodes.slice(0, 3).map((node) => <button className="minecraft-node-preview lfaa-card-motion" type="button" key={node.id} onClick={() => onNavigate("/games/minecraft/nodes")} aria-label={"查看控制节点 " + node.displayName}>
                <span><strong>{node.displayName}</strong><small>{node.platform} · {node.architecture}</small></span>
                <Tag color={node.status === "online" ? "green" : "default"}>{node.status === "online" ? "在线" : "离线"}</Tag>
                <small>最近心跳 {timeLabel(node.lastSeenAt)}</small>
              </button>)}
            </div> : <div className="minecraft-empty">还没有运行设备；连接 Daemon 后，服务器才能部署在你的设备上。</div>}
          </section>
          <section className="minecraft-overview-panel">
            <div className="minecraft-card-heading"><Typography.Title level={4}>最近任务</Typography.Title><Button type="link" onClick={() => onNavigate("/games/minecraft/tasks")}>查看全部</Button></div>
            {tasksLoaded ? <TaskList userId={canOperate ? userId : ""} onCancel={id=>{void submitAction(()=>cancelMinecraftTask(id), { message: "已提交任务取消请求。", showTasksLink: true });}} tasks={tasks.slice(0, 4)} /> : <div className="minecraft-empty">{refreshError ? "任务状态暂不可读。" : "正在读取任务状态…"}</div>}
          </section>
        </div>
      </> : null}

      {!selectedInstance && currentSection === "nodes" ? <>
        {canOperate ? <DaemonConnections /> : null}
        <div className="minecraft-node-monitor-summary lfaa-card-motion-list" aria-label="Minecraft 节点状态摘要">
          <article className="lfaa-card-motion"><span>在线节点</span><strong>{nodesLoaded ? `${onlineNodeCount} / ${nodes.length}` : unavailableValue}</strong><small>Daemon 最近心跳</small></article>
          <article className="lfaa-card-motion"><span>满足前置条件</span><strong>{nodesLoaded ? eligibleNodes.length : unavailableValue}</strong><small>在线 Windows x64 且能力满足</small></article>
          <article className="lfaa-card-motion"><span>运行实例</span><strong>{nodesLoaded ? instances.filter((instance) => instance.state === "running").length : unavailableValue}</strong><small>来自实例状态</small></article>
          <article className="lfaa-card-motion"><span>活动任务</span><strong>{tasksLoaded ? taskStatusCounts.queued + taskStatusCounts.running : unavailableValue}</strong><small>排队中或执行中</small></article>
        </div>
        <Alert className="minecraft-node-telemetry-note" type="info" showIcon message="当前可用数据" description="心跳、开服能力、实例和任务；暂无硬件、TPS 或玩家数采样。" />
        <Card className="minecraft-card minecraft-node-management">
          <div className="minecraft-card-heading"><div><Typography.Title level={4}>已连接设备</Typography.Title><Typography.Text type="secondary">设备状态来自实时心跳；具备部署能力不代表实例已启动。</Typography.Text></div><Tag color={eligibleNodes.length ? "green" : "default"}>{eligibleNodes.length ? <>{eligibleNodes.length} 个设备满足条件</> : "暂无符合条件的设备"}</Tag></div>
          {!nodesLoaded ? <div className="minecraft-empty">{refreshError ? "节点状态暂不可读，请刷新重试。" : "正在读取节点状态…"}</div> : nodes.length ? <div className="minecraft-node-grid lfaa-card-motion-list">
            {nodes.map((node) => {
              const supportsMinecraft = node.capabilities.includes("minecraft-vanilla");
              const supportsSandbox = node.capabilities.includes("app-sandbox-windows-appcontainer-v1");
              const supportsWindows = node.platform === "win32" && node.architecture === "x64";
              const ready = node.status === "online" && supportsWindows && node.capabilities.includes("minecraft-multicore-v1");
              const latestFailedTask = latestFailedTaskByNode.get(node.id);
              const nodeInstances = instances.filter((instance) => instance.nodeId === node.id);
              return <Card className="minecraft-card minecraft-node-card lfaa-card-motion" key={node.id}>
                <div className="minecraft-card-heading"><div><Typography.Title level={5}>{node.displayName}</Typography.Title><Typography.Text type="secondary">{node.platform} · {node.architecture} · Daemon {node.version}</Typography.Text></div><Tag color={node.status !== "online" ? "default" : ready ? "green" : "gold"}>{node.status !== "online" ? "离线" : ready ? "在线 · 能力齐全" : "在线 · 能力不完整"}</Tag></div>
                <div className="minecraft-node-capabilities">
                  <Tag color={supportsMinecraft ? "green" : "default"}>Minecraft Runner {supportsMinecraft ? "已上报" : "未上报"}</Tag>
                  <Tag color={supportsSandbox ? "green" : "default"}>AppContainer Host {supportsSandbox ? "已上报" : "未上报"}</Tag>
                  <Tag>{node.javaRuntimes.length} 个 Java 运行环境</Tag>
                </div>
                <dl className="minecraft-facts">
                  <div><dt>节点平台</dt><dd>{supportsWindows ? "当前 Minecraft 支持平台" : "当前 Minecraft MVP 不支持"}</dd></div>
                  <div><dt>最近心跳</dt><dd>{timeLabel(node.lastSeenAt)}</dd></div>
                  <div><dt>关联实例</dt><dd>{nodeInstances.length} 个 · {nodeInstances.filter((instance) => instance.state === "running").length} 个运行中</dd></div>
                  <div className="minecraft-node-java"><dt>Java 环境</dt><dd>{node.javaRuntimes.length ? node.javaRuntimes.map((runtime) => "Java " + runtime.major + " · " + runtime.vendor + (runtime.managed ? " · LFAA 管理" : "")).join("；") : "未发现运行环境"}</dd></div>
                </dl>
                {latestFailedTask ? <Alert type="error" showIcon message={`最近失败记录：${latestFailedTask.kind === "java-install" ? javaTaskLabel(latestFailedTask) : deploymentTaskLabel(latestFailedTask)} · ${timeLabel(latestFailedTask.createdAt)}`} description={latestFailedTask.message} action={latestFailedTask.instanceId ? <Button type="link" size="small" onClick={() => onNavigate(getInstanceRoute(latestFailedTask.instanceId!, "logs"))}>查看实例日志</Button> : <Button type="link" size="small" onClick={() => onNavigate(`${minecraftRoot}/tasks`)}>查看任务</Button>} /> : null}
                {node.status === "online" && !node.capabilities.includes("minecraft-multicore-v1") ? <Alert type="warning" showIcon message="此节点需要更新" description="更新并重启 Daemon 后可使用多核心自动开服。" /> : null}
              </Card>;
            })}
          </div> : <div className="minecraft-empty">尚无 Daemon 节点心跳记录。启动本机 Daemon 后，节点会自动登记。</div>}
        </Card>
        <Card className="minecraft-card minecraft-sandbox-card">
          <Typography.Title level={4}>运行方式与权限</Typography.Title>
          <Typography.Paragraph>默认使用设置中心选定的执行方式。当前：{settings.minecraftRuntime.minecraftExecutionMode === "native" ? "本机原生进程，以 Daemon 系统账户运行；没有 OS 沙盒隔离。" : "Windows AppContainer，仅已接入的 Vanilla 启动合同可用。"}</Typography.Paragraph>
          <Alert type="info" showIcon message="每个实例有独立数据目录和进程。目标节点负责真实文件与运行状态；节点离线时保留未知状态，不自动改到其他电脑执行。" />
        </Card>
      </> : null}

      {!selectedInstance && currentSection === "deployment" ? <>
        <div className="minecraft-deployment-layout">
          <MinecraftDeploymentPanel onPrepareWithAi={onPrepareWithAi} userId={userId} nodes={nodes} instances={instances} settings={settings} canOperate={canOperate} onSubmit={submitAction} onNavigate={onNavigate} />
          <Card className="minecraft-card minecraft-deployments-card">
            <div className="minecraft-deployments-heading"><div><Typography.Title level={4}>部署记录</Typography.Title><Typography.Text type="secondary">任务进度和结果来自控制端与目标节点。</Typography.Text></div><Tag>{deployments.length}</Tag></div>
            {!deploymentsLoaded ? <div className="minecraft-empty">{refreshError ? "部署记录暂不可读。" : "正在读取部署记录…"}</div> : !deployments.length ? <div className="minecraft-empty">暂无部署记录。</div> : <div className="minecraft-deployment-list">{deployments.map((deployment) => {
              const task = tasks.find((item) => item.deploymentId === deployment.id);
              const instance = deployment.instanceId ? instances.find((item) => item.id === deployment.instanceId) : null;
              const node = nodes.find((item) => item.id === deployment.nodeId);
              const canRegister = Boolean(node && node.status === "online" && (settings.minecraftRuntime.minecraftExecutionMode === "native" ? node.capabilities.includes("minecraft-native-v1") : node.capabilities.includes("app-sandbox-windows-appcontainer-v1")));
              return <article className="minecraft-deployment-row" key={deployment.id}>
                <div className="minecraft-deployment-row__heading"><div><strong>{deployment.name}</strong><Typography.Text type="secondary">{deployment.serverType === "vanilla" ? "官方 Vanilla" : deployment.serverType} · {deployment.releaseId} · {deployment.coreBuild} · {deployment.nodeName}</Typography.Text></div><Tag color={deploymentStateColor(deployment.state)}>{deployment.automatic && task?.status === "running" ? task.message : deployment.automatic && deployment.state === "registered" ? "开服流程完成" : deploymentStateLabel(deployment.state)}</Tag></div>
                {task && ["queued", "running"].includes(task.status) ? <Progress percent={task.status === "running" ? task.progress : 0} size="small" status={task.status === "running" ? "active" : "normal"} /> : null}
                {task && task.status === "failed" ? <Typography.Text type="danger">{task.message}</Typography.Text> : null}
                <div className="minecraft-deployment-row__actions">
                  {deployment.state === "ready" ? <Space wrap><Button type="primary" disabled={!canOperate || !canRegister} onClick={() => openRegisterModal(deployment.id)}>创建实例</Button>{!canRegister ? <Typography.Text type="secondary">节点尚未就绪，暂不能创建实例</Typography.Text> : null}</Space> : null}
                  {deployment.state === "failed" && task?.result?.outcome !== "unknown" ? <Button disabled={!canOperate || deployment.nodeStatus !== "online"} loading={busy} onClick={() => retryDeployment(deployment.id)}>{deployment.automatic ? "核对文件并重试开服" : "重试下载"}</Button> : null}
                  {instance ? <Button type="link" onClick={() => onNavigate(getInstanceRoute(instance.id, "overview"))}>打开实例</Button> : null}
                </div>
                <small>更新于 {timeLabel(deployment.updatedAt)}</small>
              </article>;
            })}</div>}
          </Card>
        </div>
        <Modal title="创建 Minecraft 实例" open={registerModalOpen} okText="创建实例" cancelText="取消" confirmLoading={busy} okButtonProps={{ disabled: !eulaAccepted || !memoryMb }} onCancel={() => setRegisterModalOpen(false)} onOk={() => document.getElementById("minecraft-register-form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))}>
          <form id="minecraft-register-form" className="minecraft-register-form" onSubmit={submitRegisterDeployment}>
            <Typography.Text type="secondary">{selectedDeployment ? `${selectedDeployment.name} · ${selectedDeployment.releaseId}` : ""}</Typography.Text>
            <label>最大内存（MB）<InputNumber min={1024} max={32768} step={512} value={memoryMb} onChange={setMemoryMb} /></label>
            <label>Java 运行环境（版本要求：Java {selectedDeployment?.javaMajor ?? unavailableValue}）<Select value={registerJavaRuntimeId} onChange={setRegisterJavaRuntimeId} disabled={!javaNodesLoaded || !registerNodeSupportsJavaSelection} options={[
              { value: "", label: `自动管理 Java ${selectedDeployment?.javaMajor ?? ""}（优先用 LFAA 版，缺少时下载）` },
              ...(registerNodeSupportsJavaSelection ? registerCompatibleJavaRuntimes : []).map((runtime) => ({
                value: runtime.runtimeId,
                label: `Java ${runtime.major} · ${runtime.vendor} · ${runtime.managed ? "LFAA 托管" : runtime.source === "custom" ? "手动登记" : "系统识别"} · ${runtime.executablePath ?? "路径不可用"}`
              }))
            ]} />{registerSelectedJavaRuntime && !registerSelectedJavaRuntime.managed
              ? <Typography.Text type="secondary">将直接使用此电脑已有的 Java；所选 Java 保持原位，运行边界遵循设置中心执行方式。</Typography.Text>
              : registerSelectedJavaRuntime?.managed
                ? <Typography.Text type="secondary">将使用 LFAA 托管版；若该版本已卸载，创建或启动时会重新下载同版本。</Typography.Text>
              : !registerNodeSupportsJavaSelection
                ? <Typography.Text type="secondary">此节点 Daemon 尚不支持按实例选择 Java；更新并重启 Daemon 后即可使用电脑已发现的 Java。</Typography.Text>
                : <Typography.Text type="secondary">检测到匹配的外部 Java 时会优先预选；自动管理会优先使用已有 LFAA 版本，缺少时才下载。</Typography.Text>}</label>
            <div className="minecraft-eula"><Checkbox checked={eulaAccepted} onChange={(event) => setEulaAccepted(event.target.checked)}>我已阅读并同意</Checkbox><a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">Minecraft EULA</a></div>
          </form>
        </Modal>
      </> : null}

      {!selectedInstance && currentSection === "instances" ? <>
        <div className="minecraft-instance-summary lfaa-card-motion-list" aria-label="Minecraft 实例状态摘要">
          <article><span>全部实例</span><strong>{instances.length}</strong><small>当前账户可见</small></article>
          <article><span>运行中</span><strong>{instanceStateCounts.running ?? 0}</strong><small>由目标节点回报</small></article>
          <article><span>已停止</span><strong>{instanceStateCounts.stopped ?? 0}</strong><small>可以进入实例管理</small></article>
          <article><span>需核对</span><strong>{(instanceStateCounts.error ?? 0) + (instanceStateCounts.unknown ?? 0)}</strong><small>失败或节点结果未确认</small></article>
        </div>
        <Card className="minecraft-card minecraft-instances-panel">
          <div className="minecraft-card-heading minecraft-instances-heading"><div><Typography.Title level={4}>服务器</Typography.Title><Typography.Text type="secondary">共 {instances.length} 个 · 状态来自控制端与运行设备</Typography.Text></div></div>
          {instances.length ? <>
            <div className="minecraft-instance-toolbar" role="search">
              <Input aria-label="搜索实例" allowClear value={instanceSearch} onChange={(event) => setInstanceSearch(event.target.value)} placeholder="按名称、核心或节点搜索" />
              <Select aria-label="按实例状态筛选" value={instanceStateFilter} onChange={setInstanceStateFilter} options={[
                { value: "all", label: `全部状态 · ${instances.length}` },
                ...(["running", "stopped", "starting", "stopping", "installing", "error", "unknown"] as const).map((state) => ({ value: state, label: `${stateLabel(state)} · ${instanceStateCounts[state] ?? 0}` }))
              ]} />
            </div>
            {visibleInstances.length ? <div className="minecraft-instance-list lfaa-card-motion-list">{visibleInstances.map((instance) => {
              const nodeOnline = instance.nodeStatus === "online";
              const canStart = canOperate && nodeOnline && (settings.minecraftRuntime.minecraftExecutionMode !== "appcontainer" || instance.sandboxAvailable) && ["stopped", "error"].includes(instance.state);
              const canStop = canOperate && nodeOnline && ["running", "starting"].includes(instance.state);
              return <Card className="minecraft-card minecraft-instance-card lfaa-card-motion" key={instance.id}>
                <div className="minecraft-instance-card__top"><div className="minecraft-instance-card__identity"><Typography.Title level={5}>{instance.name}</Typography.Title><Tag color={instance.state === "running" ? "green" : instance.state === "error" ? "red" : instance.state === "unknown" ? "orange" : "default"}>{stateLabel(instance.state)}</Tag></div><Typography.Text type="secondary">{instance.coreType} · Minecraft {instance.releaseId}</Typography.Text></div>
                <dl className="minecraft-instance-card__facts">
                  <div><dt>运行节点</dt><dd>{instance.nodeName} · {nodeOnline ? "在线" : "离线"}</dd></div>
                  <div><dt>运行环境</dt><dd>{instance.coreType === "PocketMine" ? "官方 PHP" : `Java ${instance.javaMajor}`}</dd></div>
                  <div><dt>资源配置</dt><dd>{instance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${instance.memoryMb} MB`} · 端口 {instance.serverProperties.serverPort ?? unavailableValue}</dd></div>
                  <div><dt>最近更新</dt><dd>{timeLabel(instance.updatedAt)}</dd></div>
                </dl>
                {!nodeOnline ? <Typography.Text type="secondary">节点离线；当前状态不可核实，操作会保持禁用。</Typography.Text> : null}
                {settings.minecraftRuntime.minecraftExecutionMode === "appcontainer" && !instance.sandboxAvailable ? <Typography.Text type="secondary">此节点的 AppContainer 不可用，启动操作已禁用。</Typography.Text> : null}
                <div className="minecraft-instance-card__actions">
                  <Button type="primary" disabled={!canStart} loading={busy} onClick={() => void submitAction(() => runMinecraftInstanceAction(instance.id, "start"), { message: `${taskLabel("start")}任务已提交。`, showTasksLink: true })}>启动</Button>
                  <Popconfirm title={`安全停止“${instance.name}”？`} description="Daemon 会向服务端发送正常停止指令，并按设置中心的停服时限等待退出。" okText="安全停止" cancelText="取消" onConfirm={() => void submitAction(() => runMinecraftInstanceAction(instance.id, "stop"), { message: `${taskLabel("stop")}任务已提交。`, showTasksLink: true })}>
                    <Button danger disabled={!canStop} loading={busy}>安全停止</Button>
                  </Popconfirm>
                  <Button onClick={() => onNavigate(getInstanceRoute(instance.id, "overview"))}>管理实例</Button>
                  <Button onClick={() => navigateToInstanceFiles(userId, instance.id, onNavigate)}>打开实例文件</Button>
                  <Popconfirm title={`删除“${instance.name}”？`} description="完整实例文件将移入节点备份归档，再移除登记；不会覆盖已有备份。" okText="归档并删除" cancelText="取消" onConfirm={() => deleteInstance(instance)}><Button danger disabled={!canOperate||!nodeOnline||busy||!["stopped","error","unknown"].includes(instance.state)}>删除实例</Button></Popconfirm>
                </div>
              </Card>;
            })}</div> : <div className="minecraft-empty minecraft-instance-filter-empty"><Typography.Text>没有符合当前搜索和状态筛选的实例。</Typography.Text><Button type="link" onClick={() => { setInstanceSearch(""); setInstanceStateFilter("all"); }}>清除筛选条件</Button></div>}
          </> : <div className="minecraft-instance-onboarding-empty">
            <div><Typography.Title level={5}>还没有 Minecraft 实例</Typography.Title><Typography.Paragraph type="secondary">先确认一个在线节点，然后按向导选择核心、配置实例并完成许可确认。下载、安装和启动状态会在任务中持续更新。</Typography.Paragraph></div>
            {eligibleNodes.length ? <Typography.Text type="secondary">使用右上角“新建服务器”开始部署。</Typography.Text> : <Button type="link" onClick={() => onNavigate(`${minecraftRoot}/nodes`)}>检查运行设备</Button>}
          </div>}
          {!canOperate && instances.length ? <Typography.Text className="minecraft-instance-readonly-note" type="secondary">当前账户为只读角色；可查看实例，启动和停止需要管理员权限。</Typography.Text> : null}
        </Card>
      </> : null}

      {!selectedInstance && currentSection === "tasks" ? <>
        <div className="minecraft-task-status-grid lfaa-card-motion-list" role="group" aria-label="按任务状态筛选">
          {([ ["queued", "排队中"], ["running", "执行中"], ["succeeded", "已完成"], ["failed", "失败"] ] as const).map(([status, label]) => <button className={`minecraft-task-status-card lfaa-card-motion${taskStatusFilter === status ? " is-active" : ""}`} type="button" key={status} aria-pressed={taskStatusFilter === status} aria-label={`${label} ${tasksLoaded ? taskStatusCounts[status] : ""} 个任务`} disabled={!tasksLoaded || (taskStatusCounts[status] === 0 && taskStatusFilter !== status)} onClick={() => setTaskStatusFilter(current => current === status ? "all" : status)}>
            <span>{label}</span><strong>{tasksLoaded ? taskStatusCounts[status] : "—"}</strong>
          </button>)}
        </div>
        <Card className="minecraft-card minecraft-tasks-card">
          <div className="minecraft-card-heading"><Typography.Title level={4}>任务记录</Typography.Title><Space size="small"><Tag>{visibleTasks.length} 项</Tag>{taskStatusFilter !== "all" ? <Button type="link" size="small" onClick={() => setTaskStatusFilter("all")}>清除筛选</Button> : null}</Space></div>
          {!tasksLoaded ? <div className="minecraft-empty">{refreshError ? "任务状态暂不可读，请刷新后重试。" : "正在读取任务状态…"}</div>
            : visibleTasks.length ? <TaskList key={`task-menu:${canOperate ? userId : "read-only"}`} userId={canOperate ? userId : ""} onCancel={(id) => { void submitAction(() => cancelMinecraftTask(id), { message: "已提交任务取消请求。", showTasksLink: true }); }} onOpenDetails={openTaskDetails} onDelete={removeTaskRecords} canDelete={canOperate} deleting={busy} tasks={visibleTasks} selectionTasks={tasks} />
              : <div className="minecraft-empty">{tasks.length ? `${taskStatusFilterLabel}暂无任务。` : "暂无任务记录。部署、启停、配置和归档操作的执行状态会显示在这里。"}</div>}
        </Card>
      </> : null}

      {!selectedInstance && currentSection === "workflows" ? <MinecraftWorkflowCanvas userId={userId} /> : null}

      <Modal
        className="minecraft-task-detail-modal"
        rootClassName="minecraft-task-detail-modal-root"
        wrapClassName="minecraft-task-detail-modal-wrap"
        getContainer={() => document.querySelector<HTMLElement>(".module-center") ?? document.body}
        centered
        title={detailTask ? `任务详情 · ${detailTask.kind === "java-install" ? javaTaskLabel(detailTask) : deploymentTaskLabel(detailTask)}` : "任务详情"}
        open={taskDetailId !== null}
        width="min(860px, calc(100vw - 32px))"
        footer={<Button onClick={closeTaskDetails}>关闭</Button>}
        onCancel={closeTaskDetails}
      >
        {taskDetailLoading ? <div className="minecraft-empty"><Spin tip="读取任务详情和节点日志…" /></div>
          : taskDetailError ? <Alert type="error" showIcon message="任务详情读取失败" description={taskDetailError} action={<Button onClick={() => taskDetailId && void openTaskDetails(taskDetailId)}>重试</Button>} />
            : detailTask && taskDetails ? <div className="minecraft-task-detail">
              <div className="minecraft-task-detail__heading">
                <Tag color={detailTask.result?.forced === true ? "orange" : detailTask.status === "succeeded" ? "green" : detailTask.status === "failed" ? "red" : "blue"}>{taskDetailStatusLabel(detailTask)}</Tag>
                <Typography.Text type="secondary">任务 ID：{detailTask.id}</Typography.Text>
              </div>
              {detailTask.status === "failed" ? <Alert
                type="error"
                showIcon
                message={detailTask.result?.outcome === "unknown" ? "异常任务：节点执行结果未确认" : "问题定位依据"}
                description={<div className="minecraft-task-detail__diagnosis">
                  <p><strong>任务最终回报：</strong>{detailTask.message}</p>
                  {firstProblemLog ? <div><strong>首条异常日志 · {firstProblemLog.stream} · {taskDetailTime(firstProblemLog.createdAt)}</strong><pre>{firstProblemLog.line}</pre></div>
                    : <p>当前没有关联的错误/标准错误日志；故障位置只能依据任务最终回报，未发现更具体的节点日志证据。</p>}
                  {detailTask.result?.outcome === "unknown" ? <p>这是“结果未确认”异常；任务记录本身不能证明节点副作用是否发生，请结合目标实例当前状态判断。</p> : null}
                </div>}
              /> : <Alert type={detailTask.status === "succeeded" ? "success" : "info"} showIcon message="执行回报" description={detailTask.message} />}
              <dl className="minecraft-task-detail__facts">
                <div><dt>执行节点</dt><dd>{detailNode?.displayName ?? detailTask.nodeId}</dd></div>
                <div><dt>实例 / 部署</dt><dd>{String(detailTask.payload.instanceName ?? detailTask.payload.name ?? detailTask.instanceId ?? detailTask.deploymentId ?? "未关联实例")}</dd></div>
                <div><dt>提交时间</dt><dd>{taskDetailTime(detailTask.createdAt)}</dd></div>
                <div><dt>开始时间</dt><dd>{taskDetailTime(detailTask.startedAt)}</dd></div>
                <div><dt>结束时间</dt><dd>{taskDetailTime(detailTask.finishedAt)}</dd></div>
              </dl>
              <section><Typography.Title level={5}>任务输入与参数</Typography.Title><pre className="minecraft-task-detail__json">{taskJsonText(detailTask.payload)}</pre></section>
              <section><Typography.Title level={5}>节点结构化结果</Typography.Title><pre className="minecraft-task-detail__json">{detailTask.result ? taskJsonText(detailTask.result) : "节点尚未返回结构化结果。"}</pre></section>
              <section>
                <Typography.Title level={5}>节点执行日志 · {taskDetails.logs.length}{taskDetails.logsTruncated ? "（仅显示最新 1000 条）" : " 条"}</Typography.Title>
                {taskDetails.logs.length ? <div className="minecraft-task-detail__logs" role="log" aria-label="当前任务关联的节点执行日志">
                  {taskDetails.logs.map((log) => <div className={log.stream === "stderr" ? "is-stderr" : ""} key={log.id}>
                    <time>{taskDetailTime(log.createdAt)}</time><span>{log.stream}</span><code>{log.line}</code>
                  </div>)}
                </div> : <div className="minecraft-empty">节点没有为这条任务保留关联日志。</div>}
              </section>
            </div>
              : <div className="minecraft-empty">当前任务详情暂不可用，请关闭后重试。</div>}
      </Modal>
    </section>
    </ConfigProvider>
  );
}

function MinecraftWorkspaceForIdentity(props: MinecraftWorkspaceProps) {
  return <MinecraftWorkspaceView key={`${props.userId}\u001f${props.role}`} {...props} />;
}

export const MinecraftWorkspace = memo(MinecraftWorkspaceForIdentity);

function TaskList({ tasks, selectionTasks = tasks, userId, onCancel, onOpenDetails, onDelete, canDelete = false, deleting = false }: {
  tasks: MinecraftTask[];
  selectionTasks?: MinecraftTask[];
  userId: string;
  onCancel: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onDelete?: (ids: string[]) => Promise<boolean>;
  canDelete?: boolean;
  deleting?: boolean;
}) {
  const deletableTasks = selectionTasks.filter((task) => task.status === "succeeded" || task.status === "failed");
  const deletableIds = deletableTasks.map((task) => task.id);
  const selectionPersistence = useMemo(() => canDelete && userId ? createBrowserPersistence({
    key: createClientPersistenceKey("minecraft-task-selection", 1, [userId]),
    codec: minecraftTaskSelectionCodec,
    area: "local"
  }) : null, [canDelete, userId]);
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const saved = selectionPersistence?.read() ?? [];
    return [...new Set(saved.filter((id) => deletableIds.includes(id)))];
  });
  const allDeletableSelected = deletableIds.length > 0 && deletableIds.every((id) => selectedIds.includes(id));
  useEffect(() => {
    setSelectedIds((current) => {
    const currentDeletableIds = selectionTasks.filter((task) => task.status === "succeeded" || task.status === "failed").map((task) => task.id);
      const next = current.filter((id) => currentDeletableIds.includes(id));
      return next.length === current.length ? current : next;
    });
  }, [selectionTasks]);
  useEffect(() => {
    if (!selectionPersistence) return;
    const currentDeletableIds = new Set(selectionTasks.filter((task) => task.status === "succeeded" || task.status === "failed").map((task) => task.id));
    const validSelection = selectedIds.filter((id) => currentDeletableIds.has(id));
    if (validSelection.length) selectionPersistence.write(validSelection);
    else selectionPersistence.remove();
  }, [selectedIds, selectionPersistence, selectionTasks]);
  const toggleSelected = (taskId: string, selected: boolean) => {
    setSelectedIds((current) => selected ? [...new Set([...current, taskId])] : current.filter((id) => id !== taskId));
  };
  const removeSelected = async (ids: string[]) => {
    if (onDelete && await onDelete(ids)) setSelectedIds((current) => current.filter((id) => !ids.includes(id)));
  };
  if (!tasks.length) return <div className="minecraft-empty">暂无任务记录。</div>;
  return <>
    {canDelete ? <div className="minecraft-task-selection-bar">
      <Checkbox checked={allDeletableSelected} indeterminate={selectedIds.length > 0 && !allDeletableSelected} disabled={!deletableIds.length || deleting} onChange={(event) => setSelectedIds(event.target.checked ? deletableIds : [])}>选择全部可删除任务（{deletableTasks.length}）</Checkbox>
      <div><Typography.Text type="secondary">已选 {selectedIds.length} 项</Typography.Text>
        <Popconfirm title={`删除选中的 ${selectedIds.length} 条任务记录？`} description="只允许已完成、失败或异常终态；同时清理对应节点日志，不影响实例和部署。" okText="删除所选" cancelText="取消" onConfirm={() => void removeSelected(selectedIds)}>
          <Button danger disabled={!selectedIds.length || deleting}>批量删除（{selectedIds.length}）</Button>
        </Popconfirm>
      </div>
    </div> : null}
    <div className="minecraft-task-list lfaa-card-motion-list">{tasks.map((task) => {
      const terminal = task.status === "succeeded" || task.status === "failed";
      const selectable = canDelete && terminal;
      const selected = selectedIds.includes(task.id);
      const taskLabel = task.kind === "java-install" ? javaTaskLabel(task) : deploymentTaskLabel(task);
      const showMessage = task.status !== "succeeded" || task.message !== "Minecraft 任务已完成。";
      return <article
        className={`minecraft-task-card lfaa-card-motion${selected ? " is-selected" : ""}${selectable ? " is-selectable" : " is-detail-only"}`}
        key={task.id}
      >
        <button
          className="minecraft-task-card__select"
          type="button"
          aria-label={selectable ? `${selected ? "取消选择" : "选择"}任务 ${taskLabel} 以批量删除` : `查看任务详情：${taskLabel}`}
          aria-pressed={selectable ? selected : undefined}
          onClick={() => selectable ? toggleSelected(task.id, !selected) : onOpenDetails?.(task.id)}
        />
        <div className="minecraft-task-copy">
          <div className="minecraft-task-heading"><strong>{task.kind === "java-install" ? javaTaskLabel(task) : deploymentTaskLabel(task)}</strong><Tag color={task.result?.forced === true ? "orange" : task.status === "succeeded" ? "green" : task.status === "failed" ? "red" : "blue"}>{taskDetailStatusLabel(task)}{task.status === "running" ? ` · ${task.progress}%` : ""}</Tag></div>
          {typeof task.payload.instanceName === "string" ? <small>{task.payload.instanceName}</small> : null}
          {task.status === "running" ? <Progress aria-label={`${task.message}进度`} percent={task.progress} size="small" status="active" /> : null}
          {showMessage ? <span className={`minecraft-task-message${task.status === "failed" ? " is-failed" : ""}`}>{task.message}</span> : null}
          {task.kind === "delete" && task.result?.archived === true ? <small>节点已确认完整目录归档，实例登记已移除。</small> : null}
          {typeof task.result?.note === "string" ? <small>{task.result.note}</small> : null}{typeof task.result?.backupName === "string" ? <small>节点备份归档：{task.result.backupName}</small> : null}
          <small>{timeLabel(task.createdAt)}</small>
        </div>
        <div className="minecraft-task-actions">
          <div className="minecraft-task-actions__start">
            {onOpenDetails ? <Button onClick={() => onOpenDetails(task.id)}>查看详情</Button> : null}
            {task.createdBy === userId && ["queued", "running"].includes(task.status) && ["install", "start"].includes(task.kind) && task.payload.executionMode === "native" ? <Button onClick={() => onCancel(task.id)}>请求取消任务</Button> : null}
          </div>
          {canDelete && terminal && onDelete ? <div className="minecraft-task-actions__end">
            <Popconfirm title="删除这条终态任务记录？" description="对应节点日志也会清除；Minecraft 实例和部署登记保持不变。" okText="删除记录" cancelText="取消" onConfirm={() => void removeSelected([task.id])}>
              <Button danger disabled={deleting}>删除</Button>
            </Popconfirm>
          </div> : null}
        </div>
      </article>;
    })}</div>
  </>;
}
