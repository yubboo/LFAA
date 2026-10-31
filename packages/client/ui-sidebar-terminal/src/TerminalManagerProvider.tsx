/** 功能：在工作区间共享同一套多会话终端管理器。作用：让底部入口与 Minecraft 控制台区域使用同一批独立 PTY 会话和 xterm 表面。关联文件：TaskTerminal.tsx、MinecraftWorkspace.tsx、ui-sidebar-terminal、terminal-controller。 */
import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Alert, Button, Select, Tag } from "antd";
import { createReadPoller } from "lfaa-client-connection/src/read-poller.js";
import { getErrorMessage, hasAdminAccess, loadMinecraftServerTelemetry, loadTerminalNodes, type AiToolApproval, type ApplicationId, type CreateTerminalInput, type MinecraftServerTelemetry, type TerminalInfo, type TerminalNode, type TerminalTarget, type UserRole, type UserSettings } from "lfaa-client-connection/src/api.js";
import { WorkbenchIcon } from "lfaa-client-ui-primitives/src/WorkbenchIcon.js";
import { TerminalSurface, type TerminalSurfaceHandle } from "./TerminalSurface.js";
import { useTerminalSession } from "./useTerminalSession.js";
import "./TerminalManager.css";

export interface MinecraftTerminalDockContext {
  id: string;
  name: string;
  nodeId: string;
  nodeName: string;
  nodeStatus: "online" | "offline";
  state: string;
  supportsConsole: boolean;
  software: string;
  port: number | null;
  memoryLabel: string;
  quickCommands: MinecraftTerminalQuickCommand[];
}

export interface MinecraftTerminalQuickCommand {
  label: string;
  command: string;
}

export interface TerminalManagerDockProps {
  placement: "bottom" | "minecraft";
  appId: ApplicationId;
  sessionId: string | null;
  instance?: MinecraftTerminalDockContext;
  onClose?: () => void;
  onTasks?: () => void;
  onCollapse?: () => void;
}

type DockRegistration = TerminalManagerDockProps & { element: HTMLDivElement };
interface TerminalManagerContextValue {
  activeDock: DockRegistration | null;
  rightPanelContent: ReactNode;
  registerDock(placement: TerminalManagerDockProps["placement"], element: HTMLDivElement, props: TerminalManagerDockProps): () => void;
  updateDock(placement: TerminalManagerDockProps["placement"], element: HTMLDivElement, props: TerminalManagerDockProps): void;
  registerRightPanelContent(content: ReactNode): void;
  settings: UserSettings;
  role: UserRole;
  userId: string;
}

interface TerminalSessionDescriptor {
  id: string;
  nodeId: string;
  appId: ApplicationId;
  sessionId: string | null;
  target: TerminalTarget;
  label: string;
  kind: "shell" | "minecraft-shell" | "minecraft";
  autoStart: boolean;
}

interface SessionStatus {
  terminal?: TerminalInfo;
  approval?: AiToolApproval;
  error: string;
  busy: boolean;
}

function formatServerUptime(startedAt: string | null): string {
  if (!startedAt) return "—";
  const elapsed = Date.now() - Date.parse(startedAt);
  if (!Number.isFinite(elapsed) || elapsed < 0) return "—";
  const minutes = Math.floor(elapsed / 60_000);
  const days = Math.floor(minutes / 1_440);
  const hours = Math.floor((minutes % 1_440) / 60);
  const remainder = minutes % 60;
  return days ? `${days} 天 ${hours} 小时 ${remainder} 分钟` : hours ? `${hours} 小时 ${remainder} 分钟` : `${remainder} 分钟`;
}

const TerminalManagerContext = createContext<TerminalManagerContextValue | null>(null);

