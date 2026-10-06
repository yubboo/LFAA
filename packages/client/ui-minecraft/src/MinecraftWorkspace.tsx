/**
 * 功能：呈现 Minecraft 常规模式的真实管理工作台。
 * 作用：读取控制端、官方版本目录和本机 Daemon 数据，并提交受权限控制的实例任务。
 * 关联文件：packages/client/connection/src/api.ts、packages/client/ui-workspace/src/ApplicationWorkspace.tsx、packages/client/ui-minecraft/src/MinecraftWorkspace.css、packages/client/store/src/scroll-restoration.ts。
 */
import { memo, useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { createSnapshotCache } from "lfaa-client-store/src/snapshot-cache.js";
import { Alert, Button, Card, Checkbox, ConfigProvider, Input, InputNumber, Modal, Popconfirm, Progress, Select, Space, Spin, Tag, Typography } from "antd";
import {
  hasAdminAccess,
  forgetMinecraftJavaPath,
  getErrorMessage,
  installMinecraftJava,
  loadMinecraftDeployments,
  loadMinecraftInstances,
  loadMinecraftJava,
  loadMinecraftNodes,
  loadMinecraftOverview,
  loadMinecraftReleases,
  loadMinecraftTasks,
  loadMinecraftInstanceLogs,
  registerMinecraftDeployment,
  retryMinecraftDeployment,
  runMinecraftInstanceAction,
  sendMinecraftConsole,
  saveMinecraftServerProperties,
  saveMinecraftJavaPath,
  setMinecraftInstanceJavaRuntime,
  uninstallMinecraftJava,
  type MinecraftCatalog,
  type MinecraftDeployment,
  type MinecraftInstance,
  type MinecraftLog,
  type MinecraftNode,
  type MinecraftServerProperties,
  type MinecraftTask,
  type UserRole,
  type UserSettings
} from "lfaa-client-connection/src/api.js";
import { createScrollRestorationKey, useScrollRestoration } from "lfaa-client-store/src/scroll-restoration.js";
import { createMinecraftSocket, type MinecraftRealtimeChange } from "lfaa-client-connection/src/minecraft-socket.js";
import "./MinecraftWorkspace.css";
import { MinecraftDeploymentPanel } from "./MinecraftDeploymentPanel.js";
import { MinecraftConnectivityPanel } from "./MinecraftConnectivityPanel.js";
import { DaemonConnections } from "./DaemonConnections.js";
import { MinecraftWorkflowCanvas } from "./MinecraftWorkflowCanvas.js";

interface MinecraftWorkspaceProps {
  userId: string;
  section: string;
  role: UserRole;
  settings: UserSettings;
  onNavigate: (path: string) => void;
  onOpenConnectivity: () => void;
  onContentReady: (ready: boolean) => void;
}

const minecraftRoot = "/apps/minecraft/normal";
const javaCardMajors = [8, 11, 17, 21, 25];
type RealtimeConnectionStatus = "connecting" | "connected" | "reconnecting" | "disconnected";
type MinecraftInstanceFilter = "all" | MinecraftInstance["state"];

interface MinecraftWorkspaceSnapshot {
  overview: { latestRelease: string; node: MinecraftNode | null; instanceCount: number; runningCount: number; activeTaskCount: number };
  nodes: MinecraftNode[];
  javaNodes: Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: MinecraftNode["javaRuntimes"] }>;
  instances: MinecraftInstance[];
  deployments: MinecraftDeployment[];
  tasks: MinecraftTask[];
  refreshedAt: string;
}

