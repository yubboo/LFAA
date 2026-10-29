/**
 * 功能：呈现 Minecraft 常规模式的真实管理工作台。
 * 作用：读取 LFAA 控制端与本机 Daemon 数据，并提交受权限控制的实例任务。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-sidebar-terminal/src/TerminalSurface.tsx、packages/client/ui-minecraft/src/MinecraftWorkspace.css。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
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
  saveMinecraftServerProperties,
  setMinecraftInstanceJavaRuntime,
  type MinecraftDeployment,
  type MinecraftInstance,
  type MinecraftLog,
  type MinecraftNode,
  type MinecraftServerProperties,
  type MinecraftTask,
  type MinecraftTaskDetails,
  type UserRole,
  type UserSettings
} from "lfaa-client-connection/src/api.js";
import { createBrowserPersistence, createClientPersistenceKey, createJsonPersistenceCodec } from "lfaa-client-store/src/browser-persistence.js";
import { createMinecraftSocket, type MinecraftRealtimeChange } from "lfaa-client-connection/src/minecraft-socket.js";
import { TerminalSurface, useTerminalSession, type TerminalSurfaceHandle } from "lfaa-client-ui-sidebar-terminal/src/index.js";
import "./MinecraftWorkspace.css";
import { MinecraftDeploymentPanel } from "./MinecraftDeploymentPanel.js";
import {cancelMinecraftTask} from "lfaa-client-connection/src/runtime-api.js";
import { MinecraftConnectivityPanel } from "./MinecraftConnectivityPanel.js";
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

function realtimeStatusLabel(status: RealtimeConnectionStatus): string {
  return ({ connecting: "实时连接中", connected: "控制端已连接", reconnecting: "实时连接恢复中", disconnected: "实时连接中断" })[status];
}

function realtimeStatusColor(status: RealtimeConnectionStatus): string {
  return ({ connecting: "processing", connected: "success", reconnecting: "warning", disconnected: "error" })[status];
}

function getInstanceRoute(instanceId: string, view: "overview" | "configuration" | "logs" | "backup"): string {
  return `${minecraftRoot}/instance/${encodeURIComponent(instanceId)}/${view}`;
}

function stateLabel(state: MinecraftInstance["state"]): string {
  return ({ installing: "安装中", stopped: "已停止", starting: "启动中", running: "运行中", stopping: "停止中", error: "异常", unknown: "状态未知" })[state];
}

function sandboxStatusLabel(status: MinecraftInstance["sandboxStatus"]): string {
  return ({ unsupported: "节点不支持", unprepared: "待准备", prepared: "已准备", running: "AppContainer 运行中", unknown: "无法核实" })[status];
}

function taskLabel(kind: MinecraftTask["kind"]): string {
  return ({ install: "安装服务端", start: "启动实例", stop: "停止实例", restart: "重启实例", console: "控制台指令", properties: "保存配置", backup: "世界备份", "java-install": "Java 环境管理", delete:"归档并删除实例" })[kind];
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
  const [loading, setLoading] = useState(() => cachedSnapshot === null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
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
  const [propertyDraft, setPropertyDraft] = useState<MinecraftServerProperties>({});
  const [instanceSearch, setInstanceSearch] = useState("");
  const [instanceStateFilter, setInstanceStateFilter] = useState<MinecraftInstanceFilter>("all");
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
  const renderedConsoleLogs = useRef({ instanceId: "", seenIds: new Set<number>(), emptyMessageShown: false });

  const detailMatch = /^instance\/([0-9a-f-]{36})\/(overview|configuration|logs|backup)$/iu.exec(section);
  const selectedInstanceId = detailMatch?.[1] ?? "";
  const detailView = detailMatch?.[2] ?? "overview";
  const consoleSurface = useRef<TerminalSurfaceHandle>(null);
  const terminalSession = useTerminalSession({ surface: consoleSurface, appId: "minecraft", sessionId: null, permissionsMode: settings.permissions.mode, scopeKey: `${selectedInstanceId}:${detailView}`, preserveSurfaceOnConnect: true });
  logTarget.current = { instanceId: selectedInstanceId, view: detailView };
  const selectedInstance = instances.find((item) => item.id === selectedInstanceId) ?? null;
  const independentCoreConfiguration = selectedInstance && ["BungeeCord", "Velocity", "Nukkit", "PocketMine"].includes(selectedInstance.coreType);
  const proxyInstance = selectedInstance && ["BungeeCord", "Velocity"].includes(selectedInstance.coreType);
  const selectedDeployment = deployments.find((item) => item.id === registerDeploymentId) ?? null;
  const selectedInstanceNode = selectedInstance ? nodes.find((node) => node.id === selectedInstance.nodeId) ?? null : null;
  const selectedInstanceSupportsInteractiveConsole = selectedInstanceNode?.capabilities.includes("minecraft-interactive-console-v1") ?? false;
  const selectedInstanceJavaNode = selectedInstance ? javaNodes.find((node) => node.nodeId === selectedInstance.nodeId) ?? null : null;
  const selectedInstanceJavaRuntimes = selectedInstanceJavaNode?.runtimes ?? selectedInstanceNode?.javaRuntimes ?? [];
  const selectedInstanceCompatibleJavaRuntimes = selectedInstance
    ? selectedInstanceJavaRuntimes.filter((runtime) => runtime.major === selectedInstance.javaMajor)
    : [];
  const selectedInstanceSupportsJavaSelection = selectedInstanceNode?.capabilities.includes("minecraft-java-runtime-selection-v1") ?? false;
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
  const currentSection = section === "overview" || section === "nodes" || section === "deployment" || section === "instances" || section === "java" || section === "tasks" || section === "workflows" || section === "connectivity" ? section : detailMatch ? "instances" : "overview";
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
    if (!selectedInstanceId || detailView !== "logs") {
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
    const readLogs = () => loadMinecraftInstanceLogs(selectedInstanceId, controller.signal).then((result) => { if (alive) { setLogs(result.logs); setLogsInstanceId(selectedInstanceId); } }).catch((error: unknown) => { if (alive) setActionError(getErrorMessage(error)); }).finally(() => {
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
  }, [detailView, selectedInstanceId]);

  useEffect(() => {
    if (detailView !== "logs" || !selectedInstance) {
      renderedConsoleLogs.current = { instanceId: "", seenIds: new Set(), emptyMessageShown: false };
      return;
    }
    const surface = consoleSurface.current;
    if (!surface || !logsLoaded || logsInstanceId !== selectedInstance.id) return;
    const liveTerminal = terminalSession.terminal?.state === "running";
    const state = renderedConsoleLogs.current;
    if (state.instanceId !== selectedInstance.id) {
      state.instanceId = selectedInstance.id;
      state.seenIds.clear();
      state.emptyMessageShown = false;
    }
    if (!logs.length) {
      if (!liveTerminal && !state.emptyMessageShown) {
        surface.writeOutput("[当前日志快照为空]\r\n");
        state.emptyMessageShown = true;
      }
      return;
    }
    const output = logs.slice().sort((left, right) => left.id - right.id).flatMap((entry) => {
      if (state.seenIds.has(entry.id)) return [];
      state.seenIds.add(entry.id);
      const time = new Date(entry.createdAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      const stream = entry.stream === "stderr" ? "\x1b[31m[stderr]\x1b[0m" : entry.stream === "system" ? "\x1b[33m[system]\x1b[0m" : "[stdout]";
      const line = entry.line.replace(/[\u0000-\u001f\u007f-\u009f]/gu, "�").slice(0, 4096);
      return [`${time} ${stream} ${line}\r\n`];
    }).join("");
    while (state.seenIds.size > 1000) {
      const oldest = state.seenIds.values().next().value;
      if (oldest === undefined) break;
      state.seenIds.delete(oldest);
    }
    if (output && !liveTerminal) surface.writeOutput(output);
  }, [detailView, logs, logsInstanceId, logsLoaded, selectedInstance?.id, terminalSession.terminal?.state]);

  useEffect(() => {
    if (selectedInstance) setPropertyDraft(selectedInstance.serverProperties);
  }, [selectedInstance?.id]);

  const submitAction = useCallback(async (operation: () => Promise<unknown>, returnToTasks = true): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
    setActionNotice(null);
    try {
      await operation();
      await refresh();
      if (returnToTasks) onNavigate(`${minecraftRoot}/tasks`);
      return true;
    } catch (error) {
      setActionError(getErrorMessage(error));
      return false;
    } finally {
      setBusy(false);
    }
  }, [onNavigate, refresh]);

  const connectMinecraftTerminal = useCallback(() => {
    const instance = selectedInstance;
    if (!instance || !canOperate || instance.nodeStatus !== "online" || instance.state !== "running" || !selectedInstanceSupportsInteractiveConsole || terminalSession.busy) return;
    const size = consoleSurface.current?.getSize() ?? { cols: 80, rows: 24 };
    void terminalSession.start({ id: crypto.randomUUID(), nodeId: instance.nodeId, appId: "minecraft", target: { kind: "minecraft", instanceId: instance.id }, sessionId: null, ...size });
  }, [selectedInstance, canOperate, selectedInstanceSupportsInteractiveConsole, terminalSession.busy, terminalSession.start]);

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
    const succeeded = await submitAction(() => deleteMinecraftTaskRecords(taskIds), false);
    if (succeeded) {
      if (taskDetailId && taskIds.includes(taskDetailId)) closeTaskDetails();
      setActionNotice(`已删除 ${taskIds.length} 条终态任务记录及其关联节点日志；Minecraft 实例和部署登记已保留。`);
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
    void submitAction(() => registerMinecraftDeployment(registerDeploymentId, { memoryMb, eulaAccepted: true, javaRuntimeId: registerJavaRuntimeId || null }), false).then((created) => {
      if (created) setRegisterModalOpen(false);
    });
  };

  const changeInstanceJavaRuntime = (runtimeId: string) => {
    if (!selectedInstance) return;
    void submitAction(() => setMinecraftInstanceJavaRuntime(selectedInstance.id, runtimeId || null), false);
  };

  const retryDeployment = (deploymentId: string) => {
    void submitAction(() => retryMinecraftDeployment(deploymentId), false);
  };

  const instanceAction = (action: "start" | "stop" | "backup" | "restart") => {
    if (!selectedInstance) return;
    void submitAction(() => runMinecraftInstanceAction(selectedInstance.id, action));
  };

  const deleteInstance = (instance: MinecraftInstance) => {
    void submitAction(() => deleteMinecraftInstance(instance.id), false).then((submitted) => {
      if (submitted) setActionNotice(`已提交“${instance.name}”的归档删除任务；节点完成归档后会移除实例登记，可在“任务”菜单查看进度。`);
    });
  };

  const saveProperties = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInstance) return;
    void submitAction(() => saveMinecraftServerProperties(selectedInstance.id, propertyDraft));
  };

  const pageTitle = currentSection === "overview" ? "总览" : currentSection === "nodes" ? "节点监控" : currentSection === "deployment" ? "部署" : currentSection === "instances" ? "实例管理" : currentSection === "java" ? "Java 环境" : currentSection === "connectivity" ? "世界联机" : "任务";
  const pageDescription = selectedInstance
    ? `Minecraft ${selectedInstance.releaseId} · ${selectedInstance.nodeName}`
      : currentSection === "overview"
        ? "集中查看 Minecraft 实例、执行节点和近期任务。"
      : currentSection === "nodes"
        ? "查看 Daemon 心跳、Minecraft 执行能力和 Java 环境；状态由节点真实上报。"
        : currentSection === "deployment"
        ? "选择服务端类型和版本，下载到目标节点。"
          : currentSection === "instances"
            ? "按名称、核心或节点查找实例；从卡片查看状态并进入管理操作。"
            : currentSection === "tasks"
              ? "查看服务端部署、实例操作和 Java 环境管理任务的执行状态与结果。"
              : currentSection === "connectivity"
                ? "选择独立的玩家联机路线；部署和实例启停仍在各自页面管理。"
                : "Java 运行环境状态来自 LFAA 控制端与本机 Daemon。";

  if (loading) return <div className="minecraft-loading" role="status" aria-label="Minecraft 管理工作台加载中"><Spin size="large" /><span>正在读取 Minecraft 主机与实例状态…</span></div>;

  return (
    <ConfigProvider theme={{ token: { fontSize: settings.appearance.advanced.interfaceFontSize } }}>
    <section className={`minecraft-workspace minecraft-workspace--${currentSection}`} data-section={currentSection} aria-labelledby="minecraft-page-title">
      <header className="minecraft-page-heading">
        <div><Typography.Text className="minecraft-eyebrow">{currentSection === "connectivity" ? "LFAA · MINECRAFT CONNECTIONS" : "MINECRAFT · SERVER MANAGEMENT"}</Typography.Text><Typography.Title id="minecraft-page-title" level={2}>{selectedInstance && detailView === "logs" ? "控制台" : selectedInstance ? selectedInstance.name : pageTitle}</Typography.Title><Typography.Paragraph>{pageDescription}</Typography.Paragraph></div>
        <Space size="small">
          <Tag role="status" aria-live="polite" color={realtimeStatusColor(realtimeStatus)}>{currentSection === "connectivity" ? `控制端 · ${realtimeStatusLabel(realtimeStatus)}` : realtimeStatusLabel(realtimeStatus)}</Tag>
          {realtimeStatus !== "connected" ? <Button size="small" onClick={reconnectRealtime}>重新连接</Button> : null}
          <Button onClick={() => void refresh()}>刷新状态</Button>
        </Space>
      </header>
      {refreshError ? <Alert className="minecraft-alert" type="warning" showIcon message="部分 Minecraft 数据暂时无法读取" description={refreshError} /> : null}
      {actionError ? <Alert className="minecraft-alert" type="error" showIcon closable onClose={() => setActionError(null)} message={actionError} /> : null}
      {actionNotice ? <Alert className="minecraft-alert" type="success" showIcon closable onClose={() => setActionNotice(null)} message={actionNotice} role="status" /> : null}

      {!selectedInstance && currentSection === "connectivity" ? <MinecraftConnectivityPanel onOpenConnectivity={onOpenConnectivity} /> : null}

      {selectedInstance ? <>
        <nav className="minecraft-instance-tabs" aria-label="Minecraft 实例菜单">
          {([ ["overview", "实例概览"], ["configuration", "服务器配置"], ["logs", "控制台日志"], ["backup", "世界备份"] ] as const).map(([view, label]) => <button key={view} type="button" aria-current={detailView === view ? "page" : undefined} onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, view))}>{label}</button>)}
        </nav>
        {detailView === "overview" ? <div className="minecraft-detail-grid">
          <Card className="minecraft-card minecraft-instance-summary"><div className="minecraft-card-heading"><div><Typography.Title level={4}>实例状态</Typography.Title><Typography.Text type="secondary">创建于 {timeLabel(selectedInstance.createdAt)}</Typography.Text></div><Tag color={selectedInstance.state === "running" ? "green" : selectedInstance.state === "error" ? "red" : "default"}>{stateLabel(selectedInstance.state)}</Tag></div>
            <dl className="minecraft-facts"><div><dt>服务端</dt><dd>{selectedInstance.coreType} · {selectedInstance.releaseId}</dd></div><div><dt>节点</dt><dd>{selectedInstance.nodeName} · {selectedInstance.nodeStatus === "online" ? "在线" : "离线"}</dd></div><div><dt>运行环境</dt><dd>{selectedInstance.coreType === "PocketMine" ? "官方 PHP" : `要求 Java ${selectedInstance.javaMajor}（实际版本以节点启动结果为准）`}</dd></div><div><dt>最大内存</dt><dd>{selectedInstance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${selectedInstance.memoryMb} MB`}</dd></div><div><dt>执行方式</dt><dd>{selectedInstance.executionMode === "native" ? "本机原生进程（当前系统账户权限）" : sandboxStatusLabel(selectedInstance.sandboxStatus)}</dd></div><div><dt>EULA</dt><dd>已于 {timeLabel(selectedInstance.eulaAcceptedAt)} 明确同意</dd></div></dl>
            {selectedInstance.coreType !== "PocketMine" ? <div className="minecraft-instance-java-choice">
              <label htmlFor="minecraft-instance-java-runtime">实例 Java 运行环境</label>
              <Select id="minecraft-instance-java-runtime" value={selectedInstance.javaRuntimeId ?? ""} onChange={changeInstanceJavaRuntime} disabled={!canOperate || busy || !javaNodesLoaded || selectedInstance.nodeStatus !== "online" || !["stopped", "error"].includes(selectedInstance.state) || (!selectedInstanceSupportsJavaSelection && !selectedInstance.javaRuntimeId)} options={[
                { value: "", label: `自动管理 Java ${selectedInstance.javaMajor}（优先用 LFAA 版，缺少时下载）` },
                ...(selectedInstance.javaRuntimeId && (!selectedInstanceSupportsJavaSelection || !selectedInstanceCompatibleJavaRuntimes.some((runtime) => runtime.runtimeId === selectedInstance.javaRuntimeId))
                  ? [{ value: selectedInstance.javaRuntimeId, label: !selectedInstanceSupportsJavaSelection ? "当前所选 Java（此 Daemon 不支持）" : selectedInstance.javaRuntimeId === `temurin-${selectedInstance.javaMajor}` ? "LFAA 托管版未安装（启动时重新下载）" : "当前所选 Java 已不可用" }]
                  : []),
                ...(selectedInstanceSupportsJavaSelection ? selectedInstanceCompatibleJavaRuntimes : []).map((runtime) => ({
                  value: runtime.runtimeId,
                  label: `Java ${runtime.major} · ${runtime.vendor} · ${runtime.managed ? "LFAA 托管" : runtime.source === "custom" ? "手动登记" : "系统识别"} · ${runtime.executablePath ?? "路径不可用"}`
                }))
              ]} />
              <Typography.Text type="secondary">{!selectedInstanceSupportsJavaSelection && selectedInstance.javaRuntimeId
                  ? "当前 Daemon 不支持实例 Java 选择；可切回自动管理，更新并重启 Daemon 后才能选择其他 Java。"
                : selectedInstanceJavaRuntime?.managed
                  ? "此实例指定使用 LFAA 托管版；若该版本已卸载，启动时会重新下载同版本。"
                : selectedInstance.javaRuntimeId === `temurin-${selectedInstance.javaMajor}`
                  ? "此实例指定使用的 LFAA 托管版当前未安装；启动时会重新下载同版本。"
                : selectedInstanceJavaRuntime && !selectedInstanceJavaRuntime.managed
                  ? selectedInstance.executionMode === "native" ? "使用节点现有 Java，以当前系统账户权限执行。" : "所选外部 Java 仅获得 AppContainer 读取和执行权限。"
                : selectedInstance.javaRuntimeId && !selectedInstanceJavaRuntime
                  ? "节点当前没有发现这套 Java；请选择其他运行环境，实例不会静默改用其他版本。"
                  : "优先复用可用的托管或系统 Java，缺少匹配版本时下载 Temurin。"}</Typography.Text>
            </div> : <Typography.Paragraph type="secondary">使用校验过的 PocketMine 官方 PHP 运行环境，无需 Java。</Typography.Paragraph>}
            <Button onClick={()=>onNavigate(`/games/environments?target=${selectedInstance.nodeId}&return=${selectedInstance.id}`)}>管理运行环境并返回实例</Button>
            <div className="minecraft-actions"><Button type="primary" disabled={!canOperate || (settings.minecraftRuntime.minecraftExecutionMode === "appcontainer" && !selectedInstance.sandboxAvailable) || selectedInstance.nodeStatus !== "online" || !["stopped", "error"].includes(selectedInstance.state)} loading={busy} onClick={() => instanceAction("start")}>启动实例</Button><Button disabled={!canOperate || selectedInstance.nodeStatus !== "online" || selectedInstance.state !== "running"} loading={busy} onClick={() => instanceAction("restart")}>安全重启</Button><Button danger disabled={!canOperate || selectedInstance.nodeStatus !== "online" || !["running", "starting"].includes(selectedInstance.state)} loading={busy} onClick={() => instanceAction("stop")}>安全停止</Button><Button disabled={!canOperate || proxyInstance || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"} onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, "backup"))}>备份世界</Button></div>
            {settings.minecraftRuntime.minecraftExecutionMode === "appcontainer" && !selectedInstance.sandboxAvailable ? <Alert type="error" showIcon message="当前选择 AppContainer，但节点沙盒不可用。可在设置中心选择推荐的本机原生执行。" /> : null}
            {!canOperate ? <Typography.Text type="secondary">当前账户为只读角色，实例操作需要管理员权限。</Typography.Text> : null}
          </Card>
          <Card className="minecraft-card"><Typography.Title level={4}>最近任务</Typography.Title><TaskList userId={canOperate ? userId : ""} onCancel={id=>{void submitAction(()=>cancelMinecraftTask(id),false);}} tasks={tasks.filter((task) => task.instanceId === selectedInstance.id).slice(0, 5)} /></Card>
        </div> : null}
        {detailView === "configuration" && independentCoreConfiguration ? <Alert type="info" showIcon message="此核心使用独立配置格式" description="请通过节点文件管理修改真实配置；停止实例后再修改。" /> : null}
        {detailView === "configuration" && !independentCoreConfiguration ? <Card className="minecraft-card minecraft-config-card"><Typography.Title level={4}>server.properties</Typography.Title><Typography.Paragraph type="secondary">仅提交下列受支持字段。实例必须停止后才能写入；节点未回传的 Minecraft 默认值不会被显示成已测量配置。</Typography.Paragraph>
          <form className="minecraft-property-form" onSubmit={saveProperties}>
            <label>MOTD<Input maxLength={120} value={propertyDraft.motd ?? ""} onChange={(event) => setPropertyDraft((current) => ({ ...current, motd: event.target.value }))} /></label>
            <label>游戏难度<Select value={propertyDraft.difficulty ?? "normal"} options={[{ value: "peaceful", label: "和平" }, { value: "easy", label: "简单" }, { value: "normal", label: "普通" }, { value: "hard", label: "困难" }]} onChange={(difficulty) => setPropertyDraft((current) => ({ ...current, difficulty }))} /></label>
            <label>默认模式<Select value={propertyDraft.gamemode ?? "survival"} options={[{ value: "survival", label: "生存" }, { value: "creative", label: "创造" }, { value: "adventure", label: "冒险" }, { value: "spectator", label: "旁观" }]} onChange={(gamemode) => setPropertyDraft((current) => ({ ...current, gamemode }))} /></label>
            <label>玩家上限<InputNumber min={1} max={200} value={propertyDraft.maxPlayers ?? 20} onChange={(maxPlayers) => setPropertyDraft((current) => ({ ...current, maxPlayers: maxPlayers ?? 20 }))} /></label>
            <label>服务器端口<InputNumber min={1024} max={65535} value={propertyDraft.serverPort ?? settings.minecraftRuntime.minecraftDefaultPort} onChange={(serverPort) => setPropertyDraft((current) => ({ ...current, serverPort: serverPort ?? settings.minecraftRuntime.minecraftDefaultPort }))} /></label>
            <label>视距<InputNumber min={2} max={32} value={propertyDraft.viewDistance ?? 10} onChange={(viewDistance) => setPropertyDraft((current) => ({ ...current, viewDistance: viewDistance ?? 10 }))} /></label>
            <label>模拟距离<InputNumber min={2} max={32} value={propertyDraft.simulationDistance ?? 10} onChange={(simulationDistance) => setPropertyDraft((current) => ({ ...current, simulationDistance: simulationDistance ?? 10 }))} /></label>
            <label>世界名称<Input maxLength={64} value={propertyDraft.levelName ?? "world"} onChange={(event) => setPropertyDraft((current) => ({ ...current, levelName: event.target.value }))} /></label>
            <label>世界种子<Input maxLength={80} value={propertyDraft.levelSeed ?? ""} onChange={(event) => setPropertyDraft((current) => ({ ...current, levelSeed: event.target.value }))} /></label>
            <Checkbox checked={propertyDraft.onlineMode ?? true} onChange={(event) => setPropertyDraft((current) => ({ ...current, onlineMode: event.target.checked }))}>正版验证 online-mode</Checkbox><Checkbox checked={propertyDraft.pvp ?? true} onChange={(event) => setPropertyDraft((current) => ({ ...current, pvp: event.target.checked }))}>允许 PvP</Checkbox><Checkbox checked={propertyDraft.whiteList ?? false} onChange={(event) => setPropertyDraft((current) => ({ ...current, whiteList: event.target.checked }))}>启用白名单</Checkbox>
            <Button type="primary" htmlType="submit" loading={busy} disabled={!canOperate || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"}>保存配置并排入任务</Button>
          </form>
        </Card> : null}
        {detailView === "logs" ? <div className="minecraft-console-layout">
          <Card className="minecraft-card minecraft-logs-card">
            <div className="minecraft-card-heading"><div><Typography.Title level={4}>服务器控制台</Typography.Title><Typography.Text type="secondary">连接后直接操作运行中的服务端 PTY：Tab 补全、方向键、Ctrl+C 和服务端支持的控制台命令由当前核心处理。断开只关闭终端会话，不停止服务器。</Typography.Text></div><Space wrap><Tag color={realtimeStatusColor(realtimeStatus)}>{realtimeStatus === "connected" ? "实时日志已连接" : realtimeStatus === "reconnecting" ? "日志重连中" : realtimeStatus === "connecting" ? "日志连接中" : "日志离线"}</Tag><Tag>{logsInstanceId === selectedInstance.id ? logs.length : 0} 条日志快照</Tag>{terminalSession.terminal?.state === "running" || terminalSession.terminal?.state === "starting" ? <Button size="small" onClick={() => void terminalSession.stop().catch(error => terminalSession.reportError(error))}>断开终端</Button> : <Button size="small" disabled={!canOperate || selectedInstance.nodeStatus !== "online" || selectedInstance.state !== "running" || !selectedInstanceSupportsInteractiveConsole || !!terminalSession.approval} loading={terminalSession.busy} onClick={connectMinecraftTerminal}>连接服务端终端</Button>}</Space></div>
            {terminalSession.error ? <Alert type="error" showIcon message={terminalSession.error} closable onClose={terminalSession.clearError} /> : null}
            {terminalSession.approval ? <Card size="small" className="minecraft-terminal-approval"><Typography.Paragraph>{terminalSession.approval.summary}</Typography.Paragraph><Typography.Text type="secondary">{terminalSession.approval.scopeSummary}</Typography.Text><Space wrap><Button size="small" type="primary" loading={terminalSession.busy} onClick={() => void terminalSession.decide(true)}>批准本次连接</Button><Button size="small" disabled={terminalSession.busy} onClick={() => void terminalSession.decide(false)}>拒绝</Button></Space></Card> : null}
            {!selectedInstanceSupportsInteractiveConsole && selectedInstance.nodeStatus === "online" ? <Alert type="info" showIcon message="当前节点尚未报告交互式 Minecraft 控制台能力；更新并重启节点后可连接原生 PTY。" /> : null}
            <div className="minecraft-server-terminal">
              <TerminalSurface
                key={selectedInstance.id}
                ref={consoleSurface}
                className="minecraft-server-terminal__surface _block_lfaa_wallpaper_terminal"
                ariaLabel="Minecraft 服务端终端输出"
                inputMode="raw"
                inputEnabled={canOperate && selectedInstance.nodeStatus === "online" && selectedInstance.state === "running" && terminalSession.terminal?.state === "running"}
                initialMessage="LFAA Minecraft 服务端控制台\r\n这里显示当前实例的服务端 PTY 输出。连接后按 Enter 发送命令，Tab 请求当前服务端补全；不启动 OS Shell。\r\n连接服务端终端后才能输入；断开连接不会停止服务器。\r\n\r\n"
                onData={terminalSession.send}
                onResize={size => terminalSession.resize(size)}
              />
            </div>
          </Card>
          <aside className="minecraft-console-sidebar" aria-label="控制台实例信息与快捷输入">
            <Card className="minecraft-card minecraft-console-status">
              <div className="minecraft-card-heading"><Typography.Title level={4}>服务器状态</Typography.Title><Tag color={selectedInstance.state === "running" ? "green" : selectedInstance.state === "error" ? "red" : "default"}>{stateLabel(selectedInstance.state)}</Tag></div>
              <dl className="minecraft-overview-server-facts">
                <div><dt>运行节点</dt><dd>{selectedInstance.nodeName} · {selectedInstance.nodeStatus === "online" ? "在线" : "离线"}</dd></div>
                <div><dt>服务端</dt><dd>{selectedInstance.coreType} {selectedInstance.releaseId}</dd></div>
                <div><dt>服务器端口</dt><dd>{selectedInstance.serverProperties.serverPort ?? "未配置"}</dd></div>
                <div><dt>配置内存</dt><dd>{selectedInstance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${selectedInstance.memoryMb} MB`}</dd></div>
              </dl>
            </Card>
          </aside>
        </div> : null}
        {detailView === "backup" && proxyInstance ? <Alert type="info" showIcon message="代理没有世界存档，请到后端实例备份。" /> : null}
        {detailView === "backup" && !proxyInstance ? <Card className="minecraft-card minecraft-backup-card"><Typography.Title level={4}>世界备份</Typography.Title><Typography.Paragraph>为保证存档一致性，当前 MVP 只允许备份已停止实例中的世界目录。备份保存在节点数据目录 `data/backups/minecraft/`，由 Daemon 实际执行。</Typography.Paragraph><Alert type="info" showIcon message="备份操作会复制世界文件；不会清理或覆盖现有世界。" /><Button type="primary" loading={busy} disabled={!canOperate || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"} onClick={() => instanceAction("backup")}>创建世界备份</Button>{selectedInstance.state !== "stopped" ? <Typography.Text type="secondary">请先安全停止实例，再创建备份。</Typography.Text> : null}</Card> : null}
      </> : null}

      {!selectedInstance && currentSection === "overview" ? <>
        <section className="minecraft-overview-hero" aria-label="当前 Minecraft 服务器">
          {overviewInstance ? <>
            <div className="minecraft-overview-hero__copy">
              <span>当前服务器 · {overviewInstance.nodeName}</span>
              <div className="minecraft-overview-hero__title"><Typography.Title level={3}>{overviewInstance.name}</Typography.Title><Tag color={overviewInstance.state === "running" ? "green" : overviewInstance.state === "error" ? "red" : overviewInstance.state === "unknown" ? "orange" : "default"}>{stateLabel(overviewInstance.state)}</Tag></div>
              <Typography.Paragraph>{overviewInstance.coreType} · Minecraft {overviewInstance.releaseId} · {overviewInstance.nodeStatus === "online" ? "节点在线" : "节点离线"}</Typography.Paragraph>
              <div className="minecraft-overview-hero__facts">
                <span><small>节点</small><strong>{overviewInstance.nodeName}</strong></span>
                <span><small>端口</small><strong>{overviewInstance.serverProperties.serverPort ?? "未配置"}</strong></span>
                <span><small>最大内存</small><strong>{overviewInstance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${overviewInstance.memoryMb} MB`}</strong></span>
              </div>
            </div>
            <div className="minecraft-overview-hero__actions" aria-label={`${overviewInstance.name} 快捷操作`}>
              {overviewInstanceCanStart ? <Button type="primary" loading={busy} onClick={() => void submitAction(() => runMinecraftInstanceAction(overviewInstance.id, "start"))}>启动</Button> : null}
              {overviewInstanceCanStop ? <Popconfirm title={`安全停止“${overviewInstance.name}”？`} description="Daemon 会向服务端发送正常停止指令，并按设置中心的停服时限等待退出。" okText="安全停止" cancelText="取消" onConfirm={() => void submitAction(() => runMinecraftInstanceAction(overviewInstance.id, "stop"))}><Button danger loading={busy}>安全停止</Button></Popconfirm> : null}
              {overviewInstanceCanRestart ? <Button loading={busy} onClick={() => void submitAction(() => runMinecraftInstanceAction(overviewInstance.id, "restart"))}>安全重启</Button> : null}
              <Button onClick={() => onNavigate(getInstanceRoute(overviewInstance.id, "logs"))}>控制台</Button>
              <Button onClick={() => onNavigate(getInstanceRoute(overviewInstance.id, "overview"))}>管理实例</Button>
            </div>
          </> : <div className="minecraft-overview-hero__empty">
            <div><Typography.Title level={3}>还没有 Minecraft 实例</Typography.Title><Typography.Paragraph>先确认执行节点在线，再通过部署向导创建服务器。实例和任务状态会在此显示。</Typography.Paragraph></div>
            <Space wrap><Button onClick={() => onNavigate("/games/minecraft/nodes")}>检查节点</Button><Button type="primary" onClick={() => onNavigate("/games/minecraft/deployment")}>开始部署</Button></Space>
          </div>}
        </section>
        <div className="minecraft-stat-grid" role="group" aria-label="Minecraft 管理摘要">
          <button className="minecraft-metric-card lfaa-card-motion" type="button" onClick={() => onNavigate("/apps/minecraft/normal/nodes")} aria-label="查看控制节点状态">
            <span>控制节点</span><strong>{nodesLoaded ? <>{onlineNodeCount} / {nodes.length}</> : "—"}</strong><small>{nodesLoaded ? <>{eligibleNodes.length} 个节点满足部署前置条件</> : "节点状态读取中"}</small>
          </button>
          <button className="minecraft-metric-card lfaa-card-motion" type="button" onClick={() => onNavigate("/apps/minecraft/normal/instances")} aria-label="查看 Minecraft 实例">
            <span>运行实例</span><strong>{overview?.runningCount ?? "—"} / {overview?.instanceCount ?? "—"}</strong><small>运行中 / 总数</small>
          </button>
          <button className="minecraft-metric-card lfaa-card-motion" type="button" onClick={() => onNavigate("/apps/minecraft/normal/tasks")} aria-label="查看 Minecraft 活动任务">
            <span>活动任务</span><strong>{overview?.activeTaskCount ?? "—"}</strong><small>排队中或执行中</small>
          </button>
          <button className="minecraft-metric-card lfaa-card-motion" type="button" onClick={() => onNavigate("/apps/minecraft/normal/deployment")} aria-label="部署最新 Minecraft 正式版">
            <span>官方 Minecraft 版本</span><strong>{overview?.latestRelease ?? "按需获取"}</strong><small>进入部署时读取版本目录</small>
          </button>
        </div>
        <div className="minecraft-overview-meta">
          <span>最近同步：{lastRefreshedAt ? timeLabel(lastRefreshedAt) : "尚未同步"}</span>
          <span>Socket.IO 变更推送 · 在线 30 秒 / 断线 10 秒 REST 对账</span>
          <span>当前未接入 CPU、内存与磁盘性能采样</span>
        </div>
        {nodesLoaded && !eligibleNodes.length ? <Alert
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
          <Card className="minecraft-card minecraft-overview-panel minecraft-overview-server-panel">
            <div className="minecraft-card-heading"><Typography.Title level={4}>服务器状态</Typography.Title><Button type="link" onClick={() => onNavigate("/games/minecraft/instances")}>实例管理</Button></div>
            {overviewInstance ? <dl className="minecraft-overview-server-facts">
              <div><dt>运行状态</dt><dd><Tag color={overviewInstance.state === "running" ? "green" : overviewInstance.state === "error" ? "red" : "default"}>{stateLabel(overviewInstance.state)}</Tag></dd></div>
              <div><dt>执行节点</dt><dd>{overviewInstance.nodeName} · {overviewInstance.nodeStatus === "online" ? "在线" : "离线"}</dd></div>
              <div><dt>服务端版本</dt><dd>{overviewInstance.coreType} {overviewInstance.releaseId}</dd></div>
              <div><dt>服务器端口</dt><dd>{overviewInstance.serverProperties.serverPort ?? "未配置"}</dd></div>
              <div><dt>最大内存</dt><dd>{overviewInstance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${overviewInstance.memoryMb} MB`}</dd></div>
            </dl> : <div className="minecraft-empty">暂无实例状态；请开始部署。</div>}
            <div className="minecraft-overview-node-heading"><Typography.Text strong>Daemon 节点</Typography.Text><Button type="link" onClick={() => onNavigate("/games/minecraft/nodes")}>查看全部</Button></div>
            {!nodesLoaded ? <div className="minecraft-empty">{refreshError ? "节点状态暂不可读。" : "正在读取节点状态…"}</div> : nodes.length ? <div className="minecraft-node-preview-list">
              {nodes.slice(0, 3).map((node) => <button className="minecraft-node-preview lfaa-card-motion" type="button" key={node.id} onClick={() => onNavigate("/games/minecraft/nodes")} aria-label={"查看控制节点 " + node.displayName}>
                <span><strong>{node.displayName}</strong><small>{node.platform} · {node.architecture}</small></span>
                <Tag color={node.status === "online" ? "green" : "default"}>{node.status === "online" ? "在线" : "离线"}</Tag>
                <small>最近心跳 {timeLabel(node.lastSeenAt)}</small>
              </button>)}
            </div> : <div className="minecraft-empty">尚无 Daemon 心跳记录。</div>}
          </Card>
          <Card className="minecraft-card minecraft-overview-panel">
            <div className="minecraft-card-heading"><Typography.Title level={4}>最近事件</Typography.Title><Button type="link" onClick={() => onNavigate("/games/minecraft/tasks")}>查看全部</Button></div>
            {tasksLoaded ? <TaskList userId={canOperate ? userId : ""} onCancel={id=>{void submitAction(()=>cancelMinecraftTask(id),false);}} tasks={tasks.slice(0, 4)} /> : <div className="minecraft-empty">{refreshError ? "任务状态暂不可读。" : "正在读取任务状态…"}</div>}
          </Card>
          <Card className="minecraft-card minecraft-overview-panel minecraft-overview-shortcuts-panel">
            <div className="minecraft-card-heading"><Typography.Title level={4}>快捷入口</Typography.Title></div>
            <div className="minecraft-overview-shortcuts">
              <Button type="primary" onClick={() => onNavigate("/games/minecraft/deployment")}>部署服务器</Button>
              <Button onClick={() => onNavigate("/games/minecraft/instances")}>实例管理</Button>
              <Button onClick={() => onNavigate("/games/minecraft/nodes")}>节点监控</Button>
              <Button onClick={() => onNavigate("/games/minecraft/tasks")}>任务记录</Button>
            </div>
            <Typography.Text type="secondary">仅显示 LFAA 当前已接入的 Minecraft 管理功能。</Typography.Text>
          </Card>
        </div>
      </> : null}

      {!selectedInstance && currentSection === "nodes" ? <>
        {canOperate ? <DaemonConnections /> : null}
        <div className="minecraft-node-monitor-summary" aria-label="Minecraft 节点状态摘要">
          <article><span>在线节点</span><strong>{nodesLoaded ? `${onlineNodeCount} / ${nodes.length}` : "—"}</strong><small>Daemon 最近心跳</small></article>
          <article><span>满足前置条件</span><strong>{nodesLoaded ? eligibleNodes.length : "—"}</strong><small>在线 Windows x64 且能力满足</small></article>
          <article><span>运行实例</span><strong>{nodesLoaded ? instances.filter((instance) => instance.state === "running").length : "—"}</strong><small>来自 Minecraft 实例状态</small></article>
          <article><span>活动任务</span><strong>{tasksLoaded ? taskStatusCounts.queued + taskStatusCounts.running : "—"}</strong><small>排队中或执行中</small></article>
        </div>
        <Alert className="minecraft-node-telemetry-note" type="info" showIcon message="性能采样尚未接入" description="当前可查看 Daemon 心跳、执行能力、实例状态和任务结果；CPU、内存、磁盘 I/O、网络、TPS 与玩家数没有实时采样数据。" />
        <Card className="minecraft-card minecraft-node-management">
          <div className="minecraft-card-heading"><div><Typography.Title level={4}>Minecraft 控制节点</Typography.Title><Typography.Text type="secondary">在线状态与执行能力来自 Daemon 心跳；它们只说明节点满足派发前置条件，不代表 Java 进程已经成功启动。</Typography.Text></div><Tag color={eligibleNodes.length ? "green" : "default"}>{eligibleNodes.length ? <>{eligibleNodes.length} 个节点满足前置条件</> : "暂无符合条件的节点"}</Tag></div>
          {!nodesLoaded ? <div className="minecraft-empty">{refreshError ? "节点状态暂不可读，请刷新后重试。" : "正在读取节点状态…"}</div> : nodes.length ? <div className="minecraft-node-grid">
            {nodes.map((node) => {
              const supportsMinecraft = node.capabilities.includes("minecraft-vanilla");
              const supportsSandbox = node.capabilities.includes("app-sandbox-windows-appcontainer-v1");
              const supportsWindows = node.platform === "win32" && node.architecture === "x64";
              const ready = node.status === "online" && supportsWindows && node.capabilities.includes("minecraft-multicore-v1");
              const latestFailedTask = latestFailedTaskByNode.get(node.id);
              const nodeInstances = instances.filter((instance) => instance.nodeId === node.id);
              return <Card className="minecraft-card minecraft-node-card" key={node.id}>
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
          <Typography.Title level={4}>Minecraft 执行边界</Typography.Title>
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
            <label>Java 运行环境（版本要求：Java {selectedDeployment?.javaMajor ?? "—"}）<Select value={registerJavaRuntimeId} onChange={setRegisterJavaRuntimeId} disabled={!javaNodesLoaded || !registerNodeSupportsJavaSelection} options={[
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
        <div className="minecraft-instance-summary" aria-label="Minecraft 实例状态摘要">
          <article><span>全部实例</span><strong>{instances.length}</strong><small>当前账户可见</small></article>
          <article><span>运行中</span><strong>{instanceStateCounts.running ?? 0}</strong><small>由目标节点回报</small></article>
          <article><span>已停止</span><strong>{instanceStateCounts.stopped ?? 0}</strong><small>可以进入实例管理</small></article>
          <article><span>需核对</span><strong>{(instanceStateCounts.error ?? 0) + (instanceStateCounts.unknown ?? 0)}</strong><small>失败或节点结果未确认</small></article>
        </div>
        <Card className="minecraft-card minecraft-instances-panel">
          <div className="minecraft-card-heading minecraft-instances-heading"><div><Typography.Title level={4}>Minecraft 实例</Typography.Title><Typography.Text type="secondary">共 {instances.length} 个实例 · 状态来自控制端与目标节点</Typography.Text></div><Button type="primary" onClick={() => onNavigate(`${minecraftRoot}/deployment`)}>开始部署</Button></div>
          {instances.length ? <>
            <div className="minecraft-instance-toolbar" role="search">
              <Input aria-label="搜索实例" allowClear value={instanceSearch} onChange={(event) => setInstanceSearch(event.target.value)} placeholder="按名称、核心或节点搜索" />
              <Select aria-label="按实例状态筛选" value={instanceStateFilter} onChange={setInstanceStateFilter} options={[
                { value: "all", label: `全部状态 · ${instances.length}` },
                ...(["running", "stopped", "starting", "stopping", "installing", "error", "unknown"] as const).map((state) => ({ value: state, label: `${stateLabel(state)} · ${instanceStateCounts[state] ?? 0}` }))
              ]} />
            </div>
            {visibleInstances.length ? <div className="minecraft-instance-list">{visibleInstances.map((instance) => {
              const nodeOnline = instance.nodeStatus === "online";
              const canStart = canOperate && nodeOnline && (settings.minecraftRuntime.minecraftExecutionMode !== "appcontainer" || instance.sandboxAvailable) && ["stopped", "error"].includes(instance.state);
              const canStop = canOperate && nodeOnline && ["running", "starting"].includes(instance.state);
              return <Card className="minecraft-card minecraft-instance-card" key={instance.id}>
                <div className="minecraft-instance-card__top"><div className="minecraft-instance-card__identity"><Typography.Title level={5}>{instance.name}</Typography.Title><Tag color={instance.state === "running" ? "green" : instance.state === "error" ? "red" : instance.state === "unknown" ? "orange" : "default"}>{stateLabel(instance.state)}</Tag></div><Typography.Text type="secondary">{instance.coreType} · Minecraft {instance.releaseId}</Typography.Text></div>
                <dl className="minecraft-instance-card__facts">
                  <div><dt>运行节点</dt><dd>{instance.nodeName} · {nodeOnline ? "在线" : "离线"}</dd></div>
                  <div><dt>运行环境</dt><dd>{instance.coreType === "PocketMine" ? "官方 PHP" : `Java ${instance.javaMajor}`}</dd></div>
                  <div><dt>资源配置</dt><dd>{instance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${instance.memoryMb} MB`} · 端口 {instance.serverProperties.serverPort ?? "—"}</dd></div>
                  <div><dt>最近更新</dt><dd>{timeLabel(instance.updatedAt)}</dd></div>
                </dl>
                {!nodeOnline ? <Typography.Text type="secondary">节点离线；当前状态不可核实，操作会保持禁用。</Typography.Text> : null}
                {settings.minecraftRuntime.minecraftExecutionMode === "appcontainer" && !instance.sandboxAvailable ? <Typography.Text type="secondary">此节点的 AppContainer 不可用，启动操作已禁用。</Typography.Text> : null}
                <div className="minecraft-instance-card__actions">
                  <Button type="primary" disabled={!canStart} loading={busy} onClick={() => void submitAction(() => runMinecraftInstanceAction(instance.id, "start"))}>启动</Button>
                  <Popconfirm title={`安全停止“${instance.name}”？`} description="Daemon 会向服务端发送正常停止指令，并按设置中心的停服时限等待退出。" okText="安全停止" cancelText="取消" onConfirm={() => void submitAction(() => runMinecraftInstanceAction(instance.id, "stop"))}>
                    <Button danger disabled={!canStop} loading={busy}>安全停止</Button>
                  </Popconfirm>
                  <Button onClick={() => onNavigate(getInstanceRoute(instance.id, "overview"))}>管理实例</Button>
                  <Popconfirm title={`删除“${instance.name}”？`} description="完整实例文件将移入节点备份归档，再移除登记；不会覆盖已有备份。" okText="归档并删除" cancelText="取消" onConfirm={() => deleteInstance(instance)}><Button danger disabled={!canOperate||!nodeOnline||busy||!["stopped","error","unknown"].includes(instance.state)}>删除实例</Button></Popconfirm>
                </div>
              </Card>;
            })}</div> : <div className="minecraft-empty minecraft-instance-filter-empty"><Typography.Text>没有符合当前搜索和状态筛选的实例。</Typography.Text><Button type="link" onClick={() => { setInstanceSearch(""); setInstanceStateFilter("all"); }}>清除筛选条件</Button></div>}
          </> : <div className="minecraft-instance-onboarding-empty">
            <div><Typography.Title level={5}>还没有 Minecraft 实例</Typography.Title><Typography.Paragraph type="secondary">先确认一个在线节点，然后按向导选择核心、配置实例并完成许可确认。下载、安装和启动状态会在任务中持续更新。</Typography.Paragraph></div>
            {eligibleNodes.length ? <Button type="primary" onClick={() => onNavigate(`${minecraftRoot}/deployment`)}>开始首次部署</Button> : <Button type="primary" onClick={() => onNavigate(`${minecraftRoot}/nodes`)}>检查执行节点</Button>}
          </div>}
          {!canOperate && instances.length ? <Typography.Text className="minecraft-instance-readonly-note" type="secondary">当前账户为只读角色；可查看实例，启动和停止需要管理员权限。</Typography.Text> : null}
        </Card>
      </> : null}

      {!selectedInstance && currentSection === "tasks" ? <>
        <div className="minecraft-task-status-grid" aria-label="Minecraft 任务状态统计">
          {([ ["queued", "排队中"], ["running", "执行中"], ["succeeded", "已完成"], ["failed", "失败"] ] as const).map(([status, label]) => <div className="minecraft-task-status-card" key={status}>
            <span>{label}</span><strong>{taskStatusCounts[status]}</strong>
          </div>)}
        </div>
        <Card className="minecraft-card minecraft-tasks-card">
          <div className="minecraft-card-heading"><div><Typography.Title level={4}>任务记录</Typography.Title><Typography.Text type="secondary">状态和进度来自控制端与目标节点，最近 {tasks.length} 项。</Typography.Text></div><Tag>{tasks.length} 项</Tag></div>
          {!tasksLoaded ? <div className="minecraft-empty">{refreshError ? "任务状态暂不可读，请刷新后重试。" : "正在读取任务状态…"}</div>
            : tasks.length ? <TaskList key={`task-menu:${canOperate ? userId : "read-only"}`} userId={canOperate ? userId : ""} onCancel={(id) => { void submitAction(() => cancelMinecraftTask(id), false); }} onOpenDetails={openTaskDetails} onDelete={removeTaskRecords} canDelete={canOperate} deleting={busy} tasks={tasks} />
              : <div className="minecraft-empty">暂无任务记录。部署、启停、配置和归档操作的执行状态会显示在这里。</div>}
        </Card>
      </> : null}

      {!selectedInstance && currentSection === "workflows" ? <MinecraftWorkflowCanvas userId={userId} /> : null}

      <Modal
        className="minecraft-task-detail-modal"
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

function TaskList({ tasks, userId, onCancel, onOpenDetails, onDelete, canDelete = false, deleting = false }: {
  tasks: MinecraftTask[];
  userId: string;
  onCancel: (id: string) => void;
  onOpenDetails?: (id: string) => void;
  onDelete?: (ids: string[]) => Promise<boolean>;
  canDelete?: boolean;
  deleting?: boolean;
}) {
  const deletableTasks = tasks.filter((task) => task.status === "succeeded" || task.status === "failed");
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
      const currentDeletableIds = tasks.filter((task) => task.status === "succeeded" || task.status === "failed").map((task) => task.id);
      const next = current.filter((id) => currentDeletableIds.includes(id));
      return next.length === current.length ? current : next;
    });
  }, [tasks]);
  useEffect(() => {
    if (!selectionPersistence) return;
    const currentDeletableIds = new Set(tasks.filter((task) => task.status === "succeeded" || task.status === "failed").map((task) => task.id));
    const validSelection = selectedIds.filter((id) => currentDeletableIds.has(id));
    if (validSelection.length) selectionPersistence.write(validSelection);
    else selectionPersistence.remove();
  }, [selectedIds, selectionPersistence, tasks]);
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
          <span className={`minecraft-task-message${task.status === "failed" ? " is-failed" : ""}`}>{task.message}</span>
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