export function TerminalManagerProvider({ userId, settings, role, children }: { userId: string; settings: UserSettings; role: UserRole; children: ReactNode }) {
  const docks = useRef(new Map<string, DockRegistration>());
  const parking = useRef<HTMLDivElement>(null);
  const [activeDock, setActiveDock] = useState<DockRegistration | null>(null);
  const [portalRoot, setPortalRoot] = useState<HTMLDivElement | null>(null);
  const [rightPanelContent, setRightPanelContent] = useState<ReactNode>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.createElement("div");
    root.className = "lfaa-terminal-manager-portal";
    setPortalRoot(root);
    return () => root.remove();
  }, [userId]);

  const registerDock = useCallback((placement: TerminalManagerDockProps["placement"], element: HTMLDivElement, props: TerminalManagerDockProps) => {
    const key = placement;
    const entry: DockRegistration = { ...props, placement, element };
    docks.current.set(key, entry);
    const publish = () => {
      const preferred = docks.current.get("minecraft") ?? docks.current.get("bottom") ?? null;
      setActiveDock(current => current === preferred ? current : preferred);
    };
    publish();
    return () => {
      if (docks.current.get(key)?.element !== element) return;
      docks.current.delete(key);
      publish();
    };
  }, []);

  const updateDock = useCallback((placement: TerminalManagerDockProps["placement"], element: HTMLDivElement, props: TerminalManagerDockProps) => {
    if (docks.current.get(placement)?.element !== element) return;
    const entry: DockRegistration = { ...props, placement, element };
    docks.current.set(placement, entry);
    const preferred = docks.current.get("minecraft") ?? docks.current.get("bottom") ?? null;
    setActiveDock(preferred);
  }, []);

  const registerRightPanelContent = useCallback((content: ReactNode) => {
    setRightPanelContent(current => current === content ? current : content);
  }, []);

  useLayoutEffect(() => {
    if (!portalRoot) return;
    const target = activeDock?.element ?? parking.current;
    if (!target) return;
    if (portalRoot.parentElement !== target) target.appendChild(portalRoot);
    const display = activeDock ? "" : "none";
    if (portalRoot.style.display !== display) portalRoot.style.display = display;
  }, [activeDock, portalRoot]);

  const context = useMemo(() => ({ activeDock, rightPanelContent, registerDock, updateDock, registerRightPanelContent, settings, role, userId }), [activeDock, rightPanelContent, registerDock, updateDock, registerRightPanelContent, settings, role, userId]);
  return <TerminalManagerContext.Provider value={context}>
    {children}
    <div ref={parking} className="lfaa-terminal-manager-parking" aria-hidden="true" />
    {portalRoot ? createPortal(<TerminalManagerView dock={activeDock} settings={settings} role={role} />, portalRoot) : null}
  </TerminalManagerContext.Provider>;
}

export function TerminalManagerRightSidebar() {
  const context = useContext(TerminalManagerContext);
  return <>{context?.rightPanelContent ?? null}</>;
}

export function TerminalManagerDock(props: TerminalManagerDockProps) {
  const context = useContext(TerminalManagerContext);
  const host = useRef<HTMLDivElement>(null);
  const registration = useMemo(() => props, [props.placement, props.appId, props.sessionId, props.instance?.id, props.instance?.name, props.instance?.nodeId, props.instance?.nodeName, props.instance?.nodeStatus, props.instance?.state, props.instance?.supportsConsole, props.instance?.software, props.instance?.port, props.instance?.memoryLabel, props.instance?.quickCommands, props.onClose, props.onTasks, props.onCollapse]);
  const registrationRef = useRef(registration);
  registrationRef.current = registration;
  useLayoutEffect(() => {
    if (!context || !host.current) return;
    return context.registerDock(props.placement, host.current, registrationRef.current);
  }, [context?.registerDock, props.placement]);
  useLayoutEffect(() => {
    if (!context || !host.current) return;
    context.updateDock(props.placement, host.current, registration);
  }, [context?.updateDock, props.placement, registration]);
  const active = context?.activeDock;
  return <div ref={host} className={`lfaa-terminal-manager-slot lfaa-terminal-manager-slot--${props.placement}`}>
    {props.placement === "bottom" && active?.placement === "minecraft" ? <span className="lfaa-terminal-manager-slot__note">终端管理器正在 Minecraft 实例控制台区域显示。</span> : null}
  </div>;
}