const minecraftWorkspaceSnapshots = createSnapshotCache<MinecraftWorkspaceSnapshot>();

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
  return ({ install: "安装服务端", start: "启动实例", stop: "停止实例", restart: "重启实例", console: "控制台指令", properties: "保存配置", backup: "世界备份", "java-install": "Java 环境管理" })[kind];
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

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function MinecraftWorkspaceView({ userId, section, role, settings, onNavigate, onOpenConnectivity, onContentReady }: MinecraftWorkspaceProps) {
  const cachedSnapshot = useRef(minecraftWorkspaceSnapshots.get(userId) ?? null).current;
  const [overview, setOverview] = useState<MinecraftWorkspaceSnapshot["overview"] | null>(() => cachedSnapshot?.overview ?? null);
  const [nodes, setNodes] = useState<MinecraftNode[]>(() => cachedSnapshot?.nodes ?? []);
  const [nodesLoaded, setNodesLoaded] = useState(() => cachedSnapshot !== null);
  const [tasksLoaded, setTasksLoaded] = useState(() => cachedSnapshot !== null);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<string | null>(() => cachedSnapshot?.refreshedAt ?? null);
  const [catalog, setCatalog] = useState<MinecraftCatalog | null>(null);
  const [javaNodes, setJavaNodes] = useState<MinecraftWorkspaceSnapshot["javaNodes"]>(() => cachedSnapshot?.javaNodes ?? []);
  const [instances, setInstances] = useState<MinecraftInstance[]>(() => cachedSnapshot?.instances ?? []);
  const [deployments, setDeployments] = useState<MinecraftDeployment[]>(() => cachedSnapshot?.deployments ?? []);
  const [tasks, setTasks] = useState<MinecraftTask[]>(() => cachedSnapshot?.tasks ?? []);
  const [logs, setLogs] = useState<MinecraftLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [loading, setLoading] = useState(() => cachedSnapshot === null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [realtimeStatus, setRealtimeStatus] = useState<RealtimeConnectionStatus>("connecting");
  const [javaNodeId, setJavaNodeId] = useState("");
  const [memoryMb, setMemoryMb] = useState<number | null>(settings.minecraftRuntime.minecraftDefaultMemoryMb);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [registerDeploymentId, setRegisterDeploymentId] = useState("");
  const [registerJavaRuntimeId, setRegisterJavaRuntimeId] = useState("");
  const [registerModalOpen, setRegisterModalOpen] = useState(false);
  const [javaMajor, setJavaMajor] = useState<number | null>(null);
  const [javaPathModalOpen, setJavaPathModalOpen] = useState(false);
  const [javaPathInput, setJavaPathInput] = useState("");
  const [javaPathRuntimeId, setJavaPathRuntimeId] = useState<string | null>(null);
  const [propertyDraft, setPropertyDraft] = useState<MinecraftServerProperties>({});
  const [consoleCommand, setConsoleCommand] = useState("");
  const [instanceSearch, setInstanceSearch] = useState("");
  const [instanceStateFilter, setInstanceStateFilter] = useState<MinecraftInstanceFilter>("all");
  const mounted = useRef(false);
  const refreshSequence = useRef(0);
  const realtimeSocket = useRef<ReturnType<typeof createMinecraftSocket> | null>(null);
  const readLogsRef = useRef<(() => void) | null>(null);
  const logTarget = useRef({ instanceId: "", view: "overview" });

  const detailMatch = /^instance\/([0-9a-f-]{36})\/(overview|configuration|logs|backup)$/iu.exec(section);
  const selectedInstanceId = detailMatch?.[1] ?? "";
  useEffect(() => { setConsoleCommand(""); }, [selectedInstanceId]);
  const detailView = detailMatch?.[2] ?? "overview";
  logTarget.current = { instanceId: selectedInstanceId, view: detailView };
  const selectedInstance = instances.find((item) => item.id === selectedInstanceId) ?? null;
  const independentCoreConfiguration = selectedInstance && ["BungeeCord", "Velocity", "Nukkit", "PocketMine"].includes(selectedInstance.coreType);
  const proxyInstance = selectedInstance && ["BungeeCord", "Velocity"].includes(selectedInstance.coreType);
  const selectedDeployment = deployments.find((item) => item.id === registerDeploymentId) ?? null;
  const selectedInstanceNode = selectedInstance ? nodes.find((node) => node.id === selectedInstance.nodeId) ?? null : null;
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
  const logsScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "minecraft-logs", selectedInstanceId),
    !loading && logsLoaded
  );
  const eligibleNodes = useMemo(() => nodes.filter((node) => node.status === "online" && node.platform === "win32" && node.architecture === "x64" && node.capabilities.includes("minecraft-multicore-v1")), [nodes]);
  const onlineNodeCount = nodes.filter((node) => node.status === "online").length;
  const onlineWindowsNodes = nodes.filter((node) => node.status === "online" && node.platform === "win32" && node.architecture === "x64");
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
  const canOperate = hasAdminAccess(role);
  const selectedJavaNodeId = onlineWindowsNodes.some((node) => node.id === javaNodeId) ? javaNodeId : onlineWindowsNodes[0]?.id ?? javaNodeId ?? "";
  const selectedJavaNode = nodes.find((node) => node.id === selectedJavaNodeId) ?? null;
  const selectedJavaNodeInfo = javaNodes.find((node) => node.nodeId === selectedJavaNodeId) ?? null;
  const selectedJavaNodeOnline = selectedJavaNode
    ? selectedJavaNode.status === "online" && (selectedJavaNodeInfo?.nodeStatus ?? "online") === "online"
    : selectedJavaNodeInfo?.nodeStatus === "online";
  const selectedJavaRuntimes = selectedJavaNodeOnline ? (selectedJavaNodeInfo?.runtimes ?? selectedJavaNode?.javaRuntimes ?? []) : [];
  const supportsJavaManagement = selectedJavaNode?.capabilities.includes("java-environment-manager-v1") ?? false;

  const snapshotPoller = useRef<ReturnType<typeof createReadPoller> | null>(null);
  const readSnapshot = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const results = await Promise.allSettled([
      loadMinecraftOverview(), loadMinecraftNodes(), loadMinecraftJava(), loadMinecraftInstances(), loadMinecraftTasks(), loadMinecraftDeployments()
    ]);
    if (!mounted.current || sequence !== refreshSequence.current) return;
    const failures: string[] = [];
    if (results[0].status === "fulfilled") setOverview(results[0].value.overview); else failures.push(getErrorMessage(results[0].reason));
    if (results[1].status === "fulfilled") { setNodes(results[1].value.nodes); setNodesLoaded(true); } else failures.push(getErrorMessage(results[1].reason));
    if (results[2].status === "fulfilled") setJavaNodes(results[2].value.nodes); else failures.push(getErrorMessage(results[2].reason));
    if (results[3].status === "fulfilled") setInstances(results[3].value.instances); else failures.push(getErrorMessage(results[3].reason));
    if (results[4].status === "fulfilled") { setTasks(results[4].value.tasks); setTasksLoaded(true); } else failures.push(getErrorMessage(results[4].reason));
    if (results[5].status === "fulfilled") setDeployments(results[5].value.deployments); else failures.push(getErrorMessage(results[5].reason));
    setRefreshError(failures.length ? failures[0] : null);
    if (
      results[0].status === "fulfilled" && results[1].status === "fulfilled"
      && results[2].status === "fulfilled" && results[3].status === "fulfilled"
      && results[4].status === "fulfilled" && results[5].status === "fulfilled"
    ) {
      const refreshedAt = new Date().toISOString();
      setLastRefreshedAt(refreshedAt);
      minecraftWorkspaceSnapshots.set(userId, {
        overview: results[0].value.overview,
        nodes: results[1].value.nodes,
        javaNodes: results[2].value.nodes,
        instances: results[3].value.instances,
        tasks: results[4].value.tasks,
        deployments: results[5].value.deployments,
        refreshedAt,
      });
    }
    setLoading(false);
    onContentReady(true);
  }, [onContentReady, userId]);
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
    const poller = createReadPoller(readSnapshot, 8000);
    snapshotPoller.current = poller;
    return () => {
      mounted.current = false;
      refreshSequence.current += 1;
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
      setRealtimeStatus("connected");
      void refreshRef.current();
      if (logTarget.current.view === "logs") readLogsRef.current?.();
    };
    const onDisconnect = () => {
      if (alive) setRealtimeStatus(socket.active ? "reconnecting" : "disconnected");
    };
    const onConnectError = () => {
      if (alive) setRealtimeStatus(socket.active ? "reconnecting" : "disconnected");
    };
    const onReconnectAttempt = () => {
      if (alive) setRealtimeStatus("reconnecting");
    };
    const onReconnectFailed = () => {
      if (alive) setRealtimeStatus("disconnected");
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
    let alive = true;
    void loadMinecraftReleases().then((result) => { if (alive) { setCatalog(result.catalog); setCatalogError(null); } }).catch((error: unknown) => { if (alive) setCatalogError(getErrorMessage(error)); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!selectedInstanceId || detailView !== "logs") {
      setLogs([]);
      setLogsLoaded(true);
      return;
    }
    let alive = true;
    let initialReadPending = true;
    setLogsLoaded(false);
    const readLogs = () => loadMinecraftInstanceLogs(selectedInstanceId).then((result) => { if (alive) setLogs(result.logs); }).catch((error: unknown) => { if (alive) setActionError(getErrorMessage(error)); }).finally(() => {
      if (alive && initialReadPending) {
        initialReadPending = false;
        setLogsLoaded(true);
      }
    });
    const poller = createReadPoller(readLogs, 4000);
    const trigger = () => { void poller.refresh(); };
    readLogsRef.current = trigger;
    return () => { alive = false; if (readLogsRef.current === trigger) readLogsRef.current = null; poller.stop(); };
  }, [detailView, selectedInstanceId]);

  useEffect(() => {
    if (selectedInstance) setPropertyDraft(selectedInstance.serverProperties);
  }, [selectedInstance?.id]);

  const submitAction = useCallback(async (operation: () => Promise<unknown>, returnToTasks = true): Promise<boolean> => {
    setBusy(true);
    setActionError(null);
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

  const openJavaPathModal = (runtime?: MinecraftNode["javaRuntimes"][number]) => {
    setJavaPathRuntimeId(runtime?.source === "custom" ? runtime.runtimeId : null);
    setJavaPathInput(runtime?.executablePath ?? "");
    setJavaPathModalOpen(true);
  };

  const saveJavaPath = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedJavaNodeId || !javaPathInput.trim()) return;
    void submitAction(() => saveMinecraftJavaPath({
      nodeId: selectedJavaNodeId,
      executablePath: javaPathInput.trim(),
      ...(javaPathRuntimeId ? { runtimeId: javaPathRuntimeId } : {})
    }), false).then((saved) => { if (saved) setJavaPathModalOpen(false); });
  };

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

  const saveProperties = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInstance) return;
    void submitAction(() => saveMinecraftServerProperties(selectedInstance.id, propertyDraft));
  };

  const pageTitle = currentSection === "overview" ? "总览" : currentSection === "nodes" ? "控制节点" : currentSection === "deployment" ? "部署" : currentSection === "instances" ? "实例" : currentSection === "java" ? "Java 环境" : currentSection === "connectivity" ? "世界联机" : "任务";
  const pageDescription = selectedInstance
    ? `Minecraft ${selectedInstance.releaseId} · ${selectedInstance.nodeName}`
    : currentSection === "overview"
      ? "查看 Minecraft 节点、实例和任务。"
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
    <section className="minecraft-workspace" aria-labelledby="minecraft-page-title">
      <header className="minecraft-page-heading">
        <div><Typography.Text className="minecraft-eyebrow">{currentSection === "connectivity" ? "LFAA · MINECRAFT CONNECTIONS" : "MINECRAFT · SERVER MANAGEMENT"}</Typography.Text><Typography.Title id="minecraft-page-title" level={2}>{selectedInstance ? selectedInstance.name : pageTitle}</Typography.Title><Typography.Paragraph>{pageDescription}</Typography.Paragraph></div>
        <Space size="small">
          <Tag role="status" aria-live="polite" color={realtimeStatusColor(realtimeStatus)}>{currentSection === "connectivity" ? `控制端 · ${realtimeStatusLabel(realtimeStatus)}` : realtimeStatusLabel(realtimeStatus)}</Tag>
          {realtimeStatus !== "connected" ? <Button size="small" onClick={reconnectRealtime}>重新连接</Button> : null}
          <Button onClick={() => void refresh()}>刷新状态</Button>
        </Space>
      </header>
      {refreshError ? <Alert className="minecraft-alert" type="warning" showIcon message="部分 Minecraft 数据暂时无法读取" description={refreshError} /> : null}
      {catalogError ? <Alert className="minecraft-alert" type="warning" showIcon message="Mojang 官方版本目录暂不可用" description={catalogError} /> : null}
      {actionError ? <Alert className="minecraft-alert" type="error" showIcon closable onClose={() => setActionError(null)} message={actionError} /> : null}

      {!selectedInstance && currentSection === "connectivity" ? <MinecraftConnectivityPanel onOpenConnectivity={onOpenConnectivity} /> : null}

      {selectedInstance ? <>
        <nav className="minecraft-instance-tabs" aria-label="Minecraft 实例菜单">
          {([ ["overview", "实例概览"], ["configuration", "服务器配置"], ["logs", "控制台日志"], ["backup", "世界备份"] ] as const).map(([view, label]) => <button key={view} type="button" aria-current={detailView === view ? "page" : undefined} onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, view))}>{label}</button>)}
        </nav>
        {detailView === "overview" ? <div className="minecraft-detail-grid">
          <Card className="minecraft-card minecraft-instance-summary"><div className="minecraft-card-heading"><div><Typography.Title level={4}>实例状态</Typography.Title><Typography.Text type="secondary">创建于 {timeLabel(selectedInstance.createdAt)}</Typography.Text></div><Tag color={selectedInstance.state === "running" ? "green" : selectedInstance.state === "error" ? "red" : "default"}>{stateLabel(selectedInstance.state)}</Tag></div>
            <dl className="minecraft-facts"><div><dt>服务端</dt><dd>{selectedInstance.coreType} · {selectedInstance.releaseId}</dd></div><div><dt>节点</dt><dd>{selectedInstance.nodeName} · {selectedInstance.nodeStatus === "online" ? "在线" : "离线"}</dd></div><div><dt>运行环境</dt><dd>{selectedInstance.coreType === "PocketMine" ? "官方 PHP" : `Java ${selectedInstance.javaMajor}`}</dd></div><div><dt>最大内存</dt><dd>{selectedInstance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${selectedInstance.memoryMb} MB`}</dd></div><div><dt>执行方式</dt><dd>{selectedInstance.executionMode === "native" ? "本机原生进程（当前系统账户权限）" : sandboxStatusLabel(selectedInstance.sandboxStatus)}</dd></div><div><dt>EULA</dt><dd>已于 {timeLabel(selectedInstance.eulaAcceptedAt)} 明确同意</dd></div></dl>
            {selectedInstance.coreType !== "PocketMine" ? <div className="minecraft-instance-java-choice">
              <label htmlFor="minecraft-instance-java-runtime">实例 Java 运行环境</label>
              <Select id="minecraft-instance-java-runtime" value={selectedInstance.javaRuntimeId ?? ""} onChange={changeInstanceJavaRuntime} disabled={!canOperate || busy || selectedInstance.nodeStatus !== "online" || !["stopped", "error"].includes(selectedInstance.state) || (!selectedInstanceSupportsJavaSelection && !selectedInstance.javaRuntimeId)} options={[
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
            <div className="minecraft-actions"><Button type="primary" disabled={!canOperate || (settings.minecraftRuntime.minecraftExecutionMode === "appcontainer" && !selectedInstance.sandboxAvailable) || selectedInstance.nodeStatus !== "online" || !["stopped", "error"].includes(selectedInstance.state)} loading={busy} onClick={() => instanceAction("start")}>启动实例</Button><Button disabled={!canOperate || selectedInstance.nodeStatus !== "online" || selectedInstance.state !== "running"} loading={busy} onClick={() => instanceAction("restart")}>安全重启</Button><Button danger disabled={!canOperate || selectedInstance.nodeStatus !== "online" || !["running", "starting"].includes(selectedInstance.state)} loading={busy} onClick={() => instanceAction("stop")}>安全停止</Button><Button disabled={!canOperate || proxyInstance || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"} onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, "backup"))}>备份世界</Button></div>
            {settings.minecraftRuntime.minecraftExecutionMode === "appcontainer" && !selectedInstance.sandboxAvailable ? <Alert type="error" showIcon message="当前选择 AppContainer，但节点沙盒不可用。可在设置中心选择推荐的本机原生执行。" /> : null}
            {!canOperate ? <Typography.Text type="secondary">当前账户为只读角色，实例操作需要管理员权限。</Typography.Text> : null}
          </Card>
          <Card className="minecraft-card"><Typography.Title level={4}>最近任务</Typography.Title><TaskList tasks={tasks.filter((task) => task.instanceId === selectedInstance.id).slice(0, 5)} /></Card>
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
        {detailView === "logs" ? <Card className="minecraft-card minecraft-logs-card"><div className="minecraft-card-heading"><div><Typography.Title level={4}>实例日志</Typography.Title><Typography.Text type="secondary">Socket.IO 收到新日志时刷新，并定期对账；可向当前实例发送服务器指令，执行效果以日志为准。</Typography.Text></div><Tag>{logs.length} 条</Tag></div><Space.Compact block><Input aria-label="Minecraft 控制台命令" value={consoleCommand} maxLength={1024} placeholder="输入服务器指令，例如 list" disabled={!canOperate || selectedInstance.nodeStatus !== "online" || selectedInstance.state !== "running" || busy} onChange={event => setConsoleCommand(event.target.value)} /><Button loading={busy} disabled={!canOperate || selectedInstance.nodeStatus !== "online" || selectedInstance.state !== "running" || !consoleCommand.trim()} onClick={() => void submitAction(() => sendMinecraftConsole(selectedInstance.id, consoleCommand), false).then(saved => { if (saved) setConsoleCommand(""); })}>发送指令</Button></Space.Compact><div ref={logsScroll.ref} onScroll={logsScroll.onScroll} className="minecraft-log-list" role="log" aria-live="polite">{logs.length ? logs.map((entry) => <p key={entry.id}><time>{timeLabel(entry.createdAt)}</time><span className={`is-${entry.stream}`}>{entry.stream}</span><code>{entry.line}</code></p>) : <div className="minecraft-empty">Daemon 尚未回传日志。</div>}</div></Card> : null}
        {detailView === "backup" && proxyInstance ? <Alert type="info" showIcon message="代理没有世界存档，请到后端实例备份。" /> : null}
        {detailView === "backup" && !proxyInstance ? <Card className="minecraft-card minecraft-backup-card"><Typography.Title level={4}>世界备份</Typography.Title><Typography.Paragraph>为保证存档一致性，当前 MVP 只允许备份已停止实例中的世界目录。备份保存在节点数据目录 `data/backups/minecraft/`，由 Daemon 实际执行。</Typography.Paragraph><Alert type="info" showIcon message="备份操作会复制世界文件；不会清理或覆盖现有世界。" /><Button type="primary" loading={busy} disabled={!canOperate || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"} onClick={() => instanceAction("backup")}>创建世界备份</Button>{selectedInstance.state !== "stopped" ? <Typography.Text type="secondary">请先安全停止实例，再创建备份。</Typography.Text> : null}</Card> : null}
      </> : null}

      {!selectedInstance && currentSection === "overview" ? <>
        <div className="minecraft-stat-grid" aria-label="Minecraft 运行监控指标">
          <button className="minecraft-metric-card" type="button" onClick={() => onNavigate("/apps/minecraft/normal/nodes")} aria-label="查看控制节点状态">
            <span>控制节点</span><strong>{nodesLoaded ? <>{onlineNodeCount} / {nodes.length}</> : "—"}</strong><small>{nodesLoaded ? <>{eligibleNodes.length} 个节点满足部署前置条件</> : "节点状态读取中"}</small>
          </button>
          <button className="minecraft-metric-card" type="button" onClick={() => onNavigate("/apps/minecraft/normal/instances")} aria-label="查看 Minecraft 实例">
            <span>运行实例</span><strong>{overview?.runningCount ?? "—"} / {overview?.instanceCount ?? "—"}</strong><small>运行中 / 总数</small>
          </button>
          <button className="minecraft-metric-card" type="button" onClick={() => onNavigate("/apps/minecraft/normal/tasks")} aria-label="查看 Minecraft 活动任务">
            <span>活动任务</span><strong>{overview?.activeTaskCount ?? "—"}</strong><small>排队中或执行中</small>
          </button>
          <button className="minecraft-metric-card" type="button" onClick={() => onNavigate("/apps/minecraft/normal/deployment")} aria-label="部署最新 Minecraft 正式版">
            <span>最新官方正式版</span><strong>{overview?.latestRelease ?? catalog?.latestRelease ?? "—"}</strong><small>进入部署并选择版本</small>
          </button>
        </div>
        <div className="minecraft-overview-meta">
          <span>最近同步：{lastRefreshedAt ? timeLabel(lastRefreshedAt) : "尚未同步"}</span>
          <span>Socket.IO 变更推送 · 每 8 秒 REST 快照对账</span>
          <span>当前未采集主机 CPU、内存与磁盘指标</span>
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
        <div className="minecraft-overview-panels">
          <Card className="minecraft-card minecraft-overview-panel">
            <div className="minecraft-card-heading"><Typography.Title level={4}>控制节点状态</Typography.Title><Button type="link" onClick={() => onNavigate("/apps/minecraft/normal/nodes")}>查看节点</Button></div>
            {!nodesLoaded ? <div className="minecraft-empty">节点状态暂不可读。</div> : nodes.length ? <div className="minecraft-node-preview-list">
              {nodes.slice(0, 4).map((node) => <button className="minecraft-node-preview" type="button" key={node.id} onClick={() => onNavigate("/apps/minecraft/normal/nodes")} aria-label={"查看控制节点 " + node.displayName}>
                <span><strong>{node.displayName}</strong><small>{node.platform} · {node.architecture}</small></span>
                <Tag color={node.status === "online" ? "green" : "default"}>{node.status === "online" ? "在线" : "离线"}</Tag>
                <small>{node.capabilities.includes("app-sandbox-windows-appcontainer-v1") ? "AppContainer 可用" : "AppContainer 未上报"}</small>
              </button>)}
            </div> : <div className="minecraft-empty">尚无 Daemon 心跳记录。</div>}
          </Card>
          <Card className="minecraft-card minecraft-overview-panel">
            <div className="minecraft-card-heading"><Typography.Title level={4}>最近任务</Typography.Title><Button type="link" onClick={() => onNavigate("/apps/minecraft/normal/tasks")}>查看全部</Button></div>
            {tasksLoaded ? <TaskList tasks={tasks.slice(0, 4)} /> : <div className="minecraft-empty">任务状态暂不可读。</div>}
          </Card>
        </div>
      </> : null}

      {!selectedInstance && currentSection === "nodes" ? <>
        {canOperate ? <DaemonConnections /> : null}
        <Card className="minecraft-card minecraft-node-management">
          <div className="minecraft-card-heading"><div><Typography.Title level={4}>Minecraft 控制节点</Typography.Title><Typography.Text type="secondary">在线状态与执行能力来自 Daemon 心跳；它们只说明节点满足派发前置条件，不代表 Java 进程已经成功启动。</Typography.Text></div><Tag color={eligibleNodes.length ? "green" : "default"}>{eligibleNodes.length ? <>{eligibleNodes.length} 个节点满足前置条件</> : "暂无符合条件的节点"}</Tag></div>
          {!nodesLoaded ? <div className="minecraft-empty">节点状态暂不可读，请刷新后重试。</div> : nodes.length ? <div className="minecraft-node-grid">
            {nodes.map((node) => {
              const supportsMinecraft = node.capabilities.includes("minecraft-vanilla");
              const supportsSandbox = node.capabilities.includes("app-sandbox-windows-appcontainer-v1");
              const supportsWindows = node.platform === "win32" && node.architecture === "x64";
              const ready = node.status === "online" && supportsWindows && node.capabilities.includes("minecraft-multicore-v1");
              const latestFailedTask = latestFailedTaskByNode.get(node.id);
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
          <MinecraftDeploymentPanel nodes={nodes} instances={instances} settings={settings} canOperate={canOperate} onSubmit={submitAction} onNavigate={onNavigate} />
          <Card className="minecraft-card minecraft-deployments-card">
            <div className="minecraft-deployments-heading"><div><Typography.Title level={4}>部署记录</Typography.Title><Typography.Text type="secondary">任务进度和结果来自控制端与目标节点。</Typography.Text></div><Tag>{deployments.length}</Tag></div>
            {!deployments.length ? <div className="minecraft-empty">暂无部署记录。</div> : <div className="minecraft-deployment-list">{deployments.map((deployment) => {
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
            <label>Java 运行环境（版本要求：Java {selectedDeployment?.javaMajor ?? "—"}）<Select value={registerJavaRuntimeId} onChange={setRegisterJavaRuntimeId} disabled={!registerNodeSupportsJavaSelection} options={[
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
                  <div><dt>资源配置</dt><dd>{instance.coreType === "PocketMine" ? "由 PHP 核心管理" : `${instance.memoryMb} MB`} · 端口 ${instance.serverProperties.serverPort ?? "—"}</dd></div>
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

      {!selectedInstance && currentSection === "java" ? <>
        <Card className="minecraft-card minecraft-java-manager">
          <div className="minecraft-card-heading"><div><Typography.Title level={4}>Java 环境</Typography.Title><Typography.Paragraph type="secondary">按节点安装到项目数据目录并核对 SHA-256；旧版本没有 JRE 时自动使用 JDK。扫描本机磁盘、PATH、JAVA_HOME 和常见安装目录，电脑上的外部 Java 会显示完整路径。</Typography.Paragraph></div><Button type="primary" onClick={() => openJavaPathModal()} disabled={!canOperate || !supportsJavaManagement || !selectedJavaNodeId || !selectedJavaNodeOnline}>手动添加 Java 路径</Button></div>
          <div className="minecraft-java-node-picker"><label htmlFor="minecraft-java-node">管理节点</label><Select id="minecraft-java-node" value={selectedJavaNodeId || undefined} onChange={setJavaNodeId} placeholder="选择在线 Windows 节点" options={onlineWindowsNodes.map((node) => ({ value: node.id, label: node.displayName }))} disabled={!onlineWindowsNodes.length} /></div>
          {!onlineWindowsNodes.length ? <Alert type="info" showIcon message="没有在线 Windows x64 节点" description="Java 环境由在线 Daemon 在目标电脑上扫描和管理。" /> : null}
          {selectedJavaNode && !selectedJavaNodeOnline ? <Alert type="warning" showIcon message="节点离线，无法核验当前 Java 文件" description="离线节点显示的上次 Java 清单不会被当作当前已安装状态；重启 Daemon 并刷新后会重新扫描。" /> : null}
          {selectedJavaNode && !supportsJavaManagement ? <Alert type="warning" showIcon message="节点需要重启 Daemon 才能启用路径管理和卸载" description="版本卡片下载仍可使用；手动路径和卸载功能将在 Daemon 汇报 Java 环境管理能力后开放。" /> : null}
          <div className="minecraft-java-card-grid">
            {javaCardMajors.map((major) => {
              const installed = selectedJavaRuntimes.find((runtime) => runtime.major === major && runtime.managed);
              const discovered = selectedJavaRuntimes.some((runtime) => runtime.major === major && !runtime.managed);
              const inUse = instances.filter((instance) => instance.nodeId === selectedJavaNodeId && instance.javaMajor === major && (instance.javaRuntimeId === null || instance.javaRuntimeId === `temurin-${major}`) && !["stopped", "error"].includes(instance.state));
              const pending = tasks.some((task) => task.kind === "java-install" && task.nodeId === selectedJavaNodeId && Number(task.payload.javaMajor) === major && ["queued", "running"].includes(task.status));
              return <Card className="minecraft-card minecraft-java-version-card" key={major}>
                <div className="minecraft-card-heading"><div><Typography.Title level={5}>Java {major}</Typography.Title><Typography.Text type="secondary">Eclipse Temurin · Windows x64 · JRE（无 JRE 时回退 JDK）</Typography.Text></div><Tag color={installed ? "green" : discovered ? "blue" : "default"}>{installed ? "LFAA 项目已安装" : discovered ? "电脑已发现" : "未安装"}</Tag></div>
                {installed?.executablePath ? <Typography.Text className="minecraft-java-version-path" title={installed.executablePath}>{installed.executablePath}</Typography.Text> : <Typography.Text className="minecraft-java-version-path">{discovered ? "已发现外部 Java，可在实例中选择使用，无需重复下载。" : "适用于对应版本的 Minecraft 服务端。"}</Typography.Text>}
                <div className="minecraft-java-version-card__actions">
                  {installed ? <Popconfirm title={`卸载项目管理的 Java ${major}？`} description="只删除本项目 data/environments/java 下对应的 Temurin 安装目录，不会删除电脑上其他 Java。使用此版本的已停止实例下次启动前需要重新安装 Java。" okText="卸载" cancelText="取消" onConfirm={() => void submitAction(() => uninstallMinecraftJava({ nodeId: selectedJavaNodeId, major }), false)}>
                    <Button danger block loading={busy || pending} disabled={!canOperate || !supportsJavaManagement || !selectedJavaNodeId || !selectedJavaNodeOnline || pending || inUse.length > 0}>卸载</Button>
                  </Popconfirm> : <Button type="primary" block loading={busy || pending} disabled={!canOperate || !selectedJavaNodeId || !selectedJavaNodeOnline || pending} onClick={() => void submitAction(() => installMinecraftJava({ nodeId: selectedJavaNodeId, major }), false)}>{discovered ? "安装 LFAA 托管版" : "下载并安装"}</Button>}
                  {inUse.length > 0 ? <Typography.Text type="secondary">{inUse.length} 个实例正在使用或状态未确认，暂不能卸载。</Typography.Text> : null}
                </div>
              </Card>;
            })}
          </div>
          <Card className="minecraft-card minecraft-java-custom-card">
            <div className="minecraft-java-custom-card__info"><Typography.Title level={5}>其他 Java 主版本</Typography.Title><Typography.Paragraph type="secondary">需要 Java 8–40 中的其他主版本时，可手动指定；优先下载 JRE，历史版本没有 JRE 时改用同版本 JDK。Adoptium 没有官方工件的版本会给出明确提示。</Typography.Paragraph></div>
            <div className="minecraft-java-install__controls"><InputNumber min={8} max={40} value={javaMajor} onChange={setJavaMajor} placeholder="Java 主版本" /><Button type="primary" loading={busy} disabled={!canOperate || !selectedJavaNodeId || !selectedJavaNodeOnline || !javaMajor || javaCardMajors.includes(javaMajor)} onClick={() => { if (selectedJavaNodeId && javaMajor) void submitAction(() => installMinecraftJava({ nodeId: selectedJavaNodeId, major: javaMajor }), false); }}>下载自定义版本</Button></div>
          </Card>
        </Card>

        <Card className="minecraft-card minecraft-java-detected-card">
          <div className="minecraft-card-heading"><div><Typography.Title level={4}>此电脑已发现的 Java</Typography.Title><Typography.Paragraph type="secondary">扫描固定/可移动磁盘、PATH、JAVA_HOME、Windows 常见安装目录和手动登记路径。每个路径都要能运行 java.exe 并通过版本校验；手动移除只删除 LFAA 的路径记录。</Typography.Paragraph></div><Tag color={selectedJavaNodeOnline ? "green" : "default"}>{selectedJavaNodeInfo?.nodeName ?? selectedJavaNode?.displayName ?? "未选择节点"} · {selectedJavaNodeOnline ? "在线" : "离线"}</Tag></div>
          {!selectedJavaRuntimes.length ? <div className="minecraft-empty">{selectedJavaNode && !selectedJavaNodeOnline ? "节点离线，无法确认上次记录的 Java 是否仍存在。" : "当前节点尚未发现可运行的 Java；可手动添加 `java.exe` 完整路径。"}</div> : <div className="minecraft-java-runtime-list">{selectedJavaRuntimes.map((runtime) => {
            const source = runtime.managed || runtime.source === "managed" ? "LFAA 管理" : runtime.source === "custom" ? "手动路径" : "系统识别";
            return <article className="minecraft-java-runtime" key={runtime.runtimeId}>
              <div className="minecraft-java-runtime__info"><div className="minecraft-java-runtime__heading"><strong>Java {runtime.major} · {runtime.vendor}</strong><Tag color={runtime.managed ? "green" : runtime.source === "custom" ? "blue" : "default"}>{source}</Tag></div><Typography.Text className="minecraft-java-runtime__path" title={runtime.executablePath}>{runtime.executablePath ?? "路径暂不可用"}</Typography.Text></div>
              {!runtime.managed ? <div className="minecraft-java-runtime__actions"><Button disabled={!canOperate || !supportsJavaManagement || !selectedJavaNodeId} onClick={() => openJavaPathModal(runtime.source === "custom" ? runtime : { ...runtime, source: "system" })}>{runtime.source === "custom" ? "更改路径" : "登记路径"}</Button>{runtime.source === "custom" ? <Popconfirm title="移除此 Java 路径记录？" description="只移除 LFAA 的记录，不删除磁盘上的 Java 文件。" okText="移除记录" cancelText="取消" onConfirm={() => void submitAction(() => forgetMinecraftJavaPath(selectedJavaNodeId, runtime.runtimeId), false)}><Button danger disabled={!canOperate || !supportsJavaManagement || busy}>移除记录</Button></Popconfirm> : null}</div> : null}
            </article>;
          })}</div>}
          {!canOperate ? <Typography.Text type="secondary">Java 安装、卸载和路径管理需要管理员权限。</Typography.Text> : null}
        </Card>
        <Modal title={javaPathRuntimeId ? "更改 Java 路径" : "手动添加 Java 路径"} open={javaPathModalOpen} okText={javaPathRuntimeId ? "识别并更新" : "识别并登记"} cancelText="取消" confirmLoading={busy} onCancel={() => setJavaPathModalOpen(false)} onOk={() => document.getElementById("minecraft-java-path-form")?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }))}>
          <form id="minecraft-java-path-form" className="minecraft-java-path-form" onSubmit={saveJavaPath}>
            <Typography.Paragraph type="secondary">输入目标节点上已安装的 `java.exe` 完整路径。Daemon 会运行版本核验并登记外部路径；这不会复制、移动或更改 Java 文件。符合实例版本要求的 Java 可在创建或管理实例时直接选择使用。</Typography.Paragraph>
            <label>节点<Select value={selectedJavaNodeId || undefined} onChange={setJavaNodeId} options={onlineWindowsNodes.map((node) => ({ value: node.id, label: node.displayName }))} disabled={!onlineWindowsNodes.length || Boolean(javaPathRuntimeId)} /></label>
            <label>java.exe 路径<Input autoFocus value={javaPathInput} onChange={(event) => setJavaPathInput(event.target.value)} placeholder="例如 C:\Program Files\Java\jdk-21\bin\java.exe" /></label>
          </form>
        </Modal>
      </> : null}

      {!selectedInstance && currentSection === "tasks" ? <div className="minecraft-task-panels">
          <Card className="minecraft-card minecraft-overview-panel"><div className="minecraft-card-heading"><Typography.Title level={4}>最近部署任务</Typography.Title></div><TaskList tasks={tasks.filter((task) => task.kind === "install").slice(0, 5)} /></Card>
          <Card className="minecraft-card minecraft-tasks-card"><Typography.Title level={4}>全部任务</Typography.Title><TaskList tasks={tasks} /></Card>
      </div> : null}

      {!selectedInstance && currentSection === "workflows" ? <MinecraftWorkflowCanvas userId={userId} /> : null}
    </section>
    </ConfigProvider>
  );
}

export const MinecraftWorkspace = memo(MinecraftWorkspaceView);

function TaskList({ tasks }: { tasks: MinecraftTask[] }) {
  if (!tasks.length) return <div className="minecraft-empty">暂无任务记录。</div>;
  return <div className="minecraft-task-list">{tasks.map((task) => <article key={task.id}>
    <div className="minecraft-task-copy">
      <div className="minecraft-task-heading"><strong>{task.kind === "java-install" ? javaTaskLabel(task) : deploymentTaskLabel(task)}</strong><Tag color={task.result?.forced === true ? "orange" : task.status === "succeeded" ? "green" : task.status === "failed" ? "red" : "blue"}>{task.result?.forced === true ? "已强制停止" : taskStatusLabel(task.status)}{task.status === "running" ? ` · ${task.progress}%` : ""}</Tag></div>
      <span>{task.message}</span>
      <small>{timeLabel(task.createdAt)}</small>
    </div>
  </article>)}</div>;
}
