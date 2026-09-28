/**
 * 功能：呈现 Minecraft 常规模式的真实管理工作台。
 * 作用：读取控制端、官方版本目录和本机 Daemon 数据，并提交受权限控制的实例任务。
 * 关联文件：frontend/src/api.ts、frontend/src/components/ApplicationWorkspace.tsx、frontend/src/components/MinecraftWorkspace.css、frontend/src/shared/scroll-restoration.ts。
 */
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Alert, Button, Card, Checkbox, Input, InputNumber, Select, Spin, Tag, Typography } from "antd";
import {
  createMinecraftInstance,
  getErrorMessage,
  installMinecraftJava,
  loadMinecraftInstances,
  loadMinecraftJava,
  loadMinecraftNodes,
  loadMinecraftOverview,
  loadMinecraftReleases,
  loadMinecraftTasks,
  loadMinecraftInstanceLogs,
  runMinecraftInstanceAction,
  saveMinecraftServerProperties,
  type MinecraftCatalog,
  type MinecraftInstance,
  type MinecraftLog,
  type MinecraftNode,
  type MinecraftServerProperties,
  type MinecraftTask,
  type UserRole
} from "../api.js";
import { createScrollRestorationKey, useScrollRestoration } from "../shared/scroll-restoration.js";
import "./MinecraftWorkspace.css";

interface MinecraftWorkspaceProps {
  userId: string;
  section: string;
  role: UserRole;
  onNavigate: (path: string) => void;
  onContentReady: (ready: boolean) => void;
}

const minecraftRoot = "/apps/minecraft/normal";

function getInstanceRoute(instanceId: string, view: "overview" | "configuration" | "logs" | "backup"): string {
  return `${minecraftRoot}/instance/${encodeURIComponent(instanceId)}/${view}`;
}

function stateLabel(state: MinecraftInstance["state"]): string {
  return ({ installing: "安装中", stopped: "已停止", starting: "启动中", running: "运行中", stopping: "停止中", error: "异常", unknown: "状态未知" })[state];
}

function sandboxStatusLabel(status: MinecraftInstance["sandboxStatus"]): string {
  return ({ unsupported: "节点不支持", unprepared: "待准备", prepared: "已准备", running: "AppContainer 运行中", unknown: "无法核实" })[status];
}

function sandboxStatusColor(status: MinecraftInstance["sandboxStatus"]): string {
  return ({ unsupported: "red", unprepared: "gold", prepared: "green", running: "blue", unknown: "default" })[status];
}

function taskLabel(kind: MinecraftTask["kind"]): string {
  return ({ install: "安装服务端", start: "启动实例", stop: "停止实例", properties: "保存配置", backup: "世界备份", "java-install": "安装 Java" })[kind];
}

function taskStatusLabel(status: MinecraftTask["status"]): string {
  return ({ queued: "排队中", running: "执行中", succeeded: "已完成", failed: "失败" })[status];
}