function TerminalManagerView({ dock, settings, role }: { dock: DockRegistration | null; settings: UserSettings; role: UserRole }) {
  const managerContext = useContext(TerminalManagerContext);
  const [nodes, setNodes] = useState<TerminalNode[]>([]);
  const [nodeError, setNodeError] = useState("");
  const [nodeId, setNodeId] = useState<string>();
  const [sessions, setSessions] = useState<TerminalSessionDescriptor[]>([]);
  const sessionsRef = useRef<TerminalSessionDescriptor[]>([]);
  sessionsRef.current = sessions;
  const [activeId, setActiveId] = useState("");
  const [statuses, setStatuses] = useState<Record<string, SessionStatus>>({});
  const [serverTelemetry, setServerTelemetry] = useState<MinecraftServerTelemetry | null>(null);
  const [serverTelemetryError, setServerTelemetryError] = useState("");
  const [serverTelemetryLoading, setServerTelemetryLoading] = useState(false);
  const serverTelemetryPanelRef = useRef<HTMLElement>(null);
  const sessionSenders = useRef(new Map<string, { send(data: string): void; focus(): void }>());
  const autoAttachInstance = useRef<string | null>(null);
  const autoAttachTarget = useRef<string | null>(null);
  const instance = dock?.placement === "minecraft" ? dock.instance : undefined;
  const registerRightPanelContent = managerContext?.registerRightPanelContent;
  const telemetryInstanceId = instance?.id;
  const telemetryInstanceState = instance?.state;
  const telemetryNodeStatus = instance?.nodeStatus;

  useEffect(() => {
    let alive = true;
    let activeRequest: AbortController | null = null;
    const canRead = Boolean(telemetryInstanceId && telemetryInstanceState === "running" && telemetryNodeStatus === "online");
    setServerTelemetry(null);
    setServerTelemetryError("");
    setServerTelemetryLoading(canRead);
    if (!canRead || !telemetryInstanceId) return () => { alive = false; };

    const isPanelVisible = () => {
      const panel = serverTelemetryPanelRef.current;
      if (!panel?.isConnected) return false;
      const bounds = panel.getBoundingClientRect();
      return bounds.width > 0 && bounds.height > 0 && bounds.right > 0 && bounds.left < window.innerWidth && bounds.bottom > 0 && bounds.top < window.innerHeight;
    };
    const read = async () => {
      if (!alive || !isPanelVisible()) return;
      const controller = new AbortController();
      activeRequest = controller;
      try {
        const result = await loadMinecraftServerTelemetry(telemetryInstanceId, controller.signal);
        if (!alive || controller.signal.aborted) return;
        setServerTelemetry(current => JSON.stringify(current) === JSON.stringify(result.telemetry) ? current : result.telemetry);
        setServerTelemetryError("");
      } catch (error) {
        if (alive && !controller.signal.aborted) setServerTelemetryError(getErrorMessage(error));
      } finally {
        if (activeRequest === controller) activeRequest = null;
        if (alive && !controller.signal.aborted) setServerTelemetryLoading(false);
      }
    };
    const poller = createReadPoller(read, 10_000);
    return () => {
      alive = false;
      activeRequest?.abort();
      poller.stop();
    };
  }, [telemetryInstanceId, telemetryInstanceState, telemetryNodeStatus, managerContext?.userId]);

  const registerMinecraftSender = useCallback((id: string, sender: { send(data: string): void; focus(): void }) => {
    sessionSenders.current.set(id, sender);
    return () => {
      if (sessionSenders.current.get(id) === sender) sessionSenders.current.delete(id);
    };
  }, []);

  const activeMinecraftSession = sessions.find(session => session.id === activeId && session.kind === "minecraft" && statuses[session.id]?.terminal?.state === "running");

  useEffect(() => {
    if (!dock || instance) return;
    let alive = true;
    const poller = createReadPoller(async () => {
      try {
        const result = await loadTerminalNodes();
        if (!alive) return;
        setNodes(current => JSON.stringify(current) === JSON.stringify(result.nodes) ? current : result.nodes);
        setNodeError("");
        const online = result.nodes.filter(node => node.connected);
        if (online.length === 1) setNodeId(current => current ?? online[0]!.id);
      } catch (error) { if (alive) setNodeError(getErrorMessage(error)); }
    }, 10_000);
    return () => { alive = false; poller.stop(); };
  }, [dock?.placement, dock?.appId, Boolean(instance)]);

  const selectedNodeId = instance?.nodeId ?? nodeId;
  const selectedNode = nodes.find(node => node.id === selectedNodeId);
  const nodeOptions = nodes.map(node => ({ value: node.id, label: `${node.displayName}${node.connected ? "" : " · 未连接"}`, disabled: !node.connected }));
  const canCreateShell = Boolean(selectedNodeId && (instance ? instance.nodeStatus === "online" && instance.state !== "installing" && hasAdminAccess(role) : selectedNode?.connected));
  const appendSession = (descriptor: TerminalSessionDescriptor) => {
    const current = sessionsRef.current;
    if (current.length >= 8 || current.some(item => item.id === descriptor.id)) return false;
    const next = [...current, descriptor];
    sessionsRef.current = next;
    setSessions(next);
    setActiveId(descriptor.id);
    return true;
  };

  const createShellTab = () => {
    if (!dock || !selectedNodeId) return;
    if (sessions.length >= 8) { setNodeError("当前窗口已打开 8 个终端标签，请先关闭一个标签。"); return; }
    appendSession({
      id: crypto.randomUUID(), nodeId: selectedNodeId, appId: dock.appId, sessionId: dock.sessionId, target: { kind: "shell" },
      label: `${selectedNode?.displayName ?? "节点"} · 终端`,
      kind: "shell",
      autoStart: true
    });
  };

  const createMinecraftTab = () => {
    if (!dock || !instance || !hasAdminAccess(role)) return false;
    const appended = appendSession({ id: crypto.randomUUID(), nodeId: instance.nodeId, appId: "minecraft", sessionId: null, target: { kind: "minecraft", instanceId: instance.id }, label: instance.name, kind: "minecraft", autoStart: true });
    if (!appended) setNodeError("当前窗口已打开 8 个终端标签，请先关闭一个标签。");
    return appended;
  };

  const createMinecraftShellTab = () => {
    if (!instance || !canCreateShell || !hasAdminAccess(role)) return false;
    const descriptor: TerminalSessionDescriptor = { id: crypto.randomUUID(), nodeId: instance.nodeId, appId: "minecraft", sessionId: null, target: { kind: "minecraft-shell", instanceId: instance.id }, label: `${instance.name} · Shell`, kind: "minecraft-shell", autoStart: true };
    const appended = appendSession(descriptor);
    if (!appended) setNodeError("当前窗口已打开 8 个终端标签，请先关闭一个标签。");
    return appended;
  };

  const closeSessionTab = (id: string) => {
    const next = sessionsRef.current.filter(item => item.id !== id);
    sessionsRef.current = next;
    setSessions(next);
    if (activeId === id) setActiveId(next.at(-1)?.id ?? "");
    setStatuses(current => { const next = { ...current }; delete next[id]; return next; });
  };

  const reportStatus = useCallback((id: string, status: SessionStatus) => {
    setStatuses(current => {
      const previous = current[id];
      if (previous?.terminal?.id === status.terminal?.id && previous?.terminal?.state === status.terminal?.state
        && previous?.approval?.id === status.approval?.id && previous?.error === status.error && previous?.busy === status.busy) return current;
      return { ...current, [id]: status };
    });
  }, []);

  useEffect(() => {
    if (!instance) return;
    const preferredKind = instance.state === "starting" || instance.state === "running" ? "minecraft" : "minecraft-shell";
    const existing = sessions.find(session => session.kind === preferredKind && session.target.kind !== "shell" && session.target.instanceId === instance.id);
    setActiveId(existing?.id ?? "");
  }, [instance?.id]);

  useEffect(() => {
    if (!instance) {
      return;
    }
    if (!canCreateShell || !hasAdminAccess(role)) return;
    const existing = sessions.find(session => session.kind === "minecraft-shell" && session.target.kind === "minecraft-shell" && session.target.instanceId === instance.id);
    if (existing) return;
    createMinecraftShellTab();
  }, [instance?.id, instance?.nodeStatus, instance?.state, canCreateShell, role, sessions]);

  useEffect(() => {
    if (!instance) {
      autoAttachInstance.current = null;
      autoAttachTarget.current = null;
      return;
    }
    if (autoAttachTarget.current !== instance.id) {
      autoAttachTarget.current = instance.id;
      autoAttachInstance.current = null;
    }
    const existing = sessions.find(session => session.kind === "minecraft" && session.target.kind === "minecraft" && session.target.instanceId === instance.id);
    const shell = sessions.find(session => session.kind === "minecraft-shell" && session.target.kind === "minecraft-shell" && session.target.instanceId === instance.id);
    const existingStatus = existing ? statuses[existing.id] : undefined;
    if (["stopped", "error"].includes(instance.state) || existingStatus?.terminal?.state === "exited" || Boolean(existingStatus?.error)) {
      autoAttachInstance.current = ["stopped", "error"].includes(instance.state) ? null : instance.id;
      if (existingStatus?.error) setNodeError(existingStatus.error);
      if (existing) closeSessionTab(existing.id);
      if (shell && activeId !== shell.id) setActiveId(shell.id);
      return;
    }
    if (instance.state === "stopping") {
      if (existing) autoAttachInstance.current = instance.id;
      return;
    }
    if (!["starting", "running"].includes(instance.state) || instance.nodeStatus !== "online") {
      autoAttachInstance.current = null;
      return;
    }
    if (!instance.supportsConsole || !hasAdminAccess(role)) return;
    if (autoAttachInstance.current === instance.id) return;

    if (existing) {
      autoAttachInstance.current = instance.id;
      return;
    }

    if (createMinecraftTab()) autoAttachInstance.current = instance.id;
  }, [instance?.id, instance?.state, instance?.nodeStatus, instance?.supportsConsole, role, sessions, statuses, activeId]);

  const activeMinecraftSessionId = activeMinecraftSession?.id ?? null;
  const sendQuickCommand = useCallback((command: string) => {
    if (!activeMinecraftSessionId || instance?.state !== "running") return;
    const sender = sessionSenders.current.get(activeMinecraftSessionId);
    if (!sender) return;
    sender.send(`${command}\r`);
    window.requestAnimationFrame(() => sender.focus());
  }, [activeMinecraftSessionId, instance?.state]);

  const instanceTerminalUnavailable = instance && !sessions.some(session => session.kind === "minecraft-shell" && session.target.kind === "minecraft-shell" && session.target.instanceId === instance.id)
    ? instance.state === "installing" ? "实例部署期间暂不可打开目录终端。"
      : instance.nodeStatus !== "online" ? "运行节点未连接，无法打开实例终端。"
        : !hasAdminAccess(role) ? "当前账户没有管理权限。"
          : sessions.length >= 8 ? "终端标签已达上限，请先关闭一个标签。"
            : "正在打开实例目录终端…"
    : "";
  const visibleSessions = instance
    ? sessions.filter(session => session.target.kind !== "shell" && session.target.instanceId === instance.id
      && (session.kind === "minecraft-shell" || (!["stopped", "error"].includes(instance.state) && statuses[session.id]?.terminal?.state !== "exited")))
    : sessions;
  const telemetryBadge = !instance || instance.state !== "running" ? "未运行"
    : instance.nodeStatus !== "online" ? "节点离线"
      : serverTelemetryError ? "读取失败"
        : serverTelemetry?.availability === "available" ? "采样正常"
          : serverTelemetry?.availability === "waiting" || serverTelemetryLoading ? "等待采样" : "暂不可用";
  const telemetryTagColor = telemetryBadge === "采样正常" ? "green" : telemetryBadge === "读取失败" ? "red" : "default";
  const paperCore = Boolean(instance?.software.toLocaleLowerCase().startsWith("paper ") || instance?.software.toLocaleLowerCase() === "paper");
  const unavailableTelemetryText = !instance || instance.state !== "running" ? "实例未运行" : instance.nodeStatus !== "online" ? "节点离线" : "暂未获取";
  const onlinePlayersLabel = serverTelemetry?.onlinePlayers !== null && serverTelemetry?.onlinePlayers !== undefined
    ? `${serverTelemetry.onlinePlayers} / ${serverTelemetry.maxPlayers ?? "未公布"}` : unavailableTelemetryText;
  const tpsLabel = serverTelemetry?.tps !== null && serverTelemetry?.tps !== undefined ? `${serverTelemetry.tps.toFixed(1)} TPS`
    : instance?.state !== "running" ? "实例未运行"
      : serverTelemetry?.tpsStatus === "unsupported" || (!paperCore && instance?.state === "running") ? "此核心不提供"
        : serverTelemetry?.tpsStatus === "pending" ? "查询中" : activeMinecraftSessionId ? "等待采样" : "控制台未连接";
  const pingLabel = serverTelemetry?.pingMs !== null && serverTelemetry?.pingMs !== undefined ? `${serverTelemetry.pingMs} ms` : unavailableTelemetryText;
  const versionLabel = serverTelemetry?.advertisedVersion ?? unavailableTelemetryText;
  const uptimeLabel = instance?.state === "running" ? formatServerUptime(serverTelemetry?.processStartedAt ?? null) : "实例未运行";
  const rightPanelContent = useMemo(() => instance ? <section className="lfaa-terminal-manager__right-panel" aria-label="服务器状态和快捷命令">
    <section className="lfaa-terminal-manager__sidebar-card">
      <header><strong>服务器状态</strong><Tag color={instance.state === "running" ? "green" : instance.state === "error" ? "red" : "default"}>{instance.state === "running" ? "运行中" : instance.state === "starting" ? "启动中" : instance.state === "stopping" ? "停止中" : instance.state === "installing" ? "部署中" : instance.state === "error" ? "异常" : "已停止"}</Tag></header>
      <dl>
        <div><dt>运行节点</dt><dd>{instance.nodeName} · {instance.nodeStatus === "online" ? "在线" : "离线"}</dd></div>
        <div><dt>服务端</dt><dd>{instance.software}</dd></div>
        <div><dt>端口</dt><dd>{instance.port ?? "未配置"}</dd></div>
        <div><dt>配置内存</dt><dd>{instance.memoryLabel}</dd></div>
      </dl>
    </section>
    {instance.quickCommands.length ? <section className="lfaa-terminal-manager__sidebar-card">
      <header><strong>快捷命令</strong></header>
      <div className="lfaa-terminal-manager__quick-commands">{instance.quickCommands.map(item => <Button key={item.command} size="small" disabled={!activeMinecraftSessionId || instance.state !== "running"} onClick={() => sendQuickCommand(item.command)}><code>/{item.command}</code><span>{item.label}</span></Button>)}</div>
    </section> : null}
    <section ref={serverTelemetryPanelRef} className="lfaa-terminal-manager__sidebar-card lfaa-terminal-manager__telemetry-card" aria-label="实时运行指标">
      <header><strong>实时运行指标</strong><Tag color={telemetryTagColor}>{telemetryBadge}</Tag></header>
      <dl>
        <div><dt>在线玩家</dt><dd>{onlinePlayersLabel}</dd></div>
        <div><dt>TPS</dt><dd>{tpsLabel}</dd></div>
        <div><dt>节点 Ping</dt><dd>{pingLabel}</dd></div>
        <div className="lfaa-terminal-manager__telemetry-version"><dt>运行版本</dt><dd>{versionLabel}<small>登记版本：{instance.software}</small></dd></div>
        <div><dt>运行时间</dt><dd>{uptimeLabel}</dd></div>
      </dl>
      {serverTelemetryError ? <small className="lfaa-terminal-manager__telemetry-note" role="status">指标读取失败：{serverTelemetryError}</small>
        : paperCore ? <small className="lfaa-terminal-manager__telemetry-note">Paper TPS 使用低频控制台查询，命令输出会保留在服务端控制台。</small>
          : <small className="lfaa-terminal-manager__telemetry-note">TPS 仅在 Paper 核心上提供采样。</small>}
    </section>
  </section> : null, [instance, activeMinecraftSessionId, sendQuickCommand, serverTelemetryError, telemetryBadge, telemetryTagColor, paperCore, onlinePlayersLabel, tpsLabel, pingLabel, versionLabel, uptimeLabel]);

  useLayoutEffect(() => {
    if (!registerRightPanelContent) return;
    registerRightPanelContent(rightPanelContent);
    return () => registerRightPanelContent(null);
  }, [registerRightPanelContent, rightPanelContent]);

  return <section className={`lfaa-terminal-manager${dock?.placement === "minecraft" ? " lfaa-terminal-manager--embedded" : " lfaa-terminal-manager--bottom"}`} aria-label={instance ? "Minecraft 服务端控制台" : "终端管理器"}>
    <div className="lfaa-terminal-manager__layout">
      <main className="lfaa-terminal-manager__main">
    {dock?.placement === "bottom" ? <div className="lfaa-terminal-manager__toolbar">
      {dock?.placement === "bottom" ? <strong className="lfaa-terminal-manager__title"><WorkbenchIcon name="terminal" size={15} />终端管理器</strong> : null}
      {instance ? <span className="lfaa-terminal-manager__context"><strong>{instance.name}</strong><span>{instance.nodeName} · {instance.state === "running" ? "运行中" : instance.state === "installing" ? "部署中" : "已停止"}</span></span> : null}
      {!instance ? <Select aria-label="终端目标节点" value={nodeId} placeholder="选择在线节点" options={nodeOptions} onChange={setNodeId} /> : <Tag>{instance.nodeStatus === "online" ? "节点在线" : "节点离线"}</Tag>}
      <div className="lfaa-terminal-manager__actions">
        {!instance ? <Button size="small" disabled={!canCreateShell || sessions.length >= 8} onClick={createShellTab}>新建终端</Button> : null}
        {dock?.onTasks ? <Button size="small" onClick={dock.onTasks}>任务输出</Button> : null}
        {dock?.onCollapse ? <Button size="small" onClick={dock.onCollapse}>收起</Button> : null}
        {dock?.onClose ? <button className="lfaa-terminal-manager__icon-button" type="button" aria-label="关闭终端面板" onClick={dock.onClose}><WorkbenchIcon name="close" size={15} /></button> : null}
      </div>
    </div> : null}
    {nodeError ? <Alert className="lfaa-terminal-manager__alert" type="error" showIcon message={nodeError} closable onClose={() => setNodeError("")} /> : null}
    <div className="lfaa-terminal-manager__tabs" role="tablist" aria-label="终端会话">
      {visibleSessions.map(session => {
        return <div key={session.id} className={`lfaa-terminal-manager__tab${activeId === session.id ? " is-active" : ""}`} role="presentation">
          <button type="button" role="tab" id={`terminal-tab-${session.id}`} aria-controls={`terminal-panel-${session.id}`} aria-selected={activeId === session.id} onClick={() => setActiveId(session.id)}><span>{session.label}</span></button>
          {!instance ? <button type="button" className="lfaa-terminal-manager__tab-close" aria-label={`关闭 ${session.label}`} onClick={() => closeSessionTab(session.id)}><WorkbenchIcon name="close" size={12} /></button> : null}
        </div>;
      })}
    </div>
    <div className="lfaa-terminal-manager__panes">
      {visibleSessions.map(session => <TerminalSessionPane key={session.id} descriptor={session} active={session.id === activeId} placement={dock?.placement ?? "bottom"} settings={settings} minecraftInstanceState={instance?.state} onStatus={reportStatus} registerMinecraftSender={registerMinecraftSender} />)}
        {instance && !visibleSessions.length
        ? <div className="lfaa-terminal-manager__empty" role="status"><strong>终端暂不可用</strong><span>{instanceTerminalUnavailable}</span></div>
        : !visibleSessions.length ? <div className="lfaa-terminal-manager__empty"><span>无会话</span></div>
          : !visibleSessions.some(session => session.id === activeId) ? <div className="lfaa-terminal-manager__empty"><span>请选择一个终端标签</span></div> : null}
    </div>
      </main>
    </div>
  </section>;
}

function TerminalSessionPane({ descriptor, active, placement, settings, minecraftInstanceState, onStatus, registerMinecraftSender }: { descriptor: TerminalSessionDescriptor; active: boolean; placement: "bottom" | "minecraft"; settings: UserSettings; minecraftInstanceState?: string; onStatus: (id: string, status: SessionStatus) => void; registerMinecraftSender: (id: string, sender: { send(data: string): void; focus(): void }) => () => void }) {
  const surface = useRef<TerminalSurfaceHandle>(null);
  const session = useTerminalSession({ surface, appId: descriptor.appId, sessionId: descriptor.sessionId, permissionsMode: settings.permissions.mode, scopeKey: `terminal-manager:${descriptor.id}`, quietExit: descriptor.kind === "minecraft" });
  const autoStarted = useRef(false);
  const status: SessionStatus = { terminal: session.terminal, approval: session.approval, error: session.error, busy: session.busy };
  const running = session.terminal?.state === "running";
  const sendRef = useRef(session.send);
  sendRef.current = session.send;
  const connecting = session.terminal?.state === "starting" || session.busy;
  const kindLabel = descriptor.kind === "minecraft" ? "服务端控制台" : descriptor.kind === "minecraft-shell" ? "实例 Shell" : "Shell";

  useEffect(() => onStatus(descriptor.id, status), [descriptor.id, session.terminal, session.approval, session.error, session.busy, onStatus]);

  useEffect(() => {
    if (descriptor.kind !== "minecraft" || !running) return;
    const sender = { send: (data: string) => sendRef.current(data), focus: () => surface.current?.focus() };
    return registerMinecraftSender(descriptor.id, sender);
  }, [descriptor.id, descriptor.kind, running, registerMinecraftSender]);

  useEffect(() => {
    if (!active || !running) return;
    const frame = window.requestAnimationFrame(() => surface.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [active, running, placement]);

  useEffect(() => {
    if (!descriptor.autoStart || autoStarted.current) return;
    const timer = window.setTimeout(() => {
      if (autoStarted.current) return;
      autoStarted.current = true;
      const size = surface.current?.getSize() ?? { cols: 80, rows: 24 };
      void session.start({ id: crypto.randomUUID(), nodeId: descriptor.nodeId, appId: descriptor.appId, target: descriptor.target, sessionId: descriptor.sessionId, ...size });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [descriptor.id, descriptor.autoStart]);

  const start = async () => {
    if (session.busy || session.approval) return;
    if (session.terminal?.state === "exited") await session.stop();
    const size = surface.current?.getSize() ?? { cols: 80, rows: 24 };
    const request: CreateTerminalInput = { id: crypto.randomUUID(), nodeId: descriptor.nodeId, appId: descriptor.appId, target: descriptor.target, sessionId: descriptor.sessionId, ...size };
    await session.start(request);
  };

  return <section className="lfaa-terminal-manager__pane" id={`terminal-panel-${descriptor.id}`} role="tabpanel" aria-labelledby={`terminal-tab-${descriptor.id}`} hidden={!active}>
    <div className="lfaa-terminal-manager__session-bar"><span>{kindLabel}{session.terminal ? ` · ${session.terminal.cwd}` : ""}</span><div>
      {!session.terminal || session.terminal.state === "exited" ? descriptor.kind === "minecraft" ? null : <Button size="small" type="primary" disabled={connecting || !!session.approval} loading={connecting} onClick={() => void start().catch(error => session.reportError(error))}>启动 Shell</Button> : descriptor.kind === "minecraft" || (placement === "minecraft" && descriptor.kind === "minecraft-shell") ? null : <Button size="small" onClick={() => void session.stop().catch(error => session.reportError(error))}>断开会话</Button>}
    </div></div>
    {session.error ? <Alert className="lfaa-terminal-manager__alert" type="error" showIcon message={session.error} closable onClose={session.clearError} /> : null}
    {session.approval ? <div className="lfaa-terminal-manager__approval"><p>{session.approval.summary}</p><small>{session.approval.scopeSummary}</small><div><Button size="small" type="primary" loading={session.busy} onClick={() => void session.decide(true)}>批准本次会话</Button><Button size="small" disabled={session.busy} onClick={() => void session.decide(false)}>拒绝</Button></div></div> : null}
    <TerminalSurface ref={surface} className="lfaa-terminal-manager__surface _block_lfaa_wallpaper_terminal" ariaLabel={`${descriptor.label}终端输入和输出`} inputMode="raw" inputEnabled={running && (descriptor.kind !== "minecraft" || !minecraftInstanceState || minecraftInstanceState === "running")} onData={session.send} onResize={size => session.resize(size)} />
  </section>;
}