function timeLabel(value: string): string {
  return new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function MinecraftWorkspace({ userId, section, role, onNavigate, onContentReady }: MinecraftWorkspaceProps) {
  const [overview, setOverview] = useState<{ latestRelease: string; node: MinecraftNode | null; instanceCount: number; runningCount: number; activeTaskCount: number } | null>(null);
  const [nodes, setNodes] = useState<MinecraftNode[]>([]);
  const [catalog, setCatalog] = useState<MinecraftCatalog | null>(null);
  const [javaNodes, setJavaNodes] = useState<Array<{ nodeId: string; nodeName: string; nodeStatus: string; runtimes: MinecraftNode["javaRuntimes"] }>>([]);
  const [instances, setInstances] = useState<MinecraftInstance[]>([]);
  const [tasks, setTasks] = useState<MinecraftTask[]>([]);
  const [logs, setLogs] = useState<MinecraftLog[]>([]);
  const [logsLoaded, setLogsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [instanceName, setInstanceName] = useState("");
  const [nodeId, setNodeId] = useState("");
  const [releaseId, setReleaseId] = useState("");
  const [memoryMb, setMemoryMb] = useState<number | null>(4096);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [javaMajor, setJavaMajor] = useState<number | null>(null);
  const [propertyDraft, setPropertyDraft] = useState<MinecraftServerProperties>({});
  const mounted = useRef(false);
  const refreshSequence = useRef(0);

  const detailMatch = /^instance\/([0-9a-f-]{36})\/(overview|configuration|logs|backup)$/iu.exec(section);
  const selectedInstanceId = detailMatch?.[1] ?? "";
  const detailView = detailMatch?.[2] ?? "overview";
  const selectedInstance = instances.find((item) => item.id === selectedInstanceId) ?? null;
  const logsScroll = useScrollRestoration(
    createScrollRestorationKey(userId, "minecraft-logs", selectedInstanceId),
    !loading && logsLoaded
  );
  const eligibleNodes = useMemo(() => nodes.filter((node) => node.status === "online" && node.platform === "win32" && node.architecture === "x64" && node.capabilities.includes("minecraft-vanilla") && node.capabilities.includes("app-sandbox-windows-appcontainer-v1")), [nodes]);
  const onlineWindowsNodes = nodes.filter((node) => node.status === "online" && node.platform === "win32" && node.architecture === "x64");
  const sandboxNodes = onlineWindowsNodes.filter((node) => node.capabilities.includes("app-sandbox-windows-appcontainer-v1"));
  const currentSection = section === "overview" || section === "instances" || section === "java" || section === "tasks" ? section : detailMatch ? "instances" : "overview";
  const canOperate = role === "admin";

  const refresh = useCallback(async () => {
    const sequence = ++refreshSequence.current;
    const results = await Promise.allSettled([
      loadMinecraftOverview(), loadMinecraftNodes(), loadMinecraftJava(), loadMinecraftInstances(), loadMinecraftTasks()
    ]);
    if (!mounted.current || sequence !== refreshSequence.current) return;
    const failures: string[] = [];
    if (results[0].status === "fulfilled") setOverview(results[0].value.overview); else failures.push(getErrorMessage(results[0].reason));
    if (results[1].status === "fulfilled") setNodes(results[1].value.nodes); else failures.push(getErrorMessage(results[1].reason));
    if (results[2].status === "fulfilled") setJavaNodes(results[2].value.nodes); else failures.push(getErrorMessage(results[2].reason));
    if (results[3].status === "fulfilled") setInstances(results[3].value.instances); else failures.push(getErrorMessage(results[3].reason));
    if (results[4].status === "fulfilled") setTasks(results[4].value.tasks); else failures.push(getErrorMessage(results[4].reason));
    setRefreshError(failures.length ? failures[0] : null);
    setLoading(false);
    onContentReady(true);
  }, [onContentReady]);

  useEffect(() => {
    mounted.current = true;
    let alive = true;
    const runRefresh = () => { if (alive) void refresh(); };
    runRefresh();
    const timer = window.setInterval(runRefresh, 8000);
    return () => { alive = false; mounted.current = false; refreshSequence.current += 1; window.clearInterval(timer); };
  }, [refresh]);

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
    const readLogs = () => void loadMinecraftInstanceLogs(selectedInstanceId).then((result) => { if (alive) setLogs(result.logs); }).catch((error: unknown) => { if (alive) setActionError(getErrorMessage(error)); }).finally(() => {
      if (alive && initialReadPending) {
        initialReadPending = false;
        setLogsLoaded(true);
      }
    });
    readLogs();
    const timer = window.setInterval(readLogs, 4000);
    return () => { alive = false; window.clearInterval(timer); };
  }, [detailView, selectedInstanceId]);

  useEffect(() => {
    if (selectedInstance) setPropertyDraft(selectedInstance.serverProperties);
  }, [selectedInstance?.id]);

  const submitAction = useCallback(async (operation: () => Promise<unknown>, returnToTasks = true) => {
    setBusy(true);
    setActionError(null);
    try {
      await operation();
      await refresh();
      if (returnToTasks) onNavigate(`${minecraftRoot}/tasks`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [onNavigate, refresh]);

  const submitCreate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const selectedNode = nodeId || eligibleNodes[0]?.id;
    const selectedRelease = releaseId || catalog?.latestRelease;
    if (!selectedNode || !selectedRelease || !memoryMb || !eulaAccepted) return;
    void submitAction(() => createMinecraftInstance({ nodeId: selectedNode, name: instanceName, releaseId: selectedRelease, memoryMb, eulaAccepted: true }));
  };

  const instanceAction = (action: "start" | "stop" | "backup") => {
    if (!selectedInstance) return;
    void submitAction(() => runMinecraftInstanceAction(selectedInstance.id, action));
  };

  const saveProperties = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedInstance) return;
    void submitAction(() => saveMinecraftServerProperties(selectedInstance.id, propertyDraft));
  };

  const pageTitle = currentSection === "overview" ? "总览" : currentSection === "instances" ? "实例" : currentSection === "java" ? "Java 环境" : "任务";

  if (loading) return <div className="minecraft-loading" role="status" aria-label="Minecraft 管理工作台加载中"><Spin size="large" /><span>正在读取 Minecraft 主机与实例状态…</span></div>;

  return (
    <section className="minecraft-workspace" aria-labelledby="minecraft-page-title">
      <header className="minecraft-page-heading">
        <div><Typography.Text className="minecraft-eyebrow">MINECRAFT JAVA EDITION · VANILLA</Typography.Text><Typography.Title id="minecraft-page-title" level={2}>{selectedInstance ? selectedInstance.name : pageTitle}</Typography.Title><Typography.Paragraph>{selectedInstance ? `Minecraft ${selectedInstance.releaseId} · ${selectedInstance.nodeName}` : "实例、Java 运行环境和任务状态均来自 LFAA 控制端与本机 Daemon。"}</Typography.Paragraph></div>
        <Button onClick={() => void refresh()}>刷新状态</Button>
      </header>
      {refreshError ? <Alert className="minecraft-alert" type="warning" showIcon message="部分 Minecraft 数据暂时无法读取" description={refreshError} /> : null}
      {catalogError ? <Alert className="minecraft-alert" type="warning" showIcon message="Mojang 官方版本目录暂不可用" description={catalogError} /> : null}
      {actionError ? <Alert className="minecraft-alert" type="error" showIcon closable onClose={() => setActionError(null)} message={actionError} /> : null}

      {selectedInstance ? <>
        <nav className="minecraft-instance-tabs" aria-label="Minecraft 实例菜单">
          {([ ["overview", "实例概览"], ["configuration", "服务器配置"], ["logs", "控制台日志"], ["backup", "世界备份"] ] as const).map(([view, label]) => <button key={view} type="button" aria-current={detailView === view ? "page" : undefined} onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, view))}>{label}</button>)}
        </nav>
        {detailView === "overview" ? <div className="minecraft-detail-grid">
          <Card className="minecraft-card minecraft-instance-summary"><div className="minecraft-card-heading"><div><Typography.Title level={4}>实例状态</Typography.Title><Typography.Text type="secondary">创建于 {timeLabel(selectedInstance.createdAt)}</Typography.Text></div><Tag color={selectedInstance.state === "running" ? "green" : selectedInstance.state === "error" ? "red" : "default"}>{stateLabel(selectedInstance.state)}</Tag></div>
            <dl className="minecraft-facts"><div><dt>服务端</dt><dd>官方 Vanilla · {selectedInstance.releaseId}</dd></div><div><dt>节点</dt><dd>{selectedInstance.nodeName} · {selectedInstance.nodeStatus === "online" ? "在线" : "离线"}</dd></div><div><dt>Java 主版本</dt><dd>{selectedInstance.javaMajor}</dd></div><div><dt>最大内存</dt><dd>{selectedInstance.memoryMb} MB</dd></div><div><dt>AppContainer</dt><dd>{selectedInstance.sandboxAvailable ? sandboxStatusLabel(selectedInstance.sandboxStatus) : "节点未提供 Windows 沙盒"}</dd></div><div><dt>EULA</dt><dd>已于 {timeLabel(selectedInstance.eulaAcceptedAt)} 明确同意</dd></div></dl>
            <div className="minecraft-actions"><Button type="primary" disabled={!canOperate || !selectedInstance.sandboxAvailable || selectedInstance.nodeStatus !== "online" || !["stopped", "error"].includes(selectedInstance.state)} loading={busy} onClick={() => instanceAction("start")}>启动实例</Button><Button danger disabled={!canOperate || selectedInstance.nodeStatus !== "online" || !["running", "starting"].includes(selectedInstance.state)} loading={busy} onClick={() => instanceAction("stop")}>安全停止</Button><Button disabled={!canOperate || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"} onClick={() => onNavigate(getInstanceRoute(selectedInstance.id, "backup"))}>备份世界</Button></div>
            {!selectedInstance.sandboxAvailable ? <Alert type="error" showIcon message="缺少 Windows AppContainer 沙盒，实例启动已禁用。" /> : null}
            {!canOperate ? <Typography.Text type="secondary">当前账户为只读角色，实例操作需要管理员权限。</Typography.Text> : null}
          </Card>
          <Card className="minecraft-card"><Typography.Title level={4}>最近任务</Typography.Title><TaskList tasks={tasks.filter((task) => task.instanceId === selectedInstance.id).slice(0, 5)} /></Card>
        </div> : null}
        {detailView === "configuration" ? <Card className="minecraft-card minecraft-config-card"><Typography.Title level={4}>server.properties</Typography.Title><Typography.Paragraph type="secondary">仅提交下列受支持字段。实例必须停止后才能写入；节点未回传的 Minecraft 默认值不会被显示成已测量配置。</Typography.Paragraph>
          <form className="minecraft-property-form" onSubmit={saveProperties}>
            <label>MOTD<Input maxLength={120} value={propertyDraft.motd ?? ""} onChange={(event) => setPropertyDraft((current) => ({ ...current, motd: event.target.value }))} /></label>
            <label>游戏难度<Select value={propertyDraft.difficulty ?? "normal"} options={[{ value: "peaceful", label: "和平" }, { value: "easy", label: "简单" }, { value: "normal", label: "普通" }, { value: "hard", label: "困难" }]} onChange={(difficulty) => setPropertyDraft((current) => ({ ...current, difficulty }))} /></label>
            <label>默认模式<Select value={propertyDraft.gamemode ?? "survival"} options={[{ value: "survival", label: "生存" }, { value: "creative", label: "创造" }, { value: "adventure", label: "冒险" }, { value: "spectator", label: "旁观" }]} onChange={(gamemode) => setPropertyDraft((current) => ({ ...current, gamemode }))} /></label>
            <label>玩家上限<InputNumber min={1} max={200} value={propertyDraft.maxPlayers ?? 20} onChange={(maxPlayers) => setPropertyDraft((current) => ({ ...current, maxPlayers: maxPlayers ?? 20 }))} /></label>
            <label>服务器端口<InputNumber min={1024} max={65535} value={propertyDraft.serverPort ?? 25565} onChange={(serverPort) => setPropertyDraft((current) => ({ ...current, serverPort: serverPort ?? 25565 }))} /></label>
            <label>视距<InputNumber min={2} max={32} value={propertyDraft.viewDistance ?? 10} onChange={(viewDistance) => setPropertyDraft((current) => ({ ...current, viewDistance: viewDistance ?? 10 }))} /></label>
            <label>模拟距离<InputNumber min={2} max={32} value={propertyDraft.simulationDistance ?? 10} onChange={(simulationDistance) => setPropertyDraft((current) => ({ ...current, simulationDistance: simulationDistance ?? 10 }))} /></label>
            <label>世界名称<Input maxLength={64} value={propertyDraft.levelName ?? "world"} onChange={(event) => setPropertyDraft((current) => ({ ...current, levelName: event.target.value }))} /></label>
            <label>世界种子<Input maxLength={80} value={propertyDraft.levelSeed ?? ""} onChange={(event) => setPropertyDraft((current) => ({ ...current, levelSeed: event.target.value }))} /></label>
            <Checkbox checked={propertyDraft.onlineMode ?? true} onChange={(event) => setPropertyDraft((current) => ({ ...current, onlineMode: event.target.checked }))}>正版验证 online-mode</Checkbox><Checkbox checked={propertyDraft.pvp ?? true} onChange={(event) => setPropertyDraft((current) => ({ ...current, pvp: event.target.checked }))}>允许 PvP</Checkbox><Checkbox checked={propertyDraft.whiteList ?? false} onChange={(event) => setPropertyDraft((current) => ({ ...current, whiteList: event.target.checked }))}>启用白名单</Checkbox>
            <Button type="primary" htmlType="submit" loading={busy} disabled={!canOperate || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"}>保存配置并排入任务</Button>
          </form>
        </Card> : null}
        {detailView === "logs" ? <Card className="minecraft-card minecraft-logs-card"><div className="minecraft-card-heading"><div><Typography.Title level={4}>实例日志</Typography.Title><Typography.Text type="secondary">每 4 秒从控制端刷新；当前未提供任意命令输入。</Typography.Text></div><Tag>{logs.length} 条</Tag></div><div ref={logsScroll.ref} onScroll={logsScroll.onScroll} className="minecraft-log-list" role="log" aria-live="polite">{logs.length ? logs.map((entry) => <p key={entry.id}><time>{timeLabel(entry.createdAt)}</time><span className={`is-${entry.stream}`}>{entry.stream}</span><code>{entry.line}</code></p>) : <div className="minecraft-empty">Daemon 尚未回传日志。</div>}</div></Card> : null}
        {detailView === "backup" ? <Card className="minecraft-card minecraft-backup-card"><Typography.Title level={4}>世界备份</Typography.Title><Typography.Paragraph>为保证存档一致性，当前 MVP 只允许备份已停止实例中的世界目录。备份保存在节点数据目录 `data/backups/minecraft/`，由 Daemon 实际执行。</Typography.Paragraph><Alert type="info" showIcon message="备份操作会复制世界文件；不会清理或覆盖现有世界。" /><Button type="primary" loading={busy} disabled={!canOperate || selectedInstance.state !== "stopped" || selectedInstance.nodeStatus !== "online"} onClick={() => instanceAction("backup")}>创建世界备份</Button>{selectedInstance.state !== "stopped" ? <Typography.Text type="secondary">请先安全停止实例，再创建备份。</Typography.Text> : null}</Card> : null}
      </> : null}

      {!selectedInstance && currentSection === "overview" ? <>
        <div className="minecraft-stat-grid"><Card className="minecraft-stat-card"><span>可用本机节点</span><strong>{overview?.node?.displayName ?? "未连接"}</strong><small>{overview?.node ? `${overview.node.platform} · ${overview.node.architecture}` : "启动 LFAA 本机 Daemon 后显示"}</small></Card><Card className="minecraft-stat-card"><span>最新官方正式版</span><strong>{overview?.latestRelease ?? "暂不可读"}</strong><small>来源：Mojang 官方版本清单</small></Card><Card className="minecraft-stat-card"><span>实例</span><strong>{overview?.instanceCount ?? 0}</strong><small>{overview?.runningCount ?? 0} 个运行中</small></Card><Card className="minecraft-stat-card"><span>活动任务</span><strong>{overview?.activeTaskCount ?? 0}</strong><small>来自控制端任务队列</small></Card></div>
        <Card className="minecraft-card minecraft-sandbox-card"><div className="minecraft-card-heading"><div><Typography.Title level={4}>Minecraft 独立隔离环境</Typography.Title><Typography.Text type="secondary">按实例管理的 Windows AppContainer 与进程资源边界</Typography.Text></div><Tag color={sandboxNodes.length ? "green" : "default"}>{sandboxNodes.length ? `${sandboxNodes.length} 个节点已报告 Host` : "未连接或不可用"}</Tag></div><div className="minecraft-sandbox-grid"><div><strong>实例身份</strong><span>每个实例使用独立 AppContainer 身份，不共用其他 Minecraft 实例身份。</span></div><div><strong>文件范围</strong><span>实例目录读写；受管 Java 运行目录仅读取和执行；写入受低完整性级别约束。</span></div><div><strong>网络能力</strong><span>授予 Internet 与 Private Network 能力；当前没有域名或端口白名单。</span></div><div><strong>进程资源</strong><span>Job Object 限制单进程和内存；Sandbox Host 退出时结束容器内进程。</span></div></div><Alert type="info" showIcon message="常规面板与 AI Work 属于同一个 Minecraft App。切换交互模式不会重启 Java 或更换容器；切换到其他 App 只改变当前工作区，Minecraft 仍留在自己的容器中，直到从实例面板停止。" description={!sandboxNodes.length ? (onlineWindowsNodes.length ? "当前在线 Windows x64 Daemon 未报告可用 AppContainer Host；创建和启动实例会被拒绝。" : "尚无在线 Windows x64 Daemon，因此当前无法确认 OS 沙盒是否可用。") : "本页展示在线 Daemon 的能力探测和实例心跳，不代表尚未执行的目标主机验收。其他尚无真实执行 Host 的 App 不显示为已沙盒。"} /></Card>
        <Card className="minecraft-card minecraft-overview-card"><div><Typography.Title level={4}>开始管理 Minecraft</Typography.Title><Typography.Paragraph>常规模式提供传统管理面板；AI Work 继续使用相同的 AI Runtime 与 Provider，但目前不会调用未注册的 Minecraft 执行工具。</Typography.Paragraph></div><div className="minecraft-actions"><Button type="primary" onClick={() => onNavigate(`${minecraftRoot}/instances`)}>查看实例</Button><Button onClick={() => onNavigate(`${minecraftRoot}/java`)}>检查 Java 环境</Button><Button onClick={() => onNavigate(`${minecraftRoot}/tasks`)}>查看任务</Button></div>{!eligibleNodes.length ? <Alert type="warning" showIcon message="没有可执行 Minecraft 任务的节点" description="需要在线 Windows x64 Daemon 同时报告 Vanilla 执行与 AppContainer 沙盒能力。" /> : null}</Card>
      </> : null}

      {!selectedInstance && currentSection === "instances" ? <>
        <Card className="minecraft-card minecraft-create-card"><Typography.Title level={4}>创建官方 Vanilla 实例</Typography.Title><form className="minecraft-create-form" onSubmit={submitCreate}>
          <label>实例名称<Input required minLength={1} maxLength={48} value={instanceName} onChange={(event) => setInstanceName(event.target.value)} placeholder="例如：生存世界" /></label>
          <label>目标节点<Select value={nodeId || eligibleNodes[0]?.id} onChange={setNodeId} placeholder="选择在线节点" options={eligibleNodes.map((node) => ({ value: node.id, label: node.displayName }))} disabled={!eligibleNodes.length} /></label>
          <label>正式版<Select value={releaseId || catalog?.latestRelease} onChange={setReleaseId} placeholder="读取 Mojang 官方版本" options={(catalog?.releases ?? []).slice(0, 80).map((release) => ({ value: release.id, label: `${release.id} · ${timeLabel(release.releaseTime)}` }))} showSearch optionFilterProp="label" /></label>
          <label>最大内存（MB）<InputNumber min={1024} max={32768} step={512} value={memoryMb} onChange={setMemoryMb} /></label>
          <div className="minecraft-eula"><Checkbox checked={eulaAccepted} onChange={(event) => setEulaAccepted(event.target.checked)}>我已阅读并同意</Checkbox><a href="https://www.minecraft.net/eula" target="_blank" rel="noreferrer">Minecraft EULA</a><Typography.Text type="secondary">确认前不会下载服务端或创建安装任务。</Typography.Text></div>
          <Button type="primary" htmlType="submit" loading={busy} disabled={!canOperate || !eligibleNodes.length || !catalog || !eulaAccepted || !memoryMb}>同意 EULA 并创建安装任务</Button>
        </form>{!eligibleNodes.length ? <Alert type="info" showIcon message={onlineWindowsNodes.length ? "在线节点缺少 Minecraft 沙盒能力" : "Daemon 暂未连接"} description={onlineWindowsNodes.length ? "创建和启动任务只会派发给报告 Windows AppContainer 能力的节点。" : "此页面不会模拟节点或安装进度。启动本机 Daemon 后，在线节点会出现在目标节点列表中。"} /> : null}{!canOperate ? <Typography.Text type="secondary">创建实例需要管理员权限。</Typography.Text> : null}</Card>
        <div className="minecraft-instance-list">{instances.length ? instances.map((instance) => <Card className="minecraft-card minecraft-instance-card" key={instance.id}><div className="minecraft-card-heading"><div><Typography.Title level={5}>{instance.name}</Typography.Title><Typography.Text type="secondary">{instance.releaseId} · {instance.nodeName}</Typography.Text></div><Tag color={instance.state === "running" ? "green" : instance.state === "error" ? "red" : "default"}>{stateLabel(instance.state)}</Tag></div><small>Java {instance.javaMajor} · {instance.memoryMb} MB · 更新于 {timeLabel(instance.updatedAt)}</small><Tag color={sandboxStatusColor(instance.sandboxStatus)}>沙盒：{sandboxStatusLabel(instance.sandboxStatus)}</Tag><Button type="link" onClick={() => onNavigate(getInstanceRoute(instance.id, "overview"))}>打开实例</Button></Card>) : <div className="minecraft-empty">尚无 Minecraft 实例。选择在线节点并同意 EULA 后即可创建。</div>}</div>
      </> : null}

      {!selectedInstance && currentSection === "java" ? <>
        <Card className="minecraft-card"><Typography.Title level={4}>已发现的 Java 运行环境</Typography.Title><Typography.Paragraph type="secondary">环境清单来自在线节点的本机扫描；安装任务使用 Adoptium 官方 API 返回的 JRE，并校验 SHA-256。Minecraft 沙盒只允许使用 LFAA 管理的 Java。</Typography.Paragraph>{javaNodes.length ? javaNodes.map((node) => <section className="minecraft-java-node" key={node.nodeId}><div className="minecraft-card-heading"><strong>{node.nodeName}</strong><Tag color={node.nodeStatus === "online" ? "green" : "default"}>{node.nodeStatus === "online" ? "在线" : "离线"}</Tag></div>{node.runtimes.length ? node.runtimes.map((runtime) => <p key={runtime.runtimeId}>Java {runtime.major} · {runtime.vendor} · {runtime.managed ? "LFAA 管理" : "系统 PATH"}</p>) : <p className="minecraft-empty">未发现 Java 运行环境。</p>}</section>) : <div className="minecraft-empty">尚未收到 Daemon 节点心跳。</div>}</Card>
        <Card className="minecraft-card minecraft-java-install"><Typography.Title level={4}>安装 Temurin JRE</Typography.Title><Typography.Paragraph>填写需要的 Java 主版本。创建实例时也会按 Mojang 官方版本元数据检查兼容版本。</Typography.Paragraph><div className="minecraft-java-install__controls"><Select value={nodeId || eligibleNodes[0]?.id} onChange={setNodeId} placeholder="选择在线节点" options={eligibleNodes.map((node) => ({ value: node.id, label: node.displayName }))} disabled={!eligibleNodes.length} /><InputNumber min={8} max={40} value={javaMajor} onChange={setJavaMajor} placeholder="Java 主版本" /><Button type="primary" loading={busy} disabled={!canOperate || !eligibleNodes.length || !javaMajor} onClick={() => void submitAction(() => installMinecraftJava({ nodeId: nodeId || eligibleNodes[0]!.id, major: javaMajor! }))}>排入安装任务</Button></div></Card>
      </> : null}

      {!selectedInstance && currentSection === "tasks" ? <Card className="minecraft-card minecraft-tasks-card"><Typography.Title level={4}>Minecraft 任务</Typography.Title><TaskList tasks={tasks} /></Card> : null}
    </section>
  );
}

function TaskList({ tasks }: { tasks: MinecraftTask[] }) {
  if (!tasks.length) return <div className="minecraft-empty">暂无任务记录。</div>;
  return <div className="minecraft-task-list">{tasks.map((task) => <article key={task.id}><div><strong>{taskLabel(task.kind)}</strong><span>{task.message}</span><small>{timeLabel(task.createdAt)}</small></div><Tag color={task.status === "succeeded" ? "green" : task.status === "failed" ? "red" : "blue"}>{taskStatusLabel(task.status)}{task.status === "running" ? ` · ${task.progress}%` : ""}</Tag></article>)}</div>;
}
